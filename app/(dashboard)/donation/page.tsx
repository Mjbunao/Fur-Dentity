import { requireSession } from '@/lib/auth/session';
import DonationSection from './DonationSection';

export default async function DonationPage() {
  const session = await requireSession();

  return (
    <DonationSection
      adminRole={session.role}
      adminUid={session.uid}
      adminName={session.name}
      adminEmail={session.email}
    />
  );
}
