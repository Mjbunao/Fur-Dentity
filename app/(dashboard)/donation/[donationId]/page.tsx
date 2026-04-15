import { requireSession } from '@/lib/auth/session';
import DonationDetailsPage from './DonationDetailsPage';
import type { AdminRole } from '@/lib/auth/types';

export default async function DonationDetailsRoute({
  params,
}: {
  params: Promise<{ donationId: string }>;
}) {
  const session = await requireSession();
  const { donationId } = await params;

  return (
    <DonationDetailsPage
      donationId={donationId}
      adminRole={session.role as AdminRole}
      adminUid={session.uid}
      adminName={session.name}
      adminEmail={session.email}
    />
  );
}
