import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ComplianceDay } from '@/lib/types';
import type { TFn, Lang } from '@/lib/i18n';
import { addDaysYmd, mondayOf, monthEnd, monthLabel, fmtH } from '@/lib/dates';
import { Card, buttonClass, cn, levelDot } from './ui';

/** Month view; every day shows the combined hours and is coloured by the server-computed level. */
export function MonthCalendar({ month, days, t, lang, prevHref, nextHref, dayHref, today }: {
  month: string; days: ComplianceDay[]; t: TFn; lang: Lang; prevHref: string; nextHref: string;
  dayHref: (day: string) => string; today: string;
}) {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const start = mondayOf(month);
  const end = addDaysYmd(mondayOf(monthEnd(month)), 6);
  const cells: string[] = [];
  for (let d = start; d <= end; d = addDaysYmd(d, 1)) cells.push(d);
  const head = lang === 'ja' ? ['月', '火', '水', '木', '金', '土', '日'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const monthTotal = days.filter((d) => d.day.slice(0, 7) === month.slice(0, 7)).reduce((s, d) => s + d.day_hours, 0);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-1">
          <Link href={prevHref} className={buttonClass('outline', 'icon')} aria-label={t('c.prev')}><ChevronLeft className="h-4 w-4" /></Link>
          <Link href={nextHref} className={buttonClass('outline', 'icon')} aria-label={t('c.next')}><ChevronRight className="h-4 w-4" /></Link>
          <span className="ml-2 font-semibold">{monthLabel(month, lang)}</span>
        </div>
        <span className="text-sm text-slate-600">{t('c.total')}: <b>{fmtH(monthTotal)} h</b></span>
      </div>
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-xs font-medium text-slate-500">
        {head.map((h, i) => <div key={h} className={cn('py-2', i >= 5 && 'text-rose-500')}>{h}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day) => {
          const d = byDay.get(day);
          const inMonth = day.slice(0, 7) === month.slice(0, 7);
          const colored = d && d.day_hours > 0;
          return (
            <Link key={day} href={dayHref(day)}
              className={cn('relative min-h-[64px] border-b border-r border-slate-100 p-1.5 text-left transition hover:bg-primary-50 sm:min-h-[84px] sm:p-2',
                !inMonth && 'bg-slate-50/60 text-slate-400', d?.is_holiday && inMonth && 'bg-amber-50/50')}>
              <span className={cn('text-xs', day === today && 'rounded-full bg-primary px-1.5 py-0.5 font-semibold text-white')}>{+day.slice(8)}</span>
              {d && inMonth && (
                <>
                  {colored && (
                    <span className={cn('mt-1 block rounded px-1 text-center text-xs font-semibold sm:text-sm',
                      d.level === 'red' ? 'bg-red-100 text-red-700' : d.level === 'yellow' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800')}>
                      {fmtH(d.day_hours)}h
                    </span>
                  )}
                  {!d.is_holiday && d.rolling7 > 0 && (
                    <span className="mt-0.5 hidden text-[10px] text-slate-500 sm:block">7d {fmtH(d.rolling7)}h</span>
                  )}
                  {d.is_holiday && <span className="mt-0.5 block truncate text-[10px] text-amber-700">{t('sheet.vacation')}</span>}
                  {d.level !== 'green' && <span className={cn('absolute right-1.5 top-1.5 h-2 w-2 rounded-full', levelDot[d.level])} />}
                </>
              )}
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
