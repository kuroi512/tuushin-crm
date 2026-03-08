'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';

export type QuotationDraft = {
  id: string;
  name: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  data: any; // { form, dimensions?, carrierRates?, extraServices?, customerRates? }
};

type DraftApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

async function readJson<T>(res: Response): Promise<DraftApiResponse<T>> {
  try {
    return (await res.json()) as DraftApiResponse<T>;
  } catch {
    return { success: false, error: 'Invalid server response' };
  }
}

async function loadDrafts(): Promise<QuotationDraft[]> {
  const res = await fetch('/api/quotations/drafts', { cache: 'no-store' });
  const json = await readJson<QuotationDraft[]>(res);
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to load drafts');
  }
  return Array.isArray(json.data) ? json.data : [];
}

export async function getDraftById(id: string): Promise<QuotationDraft | null> {
  if (!id) return null;
  try {
    const res = await fetch(`/api/quotations/drafts/${id}`, { cache: 'no-store' });
    const json = await readJson<QuotationDraft>(res);
    if (!res.ok || !json.success || !json.data) {
      return null;
    }
    return json.data;
  } catch {
    return null;
  }
}

export async function deleteDraftById(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const res = await fetch(`/api/quotations/drafts/${id}`, { method: 'DELETE' });
    const json = await readJson<unknown>(res);
    return Boolean(res.ok && json.success);
  } catch {
    return false;
  }
}

export function DraftsModal({
  open,
  onClose,
  onLoadQuick,
  onOpenFull,
}: {
  open: boolean;
  onClose: () => void;
  onLoadQuick: (draft: QuotationDraft) => void;
  onOpenFull: (draft: QuotationDraft) => void;
}) {
  const t = useT();
  const [drafts, setDrafts] = useState<QuotationDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyDraftId, setBusyDraftId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const rows = await loadDrafts();
        if (!cancelled) setDrafts(rows);
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const rename = async (d: QuotationDraft) => {
    const name = window.prompt(t('drafts.rename_prompt') || 'New name', d.name);
    if (!name || !name.trim()) return;
    try {
      setBusyDraftId(d.id);
      const res = await fetch(`/api/quotations/drafts/${d.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await readJson<QuotationDraft>(res);
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || 'Failed to rename draft');
      }
      setDrafts((prev) => prev.map((x) => (x.id === d.id ? json.data! : x)));
    } catch (error) {
      console.error(error);
      console.error('Failed to rename draft');
    } finally {
      setBusyDraftId(null);
    }
  };

  const remove = async (d: QuotationDraft) => {
    if (!confirm(t('drafts.delete_confirm') || 'Are you sure?')) return;
    try {
      setBusyDraftId(d.id);
      const ok = await deleteDraftById(d.id);
      if (!ok) {
        throw new Error('Failed to delete draft');
      }
      setDrafts((prev) => prev.filter((x) => x.id !== d.id));
    } catch (error) {
      console.error(error);
      console.error('Failed to delete draft');
    } finally {
      setBusyDraftId(null);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{t('drafts.title') || 'Drafts'}</CardTitle>
          <CardDescription>
            {t('drafts.desc') || 'Saved drafts linked to your account.'}
          </CardDescription>
          <div className="mt-2 text-sm text-emerald-700">
            Drafts are saved in database and available across devices.
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground text-sm">Loading drafts...</div>
          ) : drafts.length === 0 ? (
            <div className="text-muted-foreground text-sm">
              {t('drafts.none') || 'No drafts yet.'}
            </div>
          ) : (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {drafts.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded border p-3">
                  <div>
                    <div className="font-medium">{d.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {new Date(d.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onLoadQuick(d)}>
                      {t('drafts.load_quick') || 'Load in Quick'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onOpenFull(d)}>
                      {t('drafts.open_full') || 'Open Full Form'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyDraftId === d.id}
                      onClick={() => rename(d)}
                    >
                      {t('drafts.rename') || 'Rename'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busyDraftId === d.id}
                      onClick={() => remove(d)}
                    >
                      {t('drafts.delete') || 'Delete'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button onClick={onClose}>{t('common.close') || 'Close'}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export async function addDraft(
  snapshot: any,
  suggestedName?: string,
  existingId?: string,
): Promise<QuotationDraft | null> {
  try {
    const name = suggestedName?.trim() || undefined;

    if (existingId) {
      const res = await fetch(`/api/quotations/drafts/${existingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, data: snapshot }),
      });
      const json = await readJson<QuotationDraft>(res);
      if (!res.ok || !json.success || !json.data) {
        console.error(json.error || 'Failed to update draft');
        return null;
      }
      return json.data;
    }

    const res = await fetch('/api/quotations/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, data: snapshot }),
    });
    const json = await readJson<QuotationDraft>(res);
    if (!res.ok || !json.success || !json.data) {
      console.error(json.error || 'Failed to create draft');
      return null;
    }
    return json.data;
  } catch (e) {
    console.error('Error in addDraft:', e);
    return null;
  }
}
