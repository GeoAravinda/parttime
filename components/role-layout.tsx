import { requireRole } from '@/lib/auth';
import { getSettings, unreadCount } from '@/lib/data';
import { getT } from '@/lib/i18n-server';
import { createClient } from '@/lib/supabase/server';
import type { Role } from '@/lib/types';
import { AppShell, type NavItem } from './app-shell';

export async function RoleLayout({ role, children }: { role: Role; children: React.ReactNode }) {
  const user = await requireRole(role);
  const { t, lang } = await getT();
  const supabase = await createClient();
  const [unread, settings] = await Promise.all([unreadCount(user.id), getSettings()]);

  let nav: NavItem[] = [];
  if (role === 'student') {
    nav = [
      { href: '/student', label: t('nav.overview'), icon: 'home' },
      { href: '/student/records', label: t('nav.records'), icon: 'sheet' },
      { href: '/student/calendar', label: t('nav.calendar'), icon: 'calendar' },
      { href: '/student/jobs', label: t('nav.jobs'), icon: 'briefcase' },
      { href: '/student/profile', label: t('nav.profile'), icon: 'user' },
      { href: '/student/notifications', label: t('nav.notifications'), icon: 'bell', badge: unread },
    ];
  } else if (role === 'teacher') {
    const { count } = await supabase.from('work_records').select('id', { count: 'exact', head: true }).eq('status', 'submitted');
    nav = [
      { href: '/teacher', label: t('nav.overview'), icon: 'home' },
      { href: '/teacher/students', label: t('nav.students'), icon: 'users' },
      { href: '/teacher/approvals', label: t('nav.approvals'), icon: 'check', badge: count ?? 0 },
      { href: '/teacher/missing', label: t('nav.missing'), icon: 'alert' },
      { href: '/teacher/notifications', label: t('nav.notifications'), icon: 'bell', badge: unread },
    ];
  } else {
    const { count } = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    nav = [
      { href: '/admin', label: t('nav.overview'), icon: 'home' },
      { href: '/admin/students', label: t('nav.students'), icon: 'graduation', badge: count ?? 0 },
      { href: '/admin/teachers', label: t('nav.teachers'), icon: 'users' },
      { href: '/admin/classes', label: t('nav.classes'), icon: 'school' },
      { href: '/admin/holidays', label: t('nav.holidays'), icon: 'sun' },
      { href: '/admin/approvals', label: t('nav.approvals'), icon: 'check' },
      { href: '/admin/reports', label: t('nav.reports'), icon: 'file' },
      { href: '/admin/audit', label: t('nav.audit'), icon: 'shield' },
      { href: '/admin/settings', label: t('nav.settings'), icon: 'settings' },
      { href: '/admin/notifications', label: t('nav.notifications'), icon: 'bell', badge: unread },
    ];
  }
  return (
    <AppShell roleLabel={t(`role.${role}`)} userName={user.full_name} nav={nav} unread={unread}
      notificationsHref={`/${role}/notifications`} schoolName={lang === 'ja' ? settings.school_name_ja : settings.school_name}>
      {children}
    </AppShell>
  );
}
