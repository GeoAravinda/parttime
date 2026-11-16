import Link from 'next/link';
import type { WorkRecord } from '@/lib/types';
import type { TFn, Lang } from '@/lib/i18n';
import { hhmm, shortDate, fmtH } from '@/lib/dates';
import { Empty, StatusBadge, Table, Td, Th } from './ui';
import { ReviewControls } from './review-controls';

type Row = WorkRecord & { users?: { full_name: string } | null };

/** Work records list. With `review`, submitted rows get approve / reject controls (teacher/admin). */
export function RecordsTable({ records, t, lang, review, showStudent, bulk, studentHref }: {
  records: Row[]; t: TFn; lang: Lang; review?: boolean; showStudent?: boolean; bulk?: boolean; studentHref?: string;
}) {
  if (!records.length) return <Empty>{t('c.noData')}</Empty>;
  return (
    <Table>
      <thead>
        <tr>
          {bulk && <Th className="w-8" />}
          <Th>{t('c.date')}</Th>
          {showStudent && <Th>{t('c.name')}</Th>}
          <Th>{t('c.job')}</Th>
          <Th>{t('c.start')}–{t('c.end')}</Th>
          <Th className="text-right">{t('c.hours')}</Th>
          <Th>{t('c.status')}</Th>
          <Th>{t('c.comment')}</Th>
          {review && <Th>{t('c.actions')}</Th>}
        </tr>
      </thead>
      <tbody>
        {records.map((r) => (
          <tr key={r.id} className="hover:bg-slate-50">
            {bulk && (
              <Td>{r.status === 'submitted' && <input type="checkbox" name="ids" value={r.id} form="bulk-approve" className="h-4 w-4" aria-label="select" />}</Td>
            )}
            <Td className="whitespace-nowrap">{shortDate(r.work_date, lang)}</Td>
            {showStudent && (
              <Td className="whitespace-nowrap">
                {studentHref ? <Link className="text-primary hover:underline" href={`${studentHref}/${r.student_id}`}>{r.users?.full_name}</Link> : r.users?.full_name}
              </Td>
            )}
            <Td className="max-w-[180px] truncate">{r.jobs?.company_name} <span className="text-slate-400">{r.jobs?.workplace_name}</span></Td>
            <Td className="whitespace-nowrap font-mono text-xs">
              {hhmm(r.start_time)}–{hhmm(r.end_time)}{r.end_time <= r.start_time && <sup className="text-amber-600">+1</sup>}
              {r.break_minutes > 0 && <span className="ml-1 text-slate-400">−{r.break_minutes}m</span>}
            </Td>
            <Td className="text-right font-semibold">{fmtH(r.hours)}</Td>
            <Td><StatusBadge status={r.status} label={t(`status.${r.status}`)} /></Td>
            <Td className="max-w-[220px] text-xs text-slate-600">{r.teacher_comment ?? (r.note ? <span className="text-slate-400">{r.note}</span> : '')}</Td>
            {review && <Td>{r.status === 'submitted' && <ReviewControls id={r.id} />}</Td>}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
