'use client';

import { useState } from 'react';
import CreateSystemAdminDialog from '../CreateSystemAdminCard';
import SystemAdminsTable from './SystemAdminsTable';

export default function SystemAdminsSection() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-4">
      <SystemAdminsTable refreshKey={refreshKey} />
      <CreateSystemAdminDialog
        canManageAdmins
        onCreated={() => setRefreshKey((current) => current + 1)}
      />
    </div>
  );
}
