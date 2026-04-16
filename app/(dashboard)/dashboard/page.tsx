import { requireSession } from '@/lib/auth/session';
import DashboardSection from './DashboardSection';

export default async function DashboardPage() {
  const session = await requireSession();

  return <DashboardSection adminRole={session.role} adminName={session.name} />;
}
