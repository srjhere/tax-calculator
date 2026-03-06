// ============================================================
//  Indian Income Tax Rule Engine — Calculation Engine
//  Covers: FY 2022-23 to FY 2025-26
//  Handles: Old/New regime, Sec 87A rebate, surcharge,
//           Marginal Relief, Health & Education Cess
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
  slabBreakdown: SlabBreakdown[];
  grossTax: number;
  rebate87A: number;
  taxAfterRebate: number;
  surchargeRate: number;
  surcharge: number;           // actual surcharge after marginal relief
  marginalRelief: number;      // relief amount (0 if not applicable)
  taxPlusSurcharge: number;
  cess: number;
  totalTax: number;
  effectiveRate: number;
  summary: string;
}

// ----------------------------------------------------------
//  Core helpers
// ----------------------------------------------------------

function calculateSlabTax(income: number, slabs: TaxSlab[]): SlabBreakdown[] {
  const breakdown: SlabBreakdown[] = [];
  for (const slab of slabs) {
    const lower = slab.from === 0 ? 0 : slab.from - 1;
    const upper = slab.to === null ? Infinity : slab.to;
    const applicable = Math.min(income, upper) - lower;
    if (applicable <= 0) continue;
    breakdown.push({
      from: slab.from,
      to: slab.to,
      rate: slab.rate,
      taxableAmount: applicable,
      tax: Math.round(applicable * slab.rate),
    });
  }
  return breakdown;
}

function getSurchargeRate(income: number, rules: SurchargeRule[]): number {
  let rate = 0;
  for (const rule of rules) {
    if (income > rule.incomeAbove) rate = rule.rate;
  }
  return rate;
}

/**
 * Computes surcharge with proper marginal relief per the Income Tax rules.
 *
 * Marginal relief ensures that the INCREASE in tax due to surcharge does not
 * exceed the INCREASE in income over the surcharge threshold.
 *
 * For each threshold T[i] that income crosses, the maximum allowed tax is:
 *   tax_at_T[i] (with lower-band surcharge) + (income − T[i])
 *
 * The final tax+surcharge = min over all applicable thresholds.
 */
function computeSurchargeWithMarginalRelief(
  income: number,
  taxAfterRebate: number,
  surchargeRules: SurchargeRule[],
  slabs: TaxSlab[]
): { surcharge: number; surchargeRate: number; marginalRelief: number } {
  const surchargeRate = getSurchargeRate(income, surchargeRules);

  if (surchargeRate === 0 || taxAfterRebate === 0) {
    return { surcharge: 0, surchargeRate: 0, marginalRelief: 0 };
  }

  const rawSurcharge = Math.round(taxAfterRebate * surchargeRate);
  let cappedTaxWithSurcharge = taxAfterRebate + rawSurcharge;

  // Check marginal relief at each threshold the income crosses
  for (const rule of surchargeRules) {
    const threshold = rule.incomeAbove;
    if (income <= threshold) continue;

    // Previous band surcharge rate (rate that applied just below this threshold)
    const prevRules = surchargeRules.filter((r) => r.incomeAbove < threshold);
    const prevRate = prevRules.length > 0 ? prevRules[prevRules.length - 1].rate : 0;

    // Base tax at the threshold (no rebate since thresholds are 50L+ >> rebate limits)
    const baseTaxAtThreshold = calculateSlabTax(threshold, slabs).reduce(
      (s, b) => s + b.tax,
      0
    );
    // Tax at threshold with its lower-band surcharge
    const taxAtThreshold =
      baseTaxAtThreshold + Math.round(baseTaxAtThreshold * prevRate);

    // Maximum allowed tax = tax at threshold + excess income over threshold
    const maxAllowed = taxAtThreshold + (income - threshold);

    // Cap running total (apply marginal relief)
    cappedTaxWithSurcharge = Math.min(cappedTaxWithSurcharge, maxAllowed);
  }

  const actualSurcharge = Math.max(0, cappedTaxWithSurcharge - taxAfterRebate);
  const marginalRelief = Math.max(0, rawSurcharge - actualSurcharge);

  return { surcharge: actualSurcharge, surchargeRate, marginalRelief };
}

