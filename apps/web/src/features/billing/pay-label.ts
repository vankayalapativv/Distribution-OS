/** The pay-button caption for the current checkout phase. */
export function payLabelFor(phase: string, amount: string): string {
  if (phase === "starting") return "Opening…";
  if (phase === "confirming") return "Confirming…";
  return `Pay ${amount}`;
}
