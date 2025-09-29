'use client';
import { useEffect, useState } from 'react';

type Health = {
  ok: boolean;
  provider?: string;
  latencyMs?: number;
  counts?: { users: number; masterOptions: number; appQuotations: number };
  error?: string;
};

export default function DbHealthPage() {
  const [data, setData] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/health/db', { cache: 'no-store' });
        const json = (await res.json()) as Health;
        setData(json);
      } catch (e: any) {
        setData({ ok: false, error: e?.message || 'Failed to fetch' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Database Health</h1>
      {loading && <p>Checking…</p>}
      {!loading && data && (
        <div>
          <p>Status: {data.ok ? 'OK' : 'ERROR'}</p>
          {data.provider && <p>Provider: {data.provider}</p>}
          {typeof data.latencyMs === 'number' && <p>Latency: {data.latencyMs} ms</p>}
          {data.counts && (
            <ul>
              <li>Users: {data.counts.users}</li>
              <li>Master Options: {data.counts.masterOptions}</li>
              <li>App Quotations: {data.counts.appQuotations}</li>
            </ul>
          )}
          {data.error && <pre style={{ color: 'crimson' }}>{data.error}</pre>}
        </div>
      )}
    </div>
  );
}
