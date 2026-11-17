import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import { createClient } from '@/lib/supabase/server';
import { getCompliance, getRecords, getSettings, getStudent } from '@/lib/data';
import { addDaysYmd, isYmd, mondayOf, monthEnd, monthStart, todayJST } from '@/lib/dates';
import { Card, CardHeader, PageHeader, buttonClass } from '@/components/ui';
import { WeekSheet } from '@/components/week-sheet';
import { RecordsTable } from '@/components/records-table';

export default async function StudentRecords({ searchParams }: { searchParams: Promise<{ week?: string; month?: string; view?: string }> }) {
  const user = await requireRole('student');
  const { t, lang } = await getT();
  const sp = await searchParams;
  const today = todayJST();
  // Default: the whole month (like the paper sheet). ?view=week shows Mon–Sun.
  const view = sp.view === 'week' || (sp.week && !sp.month && sp.view !== 'month') ? 'week' : 'month';
  let from: string, to: string, prevHref: string, nextHref: string, todayHref: string;
  if (view === 'week') {
    from = mondayOf(isYmd(sp.week) ? sp.week : today);
    to = addDaysYmd(from, 6);
    const href = (w: string) => `/student/records?view=week&week=${w}`;
    prevHref = href(addDaysYmd(from, -7)); nextHref = href(addDaysYmd(from, 7)); todayHref = href(mondayOf(today));
  } else {
    from = monthStart(isYmd(sp.month) ? sp.month : isYmd(sp.week) ? sp.week : today);
    to = monthEnd(from);
    const href = (m: string) => `/student/records?view=month&month=${m}`;
    prevHref = href(monthStart(addDaysYmd(from, -1))); nextHref = href(addDaysYmd(to, 1)); todayHref = href(monthStart(today));
  }
  const supabase = await createClient();
  const [days, records, s, settings, rejected] = await Promise.all([
    getCompliance(user.id, from, to),
    getRecords(user.id, from, to),
    getStudent(user.id),
    getSettings(),
    supabase.from('work_records').select('*, jobs(company_name,workplace_name)').eq('student_id', user.id).eq('status', 'rejected').order('work_date'),
  ]);
  const toggle = (
    <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
      <Link href={`/student/records?view=month&month=${monthStart(from)}`}
        className={buttonClass(view === 'month' ? 'default' : 'ghost', 'sm')}>{t('sheet.viewMonth')}</Link>
      <Link href={`/student/records?view=week&week=${mondayOf(view === 'month' && today >= from && today <= to ? today : from)}`}
        className={buttonClass(view === 'week' ? 'default' : 'ghost', 'sm')}>{t('sheet.viewWeek')}</Link>
    </div>
  );
  return (
    <div className="space-y-5">
      <PageHeader title={t('sheet.title')} description={t('sheet.help')} action={toggle} />
      {!!rejected.data?.length && (
        <Card className="border-red-200">
          <CardHeader title={`${t('status.rejected')} — ${t('student.feedback')}`} />
          <RecordsTable records={rejected.data as any} t={t} lang={lang} />
        </Card>
      )}
      <WeekSheet monday={from} days={days} records={records} jobs={s.jobs} editable today={today}
        allowDelete={settings.allow_student_delete}
        prevHref={prevHref} nextHref={nextHref} todayHref={todayHref} />
      <p className="text-xs text-slate-500">{t('rule.rolling_7day')} · {t('rule.holiday_daily')}</p>
    </div>
  );
}
