'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { RefreshCcw, Loader2, Plus, Edit, Trash2, Search, FileText } from 'lucide-react';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import { useT } from '@/lib/i18n';
import { useLookup } from '@/components/lookup/hooks';
import { Checkbox } from '@/components/ui/checkbox';

interface QuotationText {
  id: string;
  text_en: string;
  text_mn: string;
  text_ru: string;
  category: 'INCLUDE' | 'EXCLUDE' | 'REMARK';
  incotermIds: string[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  id?: string;
  text_en: string;
  text_mn: string;
  text_ru: string;
  category: 'INCLUDE' | 'EXCLUDE' | 'REMARK';
  isActive: boolean;
}

export default function QuotationTextsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const t = useT();
  const [data, setData] = useState<QuotationText[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>({
    text_en: '',
    text_mn: '',
    text_ru: '',
    category: 'INCLUDE',
    isActive: true,
  });
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [selectedIncoterm, setSelectedIncoterm] = useState<string>('');
  const [selectedTextIds, setSelectedTextIds] = useState<Set<string>>(new Set());
  const [draftLoading, setDraftLoading] = useState(false);

  // Get incoterms for draft creation
  const { data: incoterms } = useLookup('incoterm');

  const role = useMemo(() => normalizeRole(session?.user?.role), [session?.user?.role]);
  const canAccess = hasPermission(role, 'accessMasterData');

  useEffect(() => {
    if (status === 'loading') return;
    if (!canAccess) {
      router.replace('/dashboard');
    }
  }, [status, canAccess, router]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }
      if (search) {
        params.append('search', search);
      }

      const res = await fetch(`/api/quotation-texts?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      } else {
        toast.error(result.error || 'Failed to load texts');
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to load texts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canAccess) {
      fetchData();
    }
  }, [canAccess, categoryFilter, search]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-gray-500">Loading…</div>
    );
  }

  if (!canAccess) {
    return null;
  }

  const handleSubmit = async () => {
    if (!form.text_en.trim() || !form.text_mn.trim() || !form.text_ru.trim()) {
      toast.error('All language fields are required');
      return;
    }

    try {
      const url = '/api/quotation-texts';
      const method = editing ? 'PATCH' : 'POST';
      const body = editing
        ? { id: form.id, ...form }
        : {
            text_en: form.text_en,
            text_mn: form.text_mn,
            text_ru: form.text_ru,
            category: form.category,
            isActive: form.isActive,
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (result.success) {
        toast.success(editing ? 'Text updated' : 'Text created');
        setShowModal(false);
        setForm({ text_en: '', text_mn: '', text_ru: '', category: 'INCLUDE', isActive: true });
        setEditing(false);
        fetchData();
      } else {
        toast.error(result.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Failed to save');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this text?')) return;

    try {
      const res = await fetch(`/api/quotation-texts?id=${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast.success('Text deleted');
        fetchData();
      } else {
        toast.error(result.error || 'Failed to delete');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete');
    }
  };

  const openEdit = (item: QuotationText) => {
    setEditing(true);
    setForm({
      id: item.id,
      text_en: item.text_en,
      text_mn: item.text_mn,
      text_ru: item.text_ru,
      category: item.category,
      isActive: item.isActive,
    });
    setShowModal(true);
  };

  const filteredData = useMemo(() => {
    return data;
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quotation Texts</h1>
          <p className="text-gray-600">Manage include/exclude/remark texts (3 languages)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={isLoading}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => {
              setEditing(false);
              setForm({
                text_en: '',
                text_mn: '',
                text_ru: '',
                category: 'INCLUDE',
                isActive: true,
              });
              setShowModal(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute top-2.5 left-2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search texts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="INCLUDE">Include</SelectItem>
                <SelectItem value="EXCLUDE">Exclude</SelectItem>
                <SelectItem value="REMARK">Remark</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No texts found</div>
          ) : (
            <div className="space-y-4">
              {filteredData.map((item) => (
                <Card key={item.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                            {item.category}
                          </span>
                          {!item.isActive && (
                            <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 text-sm">
                          <div>
                            <span className="font-medium text-gray-600">EN:</span> {item.text_en}
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">MN:</span> {item.text_mn}
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">RU:</span> {item.text_ru}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Text' : 'Add New Text'}</DialogTitle>
            <DialogDescription>
              Enter the text in all three languages (English, Mongolian, Russian)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v as any })}
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
              <Label>English Text</Label>
              <Textarea
                value={form.text_en}
                onChange={(e) => setForm({ ...form, text_en: e.target.value })}
                rows={3}
                placeholder="Enter English text..."
              />
            </div>
            <div>
              <Label>Mongolian Text</Label>
              <Textarea
                value={form.text_mn}
                onChange={(e) => setForm({ ...form, text_mn: e.target.value })}
                rows={3}
                placeholder="Enter Mongolian text..."
              />
            </div>
            <div>
              <Label>Russian Text</Label>
              <Textarea
                value={form.text_ru}
                onChange={(e) => setForm({ ...form, text_ru: e.target.value })}
                rows={3}
                placeholder="Enter Russian text..."
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Active
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>{editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Draft Management Modal */}
      <Dialog open={showDraftModal} onOpenChange={setShowDraftModal}>
        <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Incoterm Drafts</DialogTitle>
            <DialogDescription>
              Select an incoterm and choose texts to include in the draft
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Incoterm</Label>
              <Select value={selectedIncoterm} onValueChange={setSelectedIncoterm}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an incoterm..." />
                </SelectTrigger>
                <SelectContent>
                  {incoterms?.data?.map((inc: any) => (
                    <SelectItem key={inc.id} value={inc.id}>
                      {inc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedIncoterm && (
              <>
                <div className="border-t pt-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold">Select Texts for Draft</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const allIds = new Set(data.filter((t) => t.isActive).map((t) => t.id));
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

                  <div className="max-h-[400px] space-y-2 overflow-y-auto">
                    {['INCLUDE', 'EXCLUDE', 'REMARK'].map((category) => {
                      const categoryTexts = data.filter(
                        (t) => t.category === category && t.isActive,
                      );
                      if (categoryTexts.length === 0) return null;

                      return (
                        <div key={category} className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-700">{category}</h4>
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
                                <div className="flex-1 text-sm">
                                  <div className="font-medium">{text.text_en}</div>
                                  <div className="text-xs text-gray-500">
                                    MN: {text.text_mn} | RU: {text.text_ru}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                  <div className="text-sm text-gray-600">
                    {selectedTextIds.size} text{selectedTextIds.size !== 1 ? 's' : ''} selected
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        // Load existing draft
                        try {
                          setDraftLoading(true);
                          const res = await fetch(
                            `/api/incoterm-drafts?incotermId=${selectedIncoterm}`,
                          );
                          const result = await res.json();
                          if (result.success && result.data) {
                            const draft = result.data;
                            const allTextIds = new Set<string>();
                            [
                              ...(draft.include || []),
                              ...(draft.exclude || []),
                              ...(draft.remark || []),
                            ].forEach((item: any) => {
                              // Find text by matching content
                              const matchingText = data.find(
                                (t) =>
                                  t.text_en === item.text_en ||
                                  t.text_mn === item.text_mn ||
                                  t.text_ru === item.text_ru,
                              );
                              if (matchingText) allTextIds.add(matchingText.id);
                            });
                            setSelectedTextIds(allTextIds);
                            toast.success('Draft loaded');
                          }
                        } catch (error) {
                          console.error('Load draft error:', error);
                          toast.error('Failed to load draft');
                        } finally {
                          setDraftLoading(false);
                        }
                      }}
                      disabled={draftLoading}
                    >
                      Load Existing Draft
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!selectedIncoterm || selectedTextIds.size === 0) {
                          toast.error('Please select an incoterm and at least one text');
                          return;
                        }

                        try {
                          setDraftLoading(true);
                          // Group selected texts by category
                          const selectedTexts = data.filter((t) => selectedTextIds.has(t.id));
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
                              incotermId: selectedIncoterm,
                              include,
                              exclude,
                              remark,
                            }),
                          });

                          const result = await res.json();
                          if (result.success) {
                            toast.success('Draft saved successfully');
                            setShowDraftModal(false);
                            setSelectedIncoterm('');
                            setSelectedTextIds(new Set());
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
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDraftModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
