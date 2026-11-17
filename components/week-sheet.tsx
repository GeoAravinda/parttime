'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus, Send, Trash2, X, Lock, MessageSquareWarning } from 'lucide-react';
import type { ComplianceDay, Job, WorkRecord } from '@/lib/types';
import { shortDate, hhmm, fmtH } from '@/lib/dates';
import { useI18n } from './i18n-provider';
import { ActionForm, SubmitButton } from './action-form';
import { Badge, Button, Card, Field, Input, Select, Textarea, buttonClass, cn, levelBg, levelDot } from './ui';
import { saveRecord, deleteRecord, submitWeek } from '@/app/actions/student';

type Editing = { record?: WorkRecord; date: string; jobId?: string } | null;
const statusTone = { draft: 'slate', submitted: 'blue', approved: 'green', rejected: 'red' } as const;
const overnight = (r: WorkRecord) => r.end_time <= r.start_time;
const jobActiveOn = (j: Job, d: string) => d >= j.start_date && (!j.end_date || d <= j.end_date);

/**
 * Digital version of the paper アルバイト sheet: one row per day (Mon–Sun), one column per job,
 * daily total (all jobs) and the rolling 7-day total for every day — all numbers come from the server.
 */
export function WeekSheet({ monday, days, records, jobs, editable, today, prevHref, nextHref, todayHref, allowDelete = true }: {
  monday: string; days: ComplianceDay[]; records: WorkRecord[]; jobs: Job[]; editable: boolean; today: string;
  prevHref: string; nextHref: string; todayHref: string; allowDelete?: boolean;
}) {
  const { t, lang } = useI18n();
  const [editing, setEditing] = useState<Editing>(null);
  const cols = jobs.filter((j) => j.status === 'active' || records.some((r) => r.job_id === j.id));
  const weekTotal = days.reduce((s, d) => s + d.day_hours, 0);
  const lastDay = days[days.length - 1]?.day ?? monday;
  const isMonth = days.length > 7;
  // In month view, a thicker line before each Monday shows the calendar weeks
  const weekStart = (day: string, i: number) => isMonth && i > 0 && new Date(day + 'T00:00').getDay() === 1;
  // Long month lists: jump to today's row on open
  useEffect(() => {
    if (isMonth) document.querySelectorAll(`[data-day="${today}"]`).forEach((el) => {
      if ((el as HTMLElement).offsetParent) el.scrollIntoView({ block: 'center' });
    });
  }, [isMonth, today, monday]);
  const canSubmit = editable && records.some((r) => r.status === 'draft' || r.status === 'rejected');
  const cell = (day: string, jobId: string) => records.filter((r) => r.work_date === day && r.job_id === jobId);
  const isLocked = (r: WorkRecord) => r.status === 'submitted' || r.status === 'approved';

  const Shift = ({ r, showJob }: { r: WorkRecord; showJob?: boolean }) => (
    <button type="button" disabled={!editable}
      onClick={() => setEditing({ record: r, date: r.work_date })}
      className={cn('flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1 text-left text-xs',
        r.status === 'rejected' ? 'border-red-200 bg-red-50' : r.status === 'approved' ? 'border-emerald-200 bg-emerald-50/60' : r.status === 'submitted' ? 'border-blue-200 bg-blue-50/60' : 'border-slate-200 bg-white',
        editable && 'hover:border-primary')}>
      <span className="min-w-0">
        {showJob && <span className="block truncate font-medium text-slate-700">{r.jobs?.company_name}</span>}
        <span className="font-mono text-slate-800">{hhmm(r.start_time)}–{hhmm(r.end_time)}{overnight(r) && <sup className="text-amber-600">+1</sup>}</span>
        {r.break_minutes > 0 && <span className="ml-1 text-slate-500">(−{r.break_minutes}m)</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <span className="font-semibold">{fmtH(r.hours)}h</span>
        {isLocked(r) ? <Lock className="h-3 w-3 text-slate-400" /> : null}
        {r.status !== 'draft' && <span className={cn('h-2 w-2 rounded-full', r.status === 'approved' ? 'bg-emerald-500' : r.status === 'rejected' ? 'bg-red-500' : 'bg-blue-500')} />}
      </span>
    </button>
  );

  const AddBtn = ({ day, jobId }: { day: string; jobId?: string }) =>
    editable && day <= today ? (
      <button type="button" onClick={() => setEditing({ date: day, jobId })}
        className="flex h-7 w-full items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-400 hover:border-primary hover:text-primary"
        aria-label={t('sheet.addShift')}>
        <Plus className="h-4 w-4" />
      </button>
    ) : null;

  const Rolling = ({ d }: { d: ComplianceDay }) => (
    d.is_holiday
      ? <span className="text-xs font-medium text-amber-700">{t('sheet.vacation')}</span>
      : <span className="font-semibold">{fmtH(d.rolling7)}<span className="text-xs font-normal text-slate-500"> h</span></span>
  );

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-1">
          <Link href={prevHref} className={buttonClass('outline', 'icon')} aria-label={t('c.prev')}><ChevronLeft className="h-4 w-4" /></Link>
          <Link href={todayHref} className={buttonClass('outline', 'sm')}>{t('c.today')}</Link>
          <Link href={nextHref} className={buttonClass('outline', 'icon')} aria-label={t('c.next')}><ChevronRight className="h-4 w-4" /></Link>
          <span className="ml-2 text-sm font-semibold text-slate-800">{shortDate(monday, lang)} – {shortDate(lastDay, lang)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">{t(isMonth ? 'sheet.monthTotal' : 'sheet.weekTotal')}: <b>{fmtH(weekTotal)} h</b></span>
          {canSubmit && (
            <ActionForm action={submitWeek} confirm={t(isMonth ? 'sheet.submitMonthConfirm' : 'sheet.submitConfirm')} hideMessage>
              <input type="hidden" name="week" value={monday} />
              <input type="hidden" name="to" value={lastDay} />
              <SubmitButton size="sm"><Send className="h-4 w-4" />{t(isMonth ? 'sheet.submitMonth' : 'sheet.submitWeek')}</SubmitButton>
            </ActionForm>
          )}
        </div>
      </div>

      {editable && cols.length === 0 && <p className="p-4 text-sm text-amber-700">{t('student.noJobs')}</p>}

      {/* Desktop / tablet: paper-sheet table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="w-32 border-b border-slate-200 px-3 py-2 text-left">{t('sheet.day')}</th>
              {cols.map((j, i) => (
                <th key={j.id} className="border-b border-l border-slate-200 px-3 py-2 text-left normal-case">
                  <span className="text-[10px] uppercase text-slate-400">{t('c.job')} {i + 1}</span>
                  <span className="block truncate text-xs font-semibold text-slate-700">{j.company_name}</span>
                  <span className="block truncate text-[11px] font-normal text-slate-500">{j.workplace_name}</span>
                </th>
              ))}
              <th className="w-24 border-b border-l border-slate-200 px-3 py-2 text-right">{t('sheet.dayTotal')}</th>
              <th className="w-28 border-b border-l border-slate-200 px-3 py-2 text-right">{t('sheet.rolling')}</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => (
              <tr key={d.day} data-day={d.day} className={cn(d.day === today && 'bg-primary-50/40', weekStart(d.day, i) && '[&>td]:border-t-2 [&>td]:border-t-slate-300')}>
                <td className="border-b border-slate-100 px-3 py-2 align-top">
                  <span className={cn('font-medium', [0, 6].includes(new Date(d.day + 'T00:00').getDay()) && 'text-rose-600')}>{shortDate(d.day, lang)}</span>
                  {d.is_holiday && <Badge tone="yellow" className="mt-1">{t('sheet.vacation')}</Badge>}
                </td>
                {cols.map((j) => (
                  <td key={j.id} className="border-b border-l border-slate-100 px-2 py-1.5 align-top">
                    <div className="space-y-1">
                      {cell(d.day, j.id).map((r) => <Shift key={r.id} r={r} />)}
                      {j.status === 'active' && jobActiveOn(j, d.day) && <AddBtn day={d.day} jobId={j.id} />}
                    </div>
                  </td>
                ))}
                <td className={cn('border-b border-l border-slate-100 px-3 py-2 text-right align-top font-semibold', d.is_holiday && d.day_hours > 0 && levelBg[d.level])}>
                  {fmtH(d.day_hours)} h
                </td>
                <td className={cn('border-b border-l border-slate-100 px-3 py-2 text-right align-top', !d.is_holiday && levelBg[d.level])}>
                  <span className="inline-flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', levelDot[d.level])} /><Rolling d={d} /></span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per day */}
      <div className="divide-y divide-slate-100 md:hidden">
        {days.map((d, i) => {
          const recs = records.filter((r) => r.work_date === d.day);
          return (
            <div key={d.day} data-day={d.day} className={cn('px-4 py-3', d.day === today && 'bg-primary-50/40', weekStart(d.day, i) && 'border-t-4 border-t-slate-200')}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full', levelDot[d.level])} />
                  <span className="font-medium">{shortDate(d.day, lang)}</span>
                  {d.is_holiday && <Badge tone="yellow">{t('sheet.vacation')}</Badge>}
                </div>
                <div className="text-right text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">{fmtH(d.day_hours)} h</span>
                  {!d.is_holiday && <span className="ml-2">7d: <b className={cn(d.level === 'red' ? 'text-red-600' : d.level === 'yellow' ? 'text-amber-600' : 'text-slate-800')}>{fmtH(d.rolling7)}</b></span>}
                </div>
              </div>
              <div className="space-y-1.5">
                {recs.map((r) => <Shift key={r.id} r={r} showJob />)}
                {cols.some((j) => j.status === 'active' && jobActiveOn(j, d.day)) && <AddBtn day={d.day} />}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        {(['draft', 'submitted', 'approved', 'rejected'] as const).map((s) => (
          <Badge key={s} tone={statusTone[s]}>{t(`status.${s}`)}</Badge>
        ))}
        <span><sup className="text-amber-600">+1</sup> {t('sheet.overnight')}</span>
      </div>

      {editing && editable && (
        <ShiftEditor editing={editing} jobs={jobs} today={today} allowDelete={allowDelete} onClose={() => setEditing(null)} />
      )}
    </Card>
  );
}

function ShiftEditor({ editing, jobs, today, allowDelete, onClose }: {
  editing: NonNullable<Editing>; jobs: Job[]; today: string; allowDelete: boolean; onClose: () => void;
}) {
  const { t } = useI18n();
  const r = editing.record;
  const locked = r && (r.status === 'submitted' || r.status === 'approved');
  const activeJobs = jobs.filter((j) => j.status === 'active' || j.id === r?.job_id);
  const disabled = !!locked;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">{r ? t('sheet.editShift') : t('sheet.addShift')}</h3>
          <button onClick={onClose} className="p-1 text-slate-500" aria-label={t('c.cancel')}><X className="h-5 w-5" /></button>
        </div>
        {r && <div className="mb-3"><Badge tone={statusTone[r.status]}>{t(`status.${r.status}`)}</Badge></div>}
        {locked && <p className="mb-3 flex items-center gap-2 rounded-md bg-slate-50 p-2 text-sm text-slate-600"><Lock className="h-4 w-4" />{t('sheet.locked')}</p>}
        {r?.teacher_comment && (
          <p className="mb-3 flex gap-2 rounded-md bg-red-50 p-2 text-sm text-red-700"><MessageSquareWarning className="h-4 w-4 shrink-0" /><span><b>{t('student.feedback')}:</b> {r.teacher_comment}</span></p>
        )}
        <ActionForm action={saveRecord} onSuccess={onClose} className="grid grid-cols-2 gap-3">
          {r && <input type="hidden" name="id" value={r.id} />}
          <Field label={t('c.date')} className="col-span-2">
            <Input type="date" name="work_date" defaultValue={editing.date} max={today} required disabled={disabled} />
          </Field>
          <Field label={t('c.job')} className="col-span-2">
            <Select name="job_id" defaultValue={r?.job_id ?? editing.jobId ?? activeJobs[0]?.id} required disabled={disabled}>
              {activeJobs.map((j) => <option key={j.id} value={j.id}>{j.company_name} — {j.workplace_name}</option>)}
            </Select>
          </Field>
          <Field label={t('c.start')}><Input type="time" name="start_time" defaultValue={hhmm(r?.start_time) || '09:00'} required disabled={disabled} step={300} /></Field>
          <Field label={t('c.end')} hint={t('sheet.overnight') + ': 22:00 → 06:00'}><Input type="time" name="end_time" defaultValue={hhmm(r?.end_time) || '13:00'} required disabled={disabled} step={300} /></Field>
          <Field label={t('c.break')}><Input type="number" name="break_minutes" min={0} max={600} step={5} defaultValue={r?.break_minutes ?? 0} disabled={disabled} inputMode="numeric" /></Field>
          <Field label={t('c.note')} className="col-span-2"><Textarea name="note" defaultValue={r?.note ?? ''} rows={2} disabled={disabled} /></Field>
          {!locked && (
            <div className="col-span-2 flex flex-wrap justify-end gap-2 pt-1">
              <SubmitButton variant="outline" name="intent" value="draft">{t('c.save')}</SubmitButton>
              <SubmitButton name="intent" value="submit"><Send className="h-4 w-4" />{t('c.save')} + {t('c.submit')}</SubmitButton>
            </div>
          )}
        </ActionForm>
        {r && !locked && allowDelete && (
          <ActionForm action={deleteRecord} confirm={t('c.confirmDelete')} onSuccess={onClose} className="mt-3 border-t border-slate-100 pt-3">
            <input type="hidden" name="id" value={r.id} />
            <SubmitButton variant="ghost" size="sm" className="text-red-600"><Trash2 className="h-4 w-4" />{t('c.delete')}</SubmitButton>
          </ActionForm>
        )}
        {locked && <div className="mt-3 flex justify-end"><Button variant="outline" onClick={onClose}>{t('c.cancel')}</Button></div>}
      </div>
    </div>
  );
}
