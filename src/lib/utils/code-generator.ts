import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function generateInquiryCode(): Promise<string> {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  
  // Format: INQ-YYYY-MM-XXXX
  const prefix = `INQ-${year}-${month}-`;
  
  // Find the latest inquiry for this month
  const latestInquiry = await prisma.inquiry.findFirst({
    where: {
      code: {
        startsWith: prefix,
      },
    },
    orderBy: {
      code: 'desc',
    },
  });

  let nextNumber = 1;
  if (latestInquiry) {
    const lastNumber = parseInt(latestInquiry.code.split('-').pop() || '0');
    nextNumber = lastNumber + 1;
  }

  const code = prefix + String(nextNumber).padStart(4, '0');
  return code;
}

export async function generateQuotationCode(): Promise<string> {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  
  // Format: QTN-YYYY-MM-XXXX
  const prefix = `QTN-${year}-${month}-`;
  
  // Find the latest quotation for this month
  const latestQuotation = await prisma.quotation.findFirst({
    where: {
      referenceNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      referenceNumber: 'desc',
    },
  });

  let nextNumber = 1;
  if (latestQuotation) {
    const lastNumber = parseInt(latestQuotation.referenceNumber.split('-').pop() || '0');
    nextNumber = lastNumber + 1;
  }

  const code = prefix + String(nextNumber).padStart(4, '0');
  return code;
}

export async function generateShipmentCode(): Promise<string> {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  
  // Format: SHP-YYYY-MM-XXXX
  const prefix = `SHP-${year}-${month}-`;
  
  // Find the latest shipment for this month
  const latestShipment = await prisma.shipment.findFirst({
    where: {
      referenceNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      referenceNumber: 'desc',
    },
  });

  let nextNumber = 1;
  if (latestShipment) {
    const lastNumber = parseInt(latestShipment.referenceNumber.split('-').pop() || '0');
    nextNumber = lastNumber + 1;
  }

  const code = prefix + String(nextNumber).padStart(4, '0');
  return code;
}

export async function generateCustomerCode(): Promise<string> {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  
  // Format: CUS-YYYY-XXXX
  const prefix = `CUS-${year}-`;
  
  // Find the latest customer for this year
  const latestCustomer = await prisma.customer.findFirst({
    where: {
      id: {
        startsWith: prefix,
      },
    },
    orderBy: {
      id: 'desc',
    },
  });

  let nextNumber = 1;
  if (latestCustomer) {
    const lastNumber = parseInt(latestCustomer.id.split('-').pop() || '0');
    nextNumber = lastNumber + 1;
  }

  const code = prefix + String(nextNumber).padStart(4, '0');
  return code;
}
