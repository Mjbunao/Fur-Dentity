import { requireSession } from '@/lib/auth/session';
import UsersTable from './UsersTable';

export default async function UsersPage() {
  const session = await requireSession();

  return (
    <UsersTable adminRole={session.role} />
  );
}
