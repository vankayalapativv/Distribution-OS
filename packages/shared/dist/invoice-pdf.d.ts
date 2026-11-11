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
interface PdfItem {
    description: string;
    packSizeLitres: number;
    hsnCode: string;
    qtyUnits: number;
    rate: number;
    mrp: number | null;
    discountPct: number;
    taxableAmount: number;
    gstRate: number;
    cgst: number;
    sgst: number;
    igst: number;
    lineTotal: number;
}
export interface PdfData {
    company: {
        legalName: string;
        gstin: string;
        addressLine1: string;
        addressLine2: string;
        city: string;
        state: string;
        pincode: string;
        phone: string;
        email: string;
        bankAccountName: string;
        bankAccountNumber: string;
        bankIfsc: string;
        upiId: string;
        termsAndConditions: string;
    };
    invoice: {
        invoiceNumber: string;
        invoiceDate: string;
        placeOfSupply: string | null;
        buyerStateCode: string | null;
        supplyType: string;
        docStatus: string;
        irn: string | null;
        ewayBillNo: string | null;
        transport: string | null;
        vehicleNo: string | null;
        grRrNo: string | null;
        station: string | null;
        salesman: string | null;
        reverseCharge: boolean;
    };
    buyer: {
        name: string;
        gstin: string | null;
        pan: string | null;
        email: string | null;
        phone: string | null;
        pincode: string | null;
        address: string;
    };
    items: PdfItem[];
    totals: {
        taxable: number;
        totalDiscount: number;
        cgst: number;
        sgst: number;
        igst: number;
        transportCharge: number;
        grand: number;
        totalLitres: number;
    };
}
/** Shown when the company hasn't set its own Terms in Settings → Invoice. */
export declare const DEFAULT_TERMS: string;
/** Pure renderer — builds the BAL-layout jsPDF doc from a payload. Returns the
 *  jsPDF instance; callers do `.output("blob" | "arraybuffer")` or `.save()`. */
export declare function buildInvoiceDoc(data: PdfData): Promise<import("jspdf").jsPDF>;
export {};
//# sourceMappingURL=invoice-pdf.d.ts.map