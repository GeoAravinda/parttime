import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import { createClient } from '@/lib/supabase/server';
import { getCompliance, getRecords, getSettings, getStudent } from '@/lib/data';
import { addDaysYmd, isYmd, mondayOf, todayJST } from '@/lib/dates';
import { Card, CardHeader, PageHeader } from '@/components/ui';
import { WeekSheet } from '@/components/week-sheet';
import { RecordsTable } from '@/components/records-table';

export default async function StudentRecords({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const user = await requireRole('student');
  const { t, lang } = await getT();
  const sp = await searchParams;
  const today = todayJST();
  const monday = mondayOf(isYmd(sp.week) ? sp.week : today);
  const sunday = addDaysYmd(monday, 6);
  const supabase = await createClient();
  const [days, records, s, settings, rejected] = await Promise.all([
    getCompliance(user.id, monday, sunday),
    getRecords(user.id, monday, sunday),
    getStudent(user.id),
    getSettings(),
    supabase.from('work_records').select('*, jobs(company_name,workplace_name)').eq('student_id', user.id).eq('status', 'rejected').order('work_date'),
  ]);
  const href = (w: string) => `/student/records?week=${w}`;
  return (
    <div className="space-y-5">
      <PageHeader title={t('sheet.title')} description={t('sheet.help')} />
      {!!rejected.data?.length && (
        <Card className="border-red-200">
          <CardHeader title={`${t('status.rejected')} — ${t('student.feedback')}`} />
          <RecordsTable records={rejected.data as any} t={t} lang={lang} />
        </Card>
      )}
      <WeekSheet monday={monday} days={days} records={records} jobs={s.jobs} editable today={today}
        allowDelete={settings.allow_student_delete}
        prevHref={href(addDaysYmd(monday, -7))} nextHref={href(addDaysYmd(monday, 7))} todayHref={href(mondayOf(today))} />
      <p className="text-xs text-slate-500">{t('rule.rolling_7day')} · {t('rule.holiday_daily')}</p>
    </div>
  );
}
