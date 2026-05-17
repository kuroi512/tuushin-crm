'use client';

import { useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useT } from '@/lib/i18n';

export type ExternalSalesFilterOption = {
  name: string;
  matchKey: string;
};

type ExternalShipmentSalesFilterProps = {
  salesOptions: ExternalSalesFilterOption[];
  appliedMatchKeys: Set<string> | null;
  onApply: (matchKeys: Set<string> | null) => void;
  disabled?: boolean;
  loading?: boolean;
};

function setsEqual(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

export function ExternalShipmentSalesFilter({
  salesOptions,
  appliedMatchKeys,
  onApply,
  disabled = false,
  loading = false,
}: ExternalShipmentSalesFilterProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [draftKeys, setDraftKeys] = useState<Set<string>>(new Set());

  const allMatchKeys = useMemo(
    () => new Set(salesOptions.map((option) => option.matchKey)),
    [salesOptions],
  );

  const effectiveApplied = appliedMatchKeys ?? allMatchKeys;

  useEffect(() => {
    if (!open) return;
    setDraftKeys(new Set(effectiveApplied));
  }, [open, effectiveApplied]);

  const selectedCount = effectiveApplied.size;
  const totalCount = salesOptions.length;
  const isFiltered = appliedMatchKeys !== null && totalCount > 0 && selectedCount < totalCount;

  const draftAllSelected = draftKeys.size === allMatchKeys.size && allMatchKeys.size > 0;
  const draftNoneSelected = draftKeys.size === 0;

  const toggleKey = (matchKey: string, checked: boolean) => {
    setDraftKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(matchKey);
      else next.delete(matchKey);
      return next;
    });
  };

  const handleSelectAll = () => setDraftKeys(new Set(allMatchKeys));
  const handleClearAll = () => setDraftKeys(new Set());

  const handleApply = () => {
    if (draftAllSelected || allMatchKeys.size === 0) {
      onApply(null);
    } else {
      onApply(new Set(draftKeys));
    }
    setOpen(false);
  };

  const hasDraftChanges = !setsEqual(draftKeys, effectiveApplied);

  return (
    <>
      <Button
        type="button"
        variant={isFiltered ? 'default' : 'outline'}
        disabled={disabled || loading || !salesOptions.length}
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Users className="h-4 w-4" />
        {t('reports.salesFilter.button')}
        {totalCount > 0 ? (
          <span className="text-xs opacity-80">
            ({isFiltered ? `${selectedCount}/${totalCount}` : totalCount})
          </span>
        ) : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-md gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="space-y-1 border-b px-4 py-4 sm:px-6">
            <DialogTitle>{t('reports.salesFilter.modalTitle')}</DialogTitle>
            <p className="text-muted-foreground text-sm">{t('reports.salesFilter.modalHint')}</p>
          </DialogHeader>

          <div className="max-h-[min(52vh,420px)] overflow-y-auto px-4 py-3 sm:px-6">
            {loading ? (
              <p className="text-sm text-gray-500">{t('reports.salesFilter.loading')}</p>
            ) : salesOptions.length ? (
              <ul className="space-y-1">
                {salesOptions.map((option) => {
                  const checked = draftKeys.has(option.matchKey);
                  return (
                    <li key={option.matchKey}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-gray-50">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => toggleKey(option.matchKey, Boolean(value))}
                        />
                        <span className="text-sm font-medium text-gray-900">{option.name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">{t('reports.salesFilter.empty')}</p>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 border-t px-4 py-4 sm:flex-row sm:justify-between sm:px-6">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleSelectAll}>
                {t('reports.salesFilter.selectAll')}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleClearAll}>
                {t('reports.salesFilter.clearAll')}
              </Button>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t('reports.salesFilter.cancel')}
              </Button>
              <Button
                type="button"
                onClick={handleApply}
                disabled={draftNoneSelected || !hasDraftChanges}
              >
                {t('reports.salesFilter.apply')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
