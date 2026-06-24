// Emails that get the Authority (municipal) role. Everyone else is a citizen.
// Edit this list to grant authority access.
const AUTHORITY_EMAILS = ["aditya18dev@gmail.com"];

export type Role = "authority" | "citizen";

export function roleForEmail(email: string | null | undefined): Role {
  if (email && AUTHORITY_EMAILS.includes(email.toLowerCase())) return "authority";
  return "citizen";
}
