/**
 * Shared invoice PDF renderer (api + web + mobile). Builds a generated invoice as
 * a GST tax invoice in the BAL layout from a self-contained payload — the single
 * source of truth for the document, so every surface renders the exact same PDF
 * on demand from the data (no stored copy).
 *
 * Pure + isomorphic: jsPDF + jspdf-autotable + qrcode are dynamically imported,
 * and the QR is drawn as vector modules (no canvas), so this runs in the browser
 * AND on Cloudflare Workers (V8 isolate) alike.
 */
const inr = (n) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyFmt = (n) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const d = (iso) => {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime()))
        return iso.slice(0, 10);
    const p = (x) => String(x).padStart(2, "0");
    return `${p(dt.getDate())}-${p(dt.getMonth() + 1)}-${dt.getFullYear()}`;
};
/** Shown when the company hasn't set its own Terms in Settings → Invoice. */
export const DEFAULT_TERMS = [
    "1. Goods once sold will not be taken back or exchanged.",
    "2. Interest @ 24% p.a. is charged on bills not paid by due date.",
    "3. Claims, if any, must be made within 24 hours of receipt.",
    "4. Our responsibility ceases once goods leave our godown.",
    "5. Payment by cheque / UPI is subject to realisation.",
    "6. Warranty, if any, is as per the manufacturer's terms only.",
    "7. Subject to Hyderabad jurisdiction. E. & O.E.",
].join("\n");
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function words(n) {
    if (n < 20)
        return ONES[n];
    if (n < 100)
        return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
    return ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + words(n % 100) : "");
}
/** Indian-system rupees in words: "Rupees Thirty Nine Thousand … Only". */
function amountInWords(amount) {
    const n = Math.round(amount);
    if (n === 0)
        return "Rupees Zero Only";
    let r = "";
    const cr = Math.floor(n / 1e7), a1 = n % 1e7;
    const lk = Math.floor(a1 / 1e5), a2 = a1 % 1e5;
    const th = Math.floor(a2 / 1e3), rest = a2 % 1e3;
    if (cr)
        r += words(cr) + " Crore ";
    if (lk)
        r += words(lk) + " Lakh ";
    if (th)
        r += words(th) + " Thousand ";
    if (rest)
        r += words(rest);
    return `Rupees ${r.trim()} Only`;
}
async function qrMatrix(text) {
    const mod = (await import("qrcode"));
    const create = mod.create ?? mod.default.create;
    return create(text, { errorCorrectionLevel: "M" });
}
// Font sizes measured from the BAL tax-invoice PDFs: body ~10.7, fine print
// ~9.4, headings ~13.4/14.7, company name largest. Everything scaled up to these.
const FS_NAME = 18; // company legal name (hero)
const FS_TITLE = 14; // "TAX INVOICE"
const FS_BODY = 10.7; // party details, invoice meta, bank, amount in words
const FS_TABLE = 10; // tax-summary grid
const FS_LINE = 8.5; // line-items grid (denser — 9 columns on A4)
const FS_SMALL = 9.4; // terms, labels, fine print
/** GSTIN line, "TAX INVOICE" title, and the centred company name (wrapped to two
 *  lines if long) + address + contact. Returns the y just below the block. */
