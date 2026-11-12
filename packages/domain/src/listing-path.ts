// Public URLs of listings (ARCHITECTURE §8, D42). The API sends them, the web app redirects
// any other spelling to them, so the rule lives here once.

/** Where a branch is, as URL slugs. */
export interface ListingPlace {
  provinceSlug: string;
  citySlug: string;
}

/**
 * A business's page: /{province}/{city}/{business}, in the place of its first branch. For a
 * single-branch business this is the branch's full page; with several it lists them.
 */
export function businessPath(businessSlug: string, firstBranch: ListingPlace): string {
  return `/${firstBranch.provinceSlug}/${firstBranch.citySlug}/${businessSlug}`;
}

/**
 * A branch's page. The only branch shares its business's URL; with several, each branch
 * gets /{province}/{city}/{business}/{branch} in its own place (branches can be in
 * different cities). `branchCount` counts the branches shown publicly.
 */
export function branchPath(
  businessSlug: string,
  branch: ListingPlace & { slug: string },
  branchCount: number,
): string {
  const base = businessPath(businessSlug, branch);
  return branchCount === 1 ? base : `${base}/${branch.slug}`;
}
