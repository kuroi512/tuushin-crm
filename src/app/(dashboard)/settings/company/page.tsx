import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import { CompanySettingsForm } from '@/components/settings/CompanySettingsForm';
import type { CompanySettingsResponse } from '@/types/company';

export const dynamic = 'force-dynamic';

export default async function CompanySettingsPage() {
  const session = await auth();
  if (!session || !session.user) {
    redirect('/login');
  }
  const role = normalizeRole(session.user.role);
  if (!hasPermission(role, 'manageCompanySettings')) {
    redirect('/dashboard');
  }

  const profile = await prisma.companyProfile.findFirst({
    include: { translations: true },
  });

  const initialData: CompanySettingsResponse = profile
    ? {
        profile: {
          id: profile.id,
          legalName: profile.legalName,
          email: profile.email,
          phone: profile.phone,
          fax: (profile as any).fax ?? '',
        },
        translations: profile.translations.map((translation: any) => ({
          id: translation.id,
          locale: translation.locale,
          displayName: translation.displayName,
          address: translation.address,
          tagline: translation.tagline,
          description: translation.description,
          mission: translation.mission,
          vision: translation.vision,
          additionalInfo:
            (translation.additionalInfo as Record<string, unknown> | null | undefined) ?? null,
        })),
      }
    : { profile: null, translations: [] };

  return (
    <div className="space-y-6 px-2 py-4 sm:px-4 md:px-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">Company Settings</h1>
        <p className="text-gray-600">
          Manage company profile, branding, localized information, and print details.
        </p>
      </div>
      <CompanySettingsForm initialData={initialData} />
    </div>
  );
}
