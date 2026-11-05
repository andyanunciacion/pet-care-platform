import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Sign-in pages: nothing here for search engines (DESIGN.md §4). The route group adds no
// segment to the URL, so the page is just /login.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-8">
      {children}
    </main>
  );
}
