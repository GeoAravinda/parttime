'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  LayoutDashboard, Table2, CalendarDays, Briefcase, UserRound, Bell, Users, CheckCheck, AlertTriangle,
  FileBarChart, School, Sun, Settings, ShieldCheck, GraduationCap, Menu, X, LogOut, Clock,
} from 'lucide-react';
import { cn } from './ui';
import { signOut, setLang } from '@/app/actions/auth';
import { useI18n } from './i18n-provider';

const ICONS = {
  home: LayoutDashboard, sheet: Table2, calendar: CalendarDays, briefcase: Briefcase, user: UserRound, bell: Bell,
  users: Users, check: CheckCheck, alert: AlertTriangle, file: FileBarChart, school: School, sun: Sun,
  settings: Settings, shield: ShieldCheck, graduation: GraduationCap,
};
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };

export function LangSwitch({ className }: { className?: string }) {
  const { lang } = useI18n();
  const [pending, start] = useTransition();
  return (
    <div className={cn('inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs', className)} aria-label="Language">
      {(['en', 'ja'] as const).map((l) => (
        <button key={l} disabled={pending} onClick={() => start(() => setLang(l))}
          className={cn('rounded px-2 py-1 font-medium', lang === l ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100')}>
          {l === 'en' ? 'EN' : '日本語'}
        </button>
      ))}
    </div>
  );
}

export function AppShell({ roleLabel, userName, nav, notificationsHref, unread, schoolName, children }: {
  roleLabel: string; userName: string; nav: NavItem[]; notificationsHref: string; unread: number; schoolName: string; children: React.ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const isActive = (href: string) => path === href || (href.split('/').length > 2 && path.startsWith(href + '/'));

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white"><Clock className="h-5 w-5" /></div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{t('app.title')}</p>
          <p className="truncate text-xs text-slate-500">{schoolName}</p>
        </div>
      </div>
      <div className="px-3 pb-2"><span className="rounded bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">{roleLabel}</span></div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-2">
        {nav.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <li key={item.href}>
              <Link href={item.href} onClick={() => setOpen(false)}
                className={cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                  isActive(item.href) ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {!!item.badge && <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">{item.badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-slate-200 p-3">
        <p className="truncate px-1 text-sm font-medium text-slate-800">{userName}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <LangSwitch />
          <form action={signOut}>
            <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
              <LogOut className="h-3.5 w-3.5" />{t('nav.signout')}
            </button>
          </form>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white shadow-xl">
            <button className="absolute right-2 top-3 p-2 text-slate-500" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button className="-ml-2 p-2 text-slate-600 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <p className="truncate text-sm font-semibold text-slate-800 lg:hidden">{t('app.title')}</p>
          <div className="ml-auto flex items-center gap-2">
            <Link href={notificationsHref} className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100" aria-label={t('nav.notifications')}>
              <Bell className="h-5 w-5" />
              {unread > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">{unread > 99 ? '99+' : unread}</span>}
            </Link>
            <span className="hidden text-sm text-slate-600 sm:inline">{userName}</span>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
