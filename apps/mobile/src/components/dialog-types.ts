export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Primary button label. Default "OK". */
  confirmLabel?: string;
  /** Cancel label, or null for a single-button (info) dialog. Default "Cancel". */
  cancelLabel?: string | null;
  /** Style the primary button as a destructive (red) action. */
  destructive?: boolean;
}

/** A text-entry dialog — resolves with the entered string, or null if cancelled. */
export interface PromptOptions {
  title: string;
  message?: string;
  placeholder?: string;
  /** Primary button label. Default "Save". */
  confirmLabel?: string;
  /** Cancel label. Default "Cancel". */
  cancelLabel?: string;
  /** When true, the primary button stays disabled until non-blank text is entered. */
  required?: boolean;
  /** Require at least this many alphabetic letters (numbers/spaces/symbols still
   *  allowed alongside). Blocks junk like "-", "NA", "-----". Implies required. */
  minLetters?: number;
  /** Prefilled text. */
  defaultValue?: string;
  /** Style the primary (submit) button as destructive (red). */
  destructive?: boolean;
  /** Render a taller multi-line input. */
  multiline?: boolean;
  /** Keyboard type for the input (e.g. "number-pad" for an odometer reading). */
  keyboardType?: "default" | "number-pad" | "numeric" | "decimal-pad";
}

export interface DialogState extends ConfirmOptions {
  visible: boolean;
  /** Prompt mode: show a text input and resolve with the entered string. */
  input?: boolean;
  placeholder?: string;
  required?: boolean;
  minLetters?: number;
  multiline?: boolean;
  keyboardType?: "default" | "number-pad" | "numeric" | "decimal-pad";
}
