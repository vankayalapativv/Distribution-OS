"use client";

import { Button } from "@/components/ui/button";
import type { CreatedCredentials } from "./super-admin-types";

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
