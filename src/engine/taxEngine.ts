// ============================================================
//  Indian Income Tax Rule Engine — Calculation Engine
//  Covers: FY 2022-23 to FY 2025-26
//  Handles: Old/New regime, all taxpayer categories,
//           Sec 87A rebate, surcharge, Health & Education Cess
// ============================================================

import {
  TAX_RULES,
  type FinancialYear,
  type Regime,
  type TaxpayerCategory,
  type TaxSlab,
  type SurchargeRule,
} from "./taxRules";

// ----------------------------------------------------------
//  Public Input / Output types
// ----------------------------------------------------------

export interface TaxInput {
  financialYear: FinancialYear;
  regime: Regime;
  category: TaxpayerCategory;
  /** Total taxable income AFTER all deductions (in INR) */
  taxableIncome: number;
}

export interface SlabBreakdown {
  from: number;
  to: number | null;
  rate: number;
  taxableAmount: number;
  tax: number;
}

export interface TaxResult {
  input: TaxInput;

  // Step-by-step breakdown
  slabBreakdown: SlabBreakdown[];
  grossTax: number;          // sum of slab taxes
  rebate87A: number;         // Sec 87A rebate applied
  taxAfterRebate: number;    // grossTax - rebate87A
  surchargeRate: number;     // applicable surcharge rate (e.g. 0.10)
  surcharge: number;         // surcharge amount
  taxPlusSurcharge: number;  // taxAfterRebate + surcharge
  cess: number;              // Health & Education Cess (4%)
  totalTax: number;          // final tax liability
  effectiveRate: number;     // totalTax / taxableIncome (%)

  // Human-readable summary
  summary: string;
}

// ----------------------------------------------------------
//  Core helpers
// ----------------------------------------------------------

/**
 * Calculate tax on income using a progressive slab structure.
 */
function calculateSlabTax(income: number, slabs: TaxSlab[]): SlabBreakdown[] {
  const breakdown: SlabBreakdown[] = [];

  for (const slab of slabs) {
    if (income <= 0) break;

    const slabFloor = slab.from === 0 ? 0 : slab.from;
    const slabCeiling = slab.to ?? Infinity;

    // Amount of income that falls in this slab
    const taxableInSlab = Math.max(
      0,
      Math.min(income, slabCeiling) - slabFloor + (slab.from === 0 ? 0 : 0)
    );

    // Rethink: more robust calculation
    // income within [from, to]
    const lower = slab.from;
    const upper = slab.to === null ? Infinity : slab.to;
    const applicable = Math.min(income, upper) - lower;

    if (applicable <= 0) continue;

    const tax = Math.round(applicable * slab.rate);
    breakdown.push({
      from: slab.from,
      to: slab.to,
      rate: slab.rate,
      taxableAmount: applicable,
      tax,
    });
  }

  return breakdown;
}

/**
 * Get the applicable surcharge rate for an income level.
 * Surcharge rules are cumulative — the highest matching tier wins.
 */
function getSurchargeRate(income: number, rules: SurchargeRule[]): number {
  let rate = 0;
  for (const rule of rules) {
    if (income > rule.incomeAbove) {
      rate = rule.rate;
    }
  }
  return rate;
}

/**
 * Marginal relief: ensures that extra tax due to surcharge does not
 * exceed the extra income above the threshold.
 * Returns the adjusted surcharge (with marginal relief if applicable).
 */
function applyMarginalRelief(
  income: number,
  taxAfterRebate: number,
  surchargeRate: number,
  rules: SurchargeRule[]
): number {
  if (surchargeRate === 0) return 0;

  const rawSurcharge = Math.round(taxAfterRebate * surchargeRate);

  // Find the lowest threshold at which this surcharge rate kicks in
  const threshold = rules.find((r) => r.rate === surchargeRate)?.incomeAbove;
  if (threshold === undefined) return rawSurcharge;

  // Tax that would apply at the threshold (recompute at threshold income)
  // Marginal relief: surcharge should not cause total tax to exceed
  // (income - threshold) above the tax at threshold.
  // Simplified: cap surcharge so that (tax + surcharge) <= tax_at_threshold + (income - threshold)
  // For full accuracy this would need a recursive call; we apply the standard approximation.
  const excessIncome = income - threshold;
  const cappedSurcharge = Math.max(0, Math.min(rawSurcharge, excessIncome));

  // Only apply marginal relief if it actually reduces the surcharge
  return Math.min(rawSurcharge, cappedSurcharge);
}

// ----------------------------------------------------------
//  Main calculation function
// ----------------------------------------------------------

