'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { CompanySettingsResponse, CompanyProfileTranslationDto } from '@/types/company';
import { toast } from 'sonner';

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'mn', label: 'Mongolian' },
  { value: 'ru', label: 'Russian' },
];

type FormState = {
  legalName: string;
  defaultLocale: string;
};

type TranslationFormState = {
  locale: string;
  address: string;
};

type NormalizedState = {
  form: FormState;
  translations: TranslationFormState[];
};

const textareaClassName =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

const createEmptyTranslation = (locale: string): TranslationFormState => ({
  locale,
  address: '',
});

const normalizeTranslations = (
  translations: CompanyProfileTranslationDto[] | undefined,
): TranslationFormState[] => {
  const map = new Map<string, TranslationFormState>();
  (translations ?? []).forEach((item) => {
    map.set(item.locale, {
      locale: item.locale,
      address: item.address ?? '',
    });
  });
  for (const { value } of LANGUAGE_OPTIONS) {
    if (!map.has(value)) {
      map.set(value, createEmptyTranslation(value));
    }
  }
  return Array.from(map.values()).sort((a, b) => a.locale.localeCompare(b.locale));
};

const normalizeState = (data: CompanySettingsResponse): NormalizedState => {
  const translations = normalizeTranslations(data.translations);
  const defaultLocale =
    data.profile?.defaultLocale &&
    translations.some((t) => t.locale === data.profile?.defaultLocale)
      ? data.profile.defaultLocale
      : (translations[0]?.locale ?? 'en');
  return {
    form: {
      legalName: data.profile?.legalName ?? '',
      defaultLocale,
    },
    translations,
  };
};

const toUndefined = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export function CompanySettingsForm({ initialData }: { initialData: CompanySettingsResponse }) {
  const initialState = useMemo(() => normalizeState(initialData), [initialData]);
  const [form, setForm] = useState<FormState>(initialState.form);
  const [translations, setTranslations] = useState<TranslationFormState[]>(
    initialState.translations,
  );
  const [snapshot, setSnapshot] = useState<NormalizedState>(initialState);
  const [saving, setSaving] = useState(false);

  const handleFormChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleTranslationChange = <K extends keyof TranslationFormState>(
    index: number,
    key: K,
    value: TranslationFormState[K],
  ) => {
    setTranslations((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)),
    );
  };

  const handleReset = () => {
    setForm(snapshot.form);
    setTranslations(snapshot.translations);
    toast.success('Reverted changes');
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      const payload = {
        legalName: toUndefined(form.legalName),
        defaultLocale: form.defaultLocale,
        translations: translations.map((translation) => ({
          locale: translation.locale,
          displayName: form.legalName.trim() || translation.locale.toUpperCase(),
          address: toUndefined(translation.address),
        })),
      };

      const response = await fetch('/api/settings/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json();

      if (!response.ok) {
        toast.error(json?.error ?? 'Failed to save company settings');
        setSaving(false);
        return;
      }

      const updated = normalizeState(json.data as CompanySettingsResponse);
      setForm(updated.form);
      setTranslations(updated.translations);
      setSnapshot(updated);
      toast.success('Company settings saved successfully');
    } catch (error) {
      console.error(error);
      toast.error('Unexpected error while saving');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company profile</CardTitle>
          <CardDescription>Maintain only company name and address details.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="legalName">Legal name</Label>
            <Input
              id="legalName"
              value={form.legalName}
              onChange={(event) => handleFormChange('legalName', event.target.value)}
              placeholder="Tuushin LLC"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Localized content</CardTitle>
            <CardDescription>Maintain company address for each language.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleReset} disabled={saving}>
              Reset changes
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-6">
            {translations.map((translation, index) => (
              <Card key={`${translation.locale}-${index}`} className="border border-gray-200">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {LANGUAGE_OPTIONS.find((option) => option.value === translation.locale)
                        ?.label ?? translation.locale.toUpperCase()}
                    </CardTitle>
                    <CardDescription>
                      Display information for the {translation.locale.toUpperCase()} locale.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label>Address</Label>
                    <textarea
                      className={textareaClassName}
                      value={translation.address}
                      onChange={(event) =>
                        handleTranslationChange(index, 'address', event.target.value)
                      }
                      placeholder="Ulaanbaatar, Mongolia"
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
