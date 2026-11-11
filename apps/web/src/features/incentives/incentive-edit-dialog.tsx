"use client";

import { type SyntheticEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import { litres as fmtLitres, rupees } from "@/lib/format";
import type { IncentiveRow } from "./incentives-api";

/** "" → null, otherwise a finite number (or throws for the caller to catch). */
function toNum(value: string): number | null {
  const t = value.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null; // non-numeric → unset, not NaN
  return Math.max(0, n); // never submit a negative rate/target/percent
}

export function IncentiveEditDialog({
  actionConfig,
  executive,
  month,
  label,
  onClose,
}: {
  readonly actionConfig: ActionConfig;
  readonly executive: IncentiveRow;
  readonly month: string;
  readonly label: string;
  readonly onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [collectionPct, setCollectionPct] = useState(String(executive.collectionPct ?? ""));
  const [perLitreRate, setPerLitreRate] = useState(String(executive.perLitreRate ?? ""));
  const [targetLitres, setTargetLitres] = useState(String(executive.targetLitres ?? ""));
  const [targetReward, setTargetReward] = useState(String(executive.targetReward ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = {
      month,
      collectionPct: toNum(collectionPct),
      perLitreRate: toNum(perLitreRate),
      targetLitres: toNum(targetLitres),
      targetReward: toNum(targetReward),
    };
    if (Object.values(body).some((v) => typeof v === "number" && Number.isNaN(v))) {
      setError("Enter valid numbers, or leave a field blank.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiRequest(actionConfig, "PUT", `/incentives/${executive.userId}`, body);
      void queryClient.invalidateQueries({ queryKey: ["incentives"] });
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the incentive."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="md">
        <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>
              {executive.name} — {label}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-6">
            {/* Collections */}
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Collection incentive
              </p>
              <p className="text-xs text-muted-foreground">
                Verified collections this month:{" "}
                <span className="font-medium text-foreground">{rupees(executive.collectionsTotal)}</span>
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pct">Percentage (%)</Label>
                <Input
                  id="pct"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="e.g. 2"
                  value={collectionPct}
                  onChange={(e) => setCollectionPct(e.target.value)}
                />
              </div>
            </section>

            {/* Targets */}
            <section className="space-y-2 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Target incentive
              </p>
              <p className="text-xs text-muted-foreground">
                Oil litres sold this month:{" "}
                <span className="font-medium text-foreground">{fmtLitres(executive.litresTotal)}</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tl">Monthly target (litres)</Label>
                  <Input
                    id="tl"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    placeholder="e.g. 3000"
                    value={targetLitres}
                    onChange={(e) => setTargetLitres(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tr">Reward if met (₹)</Label>
                  <Input
                    id="tr"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    placeholder="e.g. 1000"
                    value={targetReward}
                    onChange={(e) => setTargetReward(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rate">Per-litre rate (₹ / litre)</Label>
                <Input
                  id="rate"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 0.5"
                  value={perLitreRate}
                  onChange={(e) => setPerLitreRate(e.target.value)}
                />
              </div>
            </section>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save incentive"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
