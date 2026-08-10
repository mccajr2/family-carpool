/** Mirrors schemas in `contracts/openapi.yaml`. */
export type Adult = {
  id: string
  email: string
  displayName: string | null
}

export type RequestAuthCodeResponse = {
  email: string
  expiresInSeconds: number
  devCode?: string
}

export type AuthSessionResponse = {
  accessToken: string
  tokenType: "Bearer"
  adult: Adult
}

export type FamilyRole = "ORGANIZER" | "CAREGIVER"

export type Kid = {
  id: string
  displayName: string
}

export type FamilyMember = {
  adultId: string
  email: string
  displayName: string | null
  role: FamilyRole
}

export type FamilyCircle = {
  id: string
  name: string | null
  role: FamilyRole
  members: FamilyMember[]
  kids: Kid[]
}

export type FamilyInvite = {
  code: string
}

export type CreateFamilyCircleRequest = {
  adultDisplayName: string
  name?: string | null
}

export type JoinFamilyCircleRequest = {
  code: string
  adultDisplayName?: string | null
}

export type ErrorResponse = {
  message: string
}
