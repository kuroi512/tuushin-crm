import { NextRequest, NextResponse } from 'next/server';
import { syncMasterOptions } from '@/lib/master-sync';
import { auditLog } from '@/lib/audit';
import { getIpFromHeaders, getUserAgentFromHeaders } from '@/lib/request';

// Simple auth guard placeholder - extend with real auth if needed
function isAuthorized(req: NextRequest) {
  const token = req.headers.get('x-api-key');
  if (!process.env.MASTER_SYNC_API_KEY) return true; // if no key set, allow
  return token === process.env.MASTER_SYNC_API_KEY;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    await auditLog({
      action: 'master.sync_unauthorized',
      resource: 'master_sync',
      ip: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
    });
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const endpoint =
      body.endpoint ||
      process.env.MASTER_SYNC_ENDPOINT ||
      process.env.MASTER_SYNC_SOURCE ||
      'https://burtgel.tuushin.mn/api/crm/get-options';

    const stats = await syncMasterOptions(endpoint);
    await auditLog({
      action: 'master.sync_success',
      resource: 'master_sync',
      metadata: { endpoint, stats },
      ip: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
    });
    return NextResponse.json({ success: true, message: 'Sync completed', stats });
  } catch (error: any) {
    console.error('Master sync error:', error);
    const attempts = error?.attempts || undefined;
    await auditLog({
      action: 'master.sync_failed',
      resource: 'master_sync',
      metadata: { message: error?.message, attempts },
      ip: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Sync failed',
        details: error?.message,
        attempts,
        hint: 'Check network connectivity, endpoint URL env vars, and upstream service availability.',
      },
      { status: 500 },
    );
  }
}
