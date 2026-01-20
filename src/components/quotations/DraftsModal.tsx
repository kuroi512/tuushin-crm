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

const DRAFTS_KEY = 'quotation_drafts_v1';

function loadDrafts(): QuotationDraft[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to load drafts:', e);
    return [];
  }
}

function saveDrafts(list: QuotationDraft[]): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    console.warn('localStorage is not available');
    return false;
  }
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.error('Failed to save drafts:', e);
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

  useEffect(() => {
    if (!open) return;
    setDrafts(loadDrafts());
  }, [open]);

  const rename = (d: QuotationDraft) => {
    const name = window.prompt(t('drafts.rename_prompt') || 'New name', d.name);
    if (!name || !name.trim()) return;
    const next = drafts.map((x) =>
      x.id === d.id ? { ...x, name: name.trim(), updatedAt: new Date().toISOString() } : x,
    );
    if (saveDrafts(next)) {
      setDrafts(next);
    } else {
      console.error('Failed to rename draft');
    }
  };
  const remove = (d: QuotationDraft) => {
    if (!confirm(t('drafts.delete_confirm') || 'Are you sure?')) return;
    const next = drafts.filter((x) => x.id !== d.id);
    if (saveDrafts(next)) {
      setDrafts(next);
    } else {
      console.error('Failed to delete draft');
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{t('drafts.title') || 'Drafts'}</CardTitle>
          <CardDescription>
            {t('drafts.desc') || 'Temporarily saved in this browser.'}
          </CardDescription>
          <div className="mt-2 text-sm text-red-600">
            {t('drafts.warning') ||
              'Warning: Drafts are stored in this browser only and may be lost (server changes, cache clear, or device restart). Do not rely on them often.'}
          </div>
        </CardHeader>
        <CardContent>
          {drafts.length === 0 ? (
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
                    <Button variant="outline" size="sm" onClick={() => rename(d)}>
                      {t('drafts.rename') || 'Rename'}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => remove(d)}>
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

export function addDraft(snapshot: any, suggestedName?: string): QuotationDraft | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    console.error('Cannot save draft: localStorage is not available');
    return null;
  }
  try {
    const list = loadDrafts();
    const now = new Date().toISOString();
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    const name =
      suggestedName && suggestedName.trim()
        ? suggestedName.trim()
        : `Draft ${new Date().toLocaleString()}`;
    const entry: QuotationDraft = { id, name, createdAt: now, updatedAt: now, data: snapshot };
    list.unshift(entry);
    if (saveDrafts(list)) {
      return entry;
    } else {
      console.error('Failed to save draft to localStorage');
      return null;
    }
  } catch (e) {
    console.error('Error in addDraft:', e);
    return null;
  }
}
