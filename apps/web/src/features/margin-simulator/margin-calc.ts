/**
 * Margin Simulator — pure calculation, a faithful port of the client's
 * `margin_simulator.xlsx` (super-admin tool, oils only). Chain per product+pack:
 *
 *   Total Expense    = Expense/L × Pack
 *   Total Cost       = DLP + Total Expense
 *   Scheme Total     = Scheme/L × Pack
 *   Net Realization  = MOP − Scheme Total
 *   Margin / Pack    = Net Realization − Total Cost
 *   Margin / Liter   = Margin / Pack ÷ Pack
 *
 * MRP and Coupon are captured for reference but — exactly as in the sheet — do
 * NOT enter the margin math.
 */

export interface MarginInputs {
  /** Pack size in litres (sheet "Pack Size (Liters)"). */
  packSize: number;
  /** Distributor Landing Price, per pack. */
  dlp: number;
  /** Expense per litre. */
  expensePerLiter: number;
  /** Market Operating Price, per pack. */
  mop: number;
  /** Scheme per litre. */
  schemePerLiter: number;
}

export interface MarginResult {
  totalExpense: number;
  totalCost: number;
  schemeTotal: number;
  netRealization: number;
  marginPerPack: number;
  marginPerLiter: number;
}

export function computeMargin(i: MarginInputs): MarginResult {
  const totalExpense = i.expensePerLiter * i.packSize;
  const totalCost = i.dlp + totalExpense;
  const schemeTotal = i.schemePerLiter * i.packSize;
  const netRealization = i.mop - schemeTotal;
  const marginPerPack = netRealization - totalCost;
  const marginPerLiter = i.packSize ? marginPerPack / i.packSize : 0;
  return { totalExpense, totalCost, schemeTotal, netRealization, marginPerPack, marginPerLiter };
}
