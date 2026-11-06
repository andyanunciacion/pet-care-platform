import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-session';

export default async function AdminPage() {
  // Every admin page starts with this, even though the layout calls it too.
  await requireAdmin();
  redirect('/admin/businesses');
}