function drawHeader(doc, co, inv, g) {
    const { W, M, L, R } = g;
    doc.setFont("helvetica", "normal").setFontSize(FS_BODY);
    doc.text(`GSTIN : ${co.gstin || "—"}`, L, M + 2);
    doc.text("Original Copy", R, M + 2, { align: "right" });
    doc.setFont("helvetica", "bold").setFontSize(FS_TITLE).text("TAX INVOICE", W / 2, M + 22, { align: "center" });
    // The "CANCELLED" state is shown by a prominent diagonal watermark across the
    // whole page (drawCancelledWatermark), not a header marker that would collide
    // with the company name.
    // Company name may be long enough to wrap. Shrink a step if needed to keep it
    // to two lines, stack the lines, and let the address follow below them (so a
    // long name never overlaps the address).
    let nameSize = FS_NAME;
    doc.setFont("helvetica", "bold").setFontSize(nameSize);
    let nameLines = doc.splitTextToSize(co.legalName || "Your Company", R - L);
    while (nameLines.length > 2 && nameSize > 12) {
        nameSize -= 1;
        doc.setFontSize(nameSize);
        nameLines = doc.splitTextToSize(co.legalName || "Your Company", R - L);
    }
    let hy = M + 44;
    nameLines.forEach((ln, i) => { if (i > 0)
        hy += nameSize + 2; doc.text(ln, W / 2, hy, { align: "center" }); });
    doc.setFont("helvetica", "normal").setFontSize(FS_BODY);
    const line1 = co.addressLine1;
    const line2 = [co.addressLine2, co.city, co.state, co.pincode].map((s) => (s || "").trim()).filter(Boolean).join(", ");
    if (line1) {
        hy += 15;
        doc.text(line1, W / 2, hy, { align: "center" });
    }
    if (line2) {
        hy += 13;
        doc.text(line2, W / 2, hy, { align: "center" });
    }
    const contact = [co.phone && `Tel. : ${co.phone}`, co.email && `email : ${co.email}`].filter(Boolean).join("        ");
    if (contact) {
        hy += 13;
        doc.text(contact, W / 2, hy, { align: "center" });
    }
    return hy;
}
/** Party details (left) + invoice meta (right) bordered box. Returns its bottom y. */
function drawPartyBox(doc, co, inv, by, g, hy) {
    const { L, R } = g;
    const boxTop = hy + 10;
    const midX = L + 300;
    doc.setFontSize(FS_BODY).setTextColor(0);
    // Left column
    let ly = boxTop + 16;
    doc.text("Party Details :", L + 6, ly);
    ly += 16;
    doc.setFont("helvetica", "bold").text((by.name || "").toUpperCase(), L + 6, ly, { maxWidth: midX - L - 14 });
    doc.setFont("helvetica", "normal");
    for (const ln of doc.splitTextToSize(by.address || "", midX - L - 14)) {
        ly += 13;
        doc.text(ln, L + 6, ly);
    }
    const leftKv = [
        ["Party PAN", by.pan], ["Party E-Mail ID", by.email], ["Party Mobile No", by.phone],
        ["Party Pincode", by.pincode], ["GSTIN / UIN", by.gstin],
    ];
    for (const [k, v] of leftKv) {
        ly += 15;
        doc.text(`${k}`, L + 6, ly);
        doc.text(":", L + 108, ly);
        if (v)
            doc.text(String(v), L + 116, ly, { maxWidth: midX - L - 124 });
    }
    // Right column
    const stateSuffix = inv.buyerStateCode ? ` (${inv.buyerStateCode})` : "";
    const place = inv.placeOfSupply ? `${inv.placeOfSupply}${stateSuffix}` : "";
    const rightKv = [
        ["Invoice No.", inv.invoiceNumber], ["Dated", d(inv.invoiceDate)], ["Place of Supply", place],
        ["Reverse Charge", inv.reverseCharge ? "Y" : "N"], ["Salesman Name", inv.salesman || ""], ["GR/RR No.", inv.grRrNo || ""],
        ["Transport", inv.transport || ""], ["Vehicle No.", inv.vehicleNo || ""], ["Station", inv.station || ""],
        ["E-Way Bill No.", inv.ewayBillNo || ""],
    ];
    let ry = boxTop + 16;
    const rk = midX + 8, rc = midX + 92, rv = midX + 98;
    for (const [k, v] of rightKv) {
        doc.text(k, rk, ry);
        doc.text(":", rc, ry);
        if (v)
            doc.text(String(v), rv, ry, { maxWidth: R - rv - 6 });
        ry += 15;
    }
    const boxBottom = Math.max(ly, ry) + 5;
    doc.setDrawColor(110).setLineWidth(0.6);
    doc.rect(L, boxTop, R - L, boxBottom - boxTop);
    doc.line(midX, boxTop, midX, boxBottom);
    return boxBottom;
}
/** The line-items grid's head + body (padded with blank ruled rows) + footer. Pure. */
function lineItemsData(data, intra) {
    const half = (gst) => `${(gst / 2).toFixed(2)} %`;
    const head = intra
        ? [["S.N.", "Description of Goods", "HSN/SAC", "Qty", "MRP", "Disc %", "Rate", "CGST", "SGST", "Amount"]]
        : [["S.N.", "Description of Goods", "HSN/SAC", "Qty", "MRP", "Disc %", "Rate", "IGST", "Amount"]];
    const body = data.items.map((it, i) => {
        const base = [
            String(i + 1),
            // The pack size is shown once (appended below); strip any trailing
            // "(5 L)" / "(5L)" the product name may carry so it isn't duplicated.
            `${it.description.replace(/\s*\(\s*[\d.]+\s*L\s*\)\s*$/i, "").trim()} ${it.packSizeLitres}L`.trim(),
            it.hsnCode,
            qtyFmt(it.qtyUnits),
            it.mrp != null ? inr(it.mrp) : "",
            `${(it.discountPct || 0).toFixed(2)} %`,
            inr(it.rate),
        ];
        const tax = intra ? [half(it.gstRate), half(it.gstRate)] : [`${it.gstRate.toFixed(2)} %`];
        return [...base, ...tax, inr(it.lineTotal)];
    });
    const amountSum = data.items.reduce((s, it) => s + it.lineTotal, 0);
    const qtySum = data.items.reduce((s, it) => s + it.qtyUnits, 0);
    // Pad the table with a few blank ruled rows so a short invoice still reads like
    // a ledger sheet — but keep the count low enough that, at the BAL text size, a
    // normal invoice + totals/footer stays on a single A4 page. A genuinely long
    // invoice gets no padding and flows to page 2 on its own.
    const MIN_ROWS = 9; // keep a short invoice on one page
    const MAX_PAD = 7; // never add more than this many blank rows
    const target = Math.min(MIN_ROWS, data.items.length + MAX_PAD);
    const colCount = head[0].length;
    while (body.length < target)
        body.push(Array.from({ length: colCount }, () => ""));
    const gstCols = intra ? 2 : 1;
    const R = (fontStyle) => ({ halign: "right", ...(fontStyle ? { fontStyle } : {}) });
    // The goods subtotal row: label + qty + the Amount column (middle columns blank).
    const totalRow = (label) => [
        { content: label, colSpan: 3, styles: R("bold") },
        { content: qtyFmt(qtySum), styles: R("bold") },
        // MRP + Disc% + Rate + the GST column(s) sit empty before the Amount total.
        ...Array.from({ length: 3 + gstCols }, () => ({ content: "" })),
        { content: inr(amountSum), styles: R("bold") },
    ];
    // A full-width total row (label spans all but the Amount column): used for the
    // transportation charge and the final grand total.
    const spanRow = (label, amount, bold) => [
        { content: label, colSpan: colCount - 1, styles: R(bold ? "bold" : undefined) },
        { content: inr(amount), styles: R(bold ? "bold" : undefined) },
    ];
    // Transport billed → three rows (Total, Transportation Charges, Grand Total);
    // otherwise a single Grand Total row as before.
    const foot = data.totals.transportCharge > 0
        ? [totalRow("Total"), spanRow("Transportation Charges", data.totals.transportCharge, false), spanRow("Grand Total", data.totals.grand, true)]
        : [totalRow("Grand Total")];
    return { head, body, foot };
}
/** Renders the line-items grid starting at `startY`. */
function drawLineTable(doc, autoTable, data, intra, g, startY) {
    const { L, M } = g;
    const { head, body, foot } = lineItemsData(data, intra);
    autoTable(doc, {
        startY,
        margin: { left: L, right: M, bottom: M },
        head, body, foot,
        showHead: "everyPage",
        theme: "grid",
        styles: { fontSize: FS_LINE, cellPadding: 3, lineColor: [110, 110, 110], lineWidth: 0.5, textColor: [0, 0, 0] },
        headStyles: { fillColor: [238, 238, 238], textColor: [0, 0, 0], fontStyle: "bold", fontSize: FS_LINE, halign: "center", lineColor: [110, 110, 110] },
        footStyles: { fillColor: [248, 248, 248], textColor: [0, 0, 0], fontSize: FS_LINE, lineColor: [110, 110, 110] },
        columnStyles: {
            0: { halign: "center", cellWidth: 22 },
            2: { halign: "center", cellWidth: 54 },
            3: { halign: "right", cellWidth: 40 },
            4: { halign: "right", cellWidth: 50 },
            5: { halign: "right", cellWidth: 42 },
            6: { halign: "right", cellWidth: 52 },
            7: { halign: "center", cellWidth: intra ? 42 : 48 },
            ...(intra ? { 8: { halign: "center", cellWidth: 42 }, 9: { halign: "right", cellWidth: 66 } } : { 8: { halign: "right", cellWidth: 74 } }),
        },
        // Every body row keeps the column separators (vertical rules) but drops the
        // horizontal rules, so item rows aren't divided by lines — only the header
        // separator, the column verticals, the outer frame and the totals row remain.
        didParseCell: (hd) => {
            if (hd.section === "body") {
                hd.cell.styles.lineWidth = { top: 0, right: 0.5, bottom: 0, left: 0.5 };
            }
        },
    });
}
/** Tax-rate summary grid (left) + Grand Total (right). Returns the y below it. */
function drawTaxSummary(doc, autoTable, intra, tot, g, y) {
    const { L } = g;
    const taxHead = intra
        ? [["Tax Rate", "Taxable Amt.", "CGST Amt.", "SGST Amt.", "Total Tax"]]
        : [["Tax Rate", "Taxable Amt.", "IGST Amt.", "Total Tax"]];
    const totalTax = intra ? tot.cgst + tot.sgst : tot.igst;
    const taxBody = intra
        ? [["18%", inr(tot.taxable), inr(tot.cgst), inr(tot.sgst), inr(totalTax)]]
        : [["18%", inr(tot.taxable), inr(tot.igst), inr(totalTax)]];
    autoTable(doc, {
        startY: y, margin: { left: L },
        tableWidth: 330, head: taxHead, body: taxBody, theme: "grid",
        styles: { fontSize: FS_TABLE, cellPadding: 3.5, lineColor: [110, 110, 110], lineWidth: 0.5, halign: "right", textColor: [0, 0, 0] },
        headStyles: { fillColor: [238, 238, 238], textColor: [0, 0, 0], fontStyle: "bold", fontSize: FS_TABLE, halign: "right" },
        columnStyles: { 0: { halign: "left" } },
    });
    // The transportation charge + grand total now live in the line-items table
    // foot (Total / Transportation Charges / Grand Total), so only the CGST/SGST
    // tax grid is drawn here.
    return doc.lastAutoTable.finalY + 16;
}
/** Bank / UPI details band (only when any are set). Returns the y below it. */
function drawBank(doc, co, g, y) {
    const { L, R } = g;
    const hasBank = co.bankAccountName || co.bankAccountNumber || co.bankIfsc;
    if (hasBank || co.upiId) {
        doc.setDrawColor(200).line(L, y - 4, R, y - 4);
        doc.setFont("helvetica", "bold").setFontSize(FS_BODY).text(`Bank Details : ${co.bankAccountName || co.legalName}`, L, y + 11);
        doc.setFont("helvetica", "normal").setFontSize(FS_BODY);
        const bankBits = [
            co.bankAccountNumber && `A/C NO: ${co.bankAccountNumber}`,
            co.bankIfsc && `IFSC CODE: ${co.bankIfsc}`,
            co.upiId && `UPI id: ${co.upiId}`,
        ].filter(Boolean).join("        ");
        if (bankBits)
            doc.text(bankBits, L, y + 26);
        y += 38;
    }
    return y;
}
/** Payment QR (centre of the footer row) — vector modules, no canvas (Workers-safe). */
async function drawPaymentQr(doc, co, inv, tot, cxQR, rowTop) {
    try {
        // An amount-encoded UPI intent — scanning pre-fills the payee, the exact
        // payable amount and a note (the invoice number), so the buyer just confirms.
        const amt = Math.max(0, Math.round(tot.grand));
        const uri = `upi://pay?pa=${encodeURIComponent(co.upiId)}&pn=${encodeURIComponent(co.legalName || "")}&am=${amt}&cu=INR&tn=${encodeURIComponent(inv.invoiceNumber)}`;
        const qr = await qrMatrix(uri);
        const n = qr.modules.size;
        const quiet = 1; // 1-module quiet zone, like margin:1
        const qs = 72; // QR box side (pt)
        const cell = qs / (n + quiet * 2);
        const x0 = cxQR - qs / 2 + quiet * cell;
        const y0 = rowTop + 18 + quiet * cell;
        doc.setFont("helvetica", "bold").setFontSize(FS_SMALL).setTextColor(40).text("Payment QR Code", cxQR, rowTop + 14, { align: "center" });
        doc.setFillColor(17, 17, 17);
        for (let r = 0; r < n; r++)
            for (let c = 0; c < n; c++) {
                if (qr.modules.data[r * n + c])
                    doc.rect(x0 + c * cell, y0 + r * cell, cell, cell, "F");
            }
        doc.setFillColor(0, 0, 0);
        doc.setFont("helvetica", "normal").setFontSize(FS_SMALL - 1).setTextColor(70);
        doc.text(`Scan & Pay  Rs. ${inr(tot.grand)}`, cxQR, rowTop + 18 + qs + 11, { align: "center" });
        doc.setTextColor(0);
    }
    catch { /* QR is best-effort */ }
}
/** Footer row (BAL layout): Terms & Conditions | Payment QR | Receiver's Signature. */
async function drawFooter(doc, co, inv, tot, g, y) {
    const { L, R } = g;
    const rowTop = y;
    const cA = L + 248; // end of the Terms column
    const cB = R - 148; // start of the Signature column
    const cxQR = (cA + cB) / 2; // centre of the QR column
    const termsLines = doc.splitTextToSize(co.termsAndConditions?.trim() || DEFAULT_TERMS, cA - L - 12);
    const rowH = Math.max(108, 24 + termsLines.length * 11);
    doc.setDrawColor(110).setLineWidth(0.6).rect(L, rowTop, R - L, rowH);
    doc.line(cA, rowTop, cA, rowTop + rowH);
    doc.line(cB, rowTop, cB, rowTop + rowH);
    // Terms (left)
    doc.setFont("helvetica", "bold").setFontSize(FS_BODY).setTextColor(0).text("Terms & Conditions", L + 6, rowTop + 15);
    doc.setFont("helvetica", "normal").setFontSize(FS_SMALL).setTextColor(60);
    let ty2 = rowTop + 15;
    for (const ln of termsLines) {
        ty2 += 11;
        doc.text(ln, L + 6, ty2);
    }
    doc.setTextColor(0);
    if (co.upiId)
        await drawPaymentQr(doc, co, inv, tot, cxQR, rowTop);
    // Receiver's Signature + authorised signatory (right)
    doc.setFont("helvetica", "bold").setFontSize(FS_BODY).text("Receiver's Signature", cB + 6, rowTop + 15);
    const sigY = rowTop + rowH - 10; // "Authorised Signatory" baseline
    doc.setFont("helvetica", "normal").setFontSize(FS_SMALL);
    const forLines = doc.splitTextToSize(`for ${co.legalName || "Your Company"}`, R - cB - 12);
    let fy = sigY - 34 - (forLines.length - 1) * 11; // name sits higher, leaving a signing gap above "Authorised Signatory"
    for (const ln of forLines) {
        doc.text(ln, R - 6, fy, { align: "right" });
        fy += 11;
    }
    doc.setFontSize(FS_BODY).text("Authorised Signatory", R - 6, sigY, { align: "right" });
}
/** Pure renderer — builds the BAL-layout jsPDF doc from a payload. Returns the
 *  jsPDF instance; callers do `.output("blob" | "arraybuffer")` or `.save()`. */
