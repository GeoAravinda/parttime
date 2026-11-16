import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileWarning, Users, XCircle } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import { getOverview } from '@/lib/data';
import { PageHeader, StatCard } from '@/components/ui';
import { AttentionList, WeeklyCompliance } from '@/components/compliance-dashboard';

export default async function TeacherHome() {
  const user = await requireRole('teacher');
  const { t } = await getT();
  const all = await getOverview();
  const active = all.filter((s) => s.status === 'active');
  const count = (l: string) => active.filter((s) => s.level === l).length;
  const pending = active.reduce((a, s) => a + s.pending_count, 0);
  const missing = active.filter((s) => s.missing_records).length;
  return (
    <div className="space-y-5">
      <PageHeader title={t('nav.overview')} description={user.full_name} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Link href="/teacher/students"><StatCard label={t('teacher.assigned')} value={active.length} icon={<Users className="h-4 w-4" />} /></Link>
        <Link href="/teacher/students?level=green"><StatCard label={t('stat.compliant')} value={count('green')} tone="green" icon={<CheckCircle2 className="h-4 w-4" />} /></Link>
        <Link href="/teacher/students?level=yellow"><StatCard label={t('stat.approaching')} value={count('yellow')} tone="yellow" icon={<AlertTriangle className="h-4 w-4" />} /></Link>
        <Link href="/teacher/students?level=red"><StatCard label={t('stat.exceeding')} value={count('red')} tone="red" icon={<XCircle className="h-4 w-4" />} /></Link>
        <Link href="/teacher/approvals"><StatCard label={t('stat.pendingApprovals')} value={pending} icon={<ClipboardCheck className="h-4 w-4" />} /></Link>
        <Link href="/teacher/missing"><StatCard label={t('stat.missing')} value={missing} tone={missing ? 'yellow' : 'green'} icon={<FileWarning className="h-4 w-4" />} /></Link>
      </div>
      <WeeklyCompliance t={t} current={all} />
      <AttentionList t={t} students={all} basePath="/teacher/students" />
    </div>
  );
}
