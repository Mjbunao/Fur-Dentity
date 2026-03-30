import DashboardShell from './DashboardShell';
import ThemeRegistry from '../ThemeRegistry';

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <DashboardShell><ThemeRegistry>{children}</ThemeRegistry> </DashboardShell>;
}
