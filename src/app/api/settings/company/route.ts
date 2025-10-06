import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import type { CompanySettingsResponse } from '@/types/company';
import type { Prisma } from '@prisma/client';

const translationSchema = z.object({
  locale: z.string().min(2).max(10),
  displayName: z.string().min(1, 'Display name is required'),
  address: z.string().optional(),
  tagline: z.string().optional(),
  description: z.string().optional(),
  mission: z.string().optional(),
  vision: z.string().optional(),
  additionalInfo: z.record(z.string(), z.any()).optional(),
});

const payloadSchema = z.object({
  legalName: z.string().optional(),
  registrationNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().optional(),
  logoUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  defaultLocale: z.string().min(2).max(10).default('en'),
  translations: z.array(translationSchema).min(1, 'At least one translation is required'),
});

const successResponse = (data: CompanySettingsResponse) =>
  NextResponse.json({ success: true, data });

const asRecord = (value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null => {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
};

export async function GET() {
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const role = normalizeRole(session.user.role);
  if (!hasPermission(role, 'accessDashboard')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const profile = await prisma.companyProfile.findFirst({ include: { translations: true } });
  if (!profile) {
    return successResponse({ profile: null, translations: [] });
  }

  return successResponse({
    profile: {
      id: profile.id,
      legalName: profile.legalName,
      registrationNumber: profile.registrationNumber,
      vatNumber: profile.vatNumber,
      phone: profile.phone,
      email: profile.email,
      website: profile.website,
      logoUrl: profile.logoUrl,
      primaryColor: profile.primaryColor,
      secondaryColor: profile.secondaryColor,
      defaultLocale: profile.defaultLocale,
    },
    translations: profile.translations.map((translation) => ({
      id: translation.id,
      locale: translation.locale,
      displayName: translation.displayName,
      address: translation.address,
      tagline: translation.tagline,
      description: translation.description,
      mission: translation.mission,
      vision: translation.vision,
      additionalInfo: asRecord(translation.additionalInfo),
    })),
  });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const role = normalizeRole(session.user.role);
  if (!hasPermission(role, 'manageCompanySettings')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const json = await request.json();
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const uniqueLocales = new Set<string>();
  for (const translation of data.translations) {
    if (uniqueLocales.has(translation.locale)) {
      return NextResponse.json(
        { success: false, error: `Locale '${translation.locale}' is duplicated.` },
        { status: 400 },
      );
    }
    uniqueLocales.add(translation.locale);
  }

  if (!uniqueLocales.has(data.defaultLocale)) {
    data.defaultLocale = data.translations[0]?.locale ?? 'en';
  }

  const existing = await prisma.companyProfile.findFirst();

  const result = await prisma.$transaction(async (tx) => {
    const base = existing
      ? await tx.companyProfile.update({
          where: { id: existing.id },
          data: {
            legalName: data.legalName,
            registrationNumber: data.registrationNumber,
            vatNumber: data.vatNumber,
            phone: data.phone,
            email: data.email,
            website: data.website,
            logoUrl: data.logoUrl,
            primaryColor: data.primaryColor,
            secondaryColor: data.secondaryColor,
            defaultLocale: data.defaultLocale,
          },
        })
      : await tx.companyProfile.create({
          data: {
            legalName: data.legalName,
            registrationNumber: data.registrationNumber,
            vatNumber: data.vatNumber,
            phone: data.phone,
            email: data.email,
            website: data.website,
            logoUrl: data.logoUrl,
            primaryColor: data.primaryColor,
            secondaryColor: data.secondaryColor,
            defaultLocale: data.defaultLocale,
          },
        });

    await tx.companyProfileTranslation.deleteMany({
      where: {
        companyProfileId: base.id,
        locale: { notIn: Array.from(uniqueLocales) },
      },
    });

    for (const translation of data.translations) {
      await tx.companyProfileTranslation.upsert({
        where: {
          companyProfileId_locale: {
            companyProfileId: base.id,
            locale: translation.locale,
          },
        },
        create: {
          companyProfileId: base.id,
          locale: translation.locale,
          displayName: translation.displayName,
          address: translation.address,
          tagline: translation.tagline,
          description: translation.description,
          mission: translation.mission,
          vision: translation.vision,
          additionalInfo: translation.additionalInfo,
        },
        update: {
          displayName: translation.displayName,
          address: translation.address,
          tagline: translation.tagline,
          description: translation.description,
          mission: translation.mission,
          vision: translation.vision,
          additionalInfo: translation.additionalInfo,
        },
      });
    }

    return base.id;
  });

  const updated = await prisma.companyProfile.findUnique({
    where: { id: result },
    include: { translations: true },
  });

  if (!updated) {
    return successResponse({ profile: null, translations: [] });
  }

  return successResponse({
    profile: {
      id: updated.id,
      legalName: updated.legalName,
      registrationNumber: updated.registrationNumber,
      vatNumber: updated.vatNumber,
      phone: updated.phone,
      email: updated.email,
      website: updated.website,
      logoUrl: updated.logoUrl,
      primaryColor: updated.primaryColor,
      secondaryColor: updated.secondaryColor,
      defaultLocale: updated.defaultLocale,
    },
    translations: updated.translations.map((translation) => ({
      id: translation.id,
      locale: translation.locale,
      displayName: translation.displayName,
      address: translation.address,
      tagline: translation.tagline,
      description: translation.description,
      mission: translation.mission,
      vision: translation.vision,
      additionalInfo: asRecord(translation.additionalInfo),
    })),
  });
}
