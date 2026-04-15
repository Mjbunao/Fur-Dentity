export type ReportStatus = 'Pending' | 'Received' | 'Processing' | 'Rejected' | 'Finished';
export type ReportKind = 'found' | 'missing' | 'other';
export type RegistrationType = 'registered' | 'unregistered';

export type ReportRow = {
  id: string;
  reportId: string;
  mainDir: string;
  subDir: string;
  reportType: ReportKind;
  registrationType: RegistrationType;
  reporterName: string;
  reporterEmail: string;
  reporterContact: string;
  petId: string;
  petName: string;
  status: ReportStatus;
  requestStatus?: 'pending' | 'approved' | 'rejected' | null;
  submittedAt: string;
  submittedAtLabel: string;
  finishedAt: string;
  finishedAtLabel: string;
  opened: boolean;
  lastSeen: string;
  dateLastSeen: string;
  state: string;
  details: string;
  reportImage: string;
  petImage: string;
  petDetails: {
    age: string;
    birthdate: string;
    breed: string;
    colors: string[];
  };
};

export type ReportDeleteRequestRow = {
  id: string;
  reportKey: string;
  reportId: string;
  mainDir: string;
  subDir: string;
  reportType: ReportKind;
  petName: string;
  reportStatus: ReportStatus;
  requestedByUid: string;
  requestedByName: string;
  requestedByEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
};

export type ReportMatchRow = {
  id: string;
  petId: string;
  petName: string;
  missing: ReportRow;
  found: ReportRow;
  status: 'active' | 'finished';
};
