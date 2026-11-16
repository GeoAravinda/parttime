export type Role = 'student' | 'teacher' | 'admin';
export type Level = 'green' | 'yellow' | 'red';
export type RecordStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface AppUser {
  id: string; email: string; full_name: string; role: Role;
  status: 'pending' | 'active' | 'inactive'; locale: 'en' | 'ja';
}
export interface ComplianceDay {
  day: string; day_hours: number; is_holiday: boolean; rolling7: number;
  rule: 'rolling_7day' | 'holiday_daily' | 'no_permit'; level: Level; remaining: number;
}
export interface Job {
  id: string; student_id: string; company_name: string; workplace_name: string; job_type: string;
  start_date: string; end_date: string | null; status: 'active' | 'inactive';
}
export interface WorkRecord {
  id: string; student_id: string; job_id: string; work_date: string; start_time: string; end_time: string;
  break_minutes: number; hours: number; status: RecordStatus; note: string | null; teacher_comment: string | null;
  submitted_at: string | null; reviewed_at: string | null; reviewed_by: string | null; created_at: string;
  jobs?: { company_name: string; workplace_name: string } | null;
}
export interface StudentOverview {
  student_id: string; full_name: string; email: string; student_no: string | null; status: string;
  class_id: string | null; class_name: string | null; course: string | null; nationality: string | null;
  visa_expiry: string | null; work_permit: boolean; today_hours: number; rolling7: number; is_holiday: boolean;
  remaining: number; level: Level; max_rolling7: number; max_day_hours: number; last_record_date: string | null;
  active_jobs: number; pending_count: number; missing_records: boolean;
}
export interface Holiday {
  id: string; name: string; name_ja: string | null; kind: 'long_vacation' | 'school_holiday';
  season: string; start_date: string; end_date: string; approved: boolean;
}
export interface Settings {
  school_name: string; school_name_ja: string; address: string | null; phone: string | null; email: string | null;
  weekly_limit: number; weekly_warn: number; holiday_daily_limit: number; holiday_daily_warn: number;
  allow_student_delete: boolean; allow_future_days: number; missing_record_days: number;
}
export type ActionState = { ok?: string; error?: string } | undefined;
