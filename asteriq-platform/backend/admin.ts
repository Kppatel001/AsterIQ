/**
 * Admin access configuration.
 * Add more admin emails here; Firestore rules must list the same
 * bootstrap emails (or have an admins/{uid} doc) for server-side enforcement.
 */
export const ADMIN_EMAILS = ["kartavyap43@gmail.com"];

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}
