import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { GoogleSignInButton } from '@/components/google-sign-in-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wordmark } from '@/components/wordmark';
import { safeNextPath } from '@/lib/safe-next';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Login');
  return { title: t('title') };
}

interface Props {
  // ?next= after a redirect from /admin; ?error= from requireAdmin() or Better Auth.
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams;
  const t = await getTranslations('Login');
  const message =
    error === undefined ? undefined : error === 'no_access' ? t('noAccess') : t('failed');

  return (
    <>
      <Wordmark />
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-lg">{t('title')}</h1>
          </CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {message !== undefined && (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}
          <GoogleSignInButton
            next={safeNextPath(next)}
            label={t('continueWithGoogle')}
            pendingLabel={t('redirecting')}
            errorLabel={t('failed')}
          />
        </CardContent>
      </Card>
    </>
  );
}
