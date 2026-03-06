import { useState, useMemo, useCallback } from "react";
import { calculateTax } from "../engine/taxEngine";
import type { FinancialYear, Regime } from "../engine/taxRules";

// ── Types ──────────────────────────────────────────────────

interface Employee {
  name: string;
  srNo: string;
  office: string;
  pan: string;
  designation: string;
  place: string;
  date: string;
  residentialStatus: string;
}

interface YearRow {
  fy: FinancialYear;
  fyLabel: string;
  taxableIncome: number;
  grossArrear: number;
  domMedArrear: number;
  regime: Regime;
}

// ── Constants ──────────────────────────────────────────────

const PREV_YEARS: Array<{ fy: FinancialYear; label: string }> = [
  { fy: "2022-23", label: "2022-2023" },
  { fy: "2023-24", label: "2023-2024" },
  { fy: "2024-25", label: "2024-2025" },
];

const CURRENT_FY: FinancialYear = "2025-26";

// ── Helpers ────────────────────────────────────────────────

const INR = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const INR_PLAIN = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);

const today = () => new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

// ── Sub-components (defined OUTSIDE to prevent remount on every render) ────

function RegimeToggle({ value, onChange }: { value: Regime; onChange: (r: Regime) => void }) {
  return (
    <div className="regime-toggle">
      <button className={`rt-btn${value === "old" ? " rt-btn--on" : ""}`} onClick={() => onChange("old")}>Old</button>
      <button className={`rt-btn${value === "new" ? " rt-btn--on" : ""}`} onClick={() => onChange("new")}>New</button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string;
}) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <input className="field-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? label} />
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

