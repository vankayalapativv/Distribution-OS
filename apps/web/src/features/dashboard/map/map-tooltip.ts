import { rupees, BUCKET_META, type DuesBucketKey, type MapCustomer } from "./map-helpers";
import { BUCKET_ORDER } from "./map-constants";

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

// Custom look for the district hover tooltip — replaces Leaflet's default cramped
// white box with a rounded, bordered card + drop-shadow (arrow recoloured to
// match). Injected once into <head> (Leaflet builds the tooltip DOM outside React,
// so the CSS must be global).
export function ensureTooltipStyles() {
  if (typeof document === "undefined" || document.getElementById("district-tip-styles")) return;
  const el = document.createElement("style");
  el.id = "district-tip-styles";
  el.textContent = `
    .district-tip.leaflet-tooltip {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
      padding: 10px 12px;
      color: #0f172a;
      font: inherit;
      white-space: normal;
    }
    .district-tip.leaflet-tooltip-top::before { border-top-color: #ffffff; }
    .district-tip.leaflet-tooltip-bottom::before { border-bottom-color: #ffffff; }
    .district-tip.leaflet-tooltip-left::before { border-left-color: #ffffff; }
    .district-tip.leaflet-tooltip-right::before { border-right-color: #ffffff; }
  `;
  document.head.appendChild(el);
}

/** Sticky hover tooltip for a district: header (name · N customers), total dues,
 *  a collection-ageing TABLE (all 4 buckets: customers + ₹ owed), and the top
 *  executive(s). */
export function districtHoverTooltip(name: string, list: MapCustomer[]): string {
  const total = list.reduce((s, c) => s + (c.outstanding || 0), 0);

  const bucketCounts = new Map<DuesBucketKey, number>();
  const bucketOwed = new Map<DuesBucketKey, number>();
  for (const c of list) {
    if (!c.bucket) continue;
    bucketCounts.set(c.bucket, (bucketCounts.get(c.bucket) ?? 0) + 1);
    bucketOwed.set(c.bucket, (bucketOwed.get(c.bucket) ?? 0) + (c.outstanding || 0));
  }

  const byExec = new Map<string, number>();
  for (const c of list) {
    const n = c.executiveName ?? "Unassigned";
    byExec.set(n, (byExec.get(n) ?? 0) + 1);
  }
  const topExecs = [...byExec.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);

  // Collection-ageing table — all 4 buckets always (even 0): bucket · customers ·
  // total ₹ owed in that bucket.
  const labelCell = "padding:3px 10px 3px 0;white-space:nowrap";
  const countCell = "padding:3px 10px 3px 0;text-align:right;font-weight:600;font-variant-numeric:tabular-nums";
  const owedCell = "padding:3px 0;text-align:right;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap";
  const ageingRows = BUCKET_ORDER.map((b) => {
    const ct = bucketCounts.get(b) ?? 0;
    const owed = bucketOwed.get(b) ?? 0;
    return `<tr>
      <td style="${labelCell}"><span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${BUCKET_META[b].color};margin-right:6px;vertical-align:middle"></span>${escapeHtml(BUCKET_META[b].label)}</td>
      <td style="${countCell}">${ct}</td>
      <td style="${owedCell}">${escapeHtml(rupees(owed))}</td>
    </tr>`;
  }).join("");
  const ageingTable = `<table style="margin-top:6px;border-collapse:collapse;width:100%;font-size:12px">
      <thead><tr>
        <th style="text-align:left;font-weight:600;color:#64748b;padding:0 10px 3px 0">Ageing</th>
        <th style="text-align:right;font-weight:600;color:#64748b;padding:0 10px 3px 0">Customers</th>
        <th style="text-align:right;font-weight:600;color:#64748b;padding:0 0 3px">Owed</th>
      </tr></thead>
      <tbody>${ageingRows}</tbody>
    </table>`;

  return `<div style="min-width:240px;font-size:12px;line-height:1.45;color:#0f172a">
    <div style="font-weight:700;font-size:13px">${escapeHtml(name)}</div>
    <div style="color:#475569;margin-top:1px">${list.length} customer${list.length === 1 ? "" : "s"}</div>
    <div style="margin-top:5px">Total dues: <b>${escapeHtml(rupees(total))}</b></div>
    ${ageingTable}
    <div style="margin-top:6px;color:#475569">Top exec${topExecs.length === 1 ? "" : "s"}: ${topExecs
      .map(([n, ct]) => `${escapeHtml(n)} <b>(${ct})</b>`)
      .join(", ")}</div>
  </div>`;
}
