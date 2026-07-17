import { he, type Dict } from './he';
import { en } from './en';

export const locales = ['he', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'he';

export function getDict(locale: string): Dict {
  return locale === 'en' ? en : he;
}

export function isRtl(locale: string): boolean {
  return locale !== 'en';
}

export function categoryName(cat: { name_he: string; name_en: string }, locale: string): string {
  return locale === 'en' ? cat.name_en : cat.name_he;
}

export function formatDate(date: string | Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(typeof date === 'string' ? new Date(date) : date);
}
