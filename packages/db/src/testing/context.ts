// Types the value that global-setup.ts hands to tests via Vitest's provide()/inject().
declare module 'vitest' {
  export interface ProvidedContext {
    /** URL of this test run's own, freshly migrated database. */
    databaseUrl: string;
  }
}

export {};
