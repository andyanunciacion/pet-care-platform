import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { SignOutButton } from '@/components/sign-out-button';
import { Wordmark } from '@/components/wordmark';
import { requireAdmin } from '@/lib/admin-session';

// PAW ops admin: internal tools, kept out of search engines (DESIGN.md §4).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Redirects to /login unless signed in as a super admin. Pages call it too (see admin-session.ts).
  const admin = await requireAdmin();
  const t = await getTranslations('Admin');

  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-6">
            <Wordmark />
            <nav aria-label={t('navLabel')} className="flex gap-4 text-sm font-medium">
              <Link href="/admin/businesses" className="hover:text-primary">
                {t('nav.listings')}
              </Link>
              <Link href="/admin/audit-log" className="hover:text-primary">
                {t('nav.auditLog')}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{t('signedInAs', { email: admin.email })}</span>
            <SignOutButton label={t('signOut')} errorLabel={t('signOutFailed')} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </>
  );
}
