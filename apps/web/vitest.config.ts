import path from 'node:path';
import { defineProject } from 'vitest/config';

export default defineProject({
  // Same "@/…" import alias as tsconfig.json.
  resolve: { alias: { '@': path.join(import.meta.dirname, 'src') } },
});
