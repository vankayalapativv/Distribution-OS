import { useEffect, useState } from "react";
import { downloadInvoicePdf, shareInvoiceFile } from "../../lib/invoice-notifications";

export type LoadState = "loading" | "ready" | "error";

/** Downloads the invoice PDF fresh (Bearer-auth) to a local file and exposes a
 *  share action that forwards that same file. `retry` re-runs the download. */
export function useInvoicePdf(invoiceId: string, label: string) {
  const [uri, setUri] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [sharing, setSharing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setUri(null);
    void downloadInvoicePdf(invoiceId, label).then((result) => {
      if (cancelled) return;
      if (!result) {
        setState("error");
        return;
      }
      setUri(result);
      setState("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [invoiceId, label, attempt]);

  async function share() {
    if (!uri || sharing) return;
    setSharing(true);
    try {
      await shareInvoiceFile(uri, label);
    } finally {
      setSharing(false);
    }
  }

  return {
    uri,
    state,
    setState,
    sharing,
    share,
    retry: () => setAttempt((a) => a + 1),
  };
}
