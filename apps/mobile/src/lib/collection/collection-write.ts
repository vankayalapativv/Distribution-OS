/**
 * The online-first write for the record-collection form: try the server
 * (create + proof upload), and on a network failure persist the proof + queue
 * the collection to the local outbox. Interprets the outcome into the form's
 * state setters. Extracted from use-collection-form to keep that hook small.
 */
import { getLocalDb } from "../db";
import { submitWrite } from "../online-first";
import type { PickedPhoto } from "../photos";
import { kickSync } from "../sync";
import { recordCollection } from "./collection-queue";
import { submitCollection } from "./submit";

export interface CollectionWriteArgs {
  token: string | null;
  customerId: string;
  collectionType: "general" | "advance";
  amountNum: number;
  mode: string;
  reference: string;
  bankName: string;
  photo: PickedPhoto;
  clientUuid: string;
  collectionDate: string;
  paymentReferenceNumber: string | null;
  bank: string | null;
}

export interface CollectionWriteCallbacks {
  mounted: { current: boolean };
  setStatus: (s: string) => void;
  setConfirmedCode: (c: string) => void;
  setQueued: (q: boolean) => void;
  setSubmitError: (e: string | null) => void;
  setSubmitting: (s: boolean) => void;
}

export async function runCollectionSubmit(
  a: CollectionWriteArgs,
  cb: CollectionWriteCallbacks,
): Promise<void> {
  try {
    const outcome = await submitWrite<string>({
      send: () =>
        submitCollection({
          token: a.token, customerId: a.customerId, collectionType: a.collectionType,
          amountNum: a.amountNum, mode: a.mode, reference: a.reference, bankName: a.bankName,
          photo: a.photo, clientUuid: a.clientUuid, onStatus: cb.setStatus,
        }),
      queue: () => {
        const db = getLocalDb();
        if (!db) throw new Error("no local db"); // → submitWrite reports "unsaved"
        recordCollection(
          db,
          {
            clientUuid: a.clientUuid, customerId: a.customerId, collectionDate: a.collectionDate,
            paymentMode: a.mode, collectionType: a.collectionType, collectionAmount: a.amountNum,
            paymentReferenceNumber: a.paymentReferenceNumber, bankName: a.bank, photo: a.photo,
          },
          Date.now(),
        );
      },
    });
    if (!cb.mounted.current) return;
    if (outcome.status === "sent") {
      cb.setConfirmedCode(outcome.data);
    } else if (outcome.status === "queued") {
      void kickSync();
      cb.setQueued(true);
    } else {
      cb.setSubmitError(
        outcome.status === "unsaved"
          ? "Couldn't save the collection on this device. Please try again."
          : "The server rejected this collection. Please review and try again.",
      );
      cb.setSubmitting(false);
    }
  } catch (e) {
    if (cb.mounted.current) {
      cb.setSubmitError(e instanceof Error ? e.message : "Could not record the collection.");
      cb.setSubmitting(false);
    }
  }
}
