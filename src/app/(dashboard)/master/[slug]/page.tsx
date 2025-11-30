'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MasterTable } from '@/components/master/MasterTable';
import {
  useMasterOptions,
  useCreateMasterOption,
  useUpdateMasterOption,
  type MasterOption,
} from '@/components/master/hooks';
import { toast } from 'sonner';
import { RefreshCcw, Loader2, Plus, FileText, Edit, Trash2, Search, Languages } from 'lucide-react';
import type { JsonValue } from '@/types/common';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FormState {
  id?: string;
  name: string;
  code?: string | null;
  meta?: string; // JSON string
}

const categoryMap: Record<string, string> = {
  type: 'TYPE',
  ownership: 'OWNERSHIP',
  customer: 'CUSTOMER',
  agent: 'AGENT',
  country: 'COUNTRY',
  port: 'PORT',
  area: 'AREA',
  exchange: 'EXCHANGE',
  incoterm: 'INCOTERM',
  sales: 'SALES',
  manager: 'MANAGER',
};

const EXTERNAL_ONLY = new Set(['SALES', 'MANAGER']);

export default function MasterCategoryPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const slug = (params?.slug as string) || 'type';
  const category = categoryMap[slug];
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>({ name: '' });
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftIncotermId, setDraftIncotermId] = useState<string>('');
  const [draftIncotermName, setDraftIncotermName] = useState<string>('');
  const [quotationTexts, setQuotationTexts] = useState<any[]>([]);
  const [selectedTextIds, setSelectedTextIds] = useState<Set<string>>(new Set());
  const [draftLoading, setDraftLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'texts' | 'draft'>('texts');
  const [viewLanguage, setViewLanguage] = useState<'en' | 'mn' | 'ru'>('en');
  const [textSearch, setTextSearch] = useState('');
  const [textCategoryFilter, setTextCategoryFilter] = useState<string>('all');
  const [showTextModal, setShowTextModal] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [textForm, setTextForm] = useState({
    id: '',
    text_en: '',
    text_mn: '',
    text_ru: '',
    category: 'INCLUDE' as 'INCLUDE' | 'EXCLUDE' | 'REMARK',
    isActive: true,
  });
  const [usedTextIds, setUsedTextIds] = useState<Set<string>>(new Set());

  const role = useMemo(() => normalizeRole(session?.user?.role), [session?.user?.role]);
  const canAccess = hasPermission(role, 'accessMasterData');

  useEffect(() => {
    if (status === 'loading') return;
    if (!canAccess) {
      router.replace('/dashboard');
    }
  }, [status, canAccess, router]);

  const { data, isLoading } = useMasterOptions(category);
  const createMutation = useCreateMasterOption();
  const updateMutation = useUpdateMasterOption(category);

  const readOnly = category ? EXTERNAL_ONLY.has(category) : false;

  useEffect(() => {
    if (!editing) setForm({ name: '' });
  }, [category, editing]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-gray-500">Loading…</div>
    );
  }

  if (!canAccess) {
    return null;
  }

  if (!category) {
    return <div className="p-6 text-sm text-red-600">Unknown category: {slug}</div>;
  }

  function openEdit(row: MasterOption) {
    if (readOnly) {
      toast.info('This category is managed by the external CRM and cannot be edited.');
      return;
    }
    setEditing(true);
    setForm({
      id: row.id,
      name: row.name,
      code: row.code ?? undefined,
      meta: row.meta ? JSON.stringify(row.meta, null, 2) : '',
    });
    setShowModal(true);
  }

  async function checkAllTextsUsage(textsToCheck: any[] = quotationTexts) {
    if (textsToCheck.length === 0) return;

    try {
      // Get all incoterms
      const incotermsRes = await fetch('/api/master?category=INCOTERM');
      const incotermsResult = await incotermsRes.json();
      if (!incotermsResult.success) return;

      const usedIds = new Set<string>();

      // Check each incoterm's draft
      for (const incoterm of incotermsResult.data || []) {
        try {
          const draftRes = await fetch(`/api/incoterm-drafts?incotermId=${incoterm.id}`);
          const draftResult = await draftRes.json();
          if (draftResult.success && draftResult.data) {
            const draft = draftResult.data;
            const allDraftTexts = [
              ...(draft.include || []),
              ...(draft.exclude || []),
              ...(draft.remark || []),
            ];

            // Match draft texts with quotation texts
            allDraftTexts.forEach((draftText: any) => {
              const matchingText = textsToCheck.find(
                (t) =>
                  (t.text_en === draftText.text_en &&
                    t.text_mn === draftText.text_mn &&
                    t.text_ru === draftText.text_ru) ||
                  t.text_en === draftText.text_en ||
                  t.text_mn === draftText.text_mn ||
                  t.text_ru === draftText.text_ru,
              );
              if (matchingText) {
                usedIds.add(matchingText.id);
              }
            });
          }
        } catch (error) {
          console.error(`Error checking incoterm ${incoterm.id}:`, error);
        }
      }

      setUsedTextIds(usedIds);
    } catch (error) {
      console.error('Error checking text usage:', error);
    }
  }

  async function openDraftManager(incotermId: string, incotermName: string) {
    setDraftIncotermId(incotermId);
    setDraftIncotermName(incotermName);
    setSelectedTextIds(new Set());
    setDraftLoading(true);
    setActiveTab('texts');
    setViewLanguage('en');
    setTextSearch('');
    setTextCategoryFilter('all');
    try {
      // Load all quotation texts
      const textsRes = await fetch('/api/quotation-texts');
      const textsResult = await textsRes.json();
      if (textsResult.success) {
        const loadedTexts = textsResult.data;
        setQuotationTexts(loadedTexts);
        // Check which texts are used after loading
        checkAllTextsUsage(loadedTexts);
      }

      // Load existing draft if any
      const draftRes = await fetch(`/api/incoterm-drafts?incotermId=${incotermId}`);
      const draftResult = await draftRes.json();
      if (draftResult.success && draftResult.data) {
        const draft = draftResult.data;
        const allTextIds = new Set<string>();
        [...(draft.include || []), ...(draft.exclude || []), ...(draft.remark || [])].forEach(
          (item: any) => {
            // Find text by matching content
            const matchingText = textsResult.data.find(
              (t: any) =>
                t.text_en === item.text_en ||
                t.text_mn === item.text_mn ||
                t.text_ru === item.text_ru,
            );
            if (matchingText) allTextIds.add(matchingText.id);
          },
        );
        setSelectedTextIds(allTextIds);
      }
    } catch (error) {
      console.error('Load error:', error);
      toast.error('Failed to load data');
    } finally {
      setDraftLoading(false);
      setShowDraftModal(true);
    }
  }

  async function fetchQuotationTexts() {
    try {
      const params = new URLSearchParams();
      if (textCategoryFilter !== 'all') {
        params.append('category', textCategoryFilter);
      }
      if (textSearch) {
        params.append('search', textSearch);
      }
      const res = await fetch(`/api/quotation-texts?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        const loadedTexts = result.data;
        setQuotationTexts(loadedTexts);
        // Check usage after fetching
        checkAllTextsUsage(loadedTexts);
        return loadedTexts;
      }
    } catch (error) {
      console.error('Failed to fetch texts:', error);
      toast.error('Failed to load texts');
    }
  }

  useEffect(() => {
    if (showDraftModal && category === 'INCOTERM') {
      fetchQuotationTexts();
    }
  }, [textSearch, textCategoryFilter, showDraftModal, category]);

  function openTextEdit(text: any) {
    setEditingText(true);
    setTextForm({
      id: text.id,
      text_en: text.text_en,
      text_mn: text.text_mn,
      text_ru: text.text_ru,
      category: text.category,
      isActive: text.isActive,
    });
    setShowTextModal(true);
  }

  function openTextCreate() {
    setEditingText(false);
    setTextForm({
      id: '',
      text_en: '',
      text_mn: '',
      text_ru: '',
      category: 'INCLUDE',
      isActive: true,
    });
    setShowTextModal(true);
  }

  async function handleTextSubmit() {
    if (!textForm.text_en.trim() || !textForm.text_mn.trim() || !textForm.text_ru.trim()) {
      toast.error('All language fields are required');
      return;
    }

    try {
      const url = '/api/quotation-texts';
      const method = editingText ? 'PATCH' : 'POST';
      const body = editingText
        ? {
            id: textForm.id,
            text_en: textForm.text_en,
            text_mn: textForm.text_mn,
            text_ru: textForm.text_ru,
            category: textForm.category,
            isActive: textForm.isActive,
          }
        : {
            text_en: textForm.text_en,
            text_mn: textForm.text_mn,
            text_ru: textForm.text_ru,
            category: textForm.category,
            isActive: textForm.isActive,
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (result.success) {
        toast.success(editingText ? 'Text updated' : 'Text created');
        setShowTextModal(false);
        await fetchQuotationTexts();
      } else {
        toast.error(result.error || 'Failed to save text');
      }
    } catch (error) {
      console.error('Save text error:', error);
      toast.error('Failed to save text');
    }
  }

  async function checkTextUsage(textId: string): Promise<{ isUsed: boolean; incoterms: string[] }> {
    try {
      // Get the text to check its content
      const text = quotationTexts.find((t) => t.id === textId);
      if (!text) return { isUsed: false, incoterms: [] };

      // Get all incoterms
      const incotermsRes = await fetch('/api/master?category=INCOTERM');
      const incotermsResult = await incotermsRes.json();
      if (!incotermsResult.success) return { isUsed: false, incoterms: [] };

      const usedIncoterms: string[] = [];

      // Check each incoterm's draft
      for (const incoterm of incotermsResult.data || []) {
        try {
          const draftRes = await fetch(`/api/incoterm-drafts?incotermId=${incoterm.id}`);
          const draftResult = await draftRes.json();
          if (draftResult.success && draftResult.data) {
            const draft = draftResult.data;
            const allDraftTexts = [
              ...(draft.include || []),
              ...(draft.exclude || []),
              ...(draft.remark || []),
            ];

            // Check if this text matches any text in the draft
            const isInDraft = allDraftTexts.some(
              (draftText: any) =>
                (draftText.text_en === text.text_en &&
                  draftText.text_mn === text.text_mn &&
                  draftText.text_ru === text.text_ru) ||
                // Also check by matching any language field
                draftText.text_en === text.text_en ||
                draftText.text_mn === text.text_mn ||
                draftText.text_ru === text.text_ru,
            );

            if (isInDraft) {
              usedIncoterms.push(incoterm.name || incoterm.id);
            }
          }
        } catch (error) {
          console.error(`Error checking incoterm ${incoterm.id}:`, error);
        }
      }

      return {
        isUsed: usedIncoterms.length > 0,
        incoterms: usedIncoterms,
      };
    } catch (error) {
      console.error('Error checking text usage:', error);
      return { isUsed: false, incoterms: [] };
    }
  }

  async function handleTextDelete(id: string) {
    // Check if text is used
    setDraftLoading(true);
    const usage = await checkTextUsage(id);
    setDraftLoading(false);

    if (usage.isUsed) {
      const incotermList = usage.incoterms.slice(0, 5).join(', ');
      const moreCount = usage.incoterms.length > 5 ? ` and ${usage.incoterms.length - 5} more` : '';
      toast.error(
        `Cannot delete: This text is used in ${usage.incoterms.length} incoterm draft${usage.incoterms.length > 1 ? 's' : ''} (${incotermList}${moreCount}). Please remove it from the drafts first.`,
        { duration: 6000 },
      );
      return;
    }

    if (!confirm('Are you sure you want to delete this text?')) return;

    try {
      const res = await fetch(`/api/quotation-texts?id=${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast.success('Text deleted');
        await fetchQuotationTexts();
      } else {
        toast.error(result.error || 'Failed to delete text');
      }
    } catch (error) {
      console.error('Delete text error:', error);
      toast.error('Failed to delete text');
    }
  }

  function getTextByLanguage(text: any, lang: 'en' | 'mn' | 'ru'): string {
    switch (lang) {
      case 'en':
        return text.text_en;
      case 'mn':
        return text.text_mn;
      case 'ru':
        return text.text_ru;
      default:
        return text.text_en;
    }
  }

  function handleSubmit() {
    if (readOnly) {
      toast.error('External categories are view only.');
      return;
    }
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    let metaObj: JsonValue | undefined;
    // Only validate meta if it's provided and category is not INCOTERM
    if (form.meta && category !== 'INCOTERM') {
      try {
        const parsed = JSON.parse(form.meta) as JsonValue;
        metaObj = parsed;
      } catch {
        toast.error('Meta JSON invalid');
        return;
      }
    }
    if (editing && form.id) {
      updateMutation.mutate(
        { id: form.id, name: form.name, code: form.code ?? undefined, meta: metaObj },
        {
          onSuccess: () => {
            toast.success('Updated');
            setShowModal(false);
          },
          onError: (error) => toast.error(error instanceof Error ? error.message : 'Update failed'),
        },
      );
    } else {
      createMutation.mutate(
        { category, name: form.name, code: form.code ?? undefined, meta: metaObj },
        {
          onSuccess: () => {
            toast.success('Created');
            setShowModal(false);
            setForm({ name: '' });
          },
          onError: (error) => toast.error(error instanceof Error ? error.message : 'Create failed'),
        },
      );
    }
  }

  async function handleSync() {
    try {
      setSyncing(true);
      const res = await fetch('/api/master/sync', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Sync failed');
      const u = json.stats?.usersProvisioned ?? 0;
      toast.success(
        `Sync complete: +${json.stats.inserted} / ~${json.stats.updated} updated / ${json.stats.deactivated} deactivated • users provisioned: ${u}`,
      );
      setLastSyncAt(new Date());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sync error');
    } finally {
      setSyncing(false);
    }
  }

  const busy = isLoading || createMutation.isPending || updateMutation.isPending || syncing;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Master Data - {category}</h1>
          <p className="text-sm text-gray-600">Manage internal options (external are read-only).</p>
          {readOnly && (
            <p className="text-xs text-amber-600">
              Sales and Manager records sync from the upstream system and are locked to preserve
              name-based matching.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={busy}
            title="Fetch & sync external master data"
          >
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            {syncing ? 'Syncing…' : 'Sync'}
          </Button>
          {lastSyncAt && (
            <span className="text-xs text-gray-500" aria-live="polite">
              Last sync: {lastSyncAt.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{category} Options</CardTitle>
          {!readOnly && (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setEditing(false);
                setForm({ name: '' });
                setShowModal(true);
              }}
              disabled={busy}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add New
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <MasterTable
            data={data?.data || []}
            loading={busy}
            onEdit={openEdit}
            onManageDraft={category === 'INCOTERM' ? openDraftManager : undefined}
          />
        </CardContent>
      </Card>

      {showModal && !readOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-md border bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">
              {editing ? 'Edit Master Option' : 'Create Master Option'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Category</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm disabled:bg-gray-100"
                  value={category}
                  disabled
                  readOnly
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Name</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Code</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.code || ''}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value || undefined }))}
                />
              </div>
              {category !== 'INCOTERM' && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Meta (JSON)</label>
                  <textarea
                    className="h-32 w-full rounded-md border px-3 py-2 font-mono text-xs"
                    value={form.meta || ''}
                    onChange={(e) => setForm((f) => ({ ...f, meta: e.target.value }))}
                    placeholder='{"note": "Local only"}'
                  />
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowModal(false);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={busy}>
                {editing ? 'Save Changes' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Quotation Texts & Draft Management Modal for Incoterms */}
      {showDraftModal && category === 'INCOTERM' && !showTextModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-md border bg-white shadow-lg">
            {/* Header */}
            <div className="border-b p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Manage Quotation Texts</h2>
                  <p className="text-sm text-gray-600">Incoterm: {draftIncotermName}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowDraftModal(false);
                    setSelectedTextIds(new Set());
                    setDraftIncotermId('');
                    setDraftIncotermName('');
                    setActiveTab('texts');
                  }}
                >
                  ✕
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b px-4">
              <button
                onClick={() => setActiveTab('texts')}
                className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'texts'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Manage Texts
              </button>
              <button
                onClick={() => setActiveTab('draft')}
                className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'draft'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Manage Draft
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {draftLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : activeTab === 'texts' ? (
                /* Texts Management Tab */
                <div className="space-y-4">
                  {/* Search and Filters */}
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label>Search</Label>
                      <div className="relative">
                        <Search className="absolute top-2.5 left-2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search texts..."
                          value={textSearch}
                          onChange={(e) => setTextSearch(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </div>
                    <div className="w-40">
                      <Label>Category</Label>
                      <Select value={textCategoryFilter} onValueChange={setTextCategoryFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="INCLUDE">Include</SelectItem>
                          <SelectItem value="EXCLUDE">Exclude</SelectItem>
                          <SelectItem value="REMARK">Remark</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={openTextCreate}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Text
                    </Button>
                  </div>

                  {/* Language Toggle */}
                  <div className="flex items-center gap-2 rounded-md border p-2">
                    <Languages className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">View Language:</span>
                    <div className="flex gap-1">
                      {(['en', 'mn', 'ru'] as const).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setViewLanguage(lang)}
                          className={`rounded px-3 py-1 text-xs transition-colors ${
                            viewLanguage === lang
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {lang.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Texts List */}
                  <div className="max-h-[500px] space-y-3 overflow-y-auto">
                    {quotationTexts
                      .filter((t) => {
                        const matchesCategory =
                          textCategoryFilter === 'all' || t.category === textCategoryFilter;
                        const matchesSearch =
                          !textSearch ||
                          getTextByLanguage(t, viewLanguage)
                            .toLowerCase()
                            .includes(textSearch.toLowerCase()) ||
                          t.text_en.toLowerCase().includes(textSearch.toLowerCase()) ||
                          t.text_mn.toLowerCase().includes(textSearch.toLowerCase()) ||
                          t.text_ru.toLowerCase().includes(textSearch.toLowerCase());
                        return matchesCategory && matchesSearch;
                      })
                      .map((text) => (
                        <div
                          key={text.id}
                          className="flex items-start gap-3 rounded border p-3 hover:bg-gray-50"
                        >
                          <div className="flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                                {text.category}
                              </span>
                              {!text.isActive && (
                                <span className="text-xs text-red-500">Inactive</span>
                              )}
                              {usedTextIds.has(text.id) && (
                                <span className="text-xs font-medium text-blue-600">
                                  Used in draft
                                </span>
                              )}
                            </div>
                            <div
                              className="cursor-pointer text-sm"
                              onClick={() => {
                                const langs: ('en' | 'mn' | 'ru')[] = ['en', 'mn', 'ru'];
                                const currentIndex = langs.indexOf(viewLanguage);
                                const nextIndex = (currentIndex + 1) % langs.length;
                                setViewLanguage(langs[nextIndex]);
                              }}
                              title="Click to cycle languages"
                            >
                              <div className="font-medium">
                                {getTextByLanguage(text, viewLanguage)}
                              </div>
                              <div className="mt-1 text-xs text-gray-400">
                                {viewLanguage === 'en' && `EN: ${text.text_en}`}
                                {viewLanguage === 'mn' && `MN: ${text.text_mn}`}
                                {viewLanguage === 'ru' && `RU: ${text.text_ru}`}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openTextEdit(text)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTextDelete(text.id)}
                              disabled={draftLoading || usedTextIds.has(text.id)}
                              title={
                                usedTextIds.has(text.id)
                                  ? 'This text is used in one or more incoterm drafts and cannot be deleted'
                                  : draftLoading
                                    ? 'Checking usage...'
                                    : 'Delete text'
                              }
                            >
                              <Trash2
                                className={`h-4 w-4 ${
                                  usedTextIds.has(text.id) ? 'text-gray-400' : 'text-red-500'
                                }`}
                              />
                            </Button>
                          </div>
                        </div>
                      ))}
                    {quotationTexts.filter((t) => {
                      const matchesCategory =
                        textCategoryFilter === 'all' || t.category === textCategoryFilter;
                      const matchesSearch =
                        !textSearch ||
                        getTextByLanguage(t, viewLanguage)
                          .toLowerCase()
                          .includes(textSearch.toLowerCase());
                      return matchesCategory && matchesSearch;
                    }).length === 0 && (
                      <div className="py-8 text-center text-gray-500">
                        No texts found. Create one to get started.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Draft Management Tab */
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    Select texts from the master data to include in this incoterm's draft
                  </div>

                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Select Texts for Draft</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const allIds = new Set(
                            quotationTexts.filter((t) => t.isActive).map((t) => t.id),
                          );
                          setSelectedTextIds(allIds);
                        }}
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTextIds(new Set())}
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>

                  <div className="max-h-[500px] space-y-4 overflow-y-auto">
                    {['INCLUDE', 'EXCLUDE', 'REMARK'].map((cat) => {
                      const categoryTexts = quotationTexts.filter(
                        (t) => t.category === cat && t.isActive,
                      );
                      if (categoryTexts.length === 0) return null;

                      return (
                        <div key={cat} className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-700">{cat}</h4>
                          <div className="space-y-2 pl-4">
                            {categoryTexts.map((text) => (
                              <div
                                key={text.id}
                                className="flex items-start gap-2 rounded border p-2 hover:bg-gray-50"
                              >
                                <Checkbox
                                  checked={selectedTextIds.has(text.id)}
                                  onCheckedChange={(checked) => {
                                    const newSet = new Set(selectedTextIds);
                                    if (checked) {
                                      newSet.add(text.id);
                                    } else {
                                      newSet.delete(text.id);
                                    }
                                    setSelectedTextIds(newSet);
                                  }}
                                />
                                <div
                                  className="flex-1 cursor-pointer text-sm"
                                  onClick={() => {
                                    const langs: ('en' | 'mn' | 'ru')[] = ['en', 'mn', 'ru'];
                                    const currentIndex = langs.indexOf(viewLanguage);
                                    const nextIndex = (currentIndex + 1) % langs.length;
                                    setViewLanguage(langs[nextIndex]);
                                  }}
                                  title="Click to cycle languages"
                                >
                                  <div className="font-medium">
                                    {getTextByLanguage(text, viewLanguage)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-gray-600">
                      {selectedTextIds.size} text{selectedTextIds.size !== 1 ? 's' : ''} selected
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={async () => {
                          if (!draftIncotermId || selectedTextIds.size === 0) {
                            toast.error('Please select at least one text');
                            return;
                          }

                          try {
                            setDraftLoading(true);
                            const selectedTexts = quotationTexts.filter((t) =>
                              selectedTextIds.has(t.id),
                            );
                            const include = selectedTexts
                              .filter((t) => t.category === 'INCLUDE')
                              .map((t) => ({
                                text_en: t.text_en,
                                text_mn: t.text_mn,
                                text_ru: t.text_ru,
                                category: 'INCLUDE' as const,
                              }));
                            const exclude = selectedTexts
                              .filter((t) => t.category === 'EXCLUDE')
                              .map((t) => ({
                                text_en: t.text_en,
                                text_mn: t.text_mn,
                                text_ru: t.text_ru,
                                category: 'EXCLUDE' as const,
                              }));
                            const remark = selectedTexts
                              .filter((t) => t.category === 'REMARK')
                              .map((t) => ({
                                text_en: t.text_en,
                                text_mn: t.text_mn,
                                text_ru: t.text_ru,
                                category: 'REMARK' as const,
                              }));

                            const res = await fetch('/api/incoterm-drafts', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                incotermId: draftIncotermId,
                                include,
                                exclude,
                                remark,
                              }),
                            });

                            const result = await res.json();
                            if (result.success) {
                              toast.success('Draft saved successfully');
                              setShowDraftModal(false);
                              setSelectedTextIds(new Set());
                              setDraftIncotermId('');
                              setDraftIncotermName('');
                            } else {
                              toast.error(result.error || 'Failed to save draft');
                            }
                          } catch (error) {
                            console.error('Save draft error:', error);
                            toast.error('Failed to save draft');
                          } finally {
                            setDraftLoading(false);
                          }
                        }}
                        disabled={draftLoading || selectedTextIds.size === 0}
                      >
                        {draftLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Draft'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Text Create/Edit Modal */}
      {showTextModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowTextModal(false);
              setEditingText(false);
            }
          }}
        >
          <div
            className="w-full max-w-2xl rounded-md border bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold">
              {editingText ? 'Edit Quotation Text' : 'Create Quotation Text'}
            </h2>
            <div className="space-y-4">
              <div>
                <Label>Category</Label>
                <Select
                  value={textForm.category}
                  onValueChange={(v) =>
                    setTextForm((f) => ({ ...f, category: v as 'INCLUDE' | 'EXCLUDE' | 'REMARK' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INCLUDE">Include</SelectItem>
                    <SelectItem value="EXCLUDE">Exclude</SelectItem>
                    <SelectItem value="REMARK">Remark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Text (English)</Label>
                <Textarea
                  value={textForm.text_en}
                  onChange={(e) => setTextForm((f) => ({ ...f, text_en: e.target.value }))}
                  placeholder="Enter text in English"
                  rows={3}
                />
              </div>
              <div>
                <Label>Text (Mongolian)</Label>
                <Textarea
                  value={textForm.text_mn}
                  onChange={(e) => setTextForm((f) => ({ ...f, text_mn: e.target.value }))}
                  placeholder="Enter text in Mongolian"
                  rows={3}
                />
              </div>
              <div>
                <Label>Text (Russian)</Label>
                <Textarea
                  value={textForm.text_ru}
                  onChange={(e) => setTextForm((f) => ({ ...f, text_ru: e.target.value }))}
                  placeholder="Enter text in Russian"
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isActive"
                  checked={textForm.isActive}
                  onCheckedChange={(checked) =>
                    setTextForm((f) => ({ ...f, isActive: checked === true }))
                  }
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  Active
                </Label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowTextModal(false);
                  setEditingText(false);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleTextSubmit}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
