import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import { createClient } from '@/lib/supabase/server';
import { getOverview } from '@/lib/data';
import { fmtH, isYmd, monthEnd, monthStart, todayJST } from '@/lib/dates';
import { Button, Card, CardHeader, Empty, Input, PageHeader, Table, Td, Th, cn } from '@/components/ui';
import { ExportButtons } from '@/components/export-buttons';

type Rep = { student_id: string; full_name: string; student_no: string | null; class_name: string | null; status: string;
  total_hours: number; days_worked: number; max_rolling7: number; max_holiday_day: number; yellow_days: number; red_days: number };

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireRole('admin');
  const { t } = await getT();
  const sp = await searchParams;
  const today = todayJST();
  const month = monthStart(sp.month && isYmd(`${sp.month}-01`) ? `${sp.month}-01` : today);
  const supabase = await createClient();
  const [{ data, error }, overview] = await Promise.all([
    supabase.rpc('period_report', { p_from: month, p_to: monthEnd(month) }),
    getOverview(),
  ]);
  const rows = ((data ?? []) as Rep[]).filter((r) => r.status !== 'pending');
  const ym = month.slice(0, 7);

  const monthlyCols = [
    { key: 'student_no', header: t('profile.studentNo') }, { key: 'name', header: t('c.name') }, { key: 'class', header: t('profile.class') },
    { key: 'total', header: `${t('c.total')} (h)` }, { key: 'days', header: 'Days worked' }, { key: 'peak7', header: t('teacher.peak') },
    { key: 'peakDay', header: 'Max vacation day (h)' }, { key: 'yellow', header: `${t('level.yellow')} (days)` }, { key: 'red', header: `${t('level.red')} (days)` },
  ];
  const monthlyRows = rows.map((r) => ({
    student_no: r.student_no ?? '', name: r.full_name, class: r.class_name ?? '', total: Number(r.total_hours), days: r.days_worked,
    peak7: Number(r.max_rolling7), peakDay: Number(r.max_holiday_day), yellow: r.yellow_days, red: r.red_days,
  }));
  const currentCols = [
    { key: 'student_no', header: t('profile.studentNo') }, { key: 'name', header: t('c.name') }, { key: 'class', header: t('profile.class') },
    { key: 'rolling7', header: t('stat.rolling7') }, { key: 'remaining', header: t('stat.remaining') }, { key: 'level', header: t('c.level') },
    { key: 'pending', header: t('stat.pending') }, { key: 'last', header: t('teacher.lastRecord') },
  ];
  const currentRows = overview.filter((s) => s.status === 'active').map((s) => ({
    student_no: s.student_no ?? '', name: s.full_name, class: s.class_name ?? '', rolling7: s.is_holiday ? 'vacation' : s.rolling7,
    remaining: s.remaining, level: s.level, pending: s.pending_count, last: s.last_record_date ?? '',
  }));

  return (
    <div className="space-y-5">
      <PageHeader title={t('nav.reports')} />
      <Card>
        <CardHeader title={t('admin.complianceReport')} description={today}
          action={<ExportButtons title={`School compliance report ${today}`} filename={`compliance-${today}`} columns={currentCols}
            pdfColumns={currentCols.map((c) => ({ ...c, header: c.key }))} rows={currentRows} />} />
      </Card>
      <Card>
        <CardHeader title={t('admin.monthlyReport')} description={ym}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <form method="get" className="flex gap-2">
                <Input type="month" name="month" defaultValue={ym} className="h-8 w-40" />
                <Button type="submit" variant="outline" size="sm">{t('c.view')}</Button>
              </form>
              <ExportButtons title={`Monthly work hours ${ym}`} filename={`monthly-hours-${ym}`} columns={monthlyCols}
                pdfColumns={monthlyCols.map((c) => ({ ...c, header: c.key }))} rows={monthlyRows} />
            </div>
          } />
        {error && <p className="p-4 text-sm text-red-600">{error.message}</p>}
        {rows.length === 0 ? <Empty>{t('c.noData')}</Empty> : (
          <Table>
            <thead><tr>{monthlyCols.map((c) => <Th key={c.key} className={c.key === 'name' || c.key === 'class' || c.key === 'student_no' ? '' : 'text-right'}>{c.header}</Th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student_id} className="hover:bg-slate-50">
                  <Td>{r.student_no}</Td>
                  <Td><Link href={`/admin/students/${r.student_id}?month=${month}`} className="text-primary hover:underline">{r.full_name}</Link></Td>
                  <Td>{r.class_name}</Td>
                  <Td className="text-right font-semibold">{fmtH(r.total_hours)}</Td>
                  <Td className="text-right">{r.days_worked}</Td>
                  <Td className={cn('text-right', Number(r.max_rolling7) > 28 && 'font-semibold text-red-600')}>{fmtH(r.max_rolling7)}</Td>
                  <Td className={cn('text-right', Number(r.max_holiday_day) > 8 && 'font-semibold text-red-600')}>{fmtH(r.max_holiday_day)}</Td>
                  <Td className="text-right">{r.yellow_days || ''}</Td>
                  <Td className={cn('text-right', r.red_days > 0 && 'font-semibold text-red-600')}>{r.red_days || ''}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
