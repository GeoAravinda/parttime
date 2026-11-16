import { RoleLayout } from '@/components/role-layout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RoleLayout role="student">{children}</RoleLayout>;
}
