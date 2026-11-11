export interface FulfillmentSummary {
  ordered: number;
  invoiced: number;
  partiallyInvoiced: number;
  partiallyDelivered: number;
  delivered: number;
  partiallyReturned: number;
  returned: number;
  partiallyCancelled: number;
  cancelled: number;
}

/** Per-stage tint: soft fill + a coloured left accent + matching label/number,
 *  keyed to the same palette as the fulfillment badge so both read alike. */
export const STAGE_TINTS: Record<string, { card: string; label: string; value: string }> = {
  ordered: { card: "border-slate-200 border-l-slate-400 bg-slate-50", label: "text-slate-600", value: "text-slate-700" },
  partially_invoiced: { card: "border-indigo-200 border-l-indigo-400 bg-indigo-50", label: "text-indigo-700", value: "text-indigo-700" },
  invoiced: { card: "border-blue-200 border-l-blue-500 bg-blue-50", label: "text-blue-700", value: "text-blue-700" },
  partially_delivered: { card: "border-amber-200 border-l-amber-500 bg-amber-50", label: "text-amber-800", value: "text-amber-800" },
  delivered: { card: "border-green-200 border-l-green-500 bg-green-50", label: "text-green-700", value: "text-green-700" },
  partially_returned: { card: "border-orange-200 border-l-orange-400 bg-orange-50", label: "text-orange-700", value: "text-orange-700" },
  returned: { card: "border-rose-200 border-l-rose-500 bg-rose-50", label: "text-rose-700", value: "text-rose-700" },
  partially_cancelled: { card: "border-purple-200 border-l-purple-400 bg-purple-50", label: "text-purple-700", value: "text-purple-700" },
  cancelled: { card: "border-gray-200 border-l-gray-400 bg-gray-100", label: "text-gray-500", value: "text-gray-600" },
};

export interface StageDef {
  token: string;
  label: string;
  key: keyof FulfillmentSummary;
  emphasized?: boolean;
}

/** Semantic groups (in funnel order): the pipeline up to delivery, the completed
 *  end-state, returns (a reversal), and cancellations — kept apart on purpose. */
export const GROUPS: { title: string; stages: StageDef[] }[] = [
  {
    title: "In progress",
    stages: [
      { token: "ordered", label: "Ordered", key: "ordered" },
      { token: "partially_invoiced", label: "Partial inv.", key: "partiallyInvoiced" },
      { token: "invoiced", label: "Invoiced", key: "invoiced" },
      { token: "partially_delivered", label: "Partial del.", key: "partiallyDelivered" },
    ],
  },
  {
    title: "Completed",
    stages: [{ token: "delivered", label: "Delivered", key: "delivered", emphasized: true }],
  },
  {
    title: "Returns",
    stages: [
      { token: "partially_returned", label: "Partial ret.", key: "partiallyReturned" },
      { token: "returned", label: "Returned", key: "returned" },
    ],
  },
  {
    title: "Cancelled",
    stages: [
      { token: "partially_cancelled", label: "Partial canc.", key: "partiallyCancelled" },
      { token: "cancelled", label: "Cancelled", key: "cancelled" },
    ],
  },
];
