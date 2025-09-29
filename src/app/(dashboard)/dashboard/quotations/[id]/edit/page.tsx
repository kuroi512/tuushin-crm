import { redirect } from 'next/navigation';

// Next.js 15 may provide params as a Promise; handle both by declaring as Promise and awaiting it.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/quotations/${id}/edit`);
}
