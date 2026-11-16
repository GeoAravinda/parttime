import 'server-only';
import { createClient } from './supabase/server';
import type { ComplianceDay, Holiday, Settings, StudentOverview, WorkRecord, Job } from './types';

export async function getSettings(): Promise<Settings> {
  const supabase = await createClient();
  const { data } = await supabase.from('school_settings').select('*').eq('id', 1).single();
  return data as Settings;
}

/** Server-computed compliance (SQL function compliance_series). */
export async function getCompliance(studentId: string, from: string, to: string): Promise<ComplianceDay[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('compliance_series', { p_student: studentId, p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ComplianceDay[]).map((r) => ({
    ...r, day_hours: Number(r.day_hours), rolling7: Number(r.rolling7), remaining: Number(r.remaining),
  }));
}

export async function getOverview(date?: string): Promise<StudentOverview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('students_overview', date ? { p_date: date } : {});
  if (error) throw new Error(error.message);
  return ((data ?? []) as StudentOverview[]).map((r) => ({
    ...r, today_hours: Number(r.today_hours), rolling7: Number(r.rolling7), remaining: Number(r.remaining),
    max_rolling7: Number(r.max_rolling7), max_day_hours: Number(r.max_day_hours),
  }));
}

export async function getHolidays(fromDate?: string): Promise<Holiday[]> {
  const supabase = await createClient();
  let q = supabase.from('school_holidays').select('*').order('start_date');
  if (fromDate) q = q.gte('end_date', fromDate);
  const { data } = await q;
  return (data ?? []) as Holiday[];
}

export async function getStudent(studentId: string) {
  const supabase = await createClient();
  const [{ data: user }, { data: profile }, { data: jobs }, { data: teachers }] = await Promise.all([
    supabase.from('users').select('id,email,full_name,status,created_at').eq('id', studentId).maybeSingle(),
    supabase.from('student_profiles').select('*, classes(id,name,course,level)').eq('user_id', studentId).maybeSingle(),
    supabase.from('jobs').select('*').eq('student_id', studentId).order('status').order('start_date'),
    supabase.from('teacher_student_assignments').select('teacher_id, users!teacher_student_assignments_teacher_id_fkey(full_name)').eq('student_id', studentId),
  ]);
  return {
    user: user as { id: string; email: string; full_name: string; status: string; created_at: string } | null,
    profile: profile as (Record<string, any> & { classes: { id: string; name: string; course: string; level: string | null } | null }) | null,
    jobs: (jobs ?? []) as Job[],
    teachers: ((teachers ?? []) as any[]).map((t) => t.users?.full_name).filter(Boolean) as string[],
  };
}

export async function getRecords(studentId: string, from: string, to: string): Promise<WorkRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('work_records')
    .select('*, jobs(company_name,workplace_name)')
    .eq('student_id', studentId).gte('work_date', from).lte('work_date', to)
    .order('work_date').order('start_time');
  return (data ?? []) as WorkRecord[];
}

export async function unreadCount(userId: string) {
  const supabase = await createClient();
  const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true })
    .eq('user_id', userId).is('read_at', null);
  return count ?? 0;
}
