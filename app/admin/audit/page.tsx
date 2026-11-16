import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import { createClient } from '@/lib/supabase/server';
import { Badge, Button, Card, PageHeader, Select, Table, Td, Th, buttonClass } from '@/components/ui';

const TABLES = ['work_records', 'jobs', 'users', 'student_profiles', 'teacher_profiles', 'teacher_student_assignments', 'classes', 'school_holidays', 'school_settings', 'app'];
const PAGE = 50;
const SKIP = new Set(['updated_at', 'created_at', 'shift_range']);

function diff(oldD: Record<string, unknown> | null, newD: Record<string, unknown> | null) {
  if (!oldD || !newD) return null;
  return Object.keys(newD).filter((k) => !SKIP.has(k) && JSON.stringify(oldD[k]) !== JSON.stringify(newD[k]))
    .map((k) => `${k}: ${JSON.stringify(oldD[k])} → ${JSON.stringify(newD[k])}`);
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ table?: string; action?: string; page?: string }> }) {
  await requireRole('admin');
  const { t, lang } = await getT();
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.page) || 0);
  const supabase = await createClient();
  let q = supabase.from('audit_logs').select('*, users(full_name)', { count: 'exact' }).order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
  if (sp.table && TABLES.includes(sp.table)) q = q.eq('table_name', sp.table);
  if (sp.action) q = q.eq('action', sp.action);
  const { data, count } = await q;
  const link = (p: number) => `/admin/audit?${new URLSearchParams({ ...(sp.table ? { table: sp.table } : {}), ...(sp.action ? { action: sp.action } : {}), page: String(p) })}`;
  return (
    <div className="space-y-4">
      <PageHeader title={t('nav.audit')} description={`${count ?? 0}`} />
      <Card>
        <form method="get" className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
          <Select name="table" defaultValue={sp.table ?? ''} className="w-56">
            <option value="">{t('admin.auditTable')}: all</option>
            {TABLES.map((x) => <option key={x} value={x}>{x}</option>)}
          </Select>
          <Select name="action" defaultValue={sp.action ?? ''} className="w-48">
            <option value="">{t('c.actions')}: all</option>
            {['insert', 'update', 'delete', 'login', 'export_pdf', 'export_excel', 'delete_account', 'reset_password'].map((x) => <option key={x} value={x}>{x}</option>)}
          </Select>
          <Button type="submit" variant="outline">{t('c.filter')}</Button>
        </form>
        <Table>
          <thead><tr><Th>{t('c.date')}</Th><Th>{t('admin.actor')}</Th><Th>{t('c.actions')}</Th><Th>{t('admin.auditTable')}</Th><Th>{t('admin.changes')}</Th></tr></thead>
          <tbody>
            {(data ?? []).map((a: any) => {
              const changes = diff(a.old_data, a.new_data);
              return (
                <tr key={a.id} className="align-top">
                  <Td className="whitespace-nowrap text-xs">{new Date(a.created_at).toLocaleString(lang === 'ja' ? 'ja-JP' : 'en-GB', { timeZone: 'Asia/Tokyo' })}</Td>
                  <Td className="text-xs">{a.users?.full_name ?? '—'}<p className="text-slate-400">{a.actor_role}</p></Td>
                  <Td><Badge tone={a.action === 'delete' || a.action === 'delete_account' ? 'red' : a.action === 'insert' ? 'green' : a.action === 'update' ? 'blue' : 'slate'}>{a.action}</Badge></Td>
                  <Td className="text-xs">{a.table_name}<p className="font-mono text-[10px] text-slate-400">{a.row_id?.slice(0, 8)}</p></Td>
                  <Td className="max-w-xl text-xs">
                    {changes ? (changes.length ? <ul className="space-y-0.5 font-mono text-[11px]">{changes.map((c) => <li key={c} className="break-all">{c}</li>)}</ul> : <span className="text-slate-400">—</span>)
                      : <details><summary className="cursor-pointer text-slate-500">JSON</summary><pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-50 p-2 text-[10px]">{JSON.stringify(a.new_data ?? a.old_data, null, 1)}</pre></details>}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <div className="flex justify-between p-3">
          {page > 0 ? <Link className={buttonClass('outline', 'sm')} href={link(page - 1)}>← {t('c.prev')}</Link> : <span />}
          {(count ?? 0) > (page + 1) * PAGE && <Link className={buttonClass('outline', 'sm')} href={link(page + 1)}>{t('c.next')} →</Link>}
        </div>
      </Card>
    </div>
  );
}
