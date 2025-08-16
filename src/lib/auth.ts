import { NextAuthOptions, getServerSession } from 'next-auth';
// import { PrismaAdapter } from '@auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
// import { prisma } from '@/lib/db';

// Mock users for development - remove when database is connected
const mockUsers = [
  {
    id: '1',
    name: 'System Administrator',
    email: 'admin@freight.mn',
    password: '$2b$12$4WDT.M52mLzP.Sgsn/esguKyNrNzTEC59ZufQ6CV.knpbSSpHX9nK', // admin123
    role: 'ADMIN',
    status: 'ACTIVE',
  }
];

export const authOptions: NextAuthOptions = {
  // adapter: PrismaAdapter(prisma), // Enable when database is connected
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Mock implementation - replace with real database query
        const user = mockUsers.find(u => u.email === credentials.email);
        
        if (!user || user.status !== 'ACTIVE') {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };

        /*
        // Real database implementation (uncomment when DB is ready):
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password || user.status !== 'ACTIVE') {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
        */
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key',
};

// Helper function to get session in API routes
export const auth = () => getServerSession(authOptions);
