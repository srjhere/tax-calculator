import { useState, useMemo } from "react";
import { calculateTax, compareRegimes } from "../engine/taxEngine";
import type { FinancialYear, Regime, TaxpayerCategory } from "../engine/taxRules";

// ── helpers ────────────────────────────────────────────────
const INR = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const INR_COMPACT = (n: number) => {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)} L`;
  return INR(n);
};

const PRESET_INCOMES = [
  { label: "5L",  value: 5_00_000 },
  { label: "7L",  value: 7_00_000 },
  { label: "10L", value: 10_00_000 },
  { label: "12L", value: 12_00_000 },
  { label: "15L", value: 15_00_000 },
  { label: "20L", value: 20_00_000 },
  { label: "30L", value: 30_00_000 },
  { label: "50L", value: 50_00_000 },
  { label: "1Cr", value: 1_00_00_000 },
];

const YEARS: FinancialYear[] = ["2022-23", "2023-24", "2024-25", "2025-26"];

interface CategoryInfo {
  id: TaxpayerCategory;
  emoji: string;
  name: string;
  age: string;
}

const CATEGORIES: CategoryInfo[] = [
  { id: "others",       emoji: "👤", name: "Individual",    age: "Below 60 yrs" },
  { id: "senior",       emoji: "🧑‍🦳", name: "Senior Citizen", age: "60 – 79 yrs" },
  { id: "super_senior", emoji: "👴", name: "Super Senior",  age: "80 yrs & above" },
];

// ── component ──────────────────────────────────────────────
export default function Calculator() {
  const [year, setYear]         = useState<FinancialYear>("2025-26");
  const [regime, setRegime]     = useState<Regime>("new");
  const [category, setCategory] = useState<TaxpayerCategory>("others");
  const [income, setIncome]     = useState<string>("");

  const numericIncome = useMemo(() => {
    const v = parseFloat(income.replace(/,/g, ""));
    return isNaN(v) || v < 0 ? 0 : v;
  }, [income]);

  const result = useMemo(() => {
    if (numericIncome <= 0) return null;
    return calculateTax({ financialYear: year, regime, category, taxableIncome: numericIncome });
  }, [year, regime, category, numericIncome]);

  const comparison = useMemo(() => {
    if (numericIncome <= 0) return null;
    return compareRegimes(year, category, numericIncome);
  }, [year, category, numericIncome]);

  const isZeroTax = result?.totalTax === 0;

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-icon">🧮</div>
        <div className="header-text">
          <h1>Income Tax Calculator</h1>
          <p>India · FY 2022-23 to 2025-26 · Old &amp; New Regime</p>
        </div>
      </header>

      <div className="main-layout">
        {/* ══ LEFT: Inputs ══ */}
        <div className="inputs-col">

          {/* Step 1 — Year */}
          <div className="card">
            <div className="step-label">
              <span className="step-num">1</span>
              <h2>Financial Year</h2>
            </div>
            <div className="year-grid">
              {YEARS.map((y) => (
                <button
                  key={y}
                  className={`year-btn${year === y ? " year-btn--active" : ""}`}
                  onClick={() => setYear(y)}
                >
                  {y === "2025-26" && <span className="year-btn__badge">Latest</span>}
                  <span className="year-btn__label">FY</span>
                  <span className="year-btn__year">{y}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2 — Regime */}
          <div className="card">
            <div className="step-label">
              <span className="step-num">2</span>
              <h2>Tax Regime</h2>
            </div>
            <div className="regime-grid">
              {/* Old Regime */}
              <button
                className={`regime-btn${regime === "old" ? " regime-btn--active" : ""}`}
                onClick={() => setRegime("old")}
              >
                <div className="regime-btn__check">
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <div className="regime-btn__header">
                  <div className="regime-btn__icon">📋</div>
                  <span className="regime-btn__name">Old Regime</span>
                </div>
                <p className="regime-btn__desc">
                  Higher exemptions &amp; deductions. Best if you claim HRA, 80C, home loan, etc.
                </p>
                <div className="regime-btn__tags">
                  <span className="tag">80C upto ₹1.5L</span>
                  <span className="tag">HRA</span>
                  <span className="tag">80D</span>
                  <span className="tag">Home Loan</span>
                </div>
              </button>

              {/* New Regime */}
              <button
                className={`regime-btn${regime === "new" ? " regime-btn--active" : ""}`}
                onClick={() => setRegime("new")}
              >
                <div className="regime-btn__check">
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <div className="regime-btn__header">
                  <div className="regime-btn__icon">⚡</div>
                  <span className="regime-btn__name">New Regime</span>
                </div>
                <p className="regime-btn__desc">
                  Lower slab rates with simplified structure. Default regime since FY 2023-24.
                </p>
                <div className="regime-btn__tags">
                  <span className="tag">Lower Rates</span>
                  <span className="tag">No Deductions</span>
                  <span className="tag">Default</span>
                </div>
              </button>
            </div>
          </div>

          {/* Step 3 — Category */}
          <div className="card">
            <div className="step-label">
              <span className="step-num">3</span>
              <h2>Taxpayer Category</h2>
            </div>
            <div className="category-grid">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  className={`cat-btn${category === c.id ? " cat-btn--active" : ""}`}
                  onClick={() => setCategory(c.id)}
                >
                  <span className="cat-btn__emoji">{c.emoji}</span>
                  <div className="cat-btn__name">{c.name}</div>
                  <div className="cat-btn__age">{c.age}</div>
                </button>
              ))}
            </div>
            {regime === "new" && (
              <p style={{ marginTop: 14, fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                ℹ️ New regime applies uniform slabs regardless of age category.
              </p>
            )}
          </div>

          {/* Step 4 — Income */}
          <div className="card">
            <div className="step-label">
              <span className="step-num">4</span>
              <h2>Taxable Income</h2>
            </div>
            <div className="income-wrapper">
              <span className="income-prefix">₹</span>
              <input
                className="income-input"
                type="number"
                placeholder="0"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
              />
            </div>
            <div className="income-formatted">
              {numericIncome > 0
                ? <>Amount in words: <span>{INR_COMPACT(numericIncome)}</span></>
                : "Enter your total taxable income after all deductions"}
            </div>
            <div className="income-presets">
              {PRESET_INCOMES.map((p) => (
                <button
                  key={p.label}
                  className="preset-btn"
                  onClick={() => setIncome(String(p.value))}
                >
                  ₹{p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ══ RIGHT: Results ══ */}
        <div className="results-col">
          {!result ? (
            <div className="card">
              <div className="prompt-state">
                <span className="prompt-state__icon">📊</span>
                <div className="prompt-state__title">Your results appear here</div>
                <p className="prompt-state__sub">
                  Select a year, regime, category and enter your taxable income to see the full breakdown.
                </p>
              </div>
            </div>
          ) : (
            <div className="results-enter">

              {/* ── Main Tax Hero Card ── */}
              <div className={`tax-hero${isZeroTax ? " tax-hero--zero" : ""}`}>
                <div className="tax-hero__label">
                  {isZeroTax ? "🎉 Zero Tax Payable" : "Total Tax Payable"}
                </div>
                <div className="tax-hero__amount">{INR(result.totalTax)}</div>
                <div className="tax-hero__effective">
                  {isZeroTax
                    ? "Full rebate under Section 87A applies"
                    : `Effective Rate: ${result.effectiveRate.toFixed(2)}% on ${INR_COMPACT(numericIncome)}`}
                </div>
                <div className="tax-hero__pills">
                  <span className="tax-hero__pill">FY {year}</span>
                  <span className="tax-hero__pill">{regime === "old" ? "Old Regime" : "New Regime"}</span>
                  <span className="tax-hero__pill">
                    {CATEGORIES.find(c => c.id === category)?.name}
                  </span>
                </div>
              </div>

              {/* ── Breakdown items ── */}
              <div className="breakdown-grid">
                <div className="breakdown-item">
                  <div className="breakdown-item__label">Gross Slab Tax</div>
                  <div className="breakdown-item__value">{INR(result.grossTax)}</div>
                  <div className="breakdown-item__sub">Before rebate &amp; cess</div>
                </div>

                {result.rebate87A > 0 && (
                  <div className="breakdown-item breakdown-item--rebate">
                    <div className="breakdown-item__label">Rebate u/s 87A</div>
                    <div className="breakdown-item__value">− {INR(result.rebate87A)}</div>
                    <div className="breakdown-item__sub">Section 87A rebate</div>
                  </div>
                )}

                {result.surcharge > 0 && (
                  <div className="breakdown-item breakdown-item--surcharge">
                    <div className="breakdown-item__label">
                      Surcharge ({(result.surchargeRate * 100).toFixed(0)}%)
                    </div>
                    <div className="breakdown-item__value">{INR(result.surcharge)}</div>
                    <div className="breakdown-item__sub">On income above threshold</div>
                  </div>
                )}

                <div className="breakdown-item">
                  <div className="breakdown-item__label">H&amp;E Cess (4%)</div>
                  <div className="breakdown-item__value">{INR(result.cess)}</div>
                  <div className="breakdown-item__sub">Health &amp; Education Cess</div>
                </div>
              </div>

              {/* ── Slab Breakdown Table ── */}
              {result.slabBreakdown.length > 0 && (
                <div className="slab-table-card">
                  <div className="slab-table-header">
                    <h3>Slab-wise Breakdown</h3>
                    <span>{regime === "old" ? "Old Regime" : "New Regime"} · FY {year}</span>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Income Slab</th>
                        <th>Rate</th>
                        <th>Taxable Amt</th>
                        <th>Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.slabBreakdown.map((s, i) => (
                        <tr key={i}>
                          <td>
                            {INR_COMPACT(s.from)} –{" "}
                            {s.to ? INR_COMPACT(s.to) : "Above"}
                          </td>
                          <td>
                            <span className={`slab-rate-badge${s.rate === 0 ? " slab-rate-badge--zero" : ""}`}>
                              {(s.rate * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td>{INR_COMPACT(s.taxableAmount)}</td>
                          <td>{INR(s.tax)}</td>
                        </tr>
                      ))}
                      <tr className="slab-total-row">
                        <td colSpan={3}>Total Slab Tax</td>
                        <td>{INR(result.grossTax)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Regime Comparison ── */}
              {comparison && (
                <div className="comparison-card">
                  <div className="comparison-header">
                    <h3>Regime Comparison</h3>
                    <span>Same income · FY {year}</span>
                  </div>
                  <div className="comparison-body">
                    {/* Old */}
                    <div className={`comparison-regime${comparison.recommendation === "old" ? " comparison-regime--winner" : ""}`}>
                      <div className="comparison-regime__label">Old Regime</div>
                      <div className="comparison-regime__amount">{INR(comparison.old.totalTax)}</div>
                      <div className="comparison-regime__rate">
                        Effective: {comparison.old.effectiveRate.toFixed(2)}%
                      </div>
                      {comparison.recommendation === "old" && (
                        <div className="winner-badge">✓ Better Choice</div>
                      )}
                    </div>
                    {/* New */}
                    <div className={`comparison-regime${comparison.recommendation === "new" ? " comparison-regime--winner" : ""}`}>
                      <div className="comparison-regime__label">New Regime</div>
                      <div className="comparison-regime__amount">{INR(comparison.new.totalTax)}</div>
                      <div className="comparison-regime__rate">
                        Effective: {comparison.new.effectiveRate.toFixed(2)}%
                      </div>
                      {comparison.recommendation === "new" && (
                        <div className="winner-badge">✓ Better Choice</div>
                      )}
                    </div>
                  </div>

                  {comparison.recommendation === "equal" ? (
                    <div className="comparison-equal">
                      Both regimes result in the same tax — ₹{comparison.old.totalTax.toLocaleString("en-IN")}
                    </div>
                  ) : (
                    <div className="comparison-saving">
                      <strong>{comparison.recommendation === "old" ? "Old" : "New"} Regime</strong> saves you{" "}
                      <strong>{INR(comparison.saving)}</strong>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
