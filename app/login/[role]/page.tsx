import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock } from 'lucide-react';
import { getT } from '@/lib/i18n-server';
import { Card, CardContent, Field, Input } from '@/components/ui';
import { ActionForm, SubmitButton } from '@/components/action-form';
import { LangSwitch } from '@/components/app-shell';
import { signIn } from '@/app/actions/auth';

const DEMO: Record<string, string> = {
  student: 'student@demo.jp',
  teacher: 'teacher@demo.jp',
  admin: 'admin@demo.jp',
};

export default async function LoginPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!['student', 'teacher', 'admin'].includes(role)) notFound();
  const { t } = await getT();
  const showDemo = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === 'true';
  const accent = role === 'student' ? 'bg-primary' : role === 'teacher' ? 'bg-emerald-600' : 'bg-slate-800';
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-10">
      <div className="mb-6 flex w-full max-w-sm items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-white ${accent}`}><Clock className="h-4 w-4" /></span>
          {t('app.title')}
        </Link>
        <LangSwitch />
      </div>
      <Card className="w-full max-w-sm overflow-hidden">
        <div className={`h-1.5 ${accent}`} />
        <CardContent className="space-y-4 p-6">
          <h1 className="text-xl font-semibold">{t('login.title', { role: t(`role.${role}`) })}</h1>
          <ActionForm action={signIn} className="space-y-4">
            <input type="hidden" name="role" value={role} />
            <Field label={t('login.email')}><Input name="email" type="email" autoComplete="email" required /></Field>
            <Field label={t('login.password')}><Input name="password" type="password" autoComplete="current-password" required /></Field>
            <SubmitButton className="w-full">{t('login.submit')}</SubmitButton>
          </ActionForm>
          {role === 'student' && (
            <p className="text-center text-sm text-slate-600">
              {t('login.noAccount')} <Link href="/register" className="font-medium text-primary hover:underline">{t('login.register')}</Link>
            </p>
          )}
          {showDemo && (
            <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold">{t('login.demo')}</p>
              <p className="mt-1 font-mono">{DEMO[role]} / Demo1234!</p>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="mt-4 text-xs text-slate-500">
        {t('login.otherRoles')}:{' '}
        {['student', 'teacher', 'admin'].filter((r) => r !== role).map((r, i) => (
          <span key={r}>{i > 0 && ' · '}<Link className="text-primary hover:underline" href={`/login/${r}`}>{t(`role.${r}`)}</Link></span>
        ))}
      </p>
    </div>
  );
}
