import Link from 'next/link';
import { AlertTriangle, Briefcase, GraduationCap, Percent, Sun, UserPlus, Users } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import { createClient } from '@/lib/supabase/server';
import { getHolidays, getOverview } from '@/lib/data';
import { todayJST } from '@/lib/dates';
import { Badge, Card, CardContent, CardHeader, LinkButton, PageHeader, StatCard } from '@/components/ui';
import { LevelPie } from '@/components/charts';
import { AttentionList, WeeklyCompliance } from '@/components/compliance-dashboard';

export default async function AdminHome() {
  await requireRole('admin');
  const { t, lang } = await getT();
  const supabase = await createClient();
  const today = todayJST();
  const [all, holidays, teachers, jobs, pendingAcc, activity] = await Promise.all([
    getOverview(),
    getHolidays(today),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'teacher').eq('status', 'active'),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('audit_logs').select('id, action, table_name, actor_role, created_at, users(full_name)').order('created_at', { ascending: false }).limit(10),
  ]);
  const active = all.filter((s) => s.status === 'active');
  const n = (l: string) => active.filter((s) => s.level === l).length;
  const pct = active.length ? Math.round((n('green') / active.length) * 100) : 100;
  return (
    <div className="space-y-5">
      <PageHeader title={t('nav.overview')} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Link href="/admin/students"><StatCard label={t('stat.totalStudents')} value={active.length} icon={<GraduationCap className="h-4 w-4" />} /></Link>
        <Link href="/admin/teachers"><StatCard label={t('stat.totalTeachers')} value={teachers.count ?? 0} icon={<Users className="h-4 w-4" />} /></Link>
        <StatCard label={t('stat.activeJobs')} value={jobs.count ?? 0} icon={<Briefcase className="h-4 w-4" />} />
        <Link href="/admin/students?level=red"><StatCard label={t('stat.withWarnings')} value={n('yellow') + n('red')} tone={n('red') ? 'red' : n('yellow') ? 'yellow' : 'green'} icon={<AlertTriangle className="h-4 w-4" />} sub={`${t('level.red')}: ${n('red')} · ${t('level.yellow')}: ${n('yellow')}`} /></Link>
        <StatCard label={t('stat.schoolCompliance')} value={`${pct}%`} tone={pct >= 90 ? 'green' : pct >= 75 ? 'yellow' : 'red'} icon={<Percent className="h-4 w-4" />} />
        <Link href="/admin/students?status=pending"><StatCard label={t('stat.pendingAccounts')} value={pendingAcc.count ?? 0} tone={pendingAcc.count ? 'yellow' : 'blue'} icon={<UserPlus className="h-4 w-4" />} /></Link>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title={t('admin.complianceSplit')} />
          <CardContent><LevelPie green={n('green')} yellow={n('yellow')} red={n('red')} /></CardContent>
        </Card>
        <Card>
          <CardHeader title={t('admin.holidays')} action={<LinkButton href="/admin/holidays">{t('c.edit')}</LinkButton>} />
          <CardContent className="space-y-2">
            {holidays.length === 0 && <p className="text-sm text-slate-500">{t('c.none')}</p>}
            {holidays.slice(0, 5).map((h) => (
              <div key={h.id} className="flex items-start gap-2 text-sm">
                <Sun className={`mt-0.5 h-4 w-4 ${h.kind === 'long_vacation' ? 'text-amber-500' : 'text-slate-400'}`} />
                <div>
                  <p className="font-medium">{lang === 'ja' && h.name_ja ? h.name_ja : h.name} {!h.approved && <Badge tone="slate">draft</Badge>}</p>
                  <p className="text-xs text-slate-500">{h.start_date} → {h.end_date} · {t(`admin.kind.${h.kind}`)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title={t('admin.recentActivity')} action={<LinkButton href="/admin/audit">{t('c.viewAll')}</LinkButton>} />
          <ul className="divide-y divide-slate-100 text-xs">
            {(activity.data ?? []).map((a: any) => (
              <li key={a.id} className="flex justify-between gap-2 px-4 py-2">
                <span><b>{a.users?.full_name ?? a.actor_role}</b> · {a.action} {a.table_name}</span>
                <span className="shrink-0 text-slate-400">{new Date(a.created_at).toLocaleString(lang === 'ja' ? 'ja-JP' : 'en-GB', { timeZone: 'Asia/Tokyo', dateStyle: 'short', timeStyle: 'short' })}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <WeeklyCompliance t={t} current={all} />
      <AttentionList t={t} students={all} basePath="/admin/students" />
    </div>
  );
}
