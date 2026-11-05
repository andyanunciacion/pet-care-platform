'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth-client';

export function SignOutButton({ label, errorLabel }: { label: string; errorLabel: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'pending' | 'error'>('idle');

  async function handleClick() {
    setState('pending');
    try {
      await signOut();
      // replace: Back doesn't return to the admin screen. refresh: drops the router's
      // cached Server Component output, which was rendered with the old session.
      router.replace('/login');
      router.refresh();
    } catch {
      setState('error');
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      {state === 'error' && (
        <span role="alert" className="text-sm text-destructive">
          {errorLabel}
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => void handleClick()}
        disabled={state === 'pending'}
      >
        {label}
      </Button>
    </span>
  );
}
