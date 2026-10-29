import { reactive } from 'vue'
// Presentation state only; no draw, odds, stake or settlement is touched.
export const kickoff = reactive({ active: false, origin: null, home: true })
export function beginKickoff (origin, home) {
  if (kickoff.active) return false
  Object.assign(kickoff, { active: true, origin, home })
  return true
}
