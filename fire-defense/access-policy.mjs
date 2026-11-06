// Match the employee hub's existing administrator identities; no new admin accounts.
export const ADMIN_EMAILS = ["mp1@firedefense.com", "302stang86@gmail.com", "wh1@firedefense.com"];
export function canPlay(user, profile) {
  if (!user || user.isAnonymous) return false;
  const email=String(user.email || '').toLowerCase();
  const admin=ADMIN_EMAILS.includes(email);
  if (!admin && email.split('@')[1] !== 'firedefense.com') return false;
  return admin || profile?.role === 'admin' || profile?.status === 'approved';
}
