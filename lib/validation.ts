/**
 * Form rules shared by the browser (inline hints) and the server (the real
 * check). Pure and dependency-free so it is safe to bundle into client code.
 */

export const PASSWORD_MIN_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isPlausibleEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

/** A message telling the person how to fix the email, or null when it is fine. */
export function emailProblem(value: string): string | null {
  const email = value.trim();
  if (!email) return "Enter your email address.";
  if (!isPlausibleEmail(email)) return "Enter a valid email address, like name@example.com.";
  return null;
}

export function passwordProblem(value: string): string | null {
  if (!value) return "Choose a password.";
  if (value.length < PASSWORD_MIN_LENGTH) {
    const missing = PASSWORD_MIN_LENGTH - value.length;
    return `Use at least ${PASSWORD_MIN_LENGTH} characters (${missing} more).`;
  }
  return null;
}
