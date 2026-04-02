export type WelcomeCardMode = 'guide' | 'copilots' | null

export function getHomeWelcomeCardMode(_params: {
  providerCount: number
  isLoggedIn: boolean
  hasLicense: boolean
}): WelcomeCardMode {
  return null
}
