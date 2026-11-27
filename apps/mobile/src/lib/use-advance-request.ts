import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useAuth } from "./auth";
import { requestAdvanceApi } from "./advances";

/** State + submit for the "request an advance" form (online-only). */
export function useAdvanceRequest() {
  const token = useAuth((s) => s.token);
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    const amountNum = Number(amount);
    if (!(amountNum > 0)) {
      setError("Enter an amount greater than 0.");
      return;
    }
    setBusy(true);
    try {
      await requestAdvanceApi(token, amountNum, reason.trim() || null);
      await queryClient.invalidateQueries({ queryKey: ["my-advances"] });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the request.");
      setBusy(false);
    }
  }

  return { amount, setAmount, reason, setReason, error, busy, submit };
}
