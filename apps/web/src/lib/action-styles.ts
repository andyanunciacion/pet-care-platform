// Buttons on owner pages (DESIGN §8 "Making actions obvious"): at least 48px tall, a verb
// label, and feedback on hover and press so it's clear they can be tapped. /admin keeps
// shadcn's denser Button instead.

const base =
  'flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 font-semibold transition-[background-color,border-color,filter] duration-150 active:translate-y-px motion-reduce:transition-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none';

/**
 * The main action (Call). Hover darkens it rather than lightening it, so white text keeps
 * its contrast.
 */
export const primaryAction = `${base} bg-primary text-primary-foreground hover:brightness-85`;

/** Secondary actions (Messenger, Directions, View branch): hover tints it and turns the border teal. */
export const outlineAction = `${base} border bg-background text-primary hover:border-primary hover:bg-muted`;
