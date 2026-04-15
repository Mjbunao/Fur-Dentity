import ActivityLogDetailsPage from './ActivityLogDetailsPage';

type PageProps = {
  params: Promise<{
    logId: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { logId } = await params;
  return <ActivityLogDetailsPage logId={logId} />;
}
