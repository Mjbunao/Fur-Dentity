import { requireSession } from '@/lib/auth/session';
import ReportDetailsPage from './ReportDetailsPage';

type ReportPageProps = {
  params: Promise<{
    reportKey: string;
  }>;
};

export default async function ReportPage({ params }: ReportPageProps) {
  const session = await requireSession();
  const { reportKey } = await params;

  return <ReportDetailsPage reportKey={reportKey} adminRole={session.role} />;
}
