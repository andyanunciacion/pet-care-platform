import { MessageCircle, Phone } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { outlineAction, primaryAction } from '@/lib/action-styles';
import { telLink } from '@/lib/contact-links';
import type { ListingBranch } from '@/lib/public-types';
import { cn } from '@/lib/utils';
import { DirectionsButton } from './directions';

/**
 * Call · Messenger · Directions, fixed to the bottom of the screen in the thumb zone
 * (DESIGN UX8, UX9). Only the channels the branch has; the full list is in the Contact
 * section. The page leaves room for it at the bottom (`pb-28`).
 */
export async function ContactBar({ branch, label }: { branch: ListingBranch; label: string }) {
  const t = await getTranslations('Listing');
  const phone = branch.contacts.find((contact) => contact.type === 'phone');
  const messenger = branch.contacts.find((contact) => contact.type === 'messenger');

  return (
    // A labeled region, not <nav>: these are actions, not links to other pages.
    // data-contact-bar: globals.css keeps focused elements clear of it (scroll padding).
    <div
      role="region"
      aria-label={label}
      data-contact-bar
      className="fixed inset-x-0 bottom-0 z-10 border-t bg-background pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-8px_color-mix(in_oklch,var(--foreground)_25%,transparent)]"
    >
      <div className="mx-auto flex max-w-5xl gap-2 px-4 py-2.5">
        {phone !== undefined && (
          <a href={telLink(phone.value)} className={cn(primaryAction, 'flex-1')}>
            <Phone aria-hidden className="size-5" />
            {t('call')}
          </a>
        )}
        {messenger !== undefined && (
          <a
            href={messenger.value}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(outlineAction, 'flex-1')}
          >
            <MessageCircle aria-hidden className="size-5" />
            {t('messenger')}
          </a>
        )}
        <DirectionsButton location={branch.location} className={cn(outlineAction, 'flex-1')} />
      </div>
    </div>
  );
}
