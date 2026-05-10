import type { Renderers } from '../types'
import { createDefaultRenderers } from './defaults'

export function createRenderers(
  overrides?: Partial<Renderers>,
): Required<Renderers> {
  const defaults = createDefaultRenderers()
  if (!overrides) {
    return defaults
  }

  // Merge: for every key in defaults, if user provided override, use it, else default.
  const merged = { ...defaults }
  for (const key of Object.keys(defaults) as (keyof Required<Renderers>)[]) {
    if (overrides[key]) {
      merged[key] = overrides[key]!
    }
  }
  return merged
}
