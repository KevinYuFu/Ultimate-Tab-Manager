// Premium entitlement gate. Premium unlocks the AI features (AI sorting on
// stash, and later AI naming). For now this is a stub that always returns true
// so the features are usable in development; it becomes a real subscription
// check once the premium/proxy backend exists.
export function hasPremium(): boolean {
  return true
}