// ----------------------------------------------------------
//  Main calculation function
// ----------------------------------------------------------

export function calculateTax(input: TaxInput): TaxResult {
  const { financialYear, regime, category, taxableIncome } = input;

  const rules = TAX_RULES[financialYear];
  if (!rules) throw new Error(`Financial year ${financialYear} is not supported.`);

  // 1. Pick the correct slab table
  const slabs: TaxSlab[] =
    regime === "old" ? rules.oldRegime[category] : rules.newRegime;

  // 2. Gross slab tax
  const slabBreakdown = calculateSlabTax(taxableIncome, slabs);
  const grossTax = slabBreakdown.reduce((s, b) => s + b.tax, 0);

  // 3. Sec 87A Rebate
  const rebateRule = regime === "old" ? rules.rebate.old : rules.rebate.new;
  const rebate87A =
    taxableIncome <= rebateRule.incomeLimit
      ? Math.min(grossTax, rebateRule.maxRebate)
      : 0;
  const taxAfterRebate = Math.max(0, grossTax - rebate87A);

  // 4. Surcharge + Marginal Relief
  const surchargeRules =
    regime === "old" ? rules.surcharge.old : rules.surcharge.new;
  const { surcharge, surchargeRate, marginalRelief } =
    computeSurchargeWithMarginalRelief(
      taxableIncome,
      taxAfterRebate,
      surchargeRules,
      slabs
    );

  const taxPlusSurcharge = taxAfterRebate + surcharge;

  // 5. Health & Education Cess (4%)
  const cess = Math.round(taxPlusSurcharge * rules.cess.rate);

  // 6. Total Tax
  const totalTax = taxPlusSurcharge + cess;

  // 7. Effective rate
  const effectiveRate = taxableIncome > 0 ? (totalTax / taxableIncome) * 100 : 0;

  // 8. Summary
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);
  const pct = (r: number) => `${(r * 100).toFixed(0)}%`;

  const summary = [
    `FY ${financialYear} | ${regime.toUpperCase()} Regime`,
    `Taxable Income    : ${fmt(taxableIncome)}`,
    `Gross Slab Tax    : ${fmt(grossTax)}`,
    rebate87A > 0 ? `Rebate u/s 87A    : -${fmt(rebate87A)}` : null,
    `Tax after Rebate  : ${fmt(taxAfterRebate)}`,
    surcharge > 0 ? `Surcharge (${pct(surchargeRate)}) : ${fmt(surcharge)}` : null,
    marginalRelief > 0 ? `Marginal Relief   : -${fmt(marginalRelief)}` : null,
    `Cess (4%)         : ${fmt(cess)}`,
    `─────────────────────────────────`,
    `Total Tax         : ${fmt(totalTax)}`,
    `Effective Rate    : ${effectiveRate.toFixed(2)}%`,
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
    marginalRelief,
    taxPlusSurcharge,
    cess,
    totalTax,
    effectiveRate,
    summary,
  };
}

// ----------------------------------------------------------
//  Comparison helper
// ----------------------------------------------------------

export interface RegimeComparison {
  old: TaxResult;
  new: TaxResult;
  recommendation: "old" | "new" | "equal";
  saving: number;
}

export function compareRegimes(
  financialYear: FinancialYear,
  category: TaxpayerCategory,
  taxableIncome: number
): RegimeComparison {
  const old = calculateTax({ financialYear, regime: "old", category, taxableIncome });
  const newR = calculateTax({ financialYear, regime: "new", category, taxableIncome });
  const saving = Math.abs(old.totalTax - newR.totalTax);
  const recommendation =
    old.totalTax < newR.totalTax ? "old" : newR.totalTax < old.totalTax ? "new" : "equal";
  return { old, new: newR, recommendation, saving };
}
