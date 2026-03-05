// ============================================================
//  Indian Income Tax Rule Engine — Rules Data
//  Source: Tax Rates FY 2022-23 to FY 2025-26.xlsx
// ============================================================

export type FinancialYear = "2022-23" | "2023-24" | "2024-25" | "2025-26";
export type Regime = "old" | "new";
export type TaxpayerCategory = "others" | "senior" | "super_senior";
// others       = below 60 years
// senior       = 60 to 79 years
// super_senior = 80+ years

export interface TaxSlab {
  from: number;
  to: number | null; // null = infinity (Above)
  rate: number;      // e.g. 0.05 = 5%
}

export interface Rebate87A {
  incomeLimit: number;  // max income to qualify
  maxRebate: number;    // max rebate amount
}

export interface SurchargeRule {
  incomeAbove: number;
  rate: number;
}

export interface CessRule {
  rate: number; // 4% = 0.04
}

export interface YearRules {
  oldRegime: {
    others: TaxSlab[];
    senior: TaxSlab[];
    super_senior: TaxSlab[];
  };
  newRegime: TaxSlab[]; // new regime has no category distinction
  rebate: {
    old: Rebate87A;
    new: Rebate87A;
  };
  surcharge: {
    old: SurchargeRule[];
    new: SurchargeRule[]; // max 25% in new regime from FY 2023-24
  };
  cess: CessRule;
}

// ----------------------------------------------------------
//  Old Regime Slabs (unchanged across all years)
// ----------------------------------------------------------

const OLD_OTHERS: TaxSlab[] = [
  { from: 0,       to: 250000,  rate: 0 },
  { from: 250001,  to: 500000,  rate: 0.05 },
  { from: 500001,  to: 1000000, rate: 0.20 },
  { from: 1000001, to: null,    rate: 0.30 },
];

const OLD_SENIOR: TaxSlab[] = [
  { from: 0,       to: 300000,  rate: 0 },
  { from: 300001,  to: 500000,  rate: 0.05 },
  { from: 500001,  to: 1000000, rate: 0.20 },
  { from: 1000001, to: null,    rate: 0.30 },
];

// Super Senior Citizen (80+): exemption up to 5L
const OLD_SUPER_SENIOR: TaxSlab[] = [
  { from: 0,       to: 500000,  rate: 0 },
  { from: 500001,  to: 1000000, rate: 0.20 },
  { from: 1000001, to: null,    rate: 0.30 },
];

// ----------------------------------------------------------
//  Standard Surcharge Rules
//  Old: 10% >50L, 15% >1Cr, 25% >2Cr, 37% >5Cr
//  New: same but capped at 25% (no 37% slab)
// ----------------------------------------------------------

const SURCHARGE_OLD: SurchargeRule[] = [
  { incomeAbove: 50_00_000,  rate: 0.10 },
  { incomeAbove: 1_00_00_000, rate: 0.15 },
  { incomeAbove: 2_00_00_000, rate: 0.25 },
  { incomeAbove: 5_00_00_000, rate: 0.37 },
];

// New regime: max surcharge 25% (37% slab removed from FY 2023-24)
const SURCHARGE_NEW_FROM_2023: SurchargeRule[] = [
  { incomeAbove: 50_00_000,  rate: 0.10 },
  { incomeAbove: 1_00_00_000, rate: 0.15 },
  { incomeAbove: 2_00_00_000, rate: 0.25 },
];

// FY 2022-23: surcharge same for both regimes (37% applied)
const SURCHARGE_ALL_2022: SurchargeRule[] = SURCHARGE_OLD;

// ----------------------------------------------------------
//  All Year Rules
// ----------------------------------------------------------

export const TAX_RULES: Record<FinancialYear, YearRules> = {
  "2022-23": {
    oldRegime: {
      others: OLD_OTHERS,
      senior: OLD_SENIOR,
      super_senior: OLD_SUPER_SENIOR,
    },
    newRegime: [
      { from: 0,       to: 250000,  rate: 0 },
      { from: 250001,  to: 500000,  rate: 0.05 },
      { from: 500001,  to: 750000,  rate: 0.10 },
      { from: 750001,  to: 1000000, rate: 0.15 },
      { from: 1000001, to: 1250000, rate: 0.20 },
      { from: 1250001, to: 1500000, rate: 0.25 },
      { from: 1500001, to: null,    rate: 0.30 },
    ],
    rebate: {
      old: { incomeLimit: 500000, maxRebate: 12500 },
      new: { incomeLimit: 500000, maxRebate: 12500 },
    },
    surcharge: {
      old: SURCHARGE_ALL_2022,
      new: SURCHARGE_ALL_2022,
    },
    cess: { rate: 0.04 },
  },

  "2023-24": {
    oldRegime: {
      others: OLD_OTHERS,
      senior: OLD_SENIOR,
      super_senior: OLD_SUPER_SENIOR,
    },
    newRegime: [
      { from: 0,       to: 300000,  rate: 0 },
      { from: 300001,  to: 600000,  rate: 0.05 },
      { from: 600001,  to: 900000,  rate: 0.10 },
      { from: 900001,  to: 1200000, rate: 0.15 },
      { from: 1200001, to: 1500000, rate: 0.20 },
      { from: 1500001, to: null,    rate: 0.30 },
    ],
    rebate: {
      old: { incomeLimit: 500000,  maxRebate: 12500 },
      new: { incomeLimit: 700000,  maxRebate: 25000 },
    },
    surcharge: {
      old: SURCHARGE_OLD,
      new: SURCHARGE_NEW_FROM_2023,
    },
    cess: { rate: 0.04 },
  },

  "2024-25": {
    oldRegime: {
      others: OLD_OTHERS,
      senior: OLD_SENIOR,
      super_senior: OLD_SUPER_SENIOR,
    },
    newRegime: [
      { from: 0,       to: 300000,  rate: 0 },
      { from: 300001,  to: 700000,  rate: 0.05 },
      { from: 700001,  to: 1000000, rate: 0.10 },
      { from: 1000001, to: 1200000, rate: 0.15 },
      { from: 1200001, to: 1500000, rate: 0.20 },
      { from: 1500001, to: null,    rate: 0.30 },
    ],
    rebate: {
      old: { incomeLimit: 500000,  maxRebate: 12500 },
      new: { incomeLimit: 700000,  maxRebate: 25000 },
    },
    surcharge: {
      old: SURCHARGE_OLD,
      new: SURCHARGE_NEW_FROM_2023,
    },
    cess: { rate: 0.04 },
  },

  "2025-26": {
    oldRegime: {
      others: OLD_OTHERS,
      senior: OLD_SENIOR,
      super_senior: OLD_SUPER_SENIOR,
    },
    newRegime: [
      { from: 0,        to: 400000,  rate: 0 },
      { from: 400001,   to: 800000,  rate: 0.05 },
      { from: 800001,   to: 1200000, rate: 0.10 },
      { from: 1200001,  to: 1600000, rate: 0.15 },
      { from: 1600001,  to: 2000000, rate: 0.20 },
      { from: 2000001,  to: 2400000, rate: 0.25 },
      { from: 2400001,  to: null,    rate: 0.30 },
    ],
    rebate: {
      old: { incomeLimit: 500000,   maxRebate: 12500 },
      new: { incomeLimit: 1200000,  maxRebate: 60000 },
    },
    surcharge: {
      old: SURCHARGE_OLD,
      new: SURCHARGE_NEW_FROM_2023,
    },
    cess: { rate: 0.04 },
  },
};

export const SUPPORTED_YEARS = Object.keys(TAX_RULES) as FinancialYear[];
