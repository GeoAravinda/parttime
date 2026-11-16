import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import { getOverview, getSettings } from '@/lib/data';
import { daysBetween, shortDate, todayJST } from '@/lib/dates';
import type { Role } from '@/lib/types';
import { Card, Empty, PageHeader, Table, Td, Th } from './ui';
import { ExportButtons } from './export-buttons';

export async function MissingPage({ role }: { role: Role }) {
  await requireRole(role);
  const { t, lang } = await getT();
  const [all, settings] = await Promise.all([getOverview(), getSettings()]);
  const today = todayJST();
  const rows = all.filter((s) => s.status === 'active' && s.missing_records);
  const exportRows = rows.map((s) => ({ student_no: s.student_no ?? '', name: s.full_name, class: s.class_name ?? '', last: s.last_record_date ?? 'never', jobs: s.active_jobs, email: s.email }));
  return (
    <div>
      <PageHeader title={t('nav.missing')} description={t('teacher.missingHelp', { n: settings.missing_record_days })}
        action={<ExportButtons title={`Students with missing records ${today}`} filename={`missing-records-${today}`} rows={exportRows}
          columns={[{ key: 'student_no', header: t('profile.studentNo') }, { key: 'name', header: t('c.name') }, { key: 'class', header: t('profile.class') },
            { key: 'last', header: t('teacher.lastRecord') }, { key: 'jobs', header: t('stat.activeJobs') }, { key: 'email', header: t('c.email') }]} />} />
      <Card>
        {rows.length === 0 ? <Empty>{t('c.none')}</Empty> : (
          <Table>
            <thead><tr><Th>{t('c.name')}</Th><Th>{t('profile.class')}</Th><Th>{t('teacher.lastRecord')}</Th><Th className="text-right">{t('stat.activeJobs')}</Th><Th>{t('c.email')}</Th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.student_id}>
                  <Td><Link className="font-medium text-primary hover:underline" href={`/${role}/students/${s.student_id}`}>{s.full_name}</Link><p className="text-xs text-slate-500">{s.student_no}</p></Td>
                  <Td>{s.class_name ?? '—'}</Td>
                  <Td>{s.last_record_date ? `${shortDate(s.last_record_date, lang)} (${daysBetween(s.last_record_date, today)}d)` : '—'}</Td>
                  <Td className="text-right">{s.active_jobs}</Td>
                  <Td className="text-xs">{s.email}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
