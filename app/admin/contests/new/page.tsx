import { ContestForm } from '@/components/admin/ContestForm';
import { PageHeader } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default function NewContestPage() {
  return (
    <>
      <PageHeader title="Create Contest" subtitle="Register a new contest." />
      <ContestForm mode="create" />
    </>
  );
}
