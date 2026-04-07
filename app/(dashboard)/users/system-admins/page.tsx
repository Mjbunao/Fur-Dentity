import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth/session';
import SystemAdminsSection from './SystemAdminsSection';

export default async function SystemAdminsPage() {
  const session = await requireSession();

  if (session.role !== 'super_admin') {
    redirect('/users');
  }

  return <SystemAdminsSection />;
}
