/** Same values as the database's business_type enum (launch is vets only, ARCHITECTURE §5.3). */
export type BusinessType = 'vet_clinic';

export interface BusinessTypeRules {
  /** Whether branches can be flagged "open 24 hours" and "accepts emergencies". */
  emergencyFlags: boolean;
}

/**
 * Rules that differ by business type, kept in one place so vet-only behavior isn't
 * hard-coded across the app. Adding a type to the enum makes this fail to type-check
 * until its rules are written.
 */
export const BUSINESS_TYPE_RULES: Record<BusinessType, BusinessTypeRules> = {
  vet_clinic: { emergencyFlags: true },
};
