import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, Checkbox, Field, Input, PageHeader, Select, Table, Td, Th } from '@/components/ui';
import { ActionForm, SubmitButton } from '@/components/action-form';
import { StudentsList, type StudentFilters } from '@/components/students-list';
import { createAccount, setAccountStatus, deleteAccount } from '@/app/actions/admin';

export default async function AdminStudents({ searchParams }: { searchParams: Promise<StudentFilters> }) {
  await requireRole('admin');
  const { t, lang } = await getT();
  const supabase = await createClient();
  const [{ data: pending }, { data: classes }, { data: teachers }] = await Promise.all([
    supabase.from('users').select('id, full_name, email, created_at, student_profiles(student_no, nationality, date_of_birth, visa_expiry)').eq('role', 'student').eq('status', 'pending').order('created_at'),
    supabase.from('classes').select('id,name,course').order('name'),
    supabase.from('users').select('id,full_name').eq('role', 'teacher').eq('status', 'active').order('full_name'),
  ]);
  return (
    <div className="space-y-5">
      <PageHeader title={t('nav.students')} />
      {!!pending?.length && (
        <Card className="border-amber-200">
          <CardHeader title={t('admin.pendingRegistrations')} description={`${pending.length}`} />
          <Table>
            <thead><tr><Th>{t('c.name')}</Th><Th>{t('profile.studentNo')}</Th><Th>{t('profile.nationality')}</Th><Th>{t('profile.visaExpiry')}</Th><Th>{t('c.actions')}</Th></tr></thead>
            <tbody>
              {pending.map((u: any) => (
                <tr key={u.id}>
                  <Td><Link href={`/admin/students/${u.id}`} className="font-medium text-primary hover:underline">{u.full_name}</Link><p className="text-xs text-slate-500">{u.email}</p></Td>
                  <Td>{u.student_profiles?.student_no ?? '—'}</Td>
                  <Td>{u.student_profiles?.nationality ?? '—'}</Td>
                  <Td>{u.student_profiles?.visa_expiry ?? '—'}</Td>
                  <Td>
                    <div className="flex gap-2">
                      <ActionForm action={setAccountStatus}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="status" value="active" /><SubmitButton variant="success" size="sm">{t('admin.approveAccount')}</SubmitButton></ActionForm>
                      <ActionForm action={deleteAccount} confirm={t('admin.deleteConfirm')}><input type="hidden" name="id" value={u.id} /><SubmitButton variant="outline" size="sm" className="text-red-600">{t('c.reject')}</SubmitButton></ActionForm>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Card>
        <details>
          <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-primary">+ {t('admin.createStudent')}</summary>
          <CardContent className="border-t border-slate-100">
            <ActionForm action={createAccount} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="role" value="student" />
              <Field label={`${t('profile.fullName')} *`}><Input name="full_name" required /></Field>
              <Field label={`${t('login.email')} *`}><Input name="email" type="email" required /></Field>
              <Field label={`${t('admin.tempPassword')} *`}><Input name="password" type="text" minLength={8} required autoComplete="off" /></Field>
              <Field label={t('profile.studentNo')}><Input name="student_no" /></Field>
              <Field label={t('profile.nationality')}><Input name="nationality" /></Field>
              <Field label={t('profile.dob')}><Input name="date_of_birth" type="date" /></Field>
              <Field label={t('profile.class')}>
                <Select name="class_id" defaultValue=""><option value="">—</option>{(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.course})</option>)}</Select>
              </Field>
              <Field label={t('role.teacher')}>
                <Select name="teacher_id" defaultValue=""><option value="">—</option>{(teachers ?? []).map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}</Select>
              </Field>
              <Field label={t('profile.visaType')}><Input name="visa_type" defaultValue="Student (留学)" /></Field>
              <Field label={t('profile.visaExpiry')}><Input name="visa_expiry" type="date" /></Field>
              <Field label={t('profile.enrolled')}><Input name="enrollment_date" type="date" /></Field>
              <div className="flex items-end pb-2"><Checkbox name="work_permit" defaultChecked label={t('profile.workPermit')} /></div>
              <div className="sm:col-span-2 lg:col-span-4"><SubmitButton>{t('c.create')}</SubmitButton></div>
            </ActionForm>
          </CardContent>
        </details>
      </Card>

      <StudentsList sp={await searchParams} basePath="/admin/students" t={t} lang={lang} extraColumn />
    </div>
  );
}
