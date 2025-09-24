import { NextRequest, NextResponse } from 'next/server';
import { syncMasterOptions } from '@/lib/master-sync';

// Simple auth guard placeholder - extend with real auth if needed
function isAuthorized(req: NextRequest) {
  const token = req.headers.get('x-api-key');
  if (!process.env.MASTER_SYNC_API_KEY) return true; // if no key set, allow
  return token === process.env.MASTER_SYNC_API_KEY;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const endpoint =
      body.endpoint ||
      process.env.MASTER_SYNC_SOURCE ||
      'https://burtgel.tuushin.mn/api/crm/get-options';

    const stats = await syncMasterOptions(endpoint);
    return NextResponse.json({ success: true, message: 'Sync completed', stats });
  } catch (error) {
    console.error('Master sync error:', error);
    return NextResponse.json(
      { success: false, error: 'Sync failed', details: (error as Error).message },
      { status: 500 },
    );
  }
}
