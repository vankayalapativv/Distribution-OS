/**
 * Self-service password policy, enforced server-side on a password change:
 * at least 8 characters, with at least one letter and one digit. The mobile
 * change-password form mirrors this rule to drive its live checklist.
 */
export const PASSWORD_MIN_LENGTH = 8;

export function isAcceptablePassword(pw: string): boolean {
  return pw.length >= PASSWORD_MIN_LENGTH && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
}

export const PASSWORD_RULE_MESSAGE =
  "Password must be at least 8 characters and include a letter and a number.";
