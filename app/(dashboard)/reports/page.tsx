import { requireSession } from '@/lib/auth/session';
import ReportsSection from './ReportsSection';

export default async function ReportsPage() {
  const session = await requireSession();

  return <ReportsSection adminRole={session.role} />;
}
