'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CompanySettingsResponse, CompanyProfileTranslationDto } from '@/types/company';
import { toast } from 'sonner';

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'mn', label: 'Mongolian' },
  { value: 'ru', label: 'Russian' },
];

type FormState = {
  legalName: string;
  registrationNumber: string;
  vatNumber: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  defaultLocale: string;
};

type TranslationFormState = {
  id?: string;
  locale: string;
  displayName: string;
  address: string;
  tagline: string;
  description: string;
  mission: string;
  vision: string;
};

type NormalizedState = {
  form: FormState;
  translations: TranslationFormState[];
};

const textareaClassName =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

const createEmptyTranslation = (locale: string): TranslationFormState => ({
  locale,
  displayName: '',
  address: '',
  tagline: '',
  description: '',
  mission: '',
  vision: '',
});

const normalizeTranslations = (
  translations: CompanyProfileTranslationDto[] | undefined,
): TranslationFormState[] => {
  const map = new Map<string, TranslationFormState>();
  (translations ?? []).forEach((item) => {
    map.set(item.locale, {
      id: item.id,
      locale: item.locale,
      displayName: item.displayName ?? '',
      address: item.address ?? '',
      tagline: item.tagline ?? '',
      description: item.description ?? '',
      mission: item.mission ?? '',
      vision: item.vision ?? '',
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
      registrationNumber: data.profile?.registrationNumber ?? '',
      vatNumber: data.profile?.vatNumber ?? '',
      phone: data.profile?.phone ?? '',
      email: data.profile?.email ?? '',
      website: data.profile?.website ?? '',
      logoUrl: data.profile?.logoUrl ?? '',
      primaryColor: data.profile?.primaryColor ?? '',
      secondaryColor: data.profile?.secondaryColor ?? '',
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

  const handleLocaleChange = (index: number, nextLocale: string) => {
    if (translations.some((t, idx) => idx !== index && t.locale === nextLocale)) {
      toast.error('This language is already configured.');
      return;
    }
    const previousLocale = translations[index]?.locale;
    setTranslations((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, locale: nextLocale } : item)),
    );
    if (form.defaultLocale === previousLocale) {
      handleFormChange('defaultLocale', nextLocale);
    }
  };

  const handleAddLanguage = () => {
    const available = LANGUAGE_OPTIONS.find(
      (option) => !translations.some((translation) => translation.locale === option.value),
    );
    if (!available) {
      toast.info('All supported languages have been added.');
      return;
    }
    setTranslations((prev) => [...prev, createEmptyTranslation(available.value)]);
  };

  const handleRemoveTranslation = (index: number) => {
    if (translations.length <= 1) {
      toast.error('At least one language must remain.');
      return;
    }
    const removed = translations[index];
    const next = translations.filter((_, idx) => idx !== index);
    setTranslations(next);
    if (removed.locale === form.defaultLocale) {
      handleFormChange('defaultLocale', next[0]?.locale ?? 'en');
    }
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
        registrationNumber: toUndefined(form.registrationNumber),
        vatNumber: toUndefined(form.vatNumber),
        phone: toUndefined(form.phone),
        email: toUndefined(form.email),
        website: toUndefined(form.website),
        logoUrl: toUndefined(form.logoUrl),
        primaryColor: toUndefined(form.primaryColor),
        secondaryColor: toUndefined(form.secondaryColor),
        defaultLocale: form.defaultLocale,
        translations: translations.map((translation) => ({
          locale: translation.locale,
          displayName: translation.displayName.trim(),
          address: toUndefined(translation.address),
          tagline: toUndefined(translation.tagline),
          description: toUndefined(translation.description),
          mission: toUndefined(translation.mission),
          vision: toUndefined(translation.vision),
        })),
      };

      if (payload.translations.some((translation) => translation.displayName.length === 0)) {
        toast.error('Each language requires a display name.');
        setSaving(false);
        return;
      }

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

  const availableLocales = LANGUAGE_OPTIONS.filter(
    (option) => !translations.some((translation) => translation.locale === option.value),
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company profile</CardTitle>
          <CardDescription>Core organization details shared across the platform.</CardDescription>
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
          <div>
            <Label htmlFor="registrationNumber">Registration number</Label>
            <Input
              id="registrationNumber"
              value={form.registrationNumber}
              onChange={(event) => handleFormChange('registrationNumber', event.target.value)}
              placeholder="1234567"
            />
          </div>
          <div>
            <Label htmlFor="vatNumber">VAT number</Label>
            <Input
              id="vatNumber"
              value={form.vatNumber}
              onChange={(event) => handleFormChange('vatNumber', event.target.value)}
              placeholder="VAT-000111"
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(event) => handleFormChange('phone', event.target.value)}
              placeholder="(+976) 7000-0000"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(event) => handleFormChange('email', event.target.value)}
              placeholder="info@tuushin.mn"
            />
          </div>
          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={form.website}
              onChange={(event) => handleFormChange('website', event.target.value)}
              placeholder="https://tuushin.mn"
            />
          </div>
          <div>
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input
              id="logoUrl"
              value={form.logoUrl}
              onChange={(event) => handleFormChange('logoUrl', event.target.value)}
              placeholder="https://cdn.tuushin.mn/logo.svg"
            />
          </div>
          <div>
            <Label htmlFor="primaryColor">Primary color</Label>
            <Input
              id="primaryColor"
              value={form.primaryColor}
              onChange={(event) => handleFormChange('primaryColor', event.target.value)}
              placeholder="#1d4ed8"
            />
          </div>
          <div>
            <Label htmlFor="secondaryColor">Secondary color</Label>
            <Input
              id="secondaryColor"
              value={form.secondaryColor}
              onChange={(event) => handleFormChange('secondaryColor', event.target.value)}
              placeholder="#0ea5e9"
            />
          </div>
          <div>
            <Label>Default language</Label>
            <Select
              value={form.defaultLocale}
              onValueChange={(value) => handleFormChange('defaultLocale', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select default language" />
              </SelectTrigger>
              <SelectContent>
                {translations.map((translation) => (
                  <SelectItem key={translation.locale} value={translation.locale}>
                    {LANGUAGE_OPTIONS.find((option) => option.value === translation.locale)
                      ?.label ?? translation.locale.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Localized content</CardTitle>
            <CardDescription>
              Maintain translated names and descriptions for each language.
            </CardDescription>
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleAddLanguage}
              disabled={availableLocales.length === 0}
            >
              Add language
            </Button>
            {availableLocales.length === 0 && (
              <span className="text-sm text-gray-500">
                All available languages are already added.
              </span>
            )}
          </div>
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
                  <div className="flex items-center gap-2">
                    <Select
                      value={translation.locale}
                      onValueChange={(value) => handleLocaleChange(index, value)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleRemoveTranslation(index)}
                      disabled={translations.length <= 1}
                    >
                      Remove
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label>Display name</Label>
                    <Input
                      value={translation.displayName}
                      onChange={(event) =>
                        handleTranslationChange(index, 'displayName', event.target.value)
                      }
                      placeholder="Tuushin Logistics"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Tagline</Label>
                    <Input
                      value={translation.tagline}
                      onChange={(event) =>
                        handleTranslationChange(index, 'tagline', event.target.value)
                      }
                      placeholder="Trusted logistics partner"
                    />
                  </div>
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
                  <div className="md:col-span-2">
                    <Label>Description</Label>
                    <textarea
                      className={textareaClassName}
                      value={translation.description}
                      onChange={(event) =>
                        handleTranslationChange(index, 'description', event.target.value)
                      }
                      placeholder="Brief description shown in customer communications"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Mission</Label>
                    <textarea
                      className={textareaClassName}
                      value={translation.mission}
                      onChange={(event) =>
                        handleTranslationChange(index, 'mission', event.target.value)
                      }
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Vision</Label>
                    <textarea
                      className={textareaClassName}
                      value={translation.vision}
                      onChange={(event) =>
                        handleTranslationChange(index, 'vision', event.target.value)
                      }
                      rows={3}
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
