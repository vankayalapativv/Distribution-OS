"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { basePaisaFromInclusive, freeModeFromConfig, freePayload, type FreeMode } from "./cockpit-billing";
import { CockpitPriceFields } from "./cockpit-price-fields";
import { CockpitFreeMode } from "./cockpit-free-mode";
import { CockpitCharges } from "./cockpit-charges";
import { CockpitEditPanel } from "./cockpit-edit-panel";

interface Ent {
  id: string; name: string; legalName: string; gstin: string; status: string;
  contactName?: string; contactEmail?: string; createdAt?: string;
  billingModel?: string | null; unitAmountPaisa?: number | null; flatAmountPaisa?: number | null;
}
interface Detail extends Ent {
  addressLine1?: string; addressLine2?: string | null;
  addressCity?: string; addressState?: string; addressPincode?: string; contactPhone?: string;
  settings?: Array<{ key: string; value: string }>;
  godowns?: Array<{ id?: string; name: string; addressLine?: string | null; city?: string | null; state: string; stateCode: string; pincode?: string | null; isDefault?: boolean }>;
  duesBands?: Array<{ ordinal: number; fromDays: number; toDays: number | null; label: string }>;
  invoiceSeries?: { prefix: string; finYear: string; nextSeq: number } | null;
  billing?: { model: string | null; unitAmountPaisa: number | null; flatAmountPaisa: number | null; gstRateBp?: number; enforced?: boolean; freeForever?: boolean; freeUntil?: string | null } | null;
}

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "active", label: "Active" },
  { key: "suspended", label: "Suspended" },
  { key: "rejected", label: "Rejected" },
  { key: "", label: "All" },
];

const rupees = (p?: number | null) => (p == null ? "—" : `₹${(p / 100).toLocaleString("en-IN")}`);
const setting = (d: Detail, k: string) => d.settings?.find((s) => s.key === k)?.value ?? "—";

