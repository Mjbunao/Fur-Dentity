import type { AdminRole } from '@/lib/auth/types';

export type DonationRow = {
  id: string;
  donorType: 'Registered User' | 'Unregistered User';
  userId: string;
  name: string;
  email: string;
  contact: string;
  address: string;
  amount: number;
  date: string;
  platform: string;
  reference: string;
  createdAt: string;
  requestStatus?: 'pending' | 'approved' | 'rejected' | null;
};

export type DonationUserOption = {
  id: string;
  name: string;
  email: string;
  contact: string;
  address: string;
};

export type DonationDeleteRequestRow = {
  id: string;
  donationId: string;
  donationName: string;
  requestedByUid: string;
  requestedByName: string;
  requestedByEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  resolvedAt?: string;
};

export type DonationSectionProps = {
  adminRole: AdminRole;
  adminUid: string;
  adminName?: string;
  adminEmail: string;
};
