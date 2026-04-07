import { requireSession } from '@/lib/auth/session';
import PetsTable from './PetsTable';

export default async function PetsPage() {
  const session = await requireSession();

  return (
    <PetsTable adminRole={session.role} />
  );
}
