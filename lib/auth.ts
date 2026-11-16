import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import type { AppUser, Role } from './types';

export const getSessionUser = cache(async (): Promise<AppUser | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('users').select('id,email,full_name,role,status,locale').eq('id', user.id).maybeSingle();
  return (data as AppUser) ?? null;
});

/** Server-side guard used by every protected layout, page and server action. */
export async function requireRole(...roles: Role[]): Promise<AppUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login/${roles[0]}`);
  if (user.status !== 'active') redirect('/pending');
  if (!roles.includes(user.role)) redirect(`/${user.role}`);
  return user;
}
