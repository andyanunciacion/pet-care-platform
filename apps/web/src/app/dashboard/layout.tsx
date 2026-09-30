import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Clinic dashboard: private tools, kept out of search engines (DESIGN.md §4).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>;
}
