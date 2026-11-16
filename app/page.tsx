import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GraduationCap, Users, ShieldCheck, Clock, ArrowRight } from 'lucide-react';
import { getT } from '@/lib/i18n-server';
import { getSessionUser } from '@/lib/auth';
import { LangSwitch } from '@/components/app-shell';
import { Card } from '@/components/ui';

export default async function Home() {
  const user = await getSessionUser();
  if (user?.status === 'active') redirect(`/${user.role}`);
  const { t } = await getT();
  const roles = [
    { role: 'student', icon: GraduationCap, color: 'bg-blue-50 text-blue-700' },
    { role: 'teacher', icon: Users, color: 'bg-emerald-50 text-emerald-700' },
    { role: 'admin', icon: ShieldCheck, color: 'bg-slate-100 text-slate-700' },
  ] as const;
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white"><Clock className="h-5 w-5" /></div>
            <span className="font-semibold">{t('app.title')}</span>
          </div>
          <LangSwitch />
        </div>
        <div className="py-12 text-center sm:py-16">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{t('app.subtitle')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">{t('app.tagline')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {roles.map(({ role, icon: Icon, color }) => (
            <Link key={role} href={`/login/${role}`}>
              <Card className="group h-full p-6 transition hover:border-primary hover:shadow-md">
                <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${color}`}><Icon className="h-6 w-6" /></div>
                <h2 className="mt-4 text-lg font-semibold">{t('login.title', { role: t(`role.${role}`) })}</h2>
                <p className="mt-1 text-sm text-slate-500">{t(`role.${role}.desc`)}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">{t('login.submit')}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
              </Card>
            </Link>
          ))}
        </div>
        <div className="mt-10 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
          <Card className="p-5"><p className="font-semibold text-slate-800">{t('rule.rolling_7day')}</p><p className="mt-1">{t('sheet.help')}</p></Card>
          <Card className="p-5"><p className="font-semibold text-slate-800">{t('rule.holiday_daily')}</p><p className="mt-1">{t('admin.holidayHelp')}</p></Card>
        </div>
      </div>
    </div>
  );
}
