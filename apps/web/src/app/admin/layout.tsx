import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// PAW ops admin: internal tools, kept out of search engines (DESIGN.md §4).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>;
}
