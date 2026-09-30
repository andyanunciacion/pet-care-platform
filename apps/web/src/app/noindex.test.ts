import { describe, expect, it } from 'vitest';
import { metadata as adminMetadata } from './admin/layout';
import { metadata as dashboardMetadata } from './dashboard/layout';

// Private areas must never show up in search results.
describe('private areas', () => {
  it.each([
    ['/dashboard', dashboardMetadata],
    ['/admin', adminMetadata],
  ])('%s is noindex, nofollow', (_path, metadata) => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
