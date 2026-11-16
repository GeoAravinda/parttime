import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock, Plus, ShieldAlert, Sun } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import { createClient } from '@/lib/supabase/server';
import { getCompliance, getHolidays, getSettings, getStudent } from '@/lib/data';
import { addDaysYmd, fmtH, mondayOf, shortDate, todayJST, daysBetween } from '@/lib/dates';
import { Badge, Card, CardContent, CardHeader, LevelBadge, LinkButton, PageHeader, StatCard, cn } from '@/components/ui';
import { HoursChart } from '@/components/charts';
import { RecordsTable } from '@/components/records-table';

export default async function StudentHome() {
  const user = await requireRole('student');
  const { t, lang } = await getT();
  const today = todayJST();
  const supabase = await createClient();
  const [settings, series, s, holidays, recent, pending, rejected] = await Promise.all([
    getSettings(),
    getCompliance(user.id, addDaysYmd(today, -13), today),
    getStudent(user.id),
    getHolidays(today),
    supabase.from('work_records').select('*, jobs(company_name,workplace_name)').eq('student_id', user.id).order('work_date', { ascending: false }).order('start_time', { ascending: false }).limit(6),
    supabase.from('work_records').select('id', { count: 'exact', head: true }).eq('student_id', user.id).eq('status', 'submitted'),
    supabase.from('work_records').select('id', { count: 'exact', head: true }).eq('student_id', user.id).eq('status', 'rejected'),
  ]);
  const now = series[series.length - 1];
  const week = series.filter((d) => d.day >= mondayOf(today));
  const weekHours = week.reduce((a, d) => a + d.day_hours, 0);
  const activeJobs = s.jobs.filter((j) => j.status === 'active');
  const visaDays = s.profile?.visa_expiry ? daysBetween(today, s.profile.visa_expiry) : null;
  const vacations = holidays.filter((h) => h.kind === 'long_vacation' && h.approved).slice(0, 3);
  const Icon = now.level === 'red' ? AlertTriangle : now.level === 'yellow' ? AlertTriangle : CheckCircle2;

  return (
    <div className="space-y-5">
      <PageHeader title={`${t('nav.overview')}`} description={`${user.full_name} · ${shortDate(today, lang)}`}
        action={<LinkButton href="/student/records" variant="default" size="default"><Plus className="h-4 w-4" />{t('sheet.addShift')}</LinkButton>} />

      <Card className={cn('flex items-start gap-3 p-4',
        now.level === 'red' ? 'border-red-200 bg-red-50' : now.level === 'yellow' ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50')}>
        <Icon className={cn('mt-0.5 h-6 w-6 shrink-0', now.level === 'red' ? 'text-red-600' : now.level === 'yellow' ? 'text-amber-600' : 'text-emerald-600')} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{t(`level.${now.level}`)}</p>
            {now.is_holiday && <Badge tone="yellow"><Sun className="h-3 w-3" />{t('student.vacationNow')}</Badge>}
          </div>
          <p className="text-sm text-slate-700">{t('student.currentRule')}: {t(`rule.${now.rule}`)}</p>
          <p className="mt-1 text-sm text-slate-700">
            {now.is_holiday
              ? `${t('stat.remainingToday')}: ${fmtH(now.remaining)} h`
              : `${t('stat.rolling7')}: ${fmtH(now.rolling7)} / ${settings.weekly_limit} h — ${t('stat.remaining')}: ${fmtH(now.remaining)} h`}
          </p>
        </div>
      </Card>

      {(visaDays !== null && visaDays <= 90) && (
        <Card className="flex items-center gap-2 border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle className="h-4 w-4" />{t('profile.visaSoon')}: {s.profile?.visa_expiry}</Card>
      )}
      {s.profile && !s.profile.work_permit && (
        <Card className="flex items-center gap-2 border-red-200 bg-red-50 p-3 text-sm text-red-800"><ShieldAlert className="h-4 w-4" />{t('rule.no_permit')}</Card>
      )}
      {!!rejected.count && (
        <Link href="/student/records"><Card className="flex items-center gap-2 border-red-200 bg-red-50 p-3 text-sm text-red-800 hover:bg-red-100"><AlertTriangle className="h-4 w-4" />{t('status.rejected')}: {rejected.count} — {t('student.feedback')}</Card></Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('stat.today')} value={`${fmtH(now.day_hours)} h`} icon={<Clock className="h-4 w-4" />}
          tone={now.is_holiday ? now.level : 'blue'} sub={now.is_holiday ? `${t('c.limit')} ${settings.holiday_daily_limit} h` : undefined} />
        <StatCard label={t('stat.rolling7')} value={now.is_holiday ? '—' : `${fmtH(now.rolling7)} h`} tone={now.is_holiday ? 'blue' : now.level}
          sub={`${t('c.limit')} ${settings.weekly_limit} h · ${t('stat.thisWeek')} ${fmtH(weekHours)} h`} />
        <StatCard label={now.is_holiday ? t('stat.remainingToday') : t('stat.remaining')} value={`${fmtH(now.remaining)} h`} tone={now.level} />
        <StatCard label={t('stat.pending')} value={pending.count ?? 0} sub={<LevelBadge level={now.level} label={t(`level.${now.level}`)} />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t('student.last14')} description={`${t('sheet.dayTotal')} / ${t('sheet.rolling')}`} />
          <CardContent><HoursChart data={series} weeklyLimit={settings.weekly_limit} dailyLimit={settings.holiday_daily_limit} /></CardContent>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title={`${t('stat.jobs')} (${activeJobs.length}/3)`} action={<LinkButton href="/student/jobs">{t('c.edit')}</LinkButton>} />
            <CardContent className="space-y-2">
              {activeJobs.length === 0 && <p className="text-sm text-amber-700">{t('student.noJobs')}</p>}
              {activeJobs.map((j, i) => (
                <div key={j.id} className="text-sm"><b>{i + 1}.</b> {j.company_name} <span className="text-slate-500">— {j.workplace_name} · {j.job_type}</span></div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader title={t('student.upcomingHolidays')} />
            <CardContent className="space-y-2">
              {vacations.length === 0 && <p className="text-sm text-slate-500">{t('c.none')}</p>}
              {vacations.map((h) => (
                <div key={h.id} className="flex items-start gap-2 text-sm">
                  <Sun className="mt-0.5 h-4 w-4 text-amber-500" />
                  <div><p className="font-medium">{lang === 'ja' && h.name_ja ? h.name_ja : h.name}</p><p className="text-xs text-slate-500">{h.start_date} → {h.end_date} · {t('rule.holiday_daily')}</p></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title={t('student.recentRecords')} action={<LinkButton href="/student/records">{t('c.viewAll')}</LinkButton>} />
        <RecordsTable records={(recent.data ?? []) as any} t={t} lang={lang} />
      </Card>
    </div>
  );
}
