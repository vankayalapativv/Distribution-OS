import { describe, expect, it } from "vitest";
import { ALERT_TYPE_LABELS, SEVERITY_CLASSES } from "./alerts-helpers";

describe("alerts helpers", () => {
  it("maps each severity to a tone class", () => {
    expect(SEVERITY_CLASSES.high).toMatch(/red/);
    expect(SEVERITY_CLASSES.medium).toMatch(/yellow/);
    expect(SEVERITY_CLASSES.low).toMatch(/blue/);
    expect(SEVERITY_CLASSES.info).toMatch(/slate/);
  });

  it("labels the known alert types", () => {
    expect(ALERT_TYPE_LABELS.COLLECTION_REJECTED).toBe("Collection Rejected");
    expect(ALERT_TYPE_LABELS.CREDIT_OVERDUE).toBe("Credit Overdue");
    expect(ALERT_TYPE_LABELS.PAYMENT_BOUNCED).toBe("Payment Bounced");
    expect(ALERT_TYPE_LABELS.ORDER_PENDING).toBe("Order Pending");
  });
});
