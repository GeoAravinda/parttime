import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n-server';
import { StudentDetail } from '@/components/student-detail';

export default async function TeacherStudent({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole('teacher');
  const { t, lang } = await getT();
  const { id } = await params;
  return (
    <div>
      <Link href="/teacher/students" className="mb-3 inline-block text-sm text-primary hover:underline">← {t('nav.students')}</Link>
      {/* RLS: an unassigned student simply returns no data → 404 */}
      <StudentDetail studentId={id} sp={await searchParams} basePath={`/teacher/students/${id}`} t={t} lang={lang} />
    </div>
  );
}
