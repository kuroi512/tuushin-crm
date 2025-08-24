import { NextResponse } from 'next/server';
import { mockQuotations } from '../store';

// Reuse the in-memory store from the module scope in /api/quotations/route.ts
// We import the module to access its exported array via dynamic import caching behavior.

export async function GET(_req: Request, { params }: any) {
  const list = mockQuotations;
  const found = list.find((q) => q.id === params.id);
  if (!found) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: found });
}

export async function PUT(req: Request, { params }: any) {
  const body = await req.json();
  const list = mockQuotations as any[];
  const idx = list.findIndex((q) => q.id === params.id);
  if (idx === -1) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  const prev = list[idx];
  const next = { ...prev, ...body, id: prev.id };
  list[idx] = next;
  return NextResponse.json({ success: true, data: next });
}
