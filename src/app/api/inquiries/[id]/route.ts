import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/inquiries/[id] - Get single inquiry
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const inquiry = await prisma.inquiry.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        salesPerson: { select: { id: true, name: true, email: true } },
        operator: { select: { id: true, name: true, email: true } },
        customsAgent: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        sizes: true,
        rates: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
        extras: true,
        offers: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
        communications: {
          include: {
            sender: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        attachments: {
          include: {
            uploadedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        quotations: {
          select: {
            id: true,
            referenceNumber: true,
            status: true,
            totalAmount: true,
            validUntil: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!inquiry) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    return NextResponse.json({ data: inquiry });
  } catch (error) {
    console.error('Error fetching inquiry:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/inquiries/[id] - Update inquiry
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      status,
      sizes,
      rates,
      extras,
    } = body;

    // Check if inquiry exists
    const existingInquiry = await prisma.inquiry.findUnique({
      where: { id: params.id },
    });

    if (!existingInquiry) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    // Update inquiry with related data in a transaction
    const updatedInquiry = await prisma.$transaction(async (tx) => {
      // Update main inquiry
      const inquiry = await tx.inquiry.update({
        where: { id: params.id },
        data: {
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
          validityDate: validityDate ? new Date(validityDate) : null,
          quotationDate: quotationDate ? new Date(quotationDate) : null,
          expectedShipDate: expectedShipDate ? new Date(expectedShipDate) : null,
          included,
          excluded,
          specialNotes,
          salesPersonId,
          operatorId,
          customsAgentId,
          priority,
          status,
          updatedById: session.user.id,
        },
      });

      // Update sizes if provided
      if (sizes) {
        // Delete existing sizes
        await tx.inquirySize.deleteMany({
          where: { inquiryId: params.id },
        });

        // Create new sizes
        if (sizes.length > 0) {
          await tx.inquirySize.createMany({
            data: sizes.map((size: any) => ({
              inquiryId: params.id,
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
      }

      // Update rates if provided
      if (rates) {
        // Soft delete existing rates
        await tx.inquiryRate.updateMany({
          where: { inquiryId: params.id },
          data: { isActive: false },
        });

        // Create new rates
        if (rates.length > 0) {
          await tx.inquiryRate.createMany({
            data: rates.map((rate: any) => ({
              inquiryId: params.id,
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
      }

      // Update extras if provided
      if (extras) {
        // Delete existing extras
        await tx.inquiryExtra.deleteMany({
          where: { inquiryId: params.id },
        });

        // Create new extras
        if (extras.length > 0) {
          await tx.inquiryExtra.createMany({
            data: extras.map((extra: any) => ({
              inquiryId: params.id,
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
      }

      return inquiry;
    });

    // Fetch the complete updated inquiry
    const completeInquiry = await prisma.inquiry.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        salesPerson: { select: { id: true, name: true, email: true } },
        operator: { select: { id: true, name: true, email: true } },
        customsAgent: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        sizes: true,
        rates: { where: { isActive: true } },
        extras: true,
        offers: { where: { isActive: true } },
      },
    });

    return NextResponse.json({
      data: completeInquiry,
      message: 'Inquiry updated successfully',
    });
  } catch (error) {
    console.error('Error updating inquiry:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/inquiries/[id] - Delete (archive) inquiry
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if inquiry exists
    const inquiry = await prisma.inquiry.findUnique({
      where: { id: params.id },
    });

    if (!inquiry) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    // Soft delete by archiving
    await prisma.inquiry.update({
      where: { id: params.id },
      data: {
        isArchived: true,
        updatedById: session.user.id,
      },
    });

    return NextResponse.json({ message: 'Inquiry archived successfully' });
  } catch (error) {
    console.error('Error deleting inquiry:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
