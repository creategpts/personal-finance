// Category.type is 'income', 'expense', or an account-type key. Origin/destination
// eligibility is purely structural, so these stay pure predicates (no fetch needed):
//   origin  = income + every account type  = anything that isn't 'expense'
//   dest    = expense + every account type = anything that isn't 'income'
export const isFlow = (t: string) => t === 'income' || t === 'expense'
export const isAccount = (t: string) => !isFlow(t)
export const isOrigin = (t: string) => t !== 'expense'
export const isDestination = (t: string) => t !== 'income'
