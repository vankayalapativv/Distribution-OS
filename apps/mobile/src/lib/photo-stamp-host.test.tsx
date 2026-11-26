import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import * as Host from "./photo-stamp-host";

const captureRef = vi.fn<(...a: unknown[]) => Promise<string>>(() => Promise.resolve("file://stamped.jpg"));
let composerProps: { job: { uri: string }; onReady: () => Promise<void> | void; onError: () => void } | null = null;
vi.mock("react-native-view-shot", () => ({ captureRef: (...a: unknown[]) => captureRef(...a) }));
vi.mock("./photo-stamp-composer", () => ({
  StampComposer: (props: typeof composerProps) => { composerProps = props; return null; },
}));

type Job = Parameters<NonNullable<typeof Host.enqueue>>[0];
function enqueueJob(over: Partial<Job> = {}) {
  const resolve = vi.fn();
  act(() => { Host.enqueue!({ uri: "file://a.jpg", width: 400, height: 300, lines: ["x"], resolve, ...over }); });
  return resolve;
}

beforeEach(() => { composerProps = null; captureRef.mockResolvedValue("file://stamped.jpg"); });
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

describe("PhotoStampHost", () => {
  it("binds the enqueue slot on mount and clears it on unmount", () => {
    const { unmount } = render(<Host.PhotoStampHost />);
    expect(Host.enqueue).toBeTypeOf("function");
    unmount();
    expect(Host.enqueue).toBeNull();
  });

  it("captures a stamped jpeg once the image is ready", async () => {
    render(<Host.PhotoStampHost />);
    const resolve = enqueueJob();
    expect(composerProps?.job.uri).toBe("file://a.jpg");
    await act(async () => { await composerProps!.onReady(); });
    expect(captureRef).toHaveBeenCalled();
    expect(resolve).toHaveBeenCalledWith("file://stamped.jpg");
  });

  it("resolves null when the capture throws", async () => {
    captureRef.mockRejectedValue(new Error("view-shot failed"));
    render(<Host.PhotoStampHost />);
    const resolve = enqueueJob();
    await act(async () => { await composerProps!.onReady(); });
    expect(resolve).toHaveBeenCalledWith(null);
  });

  it("resolves null when the image fails to load", async () => {
    render(<Host.PhotoStampHost />);
    const resolve = enqueueJob();
    act(() => composerProps!.onError());
    expect(resolve).toHaveBeenCalledWith(null);
  });

  it("frees a stuck job via the 6s watchdog", async () => {
    vi.useFakeTimers();
    render(<Host.PhotoStampHost />);
    const resolve = enqueueJob();
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(resolve).toHaveBeenCalledWith(null);
  });

  it("drains the queue FIFO, one slot at a time", async () => {
    render(<Host.PhotoStampHost />);
    const r1 = enqueueJob({ uri: "file://1.jpg" });
    const r2 = enqueueJob({ uri: "file://2.jpg" });
    expect(composerProps?.job.uri).toBe("file://1.jpg"); // second waits
    await act(async () => { await composerProps!.onReady(); });
    expect(r1).toHaveBeenCalledWith("file://stamped.jpg");
    expect(composerProps?.job.uri).toBe("file://2.jpg"); // pumped next
    await act(async () => { await composerProps!.onReady(); });
    expect(r2).toHaveBeenCalledWith("file://stamped.jpg");
  });

  it("settles a job exactly once (a late finisher is ignored)", async () => {
    render(<Host.PhotoStampHost />);
    const resolve = enqueueJob();
    const staleOnError = composerProps!.onError;
    await act(async () => { await composerProps!.onReady(); }); // settles the job
    act(() => staleOnError()); // late error for the same (now-resolved) job
    expect(resolve).toHaveBeenCalledTimes(1);
  });
});
