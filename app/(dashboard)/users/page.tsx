import { requireSession } from '@/lib/auth/session';
import CreateSystemAdminCard from './CreateSystemAdminCard';
import UsersTable from './UsersTable';

export default async function UsersPage() {
  const session = await requireSession();
  const canManageAdmins = session.role === 'super_admin';

  return (
    <div className="space-y-6">
      <UsersTable adminRole={session.role} />

      <CreateSystemAdminCard canManageAdmins={canManageAdmins} />
    </div>
  );
}
