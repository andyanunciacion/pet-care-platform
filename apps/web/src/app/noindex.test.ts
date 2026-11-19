import { describe, expect, it, vi } from 'vitest';
import { metadata as authMetadata } from './(auth)/layout';
import { metadata as adminMetadata } from './admin/layout';
import { generateMetadata as searchMetadata } from './(public)/search/page';
import { metadata as dashboardMetadata } from './dashboard/layout';

// The search page's title is translated; its strings don't matter here.
vi.mock('next-intl/server', () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
}));

// Private areas must never show up in search results.
describe('private areas', () => {
  it.each([
    ['/dashboard', dashboardMetadata],
    ['/admin', adminMetadata],
    ['/login', authMetadata],
  ])('%s is noindex, nofollow', (_path, metadata) => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});

// Search results are internal search pages: kept out of the index, but crawlers may follow
// their links to the clinic pages (ARCHITECTURE D46).
describe('search results', () => {
  it('/search is noindex, follow', async () => {
    const metadata = await searchMetadata({ searchParams: Promise.resolve({ q: 'kapon' }) });
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
