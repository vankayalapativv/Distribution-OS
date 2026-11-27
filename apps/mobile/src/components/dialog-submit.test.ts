import { describe, expect, it } from "vitest";
import { deriveSubmitState } from "./dialog-submit";
import type { DialogState } from "./dialog-types";

const state = (over: Partial<DialogState> = {}): DialogState => ({ visible: true, title: "T", ...over });

describe("deriveSubmitState", () => {
  it("enables submit for a plain confirm (no input)", () => {
    const r = deriveSubmitState(state({ input: false }), "");
    expect(r.submitDisabled).toBe(false);
    expect(r.submitBg).toBe("bg-primary");
    expect(r.showLetterHint).toBe(false);
  });

  it("disables submit when a required prompt is blank", () => {
    const r = deriveSubmitState(state({ input: true, required: true }), "   ");
    expect(r.submitDisabled).toBe(true);
    expect(r.submitBg).toBe("bg-primary/40");
  });

  it("requires the minimum letter count and hints once typing", () => {
    const tooFew = deriveSubmitState(state({ input: true, minLetters: 3 }), "ab");
    expect(tooFew.submitDisabled).toBe(true);
    expect(tooFew.showLetterHint).toBe(true);
    expect(tooFew.needLetters).toBe(3);
    const enough = deriveSubmitState(state({ input: true, minLetters: 3 }), "abc");
    expect(enough.submitDisabled).toBe(false);
    expect(enough.showLetterHint).toBe(false);
  });

  it("does not hint while the field is still empty", () => {
    const r = deriveSubmitState(state({ input: true, minLetters: 2 }), "");
    expect(r.submitDisabled).toBe(true);
    expect(r.showLetterHint).toBe(false);
  });

  it("styles the primary button destructive when enabled", () => {
    const r = deriveSubmitState(state({ input: false, destructive: true }), "");
    expect(r.submitBg).toBe("bg-destructive");
  });
});
