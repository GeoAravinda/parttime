import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import { PageHeader } from '@/components/ui';
import { StudentsList, type StudentFilters } from '@/components/students-list';

export default async function TeacherStudents({ searchParams }: { searchParams: Promise<StudentFilters> }) {
  await requireRole('teacher');
  const { t, lang } = await getT();
  return (
    <div>
      <PageHeader title={t('teacher.assigned')} />
      <StudentsList sp={await searchParams} basePath="/teacher/students" t={t} lang={lang} />
    </div>
  );
}
