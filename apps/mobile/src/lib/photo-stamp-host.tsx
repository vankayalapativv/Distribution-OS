import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { StampComposer } from "./photo-stamp-composer";

const STAMP_JPEG_QUALITY = 0.6;
// Per-job watchdog: if the <Image> never fires onLoad/onError or captureRef
// hangs (a real risk on the New Architecture), free the slot so a single stuck
// job can't wedge every subsequent photo.
const STAMP_JOB_TIMEOUT_MS = 6000;

export interface Job {
  uri: string;
  width: number;
  height: number;
  lines: string[];
  resolve: (stampedUri: string | null) => void;
  // Set once the job settles (capture, image error, OR watchdog) so the three
  // racing finishers never double-resolve or free a later job's slot.
  resolved?: boolean;
}

/** Live binding: the host writes it on mount; stampPhoto reads it to enqueue. */
export let enqueue: ((job: Job) => void) | null = null;

/**
 * Mount ONCE at the app root. Renders the composer off-screen for ONE stamp job
 * at a time (a single slot), draining a FIFO queue so concurrent callers can't
 * clobber each other's capture.
 */
export function PhotoStampHost() {
  const [job, setJob] = useState<Job | null>(null);
  const queue = useRef<Job[]>([]);
  const busy = useRef(false);
  const shotRef = useRef<View>(null);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Settle a job EXACTLY once, then release the slot and drain the queue. The
  // guard is keyed to the job object (not a shared flag) so a late capture/onLoad
  // for a timed-out job can't resolve a different job or double-free the slot.
  function finishJob(j: Job, stampedUri: string | null) {
    if (j.resolved) return;
    j.resolved = true;
    if (watchdog.current) {
      clearTimeout(watchdog.current);
      watchdog.current = null;
    }
    j.resolve(stampedUri);
    busy.current = false;
    setJob(null);
    pump();
  }

  // Start the next queued job if idle, arming the watchdog. Uses only refs + the
  // stable setJob, so the mount-captured `enqueue` closure never goes stale.
  function pump() {
    if (busy.current) return;
    const next = queue.current.shift();
    if (!next) return;
    busy.current = true;
    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = setTimeout(() => finishJob(next, null), STAMP_JOB_TIMEOUT_MS);
    setJob(next);
  }

  useEffect(() => {
    enqueue = (j: Job) => {
      queue.current.push(j);
      pump();
    };
    return () => {
      enqueue = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onImageReady() {
    if (!job) return;
    const current = job;
    try {
      // Let the texture fully upload before snapshotting: onLoad fires when the
      // bitmap decodes, but on Android the texture may not be composited for a
      // frame or two — capturing early yields a uniformly-darkened JPEG.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      await new Promise((r) => setTimeout(r, 120));
      const stamped = await captureRef(shotRef, { format: "jpg", quality: STAMP_JPEG_QUALITY, result: "tmpfile" });
      finishJob(current, stamped);
    } catch {
      finishJob(current, null);
    }
  }

  if (!job) return null;
  return <StampComposer job={job} shotRef={shotRef} onReady={onImageReady} onError={() => finishJob(job, null)} />;
}