function NumberField({ label, value, onChange, hint }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string;
}) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <div className="field-num-wrap">
        <span className="field-num-prefix">₹</span>
        <input
          className="field-input field-input--num"
          type="number"
          value={value === 0 ? "" : value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          placeholder="0"
          min={0}
        />
      </div>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────

export default function Form89() {
  const [emp, setEmp] = useState<Employee>({
    name: "",
    srNo: "",
    office: "",
    pan: "",
    designation: "",
    place: "",
    date: today(),
    residentialStatus: "RESIDENT",
  });

  const [rows, setRows] = useState<YearRow[]>(
    PREV_YEARS.map((y) => ({
      fy: y.fy,
      fyLabel: y.label,
      taxableIncome: 0,
      grossArrear: 0,
      domMedArrear: 0,
      regime: "new" as Regime,
    }))
  );

  const [currentIncome, setCurrentIncome] = useState<number>(0);
  const [currentRegime, setCurrentRegime] = useState<Regime>("new");
  const [view, setView] = useState<"input" | "results">("input");

  // ── Calculations ──────────────────────────────────────────

  const calc = useMemo(() => {
    const tableA = rows.map((row) => {
      const col2 = row.taxableIncome;
      const col3 = row.grossArrear + row.domMedArrear;
      const col4 = col2 + col3;
      const col5 = calculateTax({ financialYear: row.fy, regime: row.regime, category: "others", taxableIncome: col2 }).totalTax;
      const col6 = calculateTax({ financialYear: row.fy, regime: row.regime, category: "others", taxableIncome: col4 }).totalTax;
      const col7 = Math.max(0, col6 - col5);
      return { ...row, col2, col3, col4, col5, col6, col7 };
    });

    const t2  = tableA.reduce((s, r) => s + r.col2, 0);
    const t3  = tableA.reduce((s, r) => s + r.col3, 0);
    const t4  = tableA.reduce((s, r) => s + r.col4, 0);
    const t5  = tableA.reduce((s, r) => s + r.col5, 0);
    const t6  = tableA.reduce((s, r) => s + r.col6, 0);
    const t7  = tableA.reduce((s, r) => s + r.col7, 0);
    const tGA = rows.reduce((s, r) => s + r.grossArrear, 0);
    const tDM = rows.reduce((s, r) => s + r.domMedArrear, 0);

    // Annexure I
    const item2 = t3; // total arrear
    const item1 = currentIncome - item2;
    const item3 = currentIncome;
    const item4 = calculateTax({ financialYear: CURRENT_FY, regime: currentRegime, category: "others", taxableIncome: Math.max(0, item3) }).totalTax;
    const item5 = calculateTax({ financialYear: CURRENT_FY, regime: currentRegime, category: "others", taxableIncome: Math.max(0, item1) }).totalTax;
    const item6 = Math.max(0, item4 - item5);
    const item7 = t7;
    const item8 = Math.max(0, item6 - item7);

    return {
      tableA,
      totals: { col2: t2, col3: t3, col4: t4, col5: t5, col6: t6, col7: t7, grossArrear: tGA, domMedArrear: tDM },
      ann: { item1, item2, item3, item4, item5, item6, item7, item8 },
      currentExclArrear: item1,
    };
  }, [rows, currentIncome, currentRegime]);

  // ── Handlers ──────────────────────────────────────────────

  const setEmpField = useCallback((f: keyof Employee, v: string) => {
    setEmp((p) => ({ ...p, [f]: v }));
  }, []);

  const setRowField = useCallback((idx: number, f: keyof YearRow, v: number | Regime) => {
    setRows((p) => p.map((r, i) => (i === idx ? { ...r, [f]: v } : r)));
  }, []);

  const handlePrint = () => window.print();

  const regimeLabel = (r: Regime) => (r === "new" ? "New" : "Old");

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div className="app89">

      {/* ════════════════════════════════════════════════════
          SCREEN VIEW — Input Form + Results
      ════════════════════════════════════════════════════ */}
      <div className="screen-view">

        {/* Header */}
        <header className="form-header">
          <div className="form-header__icon">🧾</div>
          <div>
            <h1 className="form-header__title">New India Assurance Tax Relief Calculator 2026</h1>
            <p className="form-header__sub">Section 89(1) · Form 10E · Arrear Salary Relief · FY 2025–26</p>
          </div>
          {view === "results" && (
            <button className="print-btn" onClick={handlePrint}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Print Official Document
            </button>
          )}
        </header>

        {/* Tab bar */}
        <div className="form-tabs">
          <button className={`form-tab${view === "input" ? " form-tab--active" : ""}`} onClick={() => setView("input")}>
            ① Input Details
          </button>
          <button className={`form-tab${view === "results" ? " form-tab--active" : ""}`} onClick={() => setView("results")}>
            ② Computed Relief
          </button>
        </div>

        {/* ── INPUT VIEW ── */}
        {view === "input" && (
          <div className="input-view">

            {/* Employee Details */}
            <div className="section-card">
              <div className="section-card__header">
                <span className="section-badge">A</span>
                <h2>Employee Details</h2>
              </div>
              <div className="form-grid form-grid--3">
                <Field label="Full Name" value={emp.name} onChange={(v) => setEmpField("name", v)} />
                <Field label="SR / Employee No." value={emp.srNo} onChange={(v) => setEmpField("srNo", v)} />
                <Field label="Designation" value={emp.designation} onChange={(v) => setEmpField("designation", v)} />
                <Field label="Office / Department Code" value={emp.office} onChange={(v) => setEmpField("office", v)} />
                <Field label="PAN" value={emp.pan} onChange={(v) => setEmpField("pan", v.toUpperCase())} placeholder="XXXXXXXXXX" />
                <div className="field">
                  <label className="field-label">Residential Status</label>
                  <select className="field-input field-select" value={emp.residentialStatus} onChange={(e) => setEmpField("residentialStatus", e.target.value)}>
                    <option value="RESIDENT">Resident</option>
                    <option value="NON-RESIDENT">Non-Resident</option>
                  </select>
                </div>
                <Field label="Place" value={emp.place} onChange={(v) => setEmpField("place", v)} />
                <Field label="Date" value={emp.date} onChange={(v) => setEmpField("date", v)} />
              </div>
            </div>

            {/* Year-wise Arrear Details */}
            <div className="section-card">
              <div className="section-card__header">
                <span className="section-badge">B</span>
                <h2>Year-wise Taxable Income &amp; Arrear Details</h2>
              </div>
              <p className="section-note">
                Enter the taxable income as per ITR for each year <strong>excluding</strong> the arrear now being received.
                Also enter the arrear amount relating to each year.
              </p>

              {/* Desktop table */}
              <div className="arrear-table-wrap">
                <table className="arrear-table">
                  <thead>
                    <tr>
                      <th>Financial Year</th>
                      <th>Taxable Income<br /><span>As per ITR (excl. arrear)</span></th>
                      <th>Gross Salary Arrear<br /><span>Relating to this year</span></th>
                      <th>Dom. Med. Expenses Arrear<br /><span>Relating to this year</span></th>
                      <th>Total Arrear<br /><span>Col 3 + Col 4</span></th>
                      <th>Tax Regime<br /><span>Opted for this year</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={row.fy}>
                        <td className="arrear-table__fy">{row.fyLabel}</td>
                        <td>
                          <div className="td-num-wrap">
                            <span>₹</span>
                            <input type="number" min={0} className="td-input"
                              value={row.taxableIncome || ""}
                              onChange={(e) => setRowField(i, "taxableIncome", parseFloat(e.target.value) || 0)}
                              placeholder="0" />
                          </div>
                        </td>
                        <td>
                          <div className="td-num-wrap">
                            <span>₹</span>
                            <input type="number" min={0} className="td-input"
                              value={row.grossArrear || ""}
                              onChange={(e) => setRowField(i, "grossArrear", parseFloat(e.target.value) || 0)}
                              placeholder="0" />
                          </div>
                        </td>
                        <td>
                          <div className="td-num-wrap">
                            <span>₹</span>
                            <input type="number" min={0} className="td-input"
                              value={row.domMedArrear || ""}
                              onChange={(e) => setRowField(i, "domMedArrear", parseFloat(e.target.value) || 0)}
                              placeholder="0" />
                          </div>
                        </td>
                        <td className="arrear-table__computed">{INR(row.grossArrear + row.domMedArrear)}</td>
                        <td>
                          <RegimeToggle value={row.regime} onChange={(v) => setRowField(i, "regime", v)} />
                        </td>
                      </tr>
                    ))}
                    <tr className="arrear-table__total">
                      <td>TOTAL</td>
                      <td>{INR(calc.totals.col2)}</td>
                      <td>{INR(calc.totals.grossArrear)}</td>
                      <td>{INR(calc.totals.domMedArrear)}</td>
                      <td>{INR(calc.totals.col3)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Current Year */}
            <div className="section-card">
              <div className="section-card__header">
                <span className="section-badge">C</span>
                <h2>Current Year — FY 2025-26 (Assessment Year 2026-27)</h2>
              </div>
              <p className="section-note">
                Enter your <strong>total taxable income for FY 2025-26</strong> including the arrear amount already received.
                This is the income as per your IT computation statement.
              </p>
              <div className="form-grid form-grid--2">
                <NumberField
                  label="Total Taxable Income for FY 2025-26 (including arrear)"
                  value={currentIncome}
                  onChange={setCurrentIncome}
                  hint="As per IT Computation Statement + Increment + Dom. Med. Reimbursement + Leave Encashment + LTS (New Regime), if any"
                />
                <div className="field">
                  <label className="field-label">Tax Regime Opted for FY 2025-26</label>
                  <RegimeToggle value={currentRegime} onChange={setCurrentRegime} />
                </div>
              </div>

              {/* Summary strip */}
              {calc.totals.col3 > 0 && (
                <div className="summary-strip">
                  <div className="summary-strip__item">
                    <span>Gross Arrear (upto 31/03/2025)</span>
                    <strong>{INR(calc.totals.col3)}</strong>
                  </div>
                  <div className="summary-strip__sep">−</div>
                  <div className="summary-strip__item">
                    <span>Total Taxable Income FY 2025-26</span>
                    <strong>{INR(currentIncome)}</strong>
                  </div>
                  <div className="summary-strip__sep">=</div>
                  <div className="summary-strip__item">
                    <span>Income excl. Arrear</span>
                    <strong className={calc.currentExclArrear < 0 ? "text-amber" : ""}>{INR(calc.currentExclArrear)}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Calculate button */}
            <div className="calc-btn-row">
              <button className="calc-btn" onClick={() => setView("results")}>
                Calculate Relief &amp; Generate Form 10E →
              </button>
            </div>
          </div>
        )}

        {/* ── RESULTS VIEW ── */}
        {view === "results" && (
          <div className="results-view results-enter">

            {/* Relief Hero */}
            <div className={`relief-hero${calc.ann.item8 === 0 ? " relief-hero--zero" : ""}`}>
              <div className="relief-hero__left">
                <div className="relief-hero__label">Section 89(1) Relief Available</div>
                <div className="relief-hero__amount">{INR(calc.ann.item8)}</div>
                <div className="relief-hero__sub">
                  {calc.ann.item8 > 0
                    ? `You can claim this relief in your ITR for FY 2025-26`
                    : "No relief available — the arrear tax in current year does not exceed historical incremental tax"}
                </div>
              </div>
              <div className="relief-hero__right">
                <div className="relief-stat">
                  <span>Tax on Arrear (Current Year)</span>
                  <strong>{INR(calc.ann.item6)}</strong>
                </div>
                <div className="relief-stat">
                  <span>Incremental Tax (Past Years)</span>
                  <strong>{INR(calc.ann.item7)}</strong>
                </div>
                <div className="relief-stat relief-stat--highlight">
                  <span>Net Relief u/s 89(1)</span>
                  <strong>{INR(calc.ann.item8)}</strong>
                </div>
              </div>
            </div>

            {/* ── TABLE A ── */}
            <div className="result-section">
              <div className="result-section__header">
                <h2>TABLE "A"</h2>
                <span>Tax on income in respective previous years</span>
              </div>
              <div className="result-table-wrap">
                <table className="result-table">
                  <thead>
                    <tr>
                      <th className="col-fy">Previous Year<br /><em>(1)</em></th>
                      <th>Total Income<br />(excl. arrear)<br /><em>(2)</em></th>
                      <th>Arrear Relating<br />to this Year<br /><em>(3)</em></th>
                      <th>Total Income<br />(incl. arrear)<br />(2)+(3) = <em>(4)</em></th>
                      <th>Tax on<br />Col (2)<br /><em>(5)</em></th>
                      <th>Tax on<br />Col (4)<br /><em>(6)</em></th>
                      <th className="col-diff">Difference<br />(6)−(5)<br /><em>(7)</em></th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.tableA.map((row) => (
                      <tr key={row.fy}>
                        <td className="col-fy">
                          <span className="fy-badge">{row.fyLabel}</span>
                          <span className="regime-chip">{regimeLabel(row.regime)}</span>
                        </td>
                        <td>{INR(row.col2)}</td>
                        <td>{INR(row.col3)}</td>
                        <td>{INR(row.col4)}</td>
                        <td>{INR(row.col5)}</td>
                        <td>{INR(row.col6)}</td>
                        <td className={`col-diff${row.col7 > 0 ? " positive" : ""}`}>{INR(row.col7)}</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td><strong>TOTAL</strong></td>
                      <td>{INR(calc.totals.col2)}</td>
                      <td>{INR(calc.totals.col3)}</td>
                      <td>{INR(calc.totals.col4)}</td>
                      <td>{INR(calc.totals.col5)}</td>
                      <td>{INR(calc.totals.col6)}</td>
                      <td className="col-diff"><strong>{INR(calc.totals.col7)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="table-note">Note: Details of salary received in arrears relating to different previous years. Tax computed using respective year's slabs and opted regime.</p>
            </div>

            {/* ── ANNEXURE I ── */}
            <div className="result-section">
              <div className="result-section__header">
                <h2>ANNEXURE I</h2>
                <span>[See item 2 of Form No. 10E] — Arrears or Advance Salary</span>
              </div>
              <div className="result-table-wrap">
                <table className="result-table annexure-table">
                  <thead>
                    <tr>
                      <th style={{ width: "60px" }}>Sl. No.</th>
                      <th>Particulars</th>
                      <th style={{ width: "160px" }}>Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { n: 1, label: "Total income (excluding salary received in arrears or advance)", val: calc.ann.item1 },
                      { n: 2, label: "Salary received in arrears or advance", val: calc.ann.item2 },
                      { n: 3, label: "Total income (as increased by salary received in arrears or advance) [Add item 1 and item 2]", val: calc.ann.item3 },
                      { n: 4, label: `Tax on total income as per item 3 [FY 2025-26 · ${regimeLabel(currentRegime)} Regime]`, val: calc.ann.item4 },
                      { n: 5, label: `Tax on total income as per item 1 [FY 2025-26 · ${regimeLabel(currentRegime)} Regime]`, val: calc.ann.item5 },
                      { n: 6, label: "Tax on salary received in arrears or advance [Difference of item 4 and item 5]", val: calc.ann.item6 },
                      { n: 7, label: 'Tax computed in accordance with Table "A" [Brought from column (7) of Table "A"]', val: calc.ann.item7 },
                      { n: 8, label: "Relief under section 89(1) [Difference between items 6 and 7 — if item 6 > item 7]", val: calc.ann.item8 },
                    ].map(({ n, label, val }) => (
                      <tr key={n} className={n === 8 ? "relief-row" : n % 2 === 0 ? "even-row" : ""}>
                        <td className="item-num">{n}</td>
                        <td>{label}</td>
                        <td className={`item-val${n === 8 ? " item-val--relief" : ""}`}>{INR(val)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── FORM 10E ── */}
            <div className="result-section">
              <div className="result-section__header">
                <h2>FORM NO. 10E</h2>
                <span>[See rule 21AA]</span>
              </div>
              <div className="form10e">
                <p className="form10e__intro">
                  Form for furnishing particulars of income under section 192(2A) for the year ending
                  31st March, 2026 for claiming relief under section 89(1) by a Government servant or an
                  employee in a company, co-operative society, local authority, university, institution,
                  association or body.
                </p>
                <table className="result-table form10e-table">
                  <tbody>
                    <tr>
                      <td className="item-num">1</td>
                      <td>Name and address of the employee</td>
                      <td className="item-val">{emp.name || "—"}</td>
                    </tr>
                    <tr className="even-row">
                      <td className="item-num">2</td>
                      <td>Permanent Account Number</td>
                      <td className="item-val">{emp.pan || "—"}</td>
                    </tr>
                    <tr>
                      <td className="item-num">3</td>
                      <td>Residential status</td>
                      <td className="item-val">{emp.residentialStatus}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="form10e__sub-heading">
                  Particulars of income referred to in rule 21A of the Income tax Rules, 1962,
                  during the previous year relevant to assessment year 2026-27:
                </p>
                <table className="result-table form10e-table">
                  <tbody>
                    <tr>
                      <td className="item-num">1(a)</td>
                      <td>
                        Salary received in arrears or in advance in accordance with the provisions of
                        sub-rule (2) of rule 21A
                      </td>
                      <td className="item-val">{INR(calc.ann.item2)}</td>
                    </tr>
                    <tr className="even-row">
                      <td className="item-num">(b)</td>
                      <td>Payment in the nature of gratuity in respect of past services, extending over a period of not less than 5 years</td>
                      <td className="item-val">—</td>
                    </tr>
                    <tr>
                      <td className="item-num">(c)</td>
                      <td>Payment in the nature of compensation from the employer at or in connection with termination of employment</td>
                      <td className="item-val">—</td>
                    </tr>
                    <tr className="even-row">
                      <td className="item-num">(d)</td>
                      <td>Payment in commutation of pension in accordance with sub-rule (5) of rule 21A</td>
                      <td className="item-val">—</td>
                    </tr>
                  </tbody>
                </table>
                <p className="form10e__item2">
                  2. Detailed particulars of payments referred to above may be given in Annexure I, II, IIA, III or IV, as the case may be.
                </p>

                <div className="form10e__verification">
                  <div className="form10e__verify-title">Verification</div>
                  <p>
                    I,&nbsp;<span className="verify-name">{emp.name || "_______________"}</span>&nbsp;do hereby
                    declare that what is stated above is true to the best of my knowledge and belief.
                  </p>
                  <p>Verified today, the <span className="verify-date">{emp.date}</span></p>
                  <div className="form10e__sign-row">
                    <div>
                      <div className="sign-label">Place:</div>
                      <div className="sign-val">{emp.place || "_______________"}</div>
                    </div>
                    <div className="sign-box">
                      <div>Signature of the Employee</div>
                      <div className="sign-line"></div>
                      <div className="sign-name">{emp.name || "_______________"}</div>
                      <div className="sign-desig">{emp.designation}</div>
                      <div className="sign-sr">SR No.: {emp.srNo}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════
          PRINT VIEW — Official Document (hidden on screen)
      ════════════════════════════════════════════════════ */}
      <div className="print-view">
        <div className="pv-title">Calculation of Relief U/s 89(1)</div>

        {/* Top: Employee details */}
        <table className="pv-emp-table">
          <tbody>
            <tr>
              <td className="pv-label">Name</td>
              <td className="pv-val">{emp.name}</td>
              <td className="pv-label">S R No.</td>
              <td className="pv-val">{emp.srNo}</td>
            </tr>
            <tr>
              <td className="pv-label">Office</td>
              <td className="pv-val">{emp.office}</td>
              <td className="pv-label">PAN</td>
              <td className="pv-val">{emp.pan}</td>
            </tr>
            <tr>
              <td className="pv-label">Designation</td>
              <td className="pv-val" colSpan={3}>{emp.designation}</td>
            </tr>
          </tbody>
        </table>

        {/* Input summary + regime opted side by side */}
        <div className="pv-top-grid">
          {/* Left: income & arrear table */}
          <table className="pv-table">
            <thead>
              <tr>
                <th>Financial Year</th>
                <th>Taxable Income as per IT Return (₹)</th>
                <th>Gross Arrear Received (₹)</th>
                <th>Dom. Med. Exps. Arrear (₹)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.fy}>
                  <td>{row.fyLabel}</td>
                  <td>{INR_PLAIN(row.taxableIncome)}</td>
                  <td>{INR_PLAIN(row.grossArrear)}</td>
                  <td>{INR_PLAIN(row.domMedArrear)}</td>
                </tr>
              ))}
              <tr className="pv-total">
                <td>TOTAL</td>
                <td>{INR_PLAIN(calc.totals.col2)}</td>
                <td>{INR_PLAIN(calc.totals.grossArrear)}</td>
                <td>{INR_PLAIN(calc.totals.domMedArrear)}</td>
              </tr>
            </tbody>
          </table>

          {/* Right: regime opted */}
          <table className="pv-table pv-regime-table">
            <thead>
              <tr>
                <th colSpan={5}>New Tax Regime Opted</th>
              </tr>
              <tr>
                <th>Financial Year</th>
                {rows.map((r) => <th key={r.fy}>{r.fyLabel}</th>)}
                <th>2025-2026</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Opted (New Regime)</td>
                {rows.map((r) => <td key={r.fy}>{r.regime === "new" ? "Y" : "N"}</td>)}
                <td>{currentRegime === "new" ? "Y" : "N"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Summary rows */}
        <table className="pv-summary-table">
          <tbody>
            <tr>
              <td>Taxable Income upto March 2026</td>
              <td>{INR_PLAIN(currentIncome)}</td>
              <td className="pv-note">Taxable Income as per IT Computation Statement + increments + Dom. Med. Reimbursement + Leave Encashment, if any (for New Regime optees, also LTS)</td>
            </tr>
            <tr>
              <td>Gross Arrear upto 31/03/2025</td>
              <td>{INR_PLAIN(calc.totals.col3)}</td>
              <td className="pv-note">As per Arrear Sheet</td>
            </tr>
            <tr>
              <td>Total Taxable Income 2025-2026</td>
              <td>{INR_PLAIN(calc.currentExclArrear)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        {/* TABLE A */}
        <div className="pv-section-title">TABLE "A"</div>
        <table className="pv-table pv-tablea">
          <thead>
            <tr>
              <th>Previous year(s)<br />(1)</th>
              <th>Total Income of the relevant previous year (₹)<br />(2)</th>
              <th>Salary received in arrears relating to the relevant previous year (₹)<br />(3)</th>
              <th>Total income (as increased by arrears) [Add col (2) and (3)] (₹)<br />(4)</th>
              <th>Tax on total income [as per col (2)] (₹)<br />(5)</th>
              <th>Tax on total income [as per col (4)] (₹)<br />(6)</th>
              <th>Difference in tax [(6) minus (5)] (₹)<br />(7)</th>
            </tr>
          </thead>
          <tbody>
            {calc.tableA.map((row) => (
              <tr key={row.fy}>
                <td>{row.fyLabel}<br /><small>({regimeLabel(row.regime)} Regime)</small></td>
                <td>{INR_PLAIN(row.col2)}</td>
                <td>{INR_PLAIN(row.col3)}</td>
                <td>{INR_PLAIN(row.col4)}</td>
                <td>{INR_PLAIN(row.col5)}</td>
                <td>{INR_PLAIN(row.col6)}</td>
                <td>{INR_PLAIN(row.col7)}</td>
              </tr>
            ))}
            <tr className="pv-total">
              <td>TOTAL</td>
              <td>{INR_PLAIN(calc.totals.col2)}</td>
              <td>{INR_PLAIN(calc.totals.col3)}</td>
              <td>{INR_PLAIN(calc.totals.col4)}</td>
              <td>{INR_PLAIN(calc.totals.col5)}</td>
              <td>{INR_PLAIN(calc.totals.col6)}</td>
              <td>{INR_PLAIN(calc.totals.col7)}</td>
            </tr>
          </tbody>
        </table>
        <p className="pv-note-text">Note: In this Table, details of salary received in arrears or advance relating to different previous years may be furnished.</p>

        {/* Signature block — Table A */}
        <div className="pv-sign-block">
          <div className="pv-sign-left">
            <div>Place: {emp.place}</div>
            <div>Date: {emp.date}</div>
          </div>
          <div className="pv-sign-right">
            <div>Signature</div>
            <div>Name: {emp.name}</div>
            <div>Designation: {emp.designation}</div>
            <div>S R No.: {emp.srNo}</div>
            <div>Office: {emp.office}</div>
          </div>
        </div>

        {/* ANNEXURE I */}
        <div className="pv-section-title pv-page-break">
          ANNEXURE I<br />
          <small>[See item 2 of Form No. 10E]<br />ARREARS OR ADVANCE SALARY</small>
        </div>
        <table className="pv-table pv-annexure">
          <thead>
            <tr>
              <th style={{ width: "40px" }}>Sl No.</th>
              <th>Particulars</th>
              <th style={{ width: "120px" }}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {[
              { n: 1, t: "Total income (excluding salary received in arrears or Advance)", v: calc.ann.item1 },
              { n: 2, t: "Salary received in arrears or advance", v: calc.ann.item2 },
              { n: 3, t: "Total income (as increased by salary received in arrears or advance) [Add item 1 and item 2]", v: calc.ann.item3 },
              { n: 4, t: "Tax on total income (as per item 3)", v: calc.ann.item4 },
              { n: 5, t: "Tax on total income (as per item 1)", v: calc.ann.item5 },
              { n: 6, t: "Tax on salary received in arrears or advance [Difference of item 4 and item 5]", v: calc.ann.item6 },
              { n: 7, t: 'Tax computed in accordance with Table "A" [Brought from column 7 of Table "A"]', v: calc.ann.item7 },
              { n: 8, t: "Relief under section 89(1) [Indicate the difference between the amounts mentioned against items 6 and 7]", v: calc.ann.item8 },
            ].map(({ n, t, v }) => (
              <tr key={n} className={n === 8 ? "pv-relief-row" : ""}>
                <td style={{ textAlign: "center" }}>{n}</td>
                <td>{t}</td>
                <td style={{ textAlign: "right" }}>{INR_PLAIN(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Signature block — Annexure I */}
        <div className="pv-sign-block">
          <div className="pv-sign-left">
            <div>Place: {emp.place}</div>
            <div>Date: {emp.date}</div>
          </div>
          <div className="pv-sign-right">
            <div>Signature</div>
            <div>Name: {emp.name}</div>
            <div>Designation: {emp.designation}</div>
            <div>S R No.: {emp.srNo}</div>
            <div>Office: {emp.office}</div>
          </div>
        </div>

        {/* FORM 10E */}
        <div className="pv-section-title">
          FORM NO. 10E<br />
          <small>[See rule 21AA]</small>
        </div>
        <p className="pv-form10e-intro">
          Form for furnishing particulars of income under section 192(2A) for the year ending 31st March, 2026
          for claiming relief under section 89(1) by a Government servant or an employee in a company,
          co-operative society, local authority, university, institution, association or body.
        </p>
        <table className="pv-table pv-form10e">
          <tbody>
            <tr>
              <td style={{ width: "30px" }}>1</td>
              <td>Name and address of the employee</td>
              <td>{emp.name}</td>
            </tr>
            <tr>
              <td>2</td>
              <td>Permanent account number</td>
              <td>{emp.pan}</td>
            </tr>
            <tr>
              <td>3</td>
              <td>Residential status</td>
              <td>{emp.residentialStatus}</td>
            </tr>
          </tbody>
        </table>
        <p className="pv-note-text" style={{ margin: "8px 0" }}>
          Particulars of income referred to in rule 21A of the Income tax Rules, 1962, during the previous year relevant to assessment year 2026-27:
        </p>
        <table className="pv-table pv-form10e">
          <tbody>
            <tr>
              <td style={{ width: "40px" }}>1 (a)</td>
              <td>Salary received in arrears or in advance in accordance with the provisions of sub-rule (2) of rule 21A</td>
              <td style={{ width: "120px", textAlign: "right" }}>{INR_PLAIN(calc.ann.item2)}</td>
            </tr>
            <tr>
              <td>(b)</td>
              <td>Payment in the nature of gratuity in respect of past services, extending over a period of not less than 5 years in accordance with the provisions of sub-rule (3) of rule 21A</td>
              <td style={{ textAlign: "right" }}>0</td>
            </tr>
            <tr>
              <td>( c)</td>
              <td>Payment in the nature of compensation from the employer or former employer at or in connection with termination of employment after continuous service of not less than 3 years or where the unexpired portion of term of employment is also not less than 3 years</td>
              <td style={{ textAlign: "right" }}>0</td>
            </tr>
            <tr>
              <td>(d)</td>
              <td>Payment in commutation of pension in accordance with the provisions of sub-rule (5) of rule 21A</td>
              <td style={{ textAlign: "right" }}>0</td>
            </tr>
          </tbody>
        </table>
        <p className="pv-note-text" style={{ margin: "8px 0" }}>
          2. Detailed particulars of payments referred to above may be given in Annexure I, II, IIA, III or IV, as the case may be.
        </p>

        <div className="pv-verification">
          <div className="pv-verify-title">Verification</div>
          <p>
            I, {emp.name || "____________________________________"} do hereby declare that what is stated above is true to the best of my knowledge and belief.
          </p>
          <p>Verified today, the {emp.date}.</p>
        </div>

        <div className="pv-sign-block">
          <div className="pv-sign-left">
            <div>Place: {emp.place}</div>
            <div>Date: {emp.date}</div>
          </div>
          <div className="pv-sign-right">
            <div>Signature of the Employee</div>
            <div style={{ marginTop: "32px", borderTop: "1px solid #000", paddingTop: "4px" }}>{emp.name}</div>
            <div>Designation: {emp.designation}</div>
            <div>SR No.: {emp.srNo}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
