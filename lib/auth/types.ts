export type AdminRole = 'super_admin' | 'system_admin';

export type AdminProfile = {
  email: string;
  name?: string;
  role: AdminRole;
  status?: string;
  mustChangePassword?: boolean;
};

export type SessionPayload = {
  uid: string;
  email: string;
  name?: string;
  role: AdminRole;
  mustChangePassword?: boolean;
};
