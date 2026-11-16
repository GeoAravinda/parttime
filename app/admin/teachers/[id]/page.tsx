import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, Checkbox, Field, Input } from '@/components/ui';
import { ActionForm, SubmitButton } from '@/components/action-form';
import { AccountControls } from '@/components/account-controls';
import { updateTeacher, saveAssignments } from '@/app/actions/admin';

export default async function AdminTeacher({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin');
  const { t } = await getT();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: u }, { data: students }, { data: assigned }] = await Promise.all([
    supabase.from('users').select('id, full_name, email, status, role, teacher_profiles(staff_no, phone, can_view_all_students)').eq('id', id).eq('role', 'teacher').maybeSingle(),
    supabase.from('users').select('id, full_name, status, student_profiles(student_no, classes(name))').eq('role', 'student').order('full_name'),
    supabase.from('teacher_student_assignments').select('student_id').eq('teacher_id', id),
  ]);
  if (!u) notFound();
  const tp = (u as any).teacher_profiles;
  const mine = new Set((assigned ?? []).map((a) => a.student_id));
  const byClass = new Map<string, any[]>();
  (students ?? []).forEach((s: any) => {
    const k = s.student_profiles?.classes?.name ?? '—';
    byClass.set(k, [...(byClass.get(k) ?? []), s]);
  });
  return (
    <div className="space-y-5">
      <Link href="/admin/teachers" className="inline-block text-sm text-primary hover:underline">← {t('nav.teachers')}</Link>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={u.full_name} description={u.email} />
          <CardContent>
            <ActionForm action={updateTeacher} className="grid gap-3 sm:grid-cols-3">
              <input type="hidden" name="id" value={id} />
              <Field label={t('profile.fullName')}><Input name="full_name" defaultValue={u.full_name} required /></Field>
              <Field label={t('admin.staffNo')}><Input name="staff_no" defaultValue={tp?.staff_no ?? ''} /></Field>
              <Field label={t('profile.phone')}><Input name="phone" defaultValue={tp?.phone ?? ''} /></Field>
              <div className="sm:col-span-3"><Checkbox name="can_view_all_students" defaultChecked={!!tp?.can_view_all_students} label={t('admin.viewAll')} /></div>
              <div className="sm:col-span-3"><SubmitButton>{t('c.save')}</SubmitButton></div>
            </ActionForm>
          </CardContent>
        </Card>
        <AccountControls id={id} status={u.status} t={t} backHref="/admin/teachers" />
      </div>
      <Card>
        <CardHeader title={t('admin.assign')} description={`${mine.size}`} />
        <CardContent>
          <ActionForm action={saveAssignments}>
            <input type="hidden" name="teacher_id" value={id} />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[...byClass.entries()].map(([cls, list]) => (
                <div key={cls} className="rounded-lg border border-slate-200 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-slate-500">{cls}</p>
                  <div className="space-y-1.5">
                    {list.map((s: any) => (
                      <Checkbox key={s.id} name="student_ids" value={s.id} defaultChecked={mine.has(s.id)}
                        label={<span>{s.full_name} <span className="text-xs text-slate-400">{s.student_profiles?.student_no}{s.status !== 'active' ? ` · ${s.status}` : ''}</span></span>} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4"><SubmitButton>{t('admin.saveAssignments')}</SubmitButton></div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
