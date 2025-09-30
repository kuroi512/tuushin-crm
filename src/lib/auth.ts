import { NextAuthOptions, getServerSession } from 'next-auth';
// import { PrismaAdapter } from '@auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';

export const authOptions: NextAuthOptions = {
  // adapter: PrismaAdapter(prisma), // Enable when database is connected
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          // Audit: missing credentials attempt
          await auditLog({
            action: 'auth.login_failed',
            resource: 'auth',
            userEmail: credentials?.email || undefined,
            metadata: { reason: 'missing_credentials' },
          });
          return null;
        }
        // Authenticate against database users
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });

        if (!user || !user.password || user.isActive === false) {
          await auditLog({
            action: 'auth.login_failed',
            resource: 'auth',
            userEmail: credentials.email,
            metadata: {
              reason: !user ? 'not_found' : user.isActive === false ? 'inactive' : 'no_password',
            },
          });
          return null;
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          await auditLog({
            action: 'auth.login_failed',
            resource: 'auth',
            userId: user.id,
            userEmail: user.email,
            metadata: { reason: 'invalid_password' },
          });
          return null;
        }

        // Successful login
        await auditLog({
          action: 'auth.login_success',
          resource: 'auth',
          userId: user.id,
          userEmail: user.email,
        });
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
        } as any;
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
