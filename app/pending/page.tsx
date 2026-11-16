import Link from 'next/link';
import { Hourglass } from 'lucide-react';
import { getT } from '@/lib/i18n-server';
import { Card, CardContent, buttonClass } from '@/components/ui';
import { signOut } from '@/app/actions/auth';

export default async function PendingPage() {
  const { t } = await getT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="space-y-3 p-8">
          <Hourglass className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="text-lg font-semibold">{t('pending.title')}</h1>
          <p className="text-sm text-slate-600">{t('pending.body')}</p>
          <div className="flex justify-center gap-2 pt-2">
            <Link href="/" className={buttonClass('outline')}>{t('c.back')}</Link>
            <form action={signOut}><button className={buttonClass('ghost')}>{t('nav.signout')}</button></form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
