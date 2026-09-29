import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// Lints snippets through this package's eslint.config.js (the shared config),
// proving the rules that back our conventions are actually switched on.
const eslint = new ESLint({
  cwd: import.meta.dirname,
  // The fixture file only exists in memory, so let the type-aware parser
  // type-check it with this package's compiler options.
  overrideConfig: {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['fixture.ts'], defaultProject: 'tsconfig.json' },
      },
    },
  },
});

async function ruleIds(code: string): Promise<(string | null)[]> {
  const [result] = await eslint.lintText(code, { filePath: 'fixture.ts' });
  return result?.messages.map((message) => message.ruleId) ?? [];
}

describe('shared ESLint config', () => {
  it('accepts clean code', async () => {
    expect(await ruleIds('export const add = (a: number, b: number): number => a + b;\n')).toEqual(
      [],
    );
  });

  it('rejects `any`', async () => {
    expect(await ruleIds('export const value: any = 1;\n')).toContain(
      '@typescript-eslint/no-explicit-any',
    );
  });

  it('runs type-aware rules (un-awaited promise)', async () => {
    const code = 'async function save(): Promise<void> {}\nsave();\n';
    expect(await ruleIds(code)).toContain('@typescript-eslint/no-floating-promises');
  });
});
