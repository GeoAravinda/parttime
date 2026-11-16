import { Briefcase } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import { getStudent } from '@/lib/data';
import { todayJST } from '@/lib/dates';
import type { Job } from '@/lib/types';
import type { TFn } from '@/lib/i18n';
import { Badge, Card, CardContent, CardHeader, Field, Input, PageHeader, Select } from '@/components/ui';
import { ActionForm, SubmitButton } from '@/components/action-form';
import { saveJob, deleteJob } from '@/app/actions/student';

function JobFields({ job, t }: { job?: Job; t: TFn }) {
  return (
    <>
      {job && <input type="hidden" name="id" value={job.id} />}
      <Field label={t('jobs.company')}><Input name="company_name" defaultValue={job?.company_name} required placeholder="Lawson / ローソン" /></Field>
      <Field label={t('jobs.workplace')}><Input name="workplace_name" defaultValue={job?.workplace_name} required placeholder="Shinjuku 3-chome" /></Field>
      <Field label={t('jobs.type')}><Input name="job_type" defaultValue={job?.job_type} required placeholder="Convenience store / Restaurant / Factory" /></Field>
      <Field label={t('c.status')}>
        <Select name="status" defaultValue={job?.status ?? 'active'}>
          <option value="active">{t('status.active')}</option>
          <option value="inactive">{t('status.inactive')}</option>
        </Select>
      </Field>
      <Field label={t('jobs.startDate')}><Input type="date" name="start_date" defaultValue={job?.start_date ?? todayJST()} required /></Field>
      <Field label={t('jobs.endDate')}><Input type="date" name="end_date" defaultValue={job?.end_date ?? ''} /></Field>
    </>
  );
}

export default async function JobsPage() {
  const user = await requireRole('student');
  const { t } = await getT();
  const { jobs } = await getStudent(user.id);
  const active = jobs.filter((j) => j.status === 'active').length;
  return (
    <div className="space-y-5">
      <PageHeader title={t('jobs.title')} description={t('jobs.max')} />
      <div className="grid gap-4 lg:grid-cols-2">
        {jobs.map((j, i) => (
          <Card key={j.id}>
            <CardHeader title={<span className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" />{i + 1}. {j.company_name}</span>}
              description={`${j.workplace_name} · ${j.job_type}`}
              action={<Badge tone={j.status === 'active' ? 'green' : 'slate'}>{t(`status.${j.status}`)}</Badge>} />
            <CardContent>
              <details>
                <summary className="cursor-pointer text-sm font-medium text-primary">{t('c.edit')}</summary>
                <ActionForm action={saveJob} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <JobFields job={j} t={t} />
                  <div className="sm:col-span-2"><SubmitButton>{t('c.save')}</SubmitButton></div>
                </ActionForm>
                <ActionForm action={deleteJob} confirm={t('c.confirmDelete')} className="mt-2">
                  <input type="hidden" name="id" value={j.id} />
                  <SubmitButton variant="ghost" size="sm" className="text-red-600">{t('c.delete')}</SubmitButton>
                </ActionForm>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>
      {active < 3 && (
        <Card>
          <CardHeader title={t('jobs.add')} description={`${active}/3`} />
          <CardContent>
            <ActionForm action={saveJob} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <JobFields t={t} />
              <div className="sm:col-span-2 lg:col-span-3"><SubmitButton>{t('jobs.add')}</SubmitButton></div>
            </ActionForm>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
