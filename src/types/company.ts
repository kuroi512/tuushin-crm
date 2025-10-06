export type CompanyProfileDto = {
  id?: string;
  legalName?: string | null;
  registrationNumber?: string | null;
  vatNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  defaultLocale: string;
};

export type CompanyProfileTranslationDto = {
  id?: string;
  locale: string;
  displayName: string;
  address?: string | null;
  tagline?: string | null;
  description?: string | null;
  mission?: string | null;
  vision?: string | null;
  additionalInfo?: Record<string, unknown> | null;
};

export type CompanySettingsResponse = {
  profile: CompanyProfileDto | null;
  translations: CompanyProfileTranslationDto[];
};
