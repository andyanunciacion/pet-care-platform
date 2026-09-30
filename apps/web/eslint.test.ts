import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// eslint-config-next bundles plugins that only declare support up to ESLint 9, while we
// run ESLint 10. These tests prove their rules still load and fire, so an update that
// breaks them fails here instead of silently linting nothing.
const eslint = new ESLint({
  cwd: import.meta.dirname,
  overrideConfig: {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['fixture.tsx'], defaultProject: 'tsconfig.json' },
      },
    },
  },
});

async function ruleIds(code: string): Promise<(string | null)[]> {
  const [result] = await eslint.lintText(code, { filePath: 'fixture.tsx' });
  return result?.messages.map((message) => message.ruleId) ?? [];
}

// The first lint loads TypeScript for type-aware rules, which takes several seconds.
describe('web ESLint config', { timeout: 30_000 }, () => {
  it('accepts a clean component', async () => {
    const code = 'export function Hello() {\n  return <p>Hello</p>;\n}\n';
    expect(await ruleIds(code)).toEqual([]);
  });

  it('runs accessibility rules (jsx-a11y)', async () => {
    const code = 'export function Photo() {\n  return <img src="/cat.jpg" />;\n}\n';
    expect(await ruleIds(code)).toContain('jsx-a11y/alt-text');
  });

  it('runs React Hooks rules', async () => {
    const code = [
      "import { useState } from 'react';",
      'export function Counter({ on }: { on: boolean }) {',
      '  if (on) {',
      '    const [count] = useState(0);',
      '    return <p>{count}</p>;',
      '  }',
      '  return null;',
      '}',
      '',
    ].join('\n');
    expect(await ruleIds(code)).toContain('react-hooks/rules-of-hooks');
  });

  it('runs Next.js rules', async () => {
    const code = 'export function Photo() {\n  return <img src="/cat.jpg" alt="A cat" />;\n}\n';
    expect(await ruleIds(code)).toContain('@next/next/no-img-element');
  });
});
