import { requireSession } from '@/lib/auth/session';
import UserDetailsPage from './UserDetailsPage';
import type { AdminRole } from '@/lib/auth/types';

export default async function UserDetailsRoute({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await requireSession();
  const { userId } = await params;

  return <UserDetailsPage userId={userId} adminRole={session.role as AdminRole} />;
}
