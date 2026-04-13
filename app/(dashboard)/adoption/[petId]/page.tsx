import { requireSession } from '@/lib/auth/session';
import AdoptionDetailsPage from './AdoptionDetailsPage';

type AdoptionDetailsRouteProps = {
  params: Promise<{
    petId: string;
  }>;
};

export default async function AdoptionDetailsRoute({ params }: AdoptionDetailsRouteProps) {
  const [{ petId }, session] = await Promise.all([params, requireSession()]);

  return <AdoptionDetailsPage petId={petId} adminRole={session.role} />;
}
