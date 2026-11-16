import { notFound } from 'next/navigation';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCompliance, getRecords, getSettings, getStudent } from '@/lib/data';
import type { TFn, Lang } from '@/lib/i18n';
import { addDaysYmd, daysBetween, fmtH, isYmd, monthEnd, monthStart, mondayOf, todayJST, shortDate } from '@/lib/dates';
import { Card, CardContent, CardHeader, LevelBadge, StatCard, Badge } from './ui';
import { HoursChart } from './charts';
import { WeekSheet } from './week-sheet';
import { MonthCalendar } from './month-calendar';
import { RecordsTable } from './records-table';
import { ExportButtons } from './export-buttons';

/** Full student view for teachers and admins (read-only data + approval controls). */
export async function StudentDetail({ studentId, sp, basePath, t, lang }: {
  studentId: string; sp: Record<string, string | undefined>; basePath: string; t: TFn; lang: Lang;
}) {
  const today = todayJST();
  const week = isYmd(sp.week) ? mondayOf(sp.week) : mondayOf(today);
  const month = isYmd(sp.month) ? monthStart(sp.month) : monthStart(today);
  const s = await getStudent(studentId);
  if (!s.user) notFound();

  const supabase = await createClient();
  const [settings, last28, weekDays, weekRecs, monthDays, monthRecs, submitted, history] = await Promise.all([
    getSettings(),
    getCompliance(studentId, addDaysYmd(today, -27), today),
    getCompliance(studentId, week, addDaysYmd(week, 6)),
    getRecords(studentId, week, addDaysYmd(week, 6)),
    getCompliance(studentId, addDaysYmd(month, -7), addDaysYmd(monthEnd(month), 7)),
    getRecords(studentId, month, monthEnd(month)),
    supabase.from('work_records').select('*, jobs(company_name,workplace_name)').eq('student_id', studentId).eq('status', 'submitted').order('work_date'),
    supabase.from('approval_records').select('id, action, comment, created_at, snapshot, users!approval_records_actor_id_fkey(full_name)').eq('student_id', studentId).order('created_at', { ascending: false }).limit(15),
  ]);
  const now = last28[last28.length - 1];
  const worst = last28.slice(-7).reduce((w, d) => (d.level === 'red' ? 'red' : d.level === 'yellow' && w !== 'red' ? 'yellow' : w), 'green' as 'green' | 'yellow' | 'red');
  const peak = Math.max(0, ...last28.filter((d) => !d.is_holiday).map((d) => d.rolling7));
  const p = s.profile;
  const visaDays = p?.visa_expiry ? daysBetween(today, p.visa_expiry) : null;
  const q = (extra: Record<string, string>) => `${basePath}?${new URLSearchParams({ week, month, ...extra }).toString()}`;
  const byDay = new Map(monthDays.map((d) => [d.day, d]));

  const exportRows = monthRecs.map((r) => ({
    date: r.work_date, job: `${r.jobs?.company_name ?? ''} ${r.jobs?.workplace_name ?? ''}`.trim(),
    start: r.start_time.slice(0, 5), end: r.end_time.slice(0, 5), break: r.break_minutes, hours: Number(r.hours),
    day_total: byDay.get(r.work_date)?.day_hours ?? '', rolling7: byDay.get(r.work_date)?.is_holiday ? 'vacation' : byDay.get(r.work_date)?.rolling7 ?? '',
    level: byDay.get(r.work_date)?.level ?? '', status: r.status, comment: r.teacher_comment ?? '',
  }));
  const cols = [
    { key: 'date', header: t('c.date') }, { key: 'job', header: t('c.job') }, { key: 'start', header: t('c.start') },
    { key: 'end', header: t('c.end') }, { key: 'break', header: t('c.break') }, { key: 'hours', header: t('c.hours') },
    { key: 'day_total', header: t('sheet.dayTotal') }, { key: 'rolling7', header: t('sheet.rolling') },
    { key: 'level', header: t('c.level') }, { key: 'status', header: t('c.status') }, { key: 'comment', header: t('c.comment') },
  ];
  const pdfCols = cols.map((c) => ({ ...c, header: c.key.replace('_', ' ') }));

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{s.user.full_name}</h1>
              <LevelBadge level={worst} label={t(`level.${worst}`)} />
              {s.user.status !== 'active' && <Badge tone="slate">{t(`status.${s.user.status}`)}</Badge>}
            </div>
            <p className="mt-1 text-sm text-slate-500">{p?.student_no ?? '—'} · {s.user.email}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            {[
              [t('profile.class'), p?.classes ? `${p.classes.name}` : '—'],
              [t('profile.course'), p?.classes?.course ?? '—'],
              [t('profile.nationality'), p?.nationality ?? '—'],
              [t('profile.dob'), p?.date_of_birth ?? '—'],
              [t('profile.visaType'), p?.visa_type ?? '—'],
              [t('profile.visaExpiry'), p?.visa_expiry ?? '—'],
              [t('profile.workPermit'), p?.work_permit ? `${t('c.yes')} ${p?.work_permit_no ?? ''}` : t('c.no')],
              [t('profile.teachers'), s.teachers.join(', ') || '—'],
            ].map(([k, v]) => (
              <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium text-slate-800">{v}</dd></div>
            ))}
          </dl>
        </CardContent>
        {(visaDays !== null && visaDays <= 90) || !p?.work_permit ? (
          <div className="flex flex-wrap gap-3 border-t border-slate-100 px-5 py-2 text-sm">
            {visaDays !== null && visaDays <= 90 && <span className="flex items-center gap-1 text-amber-700"><AlertTriangle className="h-4 w-4" />{t('profile.visaSoon')} ({visaDays}d)</span>}
            {!p?.work_permit && <span className="flex items-center gap-1 text-red-700"><ShieldAlert className="h-4 w-4" />{t('rule.no_permit')}</span>}
          </div>
        ) : null}
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label={t('stat.today')} value={`${fmtH(now?.day_hours)} h`} />
        <StatCard label={t('stat.rolling7')} value={now?.is_holiday ? t('sheet.vacation') : `${fmtH(now?.rolling7)} h`} tone={now?.level} sub={`${t('c.limit')} ${settings.weekly_limit} h`} />
        <StatCard label={t('stat.remaining')} value={`${fmtH(now?.remaining)} h`} tone={now?.level} />
        <StatCard label={t('teacher.peak')} value={`${fmtH(peak)} h`} sub={t('student.last14').replace('14', '28')} tone={peak > settings.weekly_limit ? 'red' : peak >= settings.weekly_warn ? 'yellow' : 'green'} />
        <StatCard label={t('stat.pending')} value={submitted.data?.length ?? 0} />
      </div>

      <Card>
        <CardHeader title={t('teacher.weeklyOverview')} description={t('rule.' + (now?.rule ?? 'rolling_7day'))} />
        <CardContent><HoursChart data={last28} weeklyLimit={settings.weekly_limit} dailyLimit={settings.holiday_daily_limit} /></CardContent>
      </Card>

      {!!submitted.data?.length && (
        <Card>
          <CardHeader title={t('teacher.pendingList')} />
          <RecordsTable records={submitted.data as any} t={t} lang={lang} review />
        </Card>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">{t('sheet.title')}</h2>
        <WeekSheet monday={week} days={weekDays} records={weekRecs} jobs={s.jobs} editable={false} today={today}
          prevHref={q({ week: addDaysYmd(week, -7) })} nextHref={q({ week: addDaysYmd(week, 7) })} todayHref={q({ week: mondayOf(today) })} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">{t('cal.title')}</h2>
          <MonthCalendar month={month} days={monthDays} t={t} lang={lang} today={today}
            prevHref={q({ month: monthStart(addDaysYmd(month, -1)) })} nextHref={q({ month: addDaysYmd(monthEnd(month), 1) })}
            dayHref={(d) => q({ week: mondayOf(d) })} />
        </div>
        <Card>
          <CardHeader title={t('nav.jobs')} />
          <CardContent className="space-y-2">
            {s.jobs.length === 0 && <p className="text-sm text-slate-500">{t('c.none')}</p>}
            {s.jobs.map((j, i) => (
              <div key={j.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm">
                <div>
                  <p className="font-medium">{i + 1}. {j.company_name} <span className="text-slate-500">— {j.workplace_name}</span></p>
                  <p className="text-xs text-slate-500">{j.job_type} · {j.start_date} → {j.end_date ?? '…'}</p>
                </div>
                <Badge tone={j.status === 'active' ? 'green' : 'slate'}>{t(`status.${j.status}`)}</Badge>
              </div>
            ))}
            <h3 className="pt-3 text-sm font-semibold text-slate-700">{t('teacher.history')}</h3>
            <ul className="space-y-1.5 text-xs">
              {(history.data ?? []).map((h: any) => (
                <li key={h.id} className="flex flex-wrap gap-x-2 border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400">{new Date(h.created_at).toLocaleString(lang === 'ja' ? 'ja-JP' : 'en-GB', { timeZone: 'Asia/Tokyo', dateStyle: 'short', timeStyle: 'short' })}</span>
                  <Badge tone={h.action === 'approved' ? 'green' : h.action === 'rejected' ? 'red' : 'blue'}>{h.action}</Badge>
                  <span>{h.snapshot?.work_date && shortDate(h.snapshot.work_date, lang)} {h.snapshot?.hours}h</span>
                  <span className="text-slate-500">{h.users?.full_name}</span>
                  {h.comment && <span className="text-red-600">“{h.comment}”</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title={`${t('nav.records')} — ${month.slice(0, 7)}`}
          action={<ExportButtons title={`Work hours report: ${s.user.full_name} (${p?.student_no ?? ''}) ${month.slice(0, 7)}`}
            filename={`work-hours-${p?.student_no ?? studentId.slice(0, 8)}-${month.slice(0, 7)}`} columns={cols} pdfColumns={pdfCols} rows={exportRows} />} />
        <RecordsTable records={monthRecs} t={t} lang={lang} review />
      </Card>
    </div>
  );
}
