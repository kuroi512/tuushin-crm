import { NextRequest, NextResponse } from 'next/server';
// import { getServerSession } from 'next-auth';
// import { prisma } from '@/lib/db';
// import { authOptions } from '@/lib/auth';
import { customerCreateSchema, customerQuerySchema } from '@/lib/validations';

// Mock data for development - remove when database is connected
const mockCustomers: any[] = [
  {
    id: '1',
    companyName: 'ТУУШИН ХХК',
    contactPerson: 'Баяртай Батбаяр',
    email: 'bayartai@tuushin.mn',
    phone: '+976 11234567',
    address: 'Ulaanbaatar, Mongolia',
    status: 'ACTIVE',
    customerType: 'COMPANY',
    languagePreference: 'MN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2', 
    companyName: 'Эрдэнэт Үйлдвэр ХХК',
    contactPerson: 'Цагаан Цэрэнбат',
    email: 'tsagaan@erdenet.mn',
    phone: '+976 11234568',
    address: 'Erdenet, Mongolia',
    status: 'ACTIVE',
    customerType: 'COMPANY',
    languagePreference: 'MN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

let mockIdCounter = 3;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryResult = customerQuerySchema.safeParse({
      page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
      per_page: searchParams.get('per_page') ? Number(searchParams.get('per_page')) : 15,
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      customer_type: searchParams.get('customer_type') || undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid query parameters',
        details: queryResult.error.format(),
      }, { status: 400 });
    }

    const { page, per_page, search, status, customer_type } = queryResult.data;

    // For development: return mock data
    let filteredCustomers = [...mockCustomers];

    // Apply filters
    if (search) {
      filteredCustomers = filteredCustomers.filter(customer =>
        customer.companyName.toLowerCase().includes(search.toLowerCase()) ||
        customer.contactPerson?.toLowerCase().includes(search.toLowerCase()) ||
        customer.email?.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (status) {
      filteredCustomers = filteredCustomers.filter(customer => customer.status === status);
    }

    if (customer_type) {
      filteredCustomers = filteredCustomers.filter(customer => customer.customerType === customer_type);
    }

    // Pagination
    const total = filteredCustomers.length;
    const totalPages = Math.ceil(total / per_page);
    const skip = (page - 1) * per_page;
    const customers = filteredCustomers.slice(skip, skip + per_page);

    return NextResponse.json({
      success: true,
      data: {
        data: customers,
        meta: {
          current_page: page,
          per_page,
          total,
          last_page: totalPages,
        },
      },
    });
  } catch (error) {
    console.error('Customer fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = customerCreateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: validationResult.error.format(),
      }, { status: 400 });
    }

    const customerData = validationResult.data;

    // For development: add to mock data
    const newCustomer = {
      id: mockIdCounter.toString(),
      ...customerData,
      status: 'ACTIVE' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    mockCustomers.push(newCustomer);
    mockIdCounter++;

    return NextResponse.json({
      success: true,
      message: 'Customer created successfully',
      data: newCustomer,
    });
  } catch (error) {
    console.error('Customer create error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
