import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ProfileSettingsForm } from '@/components/settings/ProfileSettingsForm';

export const dynamic = 'force-dynamic';

export default async function ProfileSettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-6 px-2 py-4 sm:px-4 md:px-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">Profile settings</h1>
        <p className="text-gray-600">
          Manage the email and password for your personal account. Your name and role are managed by
          administrators.
        </p>
      </div>
      <ProfileSettingsForm
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        }}
      />
    </div>
  );
}
