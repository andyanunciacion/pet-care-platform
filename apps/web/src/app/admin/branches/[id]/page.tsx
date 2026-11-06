import { redirect } from 'next/navigation';
import { adminApi, dataOrNotFound } from '@/lib/admin-api';
import { requireAdmin } from '@/lib/admin-session';

/**
 * /admin/branches/{id} → the branch's editor under its business. Lets the audit log link
 * to a branch knowing only its id.
 */
export default async function BranchRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const api = await adminApi();
  const branch = dataOrNotFound(
    await api.GET('/v1/admin/branches/{id}', { params: { path: { id } } }),
  );
  redirect(`/admin/businesses/${branch.business.id}/branches/${branch.id}`);
}
