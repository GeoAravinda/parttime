import { addDays, format, parseISO, startOfWeek, startOfMonth, endOfMonth, differenceInCalendarDays } from 'date-fns';

export const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
/** Today's date in Japan (the school's legal timezone), as YYYY-MM-DD. */
export const todayJST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
export const addDaysYmd = (s: string, n: number) => ymd(addDays(parseISO(s), n));
export const mondayOf = (s: string) => ymd(startOfWeek(parseISO(s), { weekStartsOn: 1 }));
export const monthStart = (s: string) => ymd(startOfMonth(parseISO(s)));
export const monthEnd = (s: string) => ymd(endOfMonth(parseISO(s)));
export const daysBetween = (a: string, b: string) => differenceInCalendarDays(parseISO(b), parseISO(a));
export const isYmd = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseISO(s).getTime());
export const range = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysYmd(d, 1)) out.push(d);
  return out;
};
export const hhmm = (t: string | null | undefined) => (t ?? '').slice(0, 5);
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD_JA = ['日', '月', '火', '水', '木', '金', '土'];
export const weekdayIndex = (s: string) => parseISO(s).getDay();
export const weekday = (s: string, lang: 'en' | 'ja') => (lang === 'ja' ? WD_JA : WD_EN)[parseISO(s).getDay()];
export const shortDate = (s: string, lang: 'en' | 'ja') =>
  lang === 'ja'
    ? `${+s.slice(5, 7)}/${+s.slice(8, 10)}（${weekday(s, 'ja')}）`
    : `${weekday(s, 'en')} ${format(parseISO(s), 'MMM d')}`;
export const monthLabel = (s: string, lang: 'en' | 'ja') =>
  lang === 'ja' ? `${s.slice(0, 4)}年${+s.slice(5, 7)}月` : format(parseISO(s), 'MMMM yyyy');
export const fmtH = (n: number | null | undefined) => (Math.round((Number(n) || 0) * 100) / 100).toString();
