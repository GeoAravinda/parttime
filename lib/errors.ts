/** Turn database / auth errors into messages students and teachers understand. */
export function friendlyError(e: { message?: string; code?: string } | null | undefined): string {
  if (!e) return 'Unknown error';
  const m = e.message ?? '';
  if (e.code === '23P01' || m.includes('work_records_no_overlap'))
    return 'This shift overlaps another work record (shifts across all jobs cannot overlap). / 他の勤務記録と時間が重なっています。';
  if (m.includes('work_records_time_check')) return 'Start and end time cannot be the same. / 開始時刻と終了時刻が同じです。';
  if (m.includes('work_records_hours_check')) return 'Working hours must be more than 0 after the break. / 休憩を引いた勤務時間が0以下です。';
  if (e.code === '23505') return 'This value already exists. / 既に登録されています。';
  if (e.code === '23503') return 'This item is still used by other data. / 他のデータで使用中です。';
  if (e.code === '42501' || m.includes('row-level security')) return 'You do not have permission to do this. / 権限がありません。';
  if (m.includes('Invalid login credentials')) return 'Incorrect email or password. / メールアドレスまたはパスワードが正しくありません。';
  return m;
}
