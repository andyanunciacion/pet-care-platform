'use client';

import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { startGoogleSignIn } from '@/lib/auth-client';

interface Props {
  /** Where to land after signing in (already checked with safeNextPath). */
  next: string;
  // Strings come from the server page, so no messages ship to the browser.
  label: string;
  pendingLabel: string;
  errorLabel: string;
}

export function GoogleSignInButton({ next, label, pendingLabel, errorLabel }: Props) {
  const [state, setState] = useState<'idle' | 'pending' | 'error'>('idle');

  async function signIn() {
    setState('pending');
    try {
      await startGoogleSignIn(next);
      // The browser is now leaving for Google; stay "pending" until it does.
    } catch {
      setState('error');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button size="lg" onClick={() => void signIn()} disabled={state === 'pending'}>
        {state === 'pending' && (
          <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
        )}
        {state === 'pending' ? pendingLabel : label}
      </Button>
      {state === 'error' && (
        <p role="alert" className="text-sm text-destructive">
          {errorLabel}
        </p>
      )}
    </div>
  );
}
