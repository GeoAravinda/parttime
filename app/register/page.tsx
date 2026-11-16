import Link from 'next/link';
import { getT } from '@/lib/i18n-server';
import { Card, CardContent, Field, Input } from '@/components/ui';
import { ActionForm, SubmitButton } from '@/components/action-form';
import { LangSwitch } from '@/components/app-shell';
import { signUp } from '@/app/actions/auth';

export default async function RegisterPage() {
  const { t } = await getT();
  return (
    <div className="flex min-h-screen flex-col items-center bg-slate-100 px-4 py-10">
      <div className="mb-6 flex w-full max-w-xl items-center justify-between">
        <Link href="/login/student" className="text-sm text-primary hover:underline">← {t('c.back')}</Link>
        <LangSwitch />
      </div>
      <Card className="w-full max-w-xl">
        <CardContent className="p-6">
          <h1 className="text-xl font-semibold">{t('register.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('register.note')}</p>
          <ActionForm action={signUp} resetOnSuccess className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label={`${t('profile.fullName')} *`} className="sm:col-span-2"><Input name="full_name" required placeholder="NGUYEN VAN AN" /></Field>
            <Field label={`${t('login.email')} *`}><Input name="email" type="email" required autoComplete="email" /></Field>
            <Field label={`${t('login.password')} *`} hint={t('register.passwordHint')}><Input name="password" type="password" minLength={8} required autoComplete="new-password" /></Field>
            <Field label={t('profile.studentNo')}><Input name="student_no" /></Field>
            <Field label={t('profile.nationality')}><Input name="nationality" /></Field>
            <Field label={t('profile.dob')}><Input name="date_of_birth" type="date" /></Field>
            <Field label={t('profile.phone')}><Input name="phone" type="tel" /></Field>
            <Field label={t('profile.visaType')}><Input name="visa_type" defaultValue="Student (留学)" /></Field>
            <Field label={t('profile.visaExpiry')}><Input name="visa_expiry" type="date" /></Field>
            <div className="sm:col-span-2"><SubmitButton className="w-full">{t('login.register')}</SubmitButton></div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
