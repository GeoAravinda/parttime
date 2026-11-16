'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import type { ActionState } from '@/lib/types';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

/** Approve or reject one submitted record. Teachers only reach their assigned students (RLS). */
export async function reviewRecord(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole('teacher', 'admin');
  const decision = str(fd, 'decision');
  const comment = str(fd, 'comment');
  if (decision !== 'approved' && decision !== 'rejected') return { error: 'Invalid decision' };
  if (decision === 'rejected' && !comment) return { error: 'Please enter a reason for rejection. / 差し戻し理由を入力してください。' };
  const supabase = await createClient();
  const { data, error } = await supabase.from('work_records')
    .update({ status: decision, teacher_comment: comment || null })
    .eq('id', str(fd, 'id')).eq('status', 'submitted').select('id');
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: 'Record not found or already reviewed. / 記録が見つからないか、既に確認済みです。' };
  revalidatePath('/', 'layout');
  return { ok: decision === 'approved' ? 'Approved / 承認しました' : 'Rejected / 差し戻しました' };
}

export async function bulkApprove(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole('teacher', 'admin');
  const ids = fd.getAll('ids').map(String).filter(Boolean);
  if (!ids.length) return { error: 'Select at least one record. / 記録を選択してください。' };
  const supabase = await createClient();
  const { data, error } = await supabase.from('work_records').update({ status: 'approved', teacher_comment: null })
    .in('id', ids).eq('status', 'submitted').select('id');
  if (error) return { error: friendlyError(error) };
  revalidatePath('/', 'layout');
  return { ok: `${data?.length ?? 0} approved / ${data?.length ?? 0}件を承認しました` };
}

export async function logExport(kind: string, detail: Record<string, unknown>) {
  await requireRole('teacher', 'admin');
  const supabase = await createClient();
  await supabase.rpc('log_event', { p_action: `export_${kind}`, p_detail: detail });
}
