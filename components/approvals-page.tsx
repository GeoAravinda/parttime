import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import type { Role } from '@/lib/types';
import { Card, Empty, PageHeader } from './ui';
import { RecordsTable } from './records-table';
import { BulkApproveBar } from './review-controls';

export async function ApprovalsPage({ role }: { role: Role }) {
  await requireRole(role);
  const { t, lang } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.from('work_records')
    .select('*, jobs(company_name,workplace_name), users!work_records_student_id_fkey(full_name)')
    .eq('status', 'submitted').order('work_date').limit(500);
  const rows = data ?? [];
  return (
    <div>
      <PageHeader title={t('teacher.pendingList')} description={`${rows.length}`} />
      <Card>
        {rows.length === 0 ? <Empty>{t('teacher.noPending')}</Empty> : (
          <>
            <BulkApproveBar />
            <RecordsTable records={rows as any} t={t} lang={lang} review showStudent bulk studentHref={`/${role}/students`} />
          </>
        )}
      </Card>
    </div>
  );
}
