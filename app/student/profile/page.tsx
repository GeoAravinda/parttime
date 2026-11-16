import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import { getStudent } from '@/lib/data';
import { Card, CardContent, CardHeader, Field, Input, PageHeader } from '@/components/ui';
import { ActionForm, SubmitButton } from '@/components/action-form';
import { updateProfile } from '@/app/actions/student';

export default async function ProfilePage() {
  const user = await requireRole('student');
  const { t } = await getT();
  const { profile: p, teachers } = await getStudent(user.id);
  return (
    <div className="space-y-5">
      <PageHeader title={t('profile.title')} />
      <Card>
        <CardHeader title={t('profile.studentNo') + ': ' + (p?.student_no ?? '—')} description={t('profile.adminOnly')} />
        <CardContent className="grid gap-3 text-sm sm:grid-cols-4">
          {[
            [t('profile.class'), p?.classes?.name ?? '—'],
            [t('profile.course'), p?.classes?.course ?? '—'],
            [t('profile.workPermit'), p?.work_permit ? t('c.yes') : t('c.no')],
            [t('profile.teachers'), teachers.join(', ') || '—'],
          ].map(([k, v]) => (
            <div key={k}><p className="text-xs text-slate-500">{k}</p><p className="font-medium">{v}</p></div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <ActionForm action={updateProfile} className="grid gap-4 sm:grid-cols-2">
            <Field label={t('profile.fullName')}><Input name="full_name" defaultValue={user.full_name} required /></Field>
            <Field label={t('login.email')}><Input defaultValue={user.email} disabled /></Field>
            <Field label={t('profile.nationality')}><Input name="nationality" defaultValue={p?.nationality ?? ''} /></Field>
            <Field label={t('profile.dob')}><Input type="date" name="date_of_birth" defaultValue={p?.date_of_birth ?? ''} /></Field>
            <Field label={t('profile.visaType')}><Input name="visa_type" defaultValue={p?.visa_type ?? ''} /></Field>
            <Field label={t('profile.visaExpiry')}><Input type="date" name="visa_expiry" defaultValue={p?.visa_expiry ?? ''} /></Field>
            <Field label={t('profile.permitNo')}><Input name="work_permit_no" defaultValue={p?.work_permit_no ?? ''} /></Field>
            <Field label={t('profile.phone')}><Input type="tel" name="phone" defaultValue={p?.phone ?? ''} /></Field>
            <div className="sm:col-span-2"><SubmitButton>{t('c.save')}</SubmitButton></div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
