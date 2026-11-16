import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import type { Role } from '@/lib/types';
import { Card, Empty, PageHeader, cn, levelDot } from './ui';
import { ActionForm, SubmitButton } from './action-form';
import { markAllRead } from '@/app/actions/student';

export async function NotificationsPage({ role }: { role: Role }) {
  const user = await requireRole(role);
  const { t, lang } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
  const items = data ?? [];
  return (
    <div>
      <PageHeader title={t('notif.title')} action={items.some((n) => !n.read_at) && (
        <ActionForm action={markAllRead} hideMessage><SubmitButton variant="outline" size="sm">{t('notif.markAll')}</SubmitButton></ActionForm>
      )} />
      <Card>
        {items.length === 0 && <Empty>{t('notif.empty')}</Empty>}
        <ul className="divide-y divide-slate-100">
          {items.map((n) => (
            <li key={n.id} className={cn('flex gap-3 px-4 py-3', !n.read_at && 'bg-primary-50/40')}>
              <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', n.level === 'info' ? 'bg-primary' : n.level === 'success' ? 'bg-emerald-500' : levelDot[n.level as 'red'])} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{lang === 'ja' && n.title_ja ? n.title_ja : n.title}</p>
                <p className="text-sm text-slate-600">{lang === 'ja' && n.body_ja ? n.body_ja : n.body}</p>
                <p className="mt-0.5 text-xs text-slate-400">{new Date(n.created_at).toLocaleString(lang === 'ja' ? 'ja-JP' : 'en-GB', { timeZone: 'Asia/Tokyo' })}</p>
              </div>
              {n.link && (role !== 'student' || n.link.startsWith('/student')) && (
                <Link href={role === 'admin' ? n.link.replace('/teacher/', '/admin/') : n.link} className="self-center text-xs font-medium text-primary hover:underline">{t('c.view')}</Link>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
