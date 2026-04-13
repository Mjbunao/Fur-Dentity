import type { AdminRole } from '@/lib/auth/types';

export type AdoptionPetStatus = 'shelter' | 'adopted';

export type AdoptionRequestRow = {
  id: string;
  userId: string;
  requesterName: string;
  requesterEmail: string;
  requesterContact: string;
  requestedAt: string;
  status?: string;
};

export type AdoptionPetRow = {
  id: string;
  status: AdoptionPetStatus;
  petName: string;
  petAge: string;
  type: string;
  gender: string;
  breed: string;
  description: string;
  profileURL: string;
  requestCount: number;
  requestStatus?: 'pending' | 'approved' | 'rejected' | null;
  adoptedBy?: string;
  adoptedAt?: string;
  adopterName?: string;
  adopterEmail?: string;
  adopterContact?: string;
  adopterAddress?: string;
};

export type AdoptionPetFormPayload = {
  petName: string;
  petAge: string;
  type: string;
  gender: string;
  breed: string;
  description: string;
  profileURL: string;
};

export type AdoptionSectionProps = {
  adminRole: AdminRole;
  adminUid: string;
  adminName?: string;
  adminEmail: string;
};

export type AdoptionBreedOptions = {
  dogBreeds: string[];
  catBreeds: string[];
};

export type AdoptionDeleteRequestRow = {
  id: string;
  petId: string;
  petName: string;
  petStatus: AdoptionPetStatus;
  requestedByUid: string;
  requestedByName: string;
  requestedByEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
};
