"use client";

import { Button } from "@/components/ui/button";
import type { CreatedCredentials, CreateUserPayload } from "./super-admin-types";

export function CredentialsPanel({
  credentials,
  copied,
  onCopy,
  onDone,
}: {
  readonly credentials: CreatedCredentials;
  readonly copied: boolean;
  readonly onCopy: (creds: CreatedCredentials) => void;
  readonly onDone: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Share these credentials with{" "}
        <span className="font-semibold text-foreground">{credentials.name}</span>.
        The password cannot be recovered after this dialog is closed.
      </p>
      <div className="rounded-md border border-border bg-muted p-4 font-mono text-sm space-y-1">
        <div>
          <span className="text-muted-foreground">Email: </span>
          <span className="font-semibold text-foreground">{credentials.email}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Password: </span>
          <span className="font-semibold text-foreground">{credentials.password}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => onCopy(credentials)}>
          {copied ? "Copied!" : "Copy Credentials"}
        </Button>
        <Button variant="outline" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

export function SuperAdminConfirmPanel({
  payload,
  isCreating,
  error,
  onConfirm,
  onBack,
}: {
  readonly payload: CreateUserPayload;
  readonly isCreating: boolean;
  readonly error: string | null;
  readonly onConfirm: () => void;
  readonly onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-destructive bg-destructive/10 px-3 py-3 text-sm text-destructive">
        <p className="font-semibold">Create another Super Admin?</p>
        <p className="mt-1 text-destructive/90">
          A Super Admin has <span className="font-semibold">full access</span> to the entire
          system, including all customers, orders, finances, and the ability to create or
          remove other users. This cannot be limited later.
        </p>
      </div>
      <div className="rounded-md border border-border bg-muted p-4 text-sm space-y-1">
        <div>
          <span className="text-muted-foreground">Name: </span>
          <span className="font-semibold text-foreground">{payload.name}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Email: </span>
          <span className="font-semibold text-foreground">{payload.email ?? "—"}</span>
        </div>
      </div>
      {error && (
        <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <Button
          variant="destructive"
          className="flex-1"
          disabled={isCreating}
          onClick={onConfirm}
        >
          {isCreating ? "Creating…" : "Yes, create Super Admin"}
        </Button>
        <Button
          variant="outline"
          type="button"
          disabled={isCreating}
          onClick={onBack}
        >
          Back
        </Button>
      </div>
    </div>
  );
}
