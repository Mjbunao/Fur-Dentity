import { requireSession } from '@/lib/auth/session';
import PetDetailsPage from './PetDetailsPage';
import type { AdminRole } from '@/lib/auth/types';

export default async function PetDetailsRoute({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const session = await requireSession();
  const { petId } = await params;

  return <PetDetailsPage petId={petId} adminRole={session.role as AdminRole} />;
}