export async function buildInvoiceDoc(data) {
    const [{ jsPDF }, { autoTable }] = await Promise.all([
        import("jspdf"), import("jspdf-autotable"),
    ]);
    const co = data.company, inv = data.invoice, tot = data.totals;
    const intra = inv.supplyType !== "inter";
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const PH = doc.internal.pageSize.getHeight();
    // ~10 mm print margins on A4 (1 mm ≈ 2.8346 pt).
    const M = 28;
    const g = { W, PH, M, L: M, R: W - M };
    const hy = drawHeader(doc, co, inv, g);
    const boxBottom = drawPartyBox(doc, co, inv, data.buyer, g, hy);
    drawLineTable(doc, autoTable, data, intra, g, boxBottom + 12);
    let y = doc.lastAutoTable.finalY + 10;
    // Keep the totals + bank + footer block together. If the line table ran long
    // and there isn't room beneath it on this page, carry the block to a fresh A4
    // page so nothing is clipped at the bottom margin.
    const FOOTER_BLOCK = 210;
    if (y + FOOTER_BLOCK > PH - M) {
        doc.addPage();
        y = M;
    }
    y = drawTaxSummary(doc, autoTable, intra, tot, g, y);
    // ── Amount in words ──
    doc.setFont("helvetica", "normal").setFontSize(FS_BODY).text(amountInWords(tot.grand), g.L, y);
    y += 18;
    y = drawBank(doc, co, g, y);
    await drawFooter(doc, co, inv, tot, g, y);
    if (inv.docStatus === "cancelled")
        drawCancelledWatermark(doc, g);
    return doc;
}
/** Overlay a large faded diagonal "CANCELLED" across every page of a cancelled
 *  invoice, so a printed/shared copy is unmistakable (its stock was reversed and
 *  nothing is owed). Uses a GState opacity when the build supports it. */
function drawCancelledWatermark(doc, g) {
    const gstate = doc;
    const ANGLE = 30;
    const a = (ANGLE * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const maxW = g.W * 0.84; // keep a clear margin on both sides
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "bold");
        // Shrink until the word's ROTATED footprint (width·cos + capHeight·sin) sits
        // inside the margin, so "CANCELLED" never bleeds off either edge. The cap
        // height of helvetica is ~0.72·fontSize.
        let size = 100;
        doc.setFontSize(size);
        while (size > 40 && doc.getTextWidth("CANCELLED") * cos + size * 0.72 * sin > maxW) {
            size -= 3;
            doc.setFontSize(size);
        }
        if (gstate.GState && gstate.setGState)
            gstate.setGState(new gstate.GState({ opacity: 0.22 }));
        doc.setTextColor(214, 40, 40);
        doc.text("CANCELLED", g.W / 2, g.PH / 2, { align: "center", baseline: "middle", angle: ANGLE });
        doc.setTextColor(0);
        if (gstate.GState && gstate.setGState)
            gstate.setGState(new gstate.GState({ opacity: 1 }));
    }
    doc.setFontSize(FS_BODY);
}
//# sourceMappingURL=invoice-pdf.js.map