import { dict } from './dict';

export type Lang = 'en' | 'ja';
export type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function makeT(lang: Lang): TFn {
  return (key, vars) => {
    const entry = dict[key];
    let s = entry ? entry[lang === 'ja' ? 1 : 0] : key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}
