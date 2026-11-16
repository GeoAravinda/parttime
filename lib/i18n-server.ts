import 'server-only';
import { cookies } from 'next/headers';
import { makeT, type Lang } from './i18n';

export async function getLang(): Promise<Lang> {
  const c = await cookies();
  return c.get('lang')?.value === 'ja' ? 'ja' : 'en';
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: makeT(lang) };
}
