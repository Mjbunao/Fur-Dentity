import { requireSession } from '@/lib/auth/session';
import GeneralReportsSection from './GeneralReportsSection';

export default async function GeneralReportsPage() {
  const session = await requireSession();

  return <GeneralReportsSection adminRole={session.role} />;
}
