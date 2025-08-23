import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
// import { prisma } from '@/lib/db';
import { z } from 'zod';

// Mock users array for development - remove when database is connected
const mockUsers: any[] = [];

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'USER', 'VIEWER']).default('USER'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = registerSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.format(),
        },
        { status: 400 },
      );
    }

    const { name, email, password, role } = validationResult.data;

    // Check if user already exists (mock implementation)
    const existingUser = mockUsers.find((user) => user.email === email);
    if (existingUser) {
      return NextResponse.json(
        {
          error: 'User with this email already exists',
        },
        { status: 409 },
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user (mock implementation)
    const newUser = {
      id: (mockUsers.length + 1).toString(),
      name,
      email,
      password: hashedPassword,
      role,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockUsers.push(newUser);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = newUser;

    return NextResponse.json(
      {
        success: true,
        message: 'User created successfully',
        data: userWithoutPassword,
      },
      { status: 201 },
    );

    /*
    // Real database implementation (uncomment when DB is ready):
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({
        error: 'User with this email already exists',
      }, { status: 409 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      data: user,
    }, { status: 201 });
    */
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
}
