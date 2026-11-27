import type { DialogState } from "./dialog-types";

/**
 * Prompt validity + primary-button styling. `required` blocks blank; `minLetters`
 * additionally needs at least N alphabetic letters (numbers/spaces/symbols still
 * allowed alongside), so junk like "-", "NA" or "-----" can't satisfy it.
 */
export function deriveSubmitState(state: DialogState, value: string) {
  const needLetters = state.minLetters ?? 0;
  const letterCount = state.input ? (value.match(/\p{L}/gu) ?? []).length : 0;
  const tooFewLetters = state.input === true && needLetters > 0 && letterCount < needLetters;
  const blankRequired = state.input === true && state.required === true && value.trim() === "";
  const submitDisabled = blankRequired || tooFewLetters;

  let submitBg = "bg-primary";
  if (submitDisabled) submitBg = "bg-primary/40";
  else if (state.destructive) submitBg = "bg-destructive";

  return {
    submitDisabled,
    submitBg,
    needLetters,
    // Only nudge once they've started typing but haven't met the letter minimum.
    showLetterHint: tooFewLetters && value.trim() !== "",
  };
}