function StatusPill({ s }: { s: string }) {
  const tone =
    s === "active" ? "bg-[oklch(0.62_0.15_150/0.14)] text-[oklch(0.5_0.15_150)]" :
    s === "rejected" ? "bg-destructive/10 text-destructive" :
    s === "suspended" ? "bg-muted text-muted-foreground" :
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
  const [amount, setAmount] = useState("999");
  const [freeMode, setFreeMode] = useState<FreeMode>("immediate");
  const [freeMonths, setFreeMonths] = useState("2");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

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
    setErr(null); setReason(""); setEditing(false);
    const res = await fetch(`/api/platform/${id}`, { cache: "no-store" });
    const b = (await res.json()) as { data?: Detail };
    const d = b.data ?? null;
    setDetail(d);
    // Prefill the price editor with the current config's BASE (stored inclusive ÷ 1.18).
    const m = d?.billing?.model === "flat" ? "flat" : "per_seat";
    setModel(m);
    const inclusive = m === "flat" ? d?.billing?.flatAmountPaisa : d?.billing?.unitAmountPaisa;
    const base = basePaisaFromInclusive(inclusive);
    setAmount(base > 0 ? String(base / 100) : m === "flat" ? "999" : "600");
    setFreeMode(freeModeFromConfig(d?.billing));
    setFreeMonths("2");
    setOpen(true);
  }

  // One POST per action; refreshes the list and (for in-place changes) the detail.
  async function post(payload: Record<string, unknown>, opts: { closeOnDone?: boolean; refetch?: boolean } = {}) {
    if (!detail) return false;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/platform/${detail.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const b = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
      if (!res.ok) { setErr((typeof b.error === "string" ? b.error : b.error?.message) ?? "Action failed."); setBusy(false); return false; }
      setBusy(false);
      if (opts.closeOnDone) setOpen(false);
      void load(tab);
      if (opts.refetch && !opts.closeOnDone) void refetchDetail(detail.id);
      return true;
    } catch { setErr("Network error."); setBusy(false); return false; }
  }

  async function refetchDetail(id: string) {
    const res = await fetch(`/api/platform/${id}`, { cache: "no-store" });
    const b = (await res.json().catch(() => ({}))) as { data?: Detail };
    if (b.data) setDetail(b.data);
  }

  const approve = () =>
    post({ action: "approve", model, amountPaisa: Math.round(Number(amount) * 100), ...freePayload(freeMode, Number(freeMonths)) }, { closeOnDone: true });
  const savePrice = () => post({ action: "pricing", model, amountPaisa: Math.round(Number(amount) * 100) }, { refetch: true });
  const saveFree = () => post({ action: "free-period", ...freePayload(freeMode, Number(freeMonths)) }, { refetch: true });
  const reject = () => post({ action: "reject", reason }, { closeOnDone: true });
  // `op` carries the suspend/reactivate verb (the BFF consumes `action` for routing).
  const setStatus = (op: "suspend" | "reactivate") => post({ action: "status", op }, { refetch: true });
  const setEnforcement = (next: boolean) => post({ action: "enforcement", enforced: next }, { refetch: true });
  // Each edit-panel section saves to its own endpoint and refetches; the panel
  // stays open so the owner can edit several sections in a row.
  const saveSection = (payload: Record<string, unknown>) => post(payload, { refetch: true });

  return (
    <div className="text-foreground">
      <div className="mx-auto max-w-[1080px] px-6 py-7">
        <h1 className="text-[20px] font-extrabold tracking-tight">Enterprises</h1>
        <p className="mb-5 mt-1 text-[13px] text-muted-foreground">Review submitted companies, set pricing &amp; free periods, approve, suspend and manage.</p>

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
                      {e.status === "pending" ? "Review" : "Manage"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-primary">Company profile</div>
                  {detail.status !== "rejected" ? (
                    <button className="text-[12px] font-semibold text-primary hover:underline" onClick={() => setEditing((v) => !v)}>
                      {editing ? "Cancel" : "Edit details"}
                    </button>
                  ) : null}
                </div>

                {editing ? (
                  <CockpitEditPanel
                    profile={{
                      name: detail.name, legalName: detail.legalName, gstin: detail.gstin,
                      contactName: detail.contactName, contactPhone: detail.contactPhone, contactEmail: detail.contactEmail,
                      addressLine1: detail.addressLine1, addressLine2: detail.addressLine2,
                      addressCity: detail.addressCity, addressState: detail.addressState, addressPincode: detail.addressPincode,
                    }}
                    settings={Object.fromEntries((detail.settings ?? []).map((s) => [s.key, s.value]))}
                    invoice={{
                      prefix: detail.invoiceSeries?.prefix ?? "",
                      finYear: detail.invoiceSeries?.finYear ?? "",
                      nextSeq: detail.invoiceSeries?.nextSeq ?? null,
                    }}
                    godowns={(detail.godowns ?? []).map((g) => ({
                      id: g.id, name: g.name, addressLine: g.addressLine, city: g.city,
                      state: g.state, stateCode: g.stateCode, pincode: g.pincode, isDefault: g.isDefault,
                    }))}
                    duesBands={(detail.duesBands ?? []).map((b) => ({
                      ordinal: b.ordinal, fromDays: b.fromDays, toDays: b.toDays, label: b.label,
                    }))}
                    busy={busy}
                    onSave={saveSection}
                  />
                ) : (
                  <ReadOnlySections detail={detail} />
                )}

                {err ? <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{err}</div> : null}

                {detail.status === "pending" ? (
                  <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                    <div className="rounded-[8px] border border-border p-3.5">
                      <div className="mb-2.5 text-[13px] font-bold">Approve &amp; set plan</div>
                      <div className="flex flex-col gap-3">
                        <CockpitPriceFields model={model} amount={amount} onModel={setModel} onAmount={setAmount} disabled={busy} />
                        <CockpitFreeMode mode={freeMode} months={freeMonths} onMode={setFreeMode} onMonths={setFreeMonths} disabled={busy} />
                        <Button className="w-full" onClick={approve} disabled={busy || !amount}>{busy ? "Approving…" : "Approve"}</Button>
                      </div>
                    </div>
                    <div className="rounded-[8px] border border-border p-3.5">
                      <div className="mb-2.5 text-[13px] font-bold">Reject</div>
                      <Label className="text-[12px]">Reason (shown to the applicant)</Label>
                      <Textarea className="mt-1 min-h-[72px] text-[13px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What needs to change?" />
                      <Button variant="outline" className="mt-3 w-full border-destructive/40 text-destructive hover:bg-destructive/10" onClick={reject} disabled={busy || !reason.trim()}>
                        {busy ? "Rejecting…" : "Reject"}
                      </Button>
                    </div>
                  </div>
                ) : detail.status === "active" || detail.status === "suspended" ? (
                  <ManagePanels
                    detail={detail}
                    model={model} amount={amount} freeMode={freeMode} freeMonths={freeMonths} busy={busy}
                    onModel={setModel} onAmount={setAmount} onFreeMode={setFreeMode} onFreeMonths={setFreeMonths}
                    onSavePrice={savePrice} onSaveFree={saveFree} onEnforcement={setEnforcement}
                    onSuspend={() => setStatus("suspend")} onReactivate={() => setStatus("reactivate")}
                  />
                ) : (
                  <div className="border-t border-border pt-4 text-[13px] text-muted-foreground">This enterprise was rejected.</div>
                )}
              </DialogBody>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReadOnlySections({ detail }: { detail: Detail }) {
  return (
    <div className="flex flex-col gap-5">
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
      <Section title="Godowns">
        {(detail.godowns ?? []).map((g, i) => (
          <Info key={i} label={`Godown ${i + 1}`} value={`${g.name}${g.city ? ` · ${g.city}` : ""} · ${g.state ?? ""} (${g.stateCode ?? "—"})`} />
        ))}
      </Section>
      <Section title="Collection dues bands">
        {(detail.duesBands ?? []).map((b) => (
          <Info key={b.ordinal} label={b.label} value={`${b.fromDays} – ${b.toDays == null ? "∞" : b.toDays} days`} />
        ))}
      </Section>
    </div>
  );
}

function ManagePanels(props: {
  detail: Detail;
  model: "per_seat" | "flat"; amount: string; freeMode: FreeMode; freeMonths: string; busy: boolean;
  onModel: (m: "per_seat" | "flat") => void; onAmount: (v: string) => void;
  onFreeMode: (m: FreeMode) => void; onFreeMonths: (v: string) => void;
  onSavePrice: () => void; onSaveFree: () => void; onEnforcement: (next: boolean) => void;
  onSuspend: () => void; onReactivate: () => void;
}) {
  const { detail, busy } = props;
  const enforced = Boolean(detail.billing?.enforced);
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      {detail.status === "suspended" ? (
        <div className="rounded-[8px] border border-border bg-muted/40 p-3.5">
          <div className="text-[13px] font-bold">Account suspended</div>
          <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">All users are blocked; data is retained. Reactivate to restore access.</p>
          <Button className="mt-3" size="sm" onClick={props.onReactivate} disabled={busy}>{busy ? "Working…" : "Reactivate account"}</Button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[8px] border border-border p-3.5">
          <div className="mb-2.5 text-[13px] font-bold">Plan &amp; price</div>
          <CockpitPriceFields model={props.model} amount={props.amount} onModel={props.onModel} onAmount={props.onAmount} disabled={busy} />
          <Button className="mt-3 w-full" size="sm" onClick={props.onSavePrice} disabled={busy || !props.amount}>{busy ? "Saving…" : "Save price"}</Button>
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">An unpaid current month re-prices immediately; a paid month never changes.</p>
        </div>

        <div className="rounded-[8px] border border-border p-3.5">
          <div className="mb-2.5 text-[13px] font-bold">Free period</div>
          <CockpitFreeMode mode={props.freeMode} months={props.freeMonths} onMode={props.onFreeMode} onMonths={props.onFreeMonths} disabled={busy} />
          <Button className="mt-3 w-full" size="sm" onClick={props.onSaveFree} disabled={busy}>{busy ? "Saving…" : "Save free period"}</Button>
        </div>
      </div>

      <div className="rounded-[8px] border border-border p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[13px] font-bold">Billing enforcement</div>
            <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
              {enforced ? "On — app is blocked (402) if unpaid past the 7-day grace." : "Off — never blocked for non-payment."}
            </p>
          </div>
          <button
            type="button" role="switch" aria-checked={enforced} aria-label="Billing enforcement" disabled={busy}
            onClick={() => props.onEnforcement(!enforced)}
            className={`relative h-6 w-11 flex-none rounded-full transition-colors disabled:opacity-50 ${enforced ? "bg-primary" : "bg-input"}`}
          >
            <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enforced ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">Also needs the global master switch on. Leave off for demos and new signups.</p>
      </div>

      <div className="rounded-[8px] border border-border p-3.5">
        <div className="mb-2 text-[13px] font-bold">Subscription charges</div>
        <CockpitCharges enterpriseId={detail.id} />
      </div>

      {detail.status === "active" ? (
        <div className="rounded-[8px] border border-destructive/30 p-3.5">
          <div className="text-[13px] font-bold text-destructive">Suspend account</div>
          <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">Blocks all users immediately. Data is kept; reactivate anytime.</p>
          <Button variant="outline" size="sm" className="mt-3 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={props.onSuspend} disabled={busy}>
            {busy ? "Working…" : "Suspend"}
          </Button>
        </div>
      ) : null}
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
