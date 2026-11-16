import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, Field, Input, PageHeader, Table, Td, Th } from '@/components/ui';
import { ActionForm, SubmitButton } from '@/components/action-form';
import { saveClass, deleteClass } from '@/app/actions/admin';

export default async function AdminClasses() {
  await requireRole('admin');
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: classes }, { data: profiles }] = await Promise.all([
    supabase.from('classes').select('*').order('name'),
    supabase.from('student_profiles').select('class_id'),
  ]);
  const counts = new Map<string, number>();
  (profiles ?? []).forEach((p) => p.class_id && counts.set(p.class_id, (counts.get(p.class_id) ?? 0) + 1));
  return (
    <div className="space-y-5">
      <PageHeader title={t('admin.classes')} />
      <Card>
        <CardHeader title={`${t('c.add')}`} />
        <CardContent>
          <ActionForm action={saveClass} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label={`${t('admin.className')} *`}><Input name="name" required placeholder="A-1" /></Field>
            <Field label={`${t('profile.course')} *`}><Input name="course" required placeholder="2-year course / 2年コース" /></Field>
            <Field label={t('admin.level')}><Input name="level" placeholder="N3" /></Field>
            <Field label={t('admin.year')}><Input name="academic_year" type="number" placeholder="2026" /></Field>
            <div className="flex items-end"><SubmitButton>{t('c.add')}</SubmitButton></div>
          </ActionForm>
        </CardContent>
      </Card>
      <Card>
        <Table>
          <thead><tr><Th>{t('admin.className')}</Th><Th>{t('profile.course')}</Th><Th>{t('admin.level')}</Th><Th>{t('admin.year')}</Th><Th className="text-right">{t('nav.students')}</Th><Th>{t('c.actions')}</Th></tr></thead>
          <tbody>
            {(classes ?? []).map((c) => (
              <tr key={c.id}>
                <Td colSpan={4} className="p-0">
                  <ActionForm action={saveClass} className="grid grid-cols-4 gap-2 px-3 py-2">
                    <input type="hidden" name="id" value={c.id} />
                    <Input name="name" defaultValue={c.name} className="h-8" required />
                    <Input name="course" defaultValue={c.course} className="h-8" required />
                    <Input name="level" defaultValue={c.level ?? ''} className="h-8" />
                    <div className="flex gap-1"><Input name="academic_year" type="number" defaultValue={c.academic_year ?? ''} className="h-8" /><SubmitButton size="sm" variant="outline">{t('c.save')}</SubmitButton></div>
                  </ActionForm>
                </Td>
                <Td className="text-right">{counts.get(c.id) ?? 0}</Td>
                <Td>
                  <ActionForm action={deleteClass} confirm={t('c.confirmDelete')}>
                    <input type="hidden" name="id" value={c.id} />
                    <SubmitButton size="sm" variant="ghost" className="text-red-600">{t('c.delete')}</SubmitButton>
                  </ActionForm>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
