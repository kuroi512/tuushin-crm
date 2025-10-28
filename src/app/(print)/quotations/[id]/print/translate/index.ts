import type { PrintCopy, PrintLanguage } from './types';
import { enCopy, enOption } from './en';
import { mnCopy, mnOption } from './mn';
import { ruCopy, ruOption } from './ru';

export const LANGUAGE_OPTIONS = [enOption, mnOption, ruOption] as const;

export const COPY_MAP: Record<PrintLanguage, PrintCopy> = {
  en: enCopy,
  mn: mnCopy,
  ru: ruCopy,
};

export type { PrintCopy, PrintLanguage } from './types';
