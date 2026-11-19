import { connection } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { SearchForm } from '@/components/search/search-form';
import { SearchMessages } from '@/components/search/search-messages';
import { loadCities, loadTaxonomy } from '@/lib/search-data';

const QUICK_SPECIES = 3;

// Home (DESIGN UX1): search-first, not a marketing page. The search box, the location line
// and the quick chips are the whole top of the page.
export default async function HomePage() {
  // Rendered on request rather than at build time, when the API isn't running (CI builds
  // without one); the taxonomy and cities themselves come from Next's data cache.
  await connection();
  const t = await getTranslations('Home');
  const [taxonomy, cities] = await Promise.all([loadTaxonomy(), loadCities()]);

  return (
    <SearchMessages>
      {/* A neutral tint groups the search; the pink page tint is kept for the status card (DESIGN §7.1). */}
      <section className="flex flex-col gap-6 rounded-2xl bg-muted px-5 py-8 md:px-10 md:py-12">
        <div className="flex flex-col gap-2">
          <h1 className="text-[length:clamp(2rem,1.3rem+3vw,3rem)] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance">
            {t('title')}
          </h1>
          <p className="max-w-[48ch]">{t('subtitle')}</p>
        </div>
        <SearchForm
          initial={{ location: { kind: 'city', code: cities.defaultCode } }}
          cities={cities.cities}
          defaultCityCode={cities.defaultCode}
          // The most searched animals (dog, cat, rabbit, in the taxonomy's order) as chips; the
          // rest are in the results page's filters, so the chips stay on two lines on a phone.
          species={taxonomy.species.slice(0, QUICK_SPECIES)}
          rememberLocation
        />
      </section>
    </SearchMessages>
  );
}
