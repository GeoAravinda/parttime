import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import { getCompliance, getHolidays } from '@/lib/data';
import { addDaysYmd, isYmd, monthEnd, monthStart, mondayOf, todayJST } from '@/lib/dates';
import { Card, CardContent, PageHeader, levelDot, cn } from '@/components/ui';
import { MonthCalendar } from '@/components/month-calendar';

export default async function StudentCalendar({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireRole('student');
  const { t, lang } = await getT();
  const sp = await searchParams;
  const today = todayJST();
  const month = monthStart(isYmd(sp.month) ? sp.month : today);
  const [days, holidays] = await Promise.all([
    getCompliance(user.id, addDaysYmd(month, -7), addDaysYmd(monthEnd(month), 7)),
    getHolidays(month),
  ]);
  const inMonth = holidays.filter((h) => h.start_date <= monthEnd(month));
  return (
    <div className="space-y-5">
      <PageHeader title={t('cal.title')} />
      <MonthCalendar month={month} days={days} t={t} lang={lang} today={today}
        prevHref={`/student/calendar?month=${monthStart(addDaysYmd(month, -1))}`}
        nextHref={`/student/calendar?month=${addDaysYmd(monthEnd(month), 1)}`}
        dayHref={(d) => `/student/records?week=${mondayOf(d)}`} />
      <Card>
        <CardContent className="flex flex-wrap gap-4 text-xs text-slate-600">
          {(['green', 'yellow', 'red'] as const).map((l) => (
            <span key={l} className="flex items-center gap-1.5"><span className={cn('h-2.5 w-2.5 rounded-full', levelDot[l])} />{t(`level.${l}`)}</span>
          ))}
          {inMonth.map((h) => (
            <span key={h.id} className="rounded bg-amber-50 px-2 py-0.5 text-amber-800">
              {lang === 'ja' && h.name_ja ? h.name_ja : h.name}: {h.start_date} → {h.end_date}
              {h.kind === 'school_holiday' && ` (${t('admin.kind.school_holiday')})`}
            </span>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
