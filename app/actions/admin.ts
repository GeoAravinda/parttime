'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { isYmd } from '@/lib/dates';
import type { ActionState } from '@/lib/types';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const optDate = (fd: FormData, k: string) => { const v = str(fd, k); return v && isYmd(v) ? v : null; };
const done = (ok: string): ActionState => { revalidatePath('/', 'layout'); return { ok }; };

export async function createAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole('admin');
  const role = str(fd, 'role');
  if (!['student', 'teacher', 'admin'].includes(role)) return { error: 'Invalid role' };
  const email = str(fd, 'email');
  const password = String(fd.get('password') ?? '');
  const full_name = str(fd, 'full_name');
  if (!email || !full_name) return { error: 'Name and email are required. / 氏名とメールは必須です。' };
  if (password.length < 8) return { error: 'Initial password must be at least 8 characters. / 初期パスワードは8文字以上です。' };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name, student_no: str(fd, 'student_no') },
    app_metadata: { role },
  });
  if (error || !data.user) return { error: friendlyError(error) };

  const supabase = await createClient();
  if (role === 'student') {
    const { error: e2 } = await supabase.from('student_profiles').update({
      student_no: str(fd, 'student_no') || null,
      nationality: str(fd, 'nationality') || null,
      date_of_birth: optDate(fd, 'date_of_birth'),
      class_id: str(fd, 'class_id') || null,
      visa_type: str(fd, 'visa_type') || 'Student (留学)',
      visa_expiry: optDate(fd, 'visa_expiry'),
      work_permit: fd.get('work_permit') === 'on',
      enrollment_date: optDate(fd, 'enrollment_date'),
    }).eq('user_id', data.user.id);
    if (e2) return { error: friendlyError(e2) };
    const teacherId = str(fd, 'teacher_id');
    if (teacherId) await supabase.from('teacher_student_assignments').insert({ teacher_id: teacherId, student_id: data.user.id });
  } else if (role === 'teacher') {
    await supabase.from('teacher_profiles').update({ staff_no: str(fd, 'staff_no') || null }).eq('user_id', data.user.id);
  }
  return done(`Account created: ${email} / アカウントを作成しました`);
}

export async function setAccountStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireRole('admin');
  const id = str(fd, 'id');
  const status = str(fd, 'status');
  if (!['active', 'inactive', 'pending'].includes(status)) return { error: 'Invalid status' };
  if (id === me.id) return { error: 'You cannot change your own status. / 自分のステータスは変更できません。' };
  const supabase = await createClient();
  const { error } = await supabase.from('users').update({ status }).eq('id', id);
  if (error) return { error: friendlyError(error) };
  return done('Updated / 更新しました');
}

export async function deleteAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireRole('admin');
  const id = str(fd, 'id');
  if (id === me.id) return { error: 'You cannot delete your own account. / 自分のアカウントは削除できません。' };
  const supabase = await createClient();
  await supabase.rpc('log_event', { p_action: 'delete_account', p_detail: { user_id: id } });
  const { error } = await createAdminClient().auth.admin.deleteUser(id);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/', 'layout');
  const back = str(fd, 'redirect');
  if (back) redirect(back);
  return { ok: 'Deleted / 削除しました' };
}

export async function resetPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole('admin');
  const password = String(fd.get('password') ?? '');
  if (password.length < 8) return { error: 'Password must be at least 8 characters. / 8文字以上にしてください。' };
  const { error } = await createAdminClient().auth.admin.updateUserById(str(fd, 'id'), { password });
  if (error) return { error: friendlyError(error) };
  const supabase = await createClient();
  await supabase.rpc('log_event', { p_action: 'reset_password', p_detail: { user_id: str(fd, 'id') } });
  return { ok: 'Password updated / パスワードを変更しました' };
}

export async function updateStudent(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = str(fd, 'id');
  const supabase = await createClient();
  const { error: e1 } = await supabase.from('users').update({ full_name: str(fd, 'full_name') }).eq('id', id);
  if (e1) return { error: friendlyError(e1) };
  const { error } = await supabase.from('student_profiles').update({
    student_no: str(fd, 'student_no') || null,
    nationality: str(fd, 'nationality') || null,
    date_of_birth: optDate(fd, 'date_of_birth'),
    class_id: str(fd, 'class_id') || null,
    visa_type: str(fd, 'visa_type') || null,
    visa_expiry: optDate(fd, 'visa_expiry'),
    work_permit: fd.get('work_permit') === 'on',
    work_permit_no: str(fd, 'work_permit_no') || null,
    phone: str(fd, 'phone') || null,
    enrollment_date: optDate(fd, 'enrollment_date'),
  }).eq('user_id', id);
  if (error) return { error: friendlyError(error) };
  return done('Saved / 保存しました');
}

