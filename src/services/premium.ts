import { hasApiKey } from './aiProvider'

// Premium entitlement gate. Premium unlocks the AI features (AI sorting on
// stash, and later AI naming). For now it's on whenever the build has an API
// key: dev builds do, the store build doesn't. It becomes a real subscription
// check once the premium/proxy backend exists.
export function hasPremium(): boolean {
  return hasApiKey()
}
