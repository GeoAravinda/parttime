import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import { createClient } from '@/lib/supabase/server';
import { Badge, Card, CardContent, Field, Input, PageHeader, Select, StatusBadge, Table, Td, Th } from '@/components/ui';
import { ActionForm, SubmitButton } from '@/components/action-form';
import { createAccount } from '@/app/actions/admin';

export default async function AdminTeachers() {
  await requireRole('admin');
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: staff }, { data: assignments }] = await Promise.all([
    supabase.from('users').select('id, full_name, email, role, status, teacher_profiles(staff_no, can_view_all_students)').in('role', ['teacher', 'admin']).order('role').order('full_name'),
    supabase.from('teacher_student_assignments').select('teacher_id'),
  ]);
  const counts = new Map<string, number>();
  (assignments ?? []).forEach((a) => counts.set(a.teacher_id, (counts.get(a.teacher_id) ?? 0) + 1));
  return (
    <div className="space-y-5">
      <PageHeader title={t('nav.teachers')} />
      <Card>
        <details>
          <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-primary">+ {t('admin.createTeacher')}</summary>
          <CardContent className="border-t border-slate-100">
            <ActionForm action={createAccount} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Field label={`${t('profile.fullName')} *`}><Input name="full_name" required /></Field>
              <Field label={`${t('login.email')} *`}><Input name="email" type="email" required /></Field>
              <Field label={`${t('admin.tempPassword')} *`}><Input name="password" type="text" minLength={8} required autoComplete="off" /></Field>
              <Field label={t('admin.staffNo')}><Input name="staff_no" /></Field>
              <Field label={t('c.status')}>
                <Select name="role" defaultValue="teacher">
                  <option value="teacher">{t('role.teacher')}</option>
                  <option value="admin">{t('role.admin')}</option>
                </Select>
              </Field>
              <div className="sm:col-span-2 lg:col-span-5"><SubmitButton>{t('c.create')}</SubmitButton></div>
            </ActionForm>
          </CardContent>
        </details>
      </Card>
      <Card>
        <Table>
          <thead><tr><Th>{t('c.name')}</Th><Th>{t('admin.staffNo')}</Th><Th>{t('c.status')}</Th><Th className="text-right">{t('teacher.assigned')}</Th><Th>{t('admin.permissions')}</Th></tr></thead>
          <tbody>
            {(staff ?? []).map((u: any) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <Td>
                  {u.role === 'teacher'
                    ? <Link href={`/admin/teachers/${u.id}`} className="font-medium text-primary hover:underline">{u.full_name}</Link>
                    : <span className="font-medium">{u.full_name}</span>}
                  <p className="text-xs text-slate-500">{u.email}</p>
                </Td>
                <Td>{u.teacher_profiles?.staff_no ?? '—'}</Td>
                <Td><StatusBadge status={u.status} label={t(`status.${u.status}`)} /></Td>
                <Td className="text-right">{u.role === 'teacher' ? counts.get(u.id) ?? 0 : '—'}</Td>
                <Td>
                  <Badge tone={u.role === 'admin' ? 'blue' : 'slate'}>{t(`role.${u.role}`)}</Badge>
                  {u.teacher_profiles?.can_view_all_students && <Badge tone="yellow" className="ml-1">{t('admin.viewAll')}</Badge>}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
