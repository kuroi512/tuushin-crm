'use client';
import { useEffect, useState } from 'react';
import type { JsonRecord } from '@/types/common';

type AuditRow = {
  id: string;
  createdAt: string;
  action: string;
  resource: string | null;
  resourceId: string | null;
  userId: string | null;
  userEmail: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: JsonRecord | null;
};

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ action: '', resource: '', userEmail: '' });

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.action) params.set('action', filters.action);
    if (filters.resource) params.set('resource', filters.resource);
    if (filters.userEmail) params.set('userEmail', filters.userEmail);
    const res = await fetch(`/api/audit?${params.toString()}`);
    if (!res.ok) {
      setRows([]);
      setLoading(false);
      return;
    }
    const json: { data?: AuditRow[] } = await res.json();
    setRows(json.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Audit logs</h1>
      <div className="flex items-end gap-2">
        <div className="flex flex-col">
          <label className="text-sm">Action</label>
          <input
            className="rounded border px-2 py-1"
            value={filters.action}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm">Resource</label>
          <input
            className="rounded border px-2 py-1"
            value={filters.resource}
            onChange={(e) => setFilters((f) => ({ ...f, resource: e.target.value }))}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm">User Email</label>
          <input
            className="rounded border px-2 py-1"
            value={filters.userEmail}
            onChange={(e) => setFilters((f) => ({ ...f, userEmail: e.target.value }))}
          />
        </div>
        <button className="rounded bg-black px-3 py-2 text-white" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Search'}
        </button>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full border text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="border p-2">Time</th>
              <th className="border p-2">Action</th>
              <th className="border p-2">Resource</th>
              <th className="border p-2">User</th>
              <th className="border p-2">IP</th>
              <th className="border p-2">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="border p-2 whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td className="border p-2">{r.action}</td>
                <td className="border p-2">
                  {r.resource}
                  {r.resourceId ? `#${r.resourceId.slice(0, 6)}` : ''}
                </td>
                <td className="border p-2">{r.userEmail || r.userId || '-'}</td>
                <td className="border p-2">{r.ip || '-'}</td>
                <td className="max-w-[400px] border p-2">
                  <pre className="break-all whitespace-pre-wrap">
                    {JSON.stringify(r.metadata, null, 2)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
