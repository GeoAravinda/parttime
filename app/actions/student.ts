'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { isYmd, addDaysYmd } from '@/lib/dates';
import type { ActionState } from '@/lib/types';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const done = (ok: string): ActionState => { revalidatePath('/', 'layout'); return { ok }; };

/** Create or update one shift. All validation is repeated in the database triggers. */
export async function saveRecord(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireRole('student');
  const id = str(fd, 'id');
  const work_date = str(fd, 'work_date');
  const start_time = str(fd, 'start_time');
  const end_time = str(fd, 'end_time');
  const break_minutes = Number(str(fd, 'break_minutes') || 0);
  const job_id = str(fd, 'job_id');
  const submit = str(fd, 'intent') === 'submit';
  if (!isYmd(work_date)) return { error: 'Please enter a valid date. / 日付を入力してください。' };
  if (!TIME.test(start_time) || !TIME.test(end_time)) return { error: 'Please enter start and end time (HH:MM). / 開始・終了時刻を入力してください。' };
  if (!Number.isInteger(break_minutes) || break_minutes < 0 || break_minutes > 600) return { error: 'Break must be 0–600 minutes. / 休憩は0〜600分です。' };
  if (!job_id) return { error: 'Please choose a job. / アルバイト先を選択してください。' };

  const row = {
    student_id: user.id, job_id, work_date, start_time, end_time, break_minutes,
    note: str(fd, 'note') || null, status: submit ? 'submitted' : 'draft',
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from('work_records').update(row).eq('id', id).eq('student_id', user.id).select('id').single()
    : await supabase.from('work_records').insert(row).select('id').single();
  if (error) return { error: error.code === 'PGRST116' ? 'This record is locked (submitted or approved). / この記録は変更できません。' : friendlyError(error) };
  return done(submit ? 'Saved and submitted / 保存して提出しました' : 'Saved / 保存しました');
}

export async function deleteRecord(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireRole('student');
  const supabase = await createClient();
  const { data, error } = await supabase.from('work_records').delete().eq('id', str(fd, 'id')).eq('student_id', user.id).select('id');
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: 'This record can no longer be deleted. / この記録は削除できません。' };
  return done('Deleted / 削除しました');
}

/** Submit every draft / rejected record in the week (Mon..Sun). */
export async function submitWeek(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireRole('student');
  const monday = str(fd, 'week');
  if (!isYmd(monday)) return { error: 'Invalid week' };
  const supabase = await createClient();
  const { data, error } = await supabase.from('work_records').update({ status: 'submitted' })
    .eq('student_id', user.id).in('status', ['draft', 'rejected'])
    .gte('work_date', monday).lte('work_date', addDaysYmd(monday, 6)).select('id');
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: 'Nothing to submit this week. / 提出する記録はありません。' };
  return done(`${data.length} record(s) submitted / ${data.length}件を提出しました`);
}

export async function submitRecord(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireRole('student');
  const supabase = await createClient();
  const { data, error } = await supabase.from('work_records').update({ status: 'submitted' })
    .eq('id', str(fd, 'id')).eq('student_id', user.id).in('status', ['draft', 'rejected']).select('id');
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: 'This record cannot be submitted. / 提出できません。' };
  return done('Submitted / 提出しました');
}

export async function saveJob(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireRole('student');
  const id = str(fd, 'id');
  const start_date = str(fd, 'start_date');
  const end_date = str(fd, 'end_date');
  if (!str(fd, 'company_name') || !str(fd, 'workplace_name') || !str(fd, 'job_type')) return { error: 'Please fill in all job fields. / 全ての項目を入力してください。' };
  if (!isYmd(start_date) || (end_date && !isYmd(end_date))) return { error: 'Invalid date / 日付が正しくありません' };
  const row = {
    student_id: user.id,
    company_name: str(fd, 'company_name'), workplace_name: str(fd, 'workplace_name'), job_type: str(fd, 'job_type'),
    start_date, end_date: end_date || null,
    status: str(fd, 'status') === 'inactive' ? 'inactive' : 'active',
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from('jobs').update(row).eq('id', id).eq('student_id', user.id)
    : await supabase.from('jobs').insert(row);
  if (error) return { error: friendlyError(error) };
  return done('Saved / 保存しました');
}

export async function deleteJob(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireRole('student');
  const supabase = await createClient();
  const { data, error } = await supabase.from('jobs').delete().eq('id', str(fd, 'id')).eq('student_id', user.id).select('id');
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: 'Jobs that already have work records cannot be deleted — set them to Inactive instead. / 勤務記録があるため削除できません。「無効」にしてください。' };
  return done('Deleted / 削除しました');
}

export async function updateProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireRole('student');
  for (const k of ['date_of_birth', 'visa_expiry']) {
    const v = str(fd, k);
    if (v && !isYmd(v)) return { error: 'Invalid date / 日付が正しくありません' };
  }
  const supabase = await createClient();
  const name = str(fd, 'full_name');
  if (name) {
    const { error } = await supabase.from('users').update({ full_name: name }).eq('id', user.id);
    if (error) return { error: friendlyError(error) };
  }
  const { error } = await supabase.from('student_profiles').update({
    nationality: str(fd, 'nationality') || null,
    date_of_birth: str(fd, 'date_of_birth') || null,
    visa_type: str(fd, 'visa_type') || null,
    visa_expiry: str(fd, 'visa_expiry') || null,
    work_permit_no: str(fd, 'work_permit_no') || null,
    phone: str(fd, 'phone') || null,
  }).eq('user_id', user.id);
  if (error) return { error: friendlyError(error) };
  return done('Saved / 保存しました');
}

export async function markAllRead(_: ActionState, _fd: FormData): Promise<ActionState> {
  const user = await requireRole('student', 'teacher', 'admin');
  const supabase = await createClient();
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
  return done('OK');
}
