"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Ent {
  id: string; name: string; legalName: string; gstin: string; status: string;
  contactName?: string; contactEmail?: string; createdAt?: string;
  billingModel?: string | null; unitAmountPaisa?: number | null; flatAmountPaisa?: number | null;
}
interface Detail extends Ent {
  addressLine1?: string; addressLine2?: string | null;
  addressCity?: string; addressState?: string; addressPincode?: string; contactPhone?: string;
  settings?: Array<{ key: string; value: string }>;
  godowns?: Array<{ name: string; city?: string; state?: string; stateCode?: string }>;
  duesBands?: Array<{ ordinal: number; fromDays: number; toDays: number | null; label: string }>;
  invoiceSeries?: { prefix: string; finYear: string; nextSeq: number } | null;
  billing?: { model: string | null; unitAmountPaisa: number | null; flatAmountPaisa: number | null; gstRateBp?: number } | null;
}

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "active", label: "Active" },
  { key: "rejected", label: "Rejected" },
  { key: "", label: "All" },
];

const rupees = (p?: number | null) => (p == null ? "—" : `₹${(p / 100).toLocaleString("en-IN")}`);
const setting = (d: Detail, k: string) => d.settings?.find((s) => s.key === k)?.value ?? "—";

function StatusPill({ s }: { s: string }) {
  const tone =
    s === "active" ? "bg-[oklch(0.62_0.15_150/0.14)] text-[oklch(0.5_0.15_150)]" :
    s === "rejected" ? "bg-destructive/10 text-destructive" :
    "bg-[oklch(0.57_0.13_60/0.16)] text-[oklch(0.5_0.13_60)]";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-semibold capitalize ${tone}`}>{s}</span>;
}

export function OwnerCockpit({ initial }: { initial: Ent[] }) {
  const [tab, setTab] = useState("pending");
  const [list, setList] = useState<Ent[]>(initial);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [open, setOpen] = useState(false);
  const [model, setModel] = useState<"per_seat" | "flat">("per_seat");
  const [amount, setAmount] = useState("708");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/platform${status ? `?status=${status}` : ""}`, { cache: "no-store" });
      const b = (await res.json()) as { data?: { enterprises?: Ent[] } };
      setList(b.data?.enterprises ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(tab); }, [tab, load]);

  async function openDetail(id: string) {
    setErr(null); setReason("");
    const res = await fetch(`/api/platform/${id}`, { cache: "no-store" });
    const b = (await res.json()) as { data?: Detail };
    const d = b.data ?? null;
    setDetail(d);
    // Prefill the price editor from the enterprise's current config (pending → defaults).
    const m = d?.billing?.model === "flat" ? "flat" : "per_seat";
    setModel(m);
    const paisa = m === "flat" ? d?.billing?.flatAmountPaisa : d?.billing?.unitAmountPaisa;
    setAmount(paisa != null ? String(paisa / 100) : "708");
    setOpen(true);
  }

  async function act(action: "approve" | "reject" | "pricing") {
    if (!detail) return;
    setBusy(true); setErr(null);
    const payload = action === "reject"
      ? { action, reason }
      : { action, model, amountPaisa: Math.round(Number(amount) * 100) };
    try {
      const res = await fetch(`/api/platform/${detail.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const b = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
      if (!res.ok) { setErr((typeof b.error === "string" ? b.error : b.error?.message) ?? "Action failed."); setBusy(false); return; }
      setOpen(false); setBusy(false);
      void load(tab);
    } catch { setErr("Network error."); setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border px-6 py-3">
        <span className="text-[15px] font-extrabold tracking-tight">Distribution&nbsp;OS</span>
        <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Owner cockpit</span>
      </header>

      <main className="mx-auto max-w-[1080px] px-6 py-7">
        <h1 className="text-[20px] font-extrabold tracking-tight">Enterprises</h1>
        <p className="mb-5 mt-1 text-[13px] text-muted-foreground">Review submitted companies, set their price, and approve.</p>

        <div className="mb-4 inline-flex gap-1 rounded-full border border-border bg-secondary p-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold ${tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-[10px] border border-border bg-card shadow-sm">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11.5px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Company</th>
                <th className="px-4 py-2.5 font-semibold">GSTIN</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Plan</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No enterprises here.</td></tr>
              ) : list.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-secondary/60">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{e.name}</div>
                    <div className="text-[12px] text-muted-foreground">{e.legalName}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px]">{e.gstin}</td>
                  <td className="px-4 py-3"><StatusPill s={e.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {e.billingModel === "per_seat" ? `${rupees(e.unitAmountPaisa)} / user` : e.billingModel === "flat" ? `${rupees(e.flatAmountPaisa)} flat` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => openDetail(e.id)}>
                      {e.status === "pending" ? "Review" : "View"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5 text-[18px]">
                  {detail.name} <StatusPill s={detail.status} />
                </DialogTitle>
              </DialogHeader>

              <DialogBody className="flex flex-col gap-5">
                <Section title="Administrator">
                  <Info label="Name" value={detail.contactName} />
                  <Info label="Designation" value={setting(detail, "admin_designation")} />
                </Section>
                <Section title="Company">
                  <Info label="Trade name" value={detail.name} />
                  <Info label="Legal name" value={detail.legalName} />
                  <Info label="GSTIN" value={detail.gstin} mono />
                  <Info label="Business phone" value={detail.contactPhone} />
                  <Info label="Business email" value={detail.contactEmail} />
                </Section>
                <Section title="Registered address">
                  <Info label="Line 1" value={detail.addressLine1} />
                  {detail.addressLine2 ? <Info label="Line 2" value={detail.addressLine2} /> : null}
                  <Info label="City" value={detail.addressCity} />
                  <Info label="State" value={detail.addressState} />
                  <Info label="Pincode" value={detail.addressPincode} mono />
                </Section>
                <Section title="Banking &amp; payment">
                  <Info label="Bank" value={setting(detail, "company_bank_name")} />
                  <Info label="Account holder" value={setting(detail, "company_bank_account_name")} />
                  <Info label="Account number" value={setting(detail, "company_bank_account_number")} mono />
                  <Info label="IFSC" value={setting(detail, "company_bank_ifsc")} mono />
                  <Info label="UPI ID" value={setting(detail, "company_upi_id")} mono />
                </Section>
                <Section title="Invoicing">
                  <Info label="Series" value={detail.invoiceSeries ? `${detail.invoiceSeries.prefix}${detail.invoiceSeries.nextSeq}` : "—"} mono />
                  <div className="col-span-full rounded-[7px] border border-border bg-secondary px-3 py-2">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Terms &amp; conditions</div>
                    <pre className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed">{setting(detail, "company_terms")}</pre>
                  </div>
                </Section>
                <Section title="Godowns">
                  {(detail.godowns ?? []).map((g, i) => (
                    <Info key={i} label={`Godown ${i + 1}`} value={`${g.name}${g.city ? ` · ${g.city}` : ""} · ${g.state ?? ""} (${g.stateCode ?? "—"})`} />
                  ))}
                </Section>
                <Section title="Field tracking">
                  <Info label="SE auto-stop" value={`${setting(detail, "tracking_se_autostop_hour")}:00`} />
                  <Info label="Logistics auto-stop" value={`${setting(detail, "tracking_logistics_autostop_hour")}:00`} />
                </Section>
                <Section title="Collection dues bands">
                  {(detail.duesBands ?? []).map((b) => (
                    <Info key={b.ordinal} label={b.label} value={`${b.fromDays} – ${b.toDays == null ? "∞" : b.toDays} days`} />
                  ))}
                </Section>

              {err ? <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{err}</div> : null}

              {detail.status === "pending" ? (
                <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                  <div className="rounded-[8px] border border-border p-3.5">
                    <div className="mb-2.5 text-[13px] font-bold">Approve &amp; set price</div>
                    <div className="mb-2.5 flex gap-1 rounded-md border border-border bg-secondary p-0.5 text-[12.5px]">
                      {(["per_seat", "flat"] as const).map((m) => (
                        <button key={m} onClick={() => setModel(m)} className={`flex-1 rounded px-2 py-1 font-medium ${model === m ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
                          {m === "per_seat" ? "Per user" : "Flat"}
                        </button>
                      ))}
                    </div>
                    <Label className="text-[12px]">Amount (₹ {model === "per_seat" ? "/ user / month" : "/ month"})</Label>
                    <Input className="mt-1 font-mono" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
                    <Button className="mt-3 w-full" onClick={() => act("approve")} disabled={busy || !amount}>
                      {busy ? "Approving…" : "Approve"}
                    </Button>
                  </div>
                  <div className="rounded-[8px] border border-border p-3.5">
                    <div className="mb-2.5 text-[13px] font-bold">Reject</div>
                    <Label className="text-[12px]">Reason (shown to the applicant)</Label>
                    <Textarea className="mt-1 min-h-[72px] text-[13px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What needs to change?" />
                    <Button variant="outline" className="mt-3 w-full border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => act("reject")} disabled={busy || !reason.trim()}>
                      {busy ? "Rejecting…" : "Reject"}
                    </Button>
                  </div>
                </div>
              ) : detail.status === "active" ? (
                <div className="mt-4 border-t border-border pt-4">
                  <div className="rounded-[8px] border border-border p-3.5 sm:max-w-sm">
                    <div className="mb-2.5 text-[13px] font-bold">Edit price</div>
                    <div className="mb-2.5 flex gap-1 rounded-md border border-border bg-secondary p-0.5 text-[12.5px]">
                      {(["per_seat", "flat"] as const).map((m) => (
                        <button key={m} onClick={() => setModel(m)} className={`flex-1 rounded px-2 py-1 font-medium ${model === m ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
                          {m === "per_seat" ? "Per user" : "Flat"}
                        </button>
                      ))}
                    </div>
                    <Label className="text-[12px]">Amount (₹ {model === "per_seat" ? "/ user / month" : "/ month"})</Label>
                    <Input className="mt-1 font-mono" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
                    <Button className="mt-3 w-full" onClick={() => act("pricing")} disabled={busy || !amount}>
                      {busy ? "Saving…" : "Save price"}
                    </Button>
                    <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">
                      Takes effect next cycle. A paid month never changes; an unpaid current month re-prices automatically.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 border-t border-border pt-4 text-[13px] text-muted-foreground">
                  This enterprise was rejected.
                </div>
              )}
              </DialogBody>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-primary">{title}</div>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="rounded-[7px] border border-border bg-secondary px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-[13px] ${mono ? "font-mono" : "font-medium"}`}>{value || "—"}</div>
    </div>
  );
}
