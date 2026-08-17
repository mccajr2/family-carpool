/** Up to two letters from the first two words of a display name, else the email local-part. */
export function accountInitials(
  displayName: string | null | undefined,
  email: string,
): string {
  const words = displayName?.trim().split(/\s+/).filter(Boolean) ?? []
  if (words.length >= 2) {
    return `${letter(words[0])}${letter(words[1])}`
  }
  if (words.length === 1) {
    return letter(words[0])
  }
  const local = email.split("@")[0] ?? ""
  return letter(local)
}

export function humanizeCircleRole(role: string): string {
  if (role === "ORGANIZER") return "Organizer"
  if (role === "CAREGIVER") return "Caregiver"
  return role
}

function letter(word: string | undefined): string {
  const ch = word?.[0]
  return ch ? ch.toUpperCase() : ""
}
