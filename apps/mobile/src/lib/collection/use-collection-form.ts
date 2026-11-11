/** All state + orchestration for the record-collection screen — online-first
 *  with an offline queue fallback (the proof photo persists locally and uploads
 *  on sync). */
import * as Crypto from "expo-crypto";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth";
import { istDate } from "../day-flag";
import { getLocalDb } from "../db";
import { submitWrite } from "../online-first";
import { pickFromCamera, pickFromGallery, type PickedPhoto } from "../photos";
import { stampPhoto } from "../photo-stamp";
import { kickSync } from "../sync";
import { recordCollection } from "./collection-queue";
import { submitCollection } from "./submit";

export function useCollectionForm(customerId: string | undefined, customerName: string | null) {
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);

  const [collectionType, setCollectionType] = useState<"general" | "advance">("general");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<string>("cash");
  const [reference, setReference] = useState("");
  const [bankName, setBankName] = useState("");
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  // The picked photo is being watermark-stamped (a shimmer shows meanwhile).
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [status, setStatus] = useState("Saving…");
  const [confirmedCode, setConfirmedCode] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  // Stable across retries so the idempotent create can't duplicate; reset on "Start another".
  const clientUuid = useRef<string | null>(null);
  // Guard setState if the SE backs out of the screen while the submit is in flight.
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const amountNum = Number(amount);
  // Accept only a plain rupee amount (up to 2 decimals) — `Number("1e5")` and
  // stray letters otherwise pass as a silently-wrong figure.
  const amountValid = /^\d+(\.\d{1,2})?$/.test(amount.trim()) && amountNum > 0;
  const canSubmit = amountValid && photo !== null;

  async function addPhoto(source: "camera" | "gallery") {
    const { photos, error } =
      source === "camera" ? await pickFromCamera() : await pickFromGallery(1);
    if (error) return setSubmitError(error);
    if (photos.length > 0) {
      setPreparing(true);
      try {
        const stamped = await stampPhoto(photos[0], {
          userName: user?.name ?? "",
          customerName: customerName ?? null,
        });
        if (!mounted.current) return;
        setPhoto(stamped);
        setSubmitError(null);
      } finally {
        if (mounted.current) setPreparing(false);
      }
    }
  }

  async function onSubmit() {
    if (!customerId || !photo || !canSubmit || submitting) return;
    if (!clientUuid.current) clientUuid.current = Crypto.randomUUID();
    const uuid = clientUuid.current;
    setSubmitting(true);
    setSubmitError(null);
    const collectionDate = istDate();
    const paymentReferenceNumber = reference.trim() || null;
    const bank = mode === "cheque" ? bankName.trim() || null : null;
    try {
      // Online-first: try the server (create + proof upload); offline, persist the
      // proof + record the collection to the local outbox and queue the write.
      const outcome = await submitWrite<string>({
        send: () =>
          submitCollection({
            token, customerId, collectionType, amountNum, mode, reference, bankName, photo,
            clientUuid: uuid, onStatus: setStatus,
          }),
        queue: () => {
          const db = getLocalDb();
          if (!db) throw new Error("no local db"); // → submitWrite reports "unsaved"
          recordCollection(
            db,
            {
              clientUuid: uuid, customerId, collectionDate, paymentMode: mode,
              collectionType, collectionAmount: amountNum, paymentReferenceNumber,
              bankName: bank, photo,
            },
            Date.now(),
          );
        },
      });
      if (!mounted.current) return;
      if (outcome.status === "sent") {
        setConfirmedCode(outcome.data);
      } else if (outcome.status === "queued") {
        void kickSync();
        setQueued(true);
      } else {
        setSubmitError(
          outcome.status === "unsaved"
            ? "Couldn't save the collection on this device. Please try again."
            : "The server rejected this collection. Please review and try again.",
        );
        setSubmitting(false);
      }
    } catch (e) {
      if (mounted.current) {
        setSubmitError(e instanceof Error ? e.message : "Could not record the collection.");
        setSubmitting(false);
      }
    }
  }

  function reset() {
    clientUuid.current = null;
    setCollectionType("general");
    setAmount("");
    setMode("cash");
    setReference("");
    setBankName("");
    setPhoto(null);
    setSubmitting(false);
    setSubmitError(null);
    setConfirmedCode(null);
    setQueued(false);
  }

  return {
    collectionType, setCollectionType, amount, setAmount, mode, setMode, reference, setReference,
    bankName, setBankName, photo, setPhoto, preparing, submitting, submitError, status, confirmedCode, queued,
    amountNum, canSubmit, addPhoto, onSubmit, reset,
  };
}
