import { en, Locale } from './locales/en.js';
import { es } from './locales/es.js';

const locales: Record<string, Locale> = { en, es };

function detectLocale(): string {
  const lang = process.env.LANG ?? process.env.LANGUAGE ?? process.env.LC_ALL ?? process.env.LC_MESSAGES ?? '';
  const code = lang.split(/[_.\-]/)[0].toLowerCase();
  return locales[code] ? code : 'en';
}

export const t: Locale = locales[detectLocale()];
export type { Locale };
