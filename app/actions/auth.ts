'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { friendlyError } from '@/lib/errors';
import { isYmd } from '@/lib/dates';
import type { ActionState, Role } from '@/lib/types';

const ROLES: Role[] = ['student', 'teacher', 'admin'];
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

export async function signIn(_: ActionState, fd: FormData): Promise<ActionState> {
  const role = str(fd, 'role') as Role;
  if (!ROLES.includes(role)) return { error: 'Invalid login page' };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: str(fd, 'email'), password: String(fd.get('password') ?? '') });
  if (error || !data.user) return { error: friendlyError(error) };

  const { data: profile } = await supabase.from('users').select('role,status').eq('id', data.user.id).maybeSingle();
  if (!profile || profile.status !== 'active') {
    await supabase.auth.signOut();
    redirect('/pending');
  }
  if (profile.role !== role) {
    await supabase.auth.signOut();
    const label = { student: 'Student / 学生', teacher: 'Teacher / 教師', admin: 'Admin / 管理者' }[profile.role as Role];
    return { error: `This account cannot sign in here. Please use the ${label} login. / このログイン画面は使用できません。` };
  }
  await supabase.rpc('log_event', { p_action: 'login', p_detail: { role } });
  redirect(`/${role}`);
}

export async function signUp(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, 'email');
  const password = String(fd.get('password') ?? '');
  const full_name = str(fd, 'full_name');
  if (!full_name || !email) return { error: 'Name and email are required. / 氏名とメールアドレスは必須です。' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters. / パスワードは8文字以上にしてください。' };
  for (const k of ['date_of_birth', 'visa_expiry']) {
    const v = str(fd, k);
    if (v && !isYmd(v)) return { error: `Invalid date: ${k}` };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email, password,
    options: {
      data: {
        full_name,
        student_no: str(fd, 'student_no'),
        nationality: str(fd, 'nationality'),
        date_of_birth: str(fd, 'date_of_birth'),
        visa_type: str(fd, 'visa_type'),
        visa_expiry: str(fd, 'visa_expiry'),
        phone: str(fd, 'phone'),
      },
    },
  });
  if (error) return { error: friendlyError(error) };
  await supabase.auth.signOut();
  return { ok: 'Registration received. You can sign in after the school approves your account. / 登録を受け付けました。学校の承認後にログインできます。' };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function setLang(lang: 'en' | 'ja') {
  const c = await cookies();
  c.set('lang', lang === 'ja' ? 'ja' : 'en', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  revalidatePath('/', 'layout');
}
