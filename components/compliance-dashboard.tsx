import Link from 'next/link';
import { getOverview, getSettings } from '@/lib/data';
import type { TFn } from '@/lib/i18n';
import { addDaysYmd, fmtH, todayJST } from '@/lib/dates';
import type { StudentOverview } from '@/lib/types';
import { Card, CardContent, CardHeader, Empty, LevelBadge } from './ui';
import { StudentsBar, WeeklyLevelChart } from './charts';

/** Weekly overview: for each of the last 7 days, how many visible students were green / yellow / red. */
export async function WeeklyCompliance({ t, current }: { t: TFn; current: StudentOverview[] }) {
  const today = todayJST();
  const dates = Array.from({ length: 7 }, (_, i) => addDaysYmd(today, i - 6));
  const settings = await getSettings();
  const past = await Promise.all(dates.slice(0, 6).map((d) => getOverview(d)));
  const all = [...past, current];
  const rows = dates.map((d, i) => {
    const r = all[i].filter((s) => s.status === 'active');
    return { label: `${+d.slice(5, 7)}/${+d.slice(8)}`, green: r.filter((s) => s.level === 'green').length, yellow: r.filter((s) => s.level === 'yellow').length, red: r.filter((s) => s.level === 'red').length };
  });
  const bars = current.filter((s) => s.status === 'active' && !s.is_holiday)
    .sort((a, b) => b.rolling7 - a.rolling7).slice(0, 15)
    .map((s) => ({ name: s.full_name.length > 16 ? s.full_name.slice(0, 15) + '…' : s.full_name, hours: s.rolling7, level: s.level }));
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title={t('teacher.weeklyOverview')} />
        <CardContent><WeeklyLevelChart rows={rows} /></CardContent>
      </Card>
      <Card>
        <CardHeader title={t('stat.rolling7')} description={`${t('c.limit')} ${settings.weekly_limit} h`} />
        <CardContent>{bars.length ? <StudentsBar rows={bars} limit={settings.weekly_limit} /> : <Empty>{t('c.noData')}</Empty>}</CardContent>
      </Card>
    </div>
  );
}

export function AttentionList({ t, students, basePath }: { t: TFn; students: StudentOverview[]; basePath: string }) {
  const list = students.filter((s) => s.status === 'active' && (s.level !== 'green' || s.missing_records))
    .sort((a, b) => (a.level === b.level ? b.rolling7 - a.rolling7 : a.level === 'red' ? -1 : b.level === 'red' ? 1 : a.level === 'yellow' ? -1 : 1));
  return (
    <Card>
      <CardHeader title={t('teacher.needsAttention')} />
      {list.length === 0 ? <Empty>{t('c.none')}</Empty> : (
        <ul className="divide-y divide-slate-100">
          {list.slice(0, 12).map((s) => (
            <li key={s.student_id}>
              <Link href={`${basePath}/${s.student_id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.full_name}</p>
                  <p className="text-xs text-slate-500">{s.student_no} · {s.class_name ?? '—'}
                    {s.missing_records && <span className="ml-2 text-amber-600">{t('stat.missing')}</span>}</p>
                </div>
                <div className="text-right">
                  <LevelBadge level={s.level} label={t(`level.${s.level}`)} />
                  <p className="mt-0.5 text-xs text-slate-500">
                    {s.is_holiday ? `${t('stat.today')} ${fmtH(s.today_hours)} h` : `7d ${fmtH(s.rolling7)} h · max ${fmtH(s.max_rolling7)} h`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
