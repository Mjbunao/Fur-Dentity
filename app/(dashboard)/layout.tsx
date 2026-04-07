import DashboardShell from './DashboardShell';
import { requireSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireSession();

  if (session.mustChangePassword) {
    redirect('/change-password');
  }

  return (
    <DashboardShell
      adminEmail={session.email}
      adminName={session.name}
      adminRole={session.role}
    >
      {children}
    </DashboardShell>
  );
}
