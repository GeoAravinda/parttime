import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import { createClient } from '@/lib/supabase/server';
import { getStudent } from '@/lib/data';
import { Card, CardContent, CardHeader, Checkbox, Field, Input, Select } from '@/components/ui';
import { ActionForm, SubmitButton } from '@/components/action-form';
import { AccountControls } from '@/components/account-controls';
import { StudentDetail } from '@/components/student-detail';
import { updateStudent } from '@/app/actions/admin';
import { notFound } from 'next/navigation';

export default async function AdminStudent({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole('admin');
  const { t, lang } = await getT();
  const { id } = await params;
  const supabase = await createClient();
  const [{ user, profile: p }, { data: classes }] = await Promise.all([
    getStudent(id), supabase.from('classes').select('id,name,course').order('name'),
  ]);
  if (!user) notFound();
  return (
    <div className="space-y-5">
      <Link href="/admin/students" className="inline-block text-sm text-primary hover:underline">← {t('nav.students')}</Link>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={`${t('c.edit')}: ${user.full_name}`} description={user.email} />
          <CardContent>
            <ActionForm action={updateStudent} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <input type="hidden" name="id" value={id} />
              <Field label={t('profile.fullName')}><Input name="full_name" defaultValue={user.full_name} required /></Field>
              <Field label={t('profile.studentNo')}><Input name="student_no" defaultValue={p?.student_no ?? ''} /></Field>
              <Field label={t('profile.class')}>
                <Select name="class_id" defaultValue={p?.class_id ?? ''}><option value="">—</option>{(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.course})</option>)}</Select>
              </Field>
              <Field label={t('profile.nationality')}><Input name="nationality" defaultValue={p?.nationality ?? ''} /></Field>
              <Field label={t('profile.dob')}><Input type="date" name="date_of_birth" defaultValue={p?.date_of_birth ?? ''} /></Field>
              <Field label={t('profile.phone')}><Input name="phone" defaultValue={p?.phone ?? ''} /></Field>
              <Field label={t('profile.visaType')}><Input name="visa_type" defaultValue={p?.visa_type ?? ''} /></Field>
              <Field label={t('profile.visaExpiry')}><Input type="date" name="visa_expiry" defaultValue={p?.visa_expiry ?? ''} /></Field>
              <Field label={t('profile.enrolled')}><Input type="date" name="enrollment_date" defaultValue={p?.enrollment_date ?? ''} /></Field>
              <Field label={t('profile.permitNo')}><Input name="work_permit_no" defaultValue={p?.work_permit_no ?? ''} /></Field>
              <div className="flex items-end pb-2"><Checkbox name="work_permit" defaultChecked={!!p?.work_permit} label={t('profile.workPermit')} /></div>
              <div className="sm:col-span-2 lg:col-span-3"><SubmitButton>{t('c.save')}</SubmitButton></div>
            </ActionForm>
          </CardContent>
        </Card>
        <AccountControls id={id} status={user.status} t={t} backHref="/admin/students" />
      </div>
      <StudentDetail studentId={id} sp={await searchParams} basePath={`/admin/students/${id}`} t={t} lang={lang} />
    </div>
  );
}