export function calculateTax(input: TaxInput): TaxResult {
  const { financialYear, regime, category, taxableIncome } = input;

  const rules = TAX_RULES[financialYear];
  if (!rules) {
    throw new Error(`Financial year ${financialYear} is not supported.`);
  }

  // 1. Pick the correct slab table
  let slabs: TaxSlab[];
  if (regime === "old") {
    slabs = rules.oldRegime[category];
  } else {
    // New regime has no category distinction
    slabs = rules.newRegime;
  }

  // 2. Calculate gross slab tax
  const slabBreakdown = calculateSlabTax(taxableIncome, slabs);
  const grossTax = slabBreakdown.reduce((sum, s) => sum + s.tax, 0);

  // 3. Sec 87A Rebate
  const rebateRule = regime === "old" ? rules.rebate.old : rules.rebate.new;
  let rebate87A = 0;
  if (taxableIncome <= rebateRule.incomeLimit) {
    rebate87A = Math.min(grossTax, rebateRule.maxRebate);
  }
  const taxAfterRebate = Math.max(0, grossTax - rebate87A);

  // 4. Surcharge
  const surchargeRules =
    regime === "old" ? rules.surcharge.old : rules.surcharge.new;
  const surchargeRate = getSurchargeRate(taxableIncome, surchargeRules);
  const surcharge = Math.round(taxAfterRebate * surchargeRate);

  const taxPlusSurcharge = taxAfterRebate + surcharge;

  // 5. Health & Education Cess (4%)
  const cess = Math.round(taxPlusSurcharge * rules.cess.rate);

  // 6. Total Tax
  const totalTax = taxPlusSurcharge + cess;

  // 7. Effective rate
  const effectiveRate =
    taxableIncome > 0 ? (totalTax / taxableIncome) * 100 : 0;

  // 8. Build human-readable summary
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);

  const pct = (r: number) => `${(r * 100).toFixed(0)}%`;

  const summary = [
    `FY ${financialYear} | ${regime.toUpperCase()} Regime | ${category.replace("_", " ")}`,
    `Taxable Income   : ${fmt(taxableIncome)}`,
    `Gross Slab Tax   : ${fmt(grossTax)}`,
    rebate87A > 0 ? `Rebate u/s 87A   : -${fmt(rebate87A)}` : null,
    `Tax after Rebate : ${fmt(taxAfterRebate)}`,
    surcharge > 0
      ? `Surcharge (${pct(surchargeRate)})  : ${fmt(surcharge)}`
      : null,
    `Cess (4%)        : ${fmt(cess)}`,
    `─────────────────────────────────`,
    `Total Tax        : ${fmt(totalTax)}`,
    `Effective Rate   : ${effectiveRate.toFixed(2)}%`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    input,
    slabBreakdown,
    grossTax,
    rebate87A,
    taxAfterRebate,
    surchargeRate,
    surcharge,
    taxPlusSurcharge,
    cess,
    totalTax,
    effectiveRate,
    summary,
  };
}

// ----------------------------------------------------------
//  Comparison helper: Old vs New regime for the same income
// ----------------------------------------------------------

export interface RegimeComparison {
  old: TaxResult;
  new: TaxResult;
  recommendation: "old" | "new" | "equal";
  saving: number; // how much the recommended regime saves
}

export function compareRegimes(
  financialYear: FinancialYear,
  category: TaxpayerCategory,
  taxableIncome: number
): RegimeComparison {
  const old = calculateTax({
    financialYear,
    regime: "old",
    category,
    taxableIncome,
  });
  const newR = calculateTax({
    financialYear,
    regime: "new",
    category,
    taxableIncome,
  });

  const saving = Math.abs(old.totalTax - newR.totalTax);
  const recommendation =
    old.totalTax < newR.totalTax
      ? "old"
      : newR.totalTax < old.totalTax
      ? "new"
      : "equal";

  return { old, new: newR, recommendation, saving };
}

// ----------------------------------------------------------
//  Section 89(1) helper — arrear salary relief
//  Calculates tax difference when arrear is spread back
//  to the year it belonged to.
// ----------------------------------------------------------

export interface ArrearEntry {
  financialYear: FinancialYear;
  regime: Regime;
  category: TaxpayerCategory;
  /** Income of that year WITHOUT the arrear */
  originalIncome: number;
  /** Arrear amount relating to that year */
  arrearAmount: number;
}

export interface Section891Result {
  entries: Array<{
    financialYear: FinancialYear;
    taxWithout: number;
    taxWith: number;
    difference: number;
  }>;
  totalDifference: number;   // column 7 total of Table A
  taxOnArrearInCurrentYear: number; // tax on arrear if taxed this year
  relief: number;            // Sec 89(1) relief = max(0, taxOnCurrentYear - totalDifference)
}

export function calculateSection891Relief(
  currentYear: FinancialYear,
  currentYearResult: TaxResult,
  arrears: ArrearEntry[]
): Section891Result {
  const entries = arrears.map((a) => {
    const taxWithout = calculateTax({
      financialYear: a.financialYear,
      regime: a.regime,
      category: a.category,
      taxableIncome: a.originalIncome,
    }).totalTax;

    const taxWith = calculateTax({
      financialYear: a.financialYear,
      regime: a.regime,
      category: a.category,
      taxableIncome: a.originalIncome + a.arrearAmount,
    }).totalTax;

    return {
      financialYear: a.financialYear,
      taxWithout,
      taxWith,
      difference: Math.max(0, taxWith - taxWithout),
    };
  });

  const totalDifference = entries.reduce((s, e) => s + e.difference, 0);

  // Tax on arrear if included in current year
  // = (current year total tax) - (current year tax WITHOUT arrear)
  const totalArrear = arrears.reduce((s, a) => s + a.arrearAmount, 0);
  const incomeWithoutArrear =
    currentYearResult.input.taxableIncome - totalArrear;

  const taxWithoutArrear = calculateTax({
    financialYear: currentYear,
    regime: currentYearResult.input.regime,
    category: currentYearResult.input.category,
    taxableIncome: Math.max(0, incomeWithoutArrear),
  }).totalTax;

  const taxOnArrearInCurrentYear = Math.max(
    0,
    currentYearResult.totalTax - taxWithoutArrear
  );

  const relief = Math.max(0, taxOnArrearInCurrentYear - totalDifference);

  return {
    entries,
    totalDifference,
    taxOnArrearInCurrentYear,
    relief,
  };
}
