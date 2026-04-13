import { requireSession } from '@/lib/auth/session';
import AdoptionSection from './AdoptionSection';

export default async function AdoptionPage() {
  const session = await requireSession();

  return (
    <AdoptionSection
      adminRole={session.role}
      adminUid={session.uid}
      adminName={session.name}
      adminEmail={session.email}
    />
  );
}
