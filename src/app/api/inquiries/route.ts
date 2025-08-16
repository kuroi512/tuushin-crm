import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';
import { generateInquiryCode } from '@/lib/utils/code-generator';

const prisma = new PrismaClient();

// GET /api/inquiries - List all inquiries with filtering and pagination
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

  const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const salesPersonId = searchParams.get('salesPersonId');
    const transportMode = searchParams.get('transportMode');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      isArchived: false,
    };

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { cargoDescription: { contains: search, mode: 'insensitive' } },
        { customer: { companyName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (salesPersonId) where.salesPersonId = salesPersonId;
    if (transportMode) where.transportMode = transportMode;

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }

    // Get inquiries with relations
    const [inquiries, total] = await Promise.all([
      prisma.inquiry.findMany({
        where,
        include: {
          customer: true,
          salesPerson: { select: { id: true, name: true, email: true } },
          operator: { select: { id: true, name: true, email: true } },
          customsAgent: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          sizes: true,
          rates: true,
          extras: true,
          offers: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              communications: true,
              attachments: true,
              quotations: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.inquiry.count({ where }),
    ]);

    return NextResponse.json({
      data: inquiries,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/inquiries - Create new inquiry
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      customerId,
      customerContactPerson,
      commodityType,
      cargoDescription,
      isDangerous,
      requiresPermits,
      transportMode,
      transportType,
      incoterm,
      incotermLocation,
      originCountry,
      originCity,
      originAddress,
      destinationCountry,
      destinationCity,
      destinationAddress,
      viaRoute,
      borderCrossing,
      validityDate,
      quotationDate,
      expectedShipDate,
      included,
      excluded,
      specialNotes,
      salesPersonId,
      operatorId,
      customsAgentId,
      priority,
      sizes,
      rates,
      extras,
    } = body;

    // Validate required fields
    if (!name || !customerId || !commodityType || !transportMode || !incoterm) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate inquiry code
    const code = await generateInquiryCode();

    // Create inquiry with related data in a transaction
    const inquiry = await prisma.$transaction(async (tx) => {
      // Create main inquiry
      const newInquiry = await tx.inquiry.create({
        data: {
          code,
          name,
          customerId,
          customerContactPerson,
          commodityType,
          cargoDescription,
          isDangerous: isDangerous || false,
          requiresPermits: requiresPermits || false,
          transportMode,
          transportType,
          incoterm,
          incotermLocation,
          originCountry,
          originCity,
          originAddress,
          destinationCountry,
          destinationCity,
          destinationAddress,
          viaRoute,
          borderCrossing,
          validityDate: validityDate ? new Date(validityDate) : null,
          quotationDate: quotationDate ? new Date(quotationDate) : null,
          expectedShipDate: expectedShipDate ? new Date(expectedShipDate) : null,
          included,
          excluded,
          specialNotes,
          salesPersonId,
          operatorId,
          customsAgentId,
          priority: priority || 'MEDIUM',
          status: 'DRAFT',
          createdById: session.user.id,
        },
      });

      // Create sizes if provided
      if (sizes && sizes.length > 0) {
        await tx.inquirySize.createMany({
          data: sizes.map((size: any) => ({
            inquiryId: newInquiry.id,
            containerType: size.containerType,
            quantity: size.quantity,
            length: size.length,
            width: size.width,
            height: size.height,
            weight: size.weight,
            volume: size.volume,
            unit: size.unit || 'CBM',
          })),
        });
      }

      // Create rates if provided
      if (rates && rates.length > 0) {
        await tx.inquiryRate.createMany({
          data: rates.map((rate: any) => ({
            inquiryId: newInquiry.id,
            rateType: rate.rateType,
            carrierId: rate.carrierId,
            carrierName: rate.carrierName,
            routeId: rate.routeId,
            currency: rate.currency || 'USD',
            freightRate: rate.freightRate,
            fuelSurcharge: rate.fuelSurcharge,
            securityFee: rate.securityFee,
            handlingFee: rate.handlingFee,
            documentFee: rate.documentFee,
            insuranceFee: rate.insuranceFee,
            customsFee: rate.customsFee,
            terminalFee: rate.terminalFee,
            otherFees: rate.otherFees,
            totalCost: rate.totalCost,
            transitTime: rate.transitTime,
            validFrom: rate.validFrom ? new Date(rate.validFrom) : null,
            validTo: rate.validTo ? new Date(rate.validTo) : null,
            notes: rate.notes,
          })),
        });
      }

      // Create extras if provided
      if (extras && extras.length > 0) {
        await tx.inquiryExtra.createMany({
          data: extras.map((extra: any) => ({
            inquiryId: newInquiry.id,
            serviceType: extra.serviceType,
            serviceName: extra.serviceName,
            description: extra.description,
            providerId: extra.providerId,
            providerName: extra.providerName,
            currency: extra.currency || 'USD',
            unitPrice: extra.unitPrice,
            quantity: extra.quantity || 1,
            totalCost: extra.totalCost,
            isRequired: extra.isRequired || false,
            isIncluded: extra.isIncluded || false,
          })),
        });
      }

      return newInquiry;
    });

    // Fetch the complete inquiry with relations
    const completeInquiry = await prisma.inquiry.findUnique({
      where: { id: inquiry.id },
      include: {
        customer: true,
        salesPerson: { select: { id: true, name: true, email: true } },
        operator: { select: { id: true, name: true, email: true } },
        customsAgent: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        sizes: true,
        rates: true,
        extras: true,
      },
    });

    return NextResponse.json({
      data: completeInquiry,
      message: 'Inquiry created successfully',
    });
  } catch (error) {
    console.error('Error creating inquiry:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
