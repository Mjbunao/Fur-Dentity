import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth/session';
import RecoverySection from './RecoverySection';

export default async function RecoveryPage() {
  const session = await requireSession();

  if (session.role !== 'super_admin') {
    redirect('/dashboard');
  }

  return <RecoverySection />;
}
