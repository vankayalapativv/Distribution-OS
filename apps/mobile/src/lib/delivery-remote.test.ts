import { describe, expect, it, vi } from "vitest";
import { sendAddStop, sendEndRun, sendStartRun } from "./delivery-remote";

const resolving = (data: unknown) => vi.fn().mockResolvedValue(data);

describe("delivery-remote senders", () => {
  it("sendStartRun POSTs /deliveries/runs/start with the body + token", async () => {
    const fetcher = resolving({ id: "run-1" });
    const body = { vehicleNumber: "TS07AB1234", startOdometer: 100, clientUuid: "u1" };
    const res = await sendStartRun(body, "tok", fetcher);
    expect(fetcher).toHaveBeenCalledWith("/deliveries/runs/start", {
      method: "POST",
      body,
      token: "tok",
    });
    expect(res).toEqual({ id: "run-1" });
  });

  it("sendAddStop POSTs to the run's /stops path", async () => {
    const fetcher = resolving({ id: "stop-1" });
    const body = {
      runClientUuid: "u1",
      customerId: "c1",
      latitude: 1,
      longitude: 2,
      invoiceId: "i1",
      clientUuid: "u2",
    };
    const res = await sendAddStop("run-1", body, "tok", fetcher);
    expect(fetcher).toHaveBeenCalledWith("/deliveries/runs/run-1/stops", {
      method: "POST",
      body,
      token: "tok",
    });
    expect(res).toEqual({ id: "stop-1" });
  });

  it("sendEndRun POSTs to the run's /end path", async () => {
    const fetcher = resolving({ id: "run-1", status: "ended" });
    const body = { runClientUuid: "u1", endOdometer: 200 };
    const res = await sendEndRun("run-1", body, "tok", fetcher);
    expect(fetcher).toHaveBeenCalledWith("/deliveries/runs/run-1/end", {
      method: "POST",
      body,
      token: "tok",
    });
    expect(res).toEqual({ id: "run-1", status: "ended" });
  });
});