export async function updateTeacher(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = str(fd, 'id');
  const supabase = await createClient();
  const { error: e1 } = await supabase.from('users').update({ full_name: str(fd, 'full_name') }).eq('id', id);
  if (e1) return { error: friendlyError(e1) };
  const { error } = await supabase.from('teacher_profiles').upsert({
    user_id: id, staff_no: str(fd, 'staff_no') || null, phone: str(fd, 'phone') || null,
    can_view_all_students: fd.get('can_view_all_students') === 'on',
  });
  if (error) return { error: friendlyError(error) };
  return done('Saved / 保存しました');
}

export async function saveAssignments(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole('admin');
  const teacherId = str(fd, 'teacher_id');
  const ids = fd.getAll('student_ids').map(String).filter(Boolean);
  const supabase = await createClient();
  const { data: current } = await supabase.from('teacher_student_assignments').select('student_id').eq('teacher_id', teacherId);
  const have = new Set((current ?? []).map((r) => r.student_id as string));
  const want = new Set(ids);
  const remove = [...have].filter((x) => !want.has(x));
  const add = [...want].filter((x) => !have.has(x));
  if (remove.length) {
    const { error } = await supabase.from('teacher_student_assignments').delete().eq('teacher_id', teacherId).in('student_id', remove);
    if (error) return { error: friendlyError(error) };
  }
  if (add.length) {
    const { error } = await supabase.from('teacher_student_assignments').insert(add.map((student_id) => ({ teacher_id: teacherId, student_id })));
    if (error) return { error: friendlyError(error) };
  }
  return done(`Saved (+${add.length} / −${remove.length}) / 保存しました`);
}

export async function saveClass(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = str(fd, 'id');
  const row = { name: str(fd, 'name'), course: str(fd, 'course'), level: str(fd, 'level') || null, academic_year: Number(str(fd, 'academic_year')) || null };
  if (!row.name || !row.course) return { error: 'Class name and course are required. / クラス名とコースは必須です。' };
  const supabase = await createClient();
  const { error } = id ? await supabase.from('classes').update(row).eq('id', id) : await supabase.from('classes').insert(row);
  if (error) return { error: friendlyError(error) };
  return done('Saved / 保存しました');
}

export async function deleteClass(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole('admin');
  const supabase = await createClient();
  const { error } = await supabase.from('classes').delete().eq('id', str(fd, 'id'));
  if (error) return { error: friendlyError(error) };
  return done('Deleted / 削除しました');
}

export async function saveHoliday(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireRole('admin');
  const id = str(fd, 'id');
  const start_date = str(fd, 'start_date');
  const end_date = str(fd, 'end_date');
  if (!str(fd, 'name') || !isYmd(start_date) || !isYmd(end_date)) return { error: 'Name and dates are required. / 名称と期間は必須です。' };
  if (end_date < start_date) return { error: 'End date must be after start date. / 終了日は開始日以降にしてください。' };
  const row = {
    name: str(fd, 'name'), name_ja: str(fd, 'name_ja') || null,
    kind: str(fd, 'kind') === 'school_holiday' ? 'school_holiday' : 'long_vacation',
    season: ['summer', 'winter', 'spring'].includes(str(fd, 'season')) ? str(fd, 'season') : 'other',
    start_date, end_date, approved: fd.get('approved') === 'on',
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from('school_holidays').update(row).eq('id', id)
    : await supabase.from('school_holidays').insert({ ...row, created_by: me.id });
  if (error) return { error: friendlyError(error) };
  return done('Saved / 保存しました');
}

export async function deleteHoliday(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole('admin');
  const supabase = await createClient();
  const { error } = await supabase.from('school_holidays').delete().eq('id', str(fd, 'id'));
  if (error) return { error: friendlyError(error) };
  return done('Deleted / 削除しました');
}

export async function saveSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole('admin');
  const num = (k: string) => Number(str(fd, k));
  const row = {
    school_name: str(fd, 'school_name'), school_name_ja: str(fd, 'school_name_ja'),
    address: str(fd, 'address') || null, phone: str(fd, 'phone') || null, email: str(fd, 'email') || null,
    weekly_limit: num('weekly_limit'), weekly_warn: num('weekly_warn'),
    holiday_daily_limit: num('holiday_daily_limit'), holiday_daily_warn: num('holiday_daily_warn'),
    allow_student_delete: fd.get('allow_student_delete') === 'on',
    allow_future_days: Math.max(0, Math.floor(num('allow_future_days') || 0)),
    missing_record_days: Math.max(1, Math.floor(num('missing_record_days') || 7)),
  };
  if (!(row.weekly_warn > 0 && row.weekly_warn <= row.weekly_limit) || !(row.holiday_daily_warn > 0 && row.holiday_daily_warn <= row.holiday_daily_limit))
    return { error: 'Warning thresholds must be positive and not above the limit. / 警告値は上限以下にしてください。' };
  const supabase = await createClient();
  const { error } = await supabase.from('school_settings').update(row).eq('id', 1);
  if (error) return { error: friendlyError(error) };
  return done('Saved / 保存しました');
}
