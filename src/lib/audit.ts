import { prisma } from '@/lib/db';

type LogInput = {
  action: string;
  resource?: string;
  resourceId?: string;
  userId?: string | null;
  userEmail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: any;
};

export async function auditLog(input: LogInput) {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        userId: input.userId || undefined,
        userEmail: input.userEmail || undefined,
        ip: input.ip || undefined,
        userAgent: input.userAgent || undefined,
        metadata: input.metadata as any,
      },
    });
  } catch (e) {
    // Avoid throwing from audit path; optionally console.warn
    console.warn('auditLog failed', e);
  }
}
