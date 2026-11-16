import Link from 'next/link';
import { Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getOverview } from '@/lib/data';
import type { TFn, Lang } from '@/lib/i18n';
import { fmtH, todayJST, shortDate } from '@/lib/dates';
import { Button, Card, Empty, Input, LevelBadge, Select, StatusBadge, Table, Td, Th } from './ui';
import { ExportButtons } from './export-buttons';

export type StudentFilters = { q?: string; class?: string; course?: string; status?: string; level?: string };

/** Searchable / filterable student list with compliance numbers (teacher & admin). */
export async function StudentsList({ sp, basePath, t, lang, extraColumn }: {
  sp: StudentFilters; basePath: string; t: TFn; lang: Lang; extraColumn?: boolean;
}) {
  const supabase = await createClient();
  const [all, { data: classes }] = await Promise.all([
    getOverview(),
    supabase.from('classes').select('id,name,course').order('name'),
  ]);
  const courses = [...new Set((classes ?? []).map((c) => c.course))];
  const q = (sp.q ?? '').toLowerCase().trim();
  const rows = all.filter((s) =>
    (!q || s.full_name.toLowerCase().includes(q) || (s.student_no ?? '').toLowerCase().includes(q)) &&
    (!sp.class || s.class_id === sp.class) &&
    (!sp.course || s.course === sp.course) &&
    (!sp.status || s.status === sp.status) &&
    (!sp.level || s.level === sp.level || (sp.level === 'missing' && s.missing_records)));

  const exportRows = rows.map((s) => ({
    student_no: s.student_no ?? '', name: s.full_name, class: s.class_name ?? '', course: s.course ?? '',
    today: s.today_hours, rolling7: s.is_holiday ? 'vacation' : s.rolling7, remaining: s.remaining,
    peak7: s.max_rolling7, level: s.level, jobs: s.active_jobs, pending: s.pending_count,
    last_record: s.last_record_date ?? '', visa_expiry: s.visa_expiry ?? '',
  }));
  const cols = [
    { key: 'student_no', header: t('profile.studentNo') }, { key: 'name', header: t('c.name') }, { key: 'class', header: t('profile.class') },
    { key: 'course', header: t('profile.course') }, { key: 'today', header: t('stat.today') }, { key: 'rolling7', header: t('stat.rolling7') },
    { key: 'remaining', header: t('stat.remaining') }, { key: 'peak7', header: t('teacher.peak') }, { key: 'level', header: t('c.level') },
    { key: 'jobs', header: t('stat.activeJobs') }, { key: 'pending', header: t('stat.pending') }, { key: 'last_record', header: t('teacher.lastRecord') },
    { key: 'visa_expiry', header: t('profile.visaExpiry') },
  ];

  return (
    <Card>
      <form className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-6" method="get">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input name="q" defaultValue={sp.q} placeholder={t('teacher.search')} className="pl-9" />
        </div>
        <Select name="class" defaultValue={sp.class ?? ''}>
          <option value="">{t('teacher.allClasses')}</option>
          {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select name="course" defaultValue={sp.course ?? ''}>
          <option value="">{t('teacher.allCourses')}</option>
          {courses.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select name="level" defaultValue={sp.level ?? ''}>
          <option value="">{t('teacher.allLevels')}</option>
          <option value="red">{t('level.red')}</option>
          <option value="yellow">{t('level.yellow')}</option>
          <option value="green">{t('level.green')}</option>
          <option value="missing">{t('stat.missing')}</option>
        </Select>
        <div className="flex gap-2">
          <Select name="status" defaultValue={sp.status ?? ''}>
            <option value="">{t('teacher.allStatus')}</option>
            <option value="active">{t('status.active')}</option>
            <option value="inactive">{t('status.inactive')}</option>
            <option value="pending">{t('status.pending')}</option>
          </Select>
          <Button type="submit" variant="outline">{t('c.filter')}</Button>
        </div>
      </form>
      <div className="flex items-center justify-between px-4 py-2 text-xs text-slate-500">
        <span>{rows.length} / {all.length}</span>
        <ExportButtons title={`Student compliance report ${todayJST()}`} filename={`students-${todayJST()}`} columns={cols}
          pdfColumns={cols.map((c) => ({ ...c, header: c.key.replace('_', ' ') }))} rows={exportRows} />
      </div>
      {rows.length === 0 ? <Empty>{t('c.noData')}</Empty> : (
        <Table>
          <thead>
            <tr>
              <Th>{t('c.name')}</Th><Th>{t('profile.class')}</Th>
              <Th className="text-right">{t('stat.today')}</Th><Th className="text-right">{t('stat.rolling7')}</Th>
              <Th className="text-right">{t('stat.remaining')}</Th><Th>{t('c.level')}</Th>
              <Th className="text-right">{t('nav.jobs')}</Th><Th className="text-right">{t('stat.pending')}</Th><Th>{t('teacher.lastRecord')}</Th>
              {extraColumn && <Th>{t('c.status')}</Th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.student_id} className="hover:bg-slate-50">
                <Td>
                  <Link href={`${basePath}/${s.student_id}`} className="font-medium text-primary hover:underline">{s.full_name}</Link>
                  <p className="text-xs text-slate-500">{s.student_no ?? '—'} · {s.nationality ?? ''}</p>
                </Td>
                <Td className="whitespace-nowrap text-xs">{s.class_name ?? '—'}<p className="text-slate-400">{s.course}</p></Td>
                <Td className="text-right">{fmtH(s.today_hours)}</Td>
                <Td className="text-right font-semibold">{s.is_holiday ? <span className="text-xs font-normal text-amber-700">{t('sheet.vacation')}</span> : fmtH(s.rolling7)}</Td>
                <Td className="text-right">{fmtH(s.remaining)}</Td>
                <Td><LevelBadge level={s.level} label={t(`level.${s.level}`)} />{!s.work_permit && <p className="mt-1 text-[10px] text-red-600">{t('rule.no_permit').split('—')[0]}</p>}</Td>
                <Td className="text-right">{s.active_jobs}</Td>
                <Td className="text-right">{s.pending_count || ''}</Td>
                <Td className="whitespace-nowrap text-xs">{s.last_record_date ? shortDate(s.last_record_date, lang) : '—'}{s.missing_records && <p className="text-amber-600">{t('stat.missing')}</p>}</Td>
                {extraColumn && <Td><StatusBadge status={s.status} label={t(`status.${s.status}`)} /></Td>}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
