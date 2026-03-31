import { requireSession } from '@/lib/auth/session';
import CreateSystemAdminCard from './CreateSystemAdminCard';

export default async function UsersPage() {
  const session = await requireSession();
  const canManageAdmins = session.role === 'super_admin';

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-3xl font-bold text-slate-900">Users</h1>
        <p className="mt-3 text-slate-600">
          This route will hold user management features from the legacy project.
          For now, it includes the first super-admin-only account management tool.
        </p>
      </section>

      <CreateSystemAdminCard canManageAdmins={canManageAdmins} />
    </div>
  );
}
