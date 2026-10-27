import { parseParams, type Lang } from './lib/params.mjs'
import STRINGS from './i18n/strings.json'

export type Strings = (typeof STRINGS)['en']

/** URL parameters, parsed once at startup. */
export const params = parseParams(typeof window === 'undefined' ? '' : window.location.search)

export const lang: Lang = params.lang
export const t: Strings = STRINGS[lang]

/**
 * Debug-only starting viewpoint (?view=topdown|lower|midtown|vessel|…). Lab never passes it, and it
 * is ignored in capture mode so covers and checks always start from the default overview.
 */
export const view: string | null =
  typeof window === 'undefined' || params.capture ? null : new URLSearchParams(window.location.search).get('view')

/** Camera cuts instead of flights and an instant day/night switch; traffic keeps moving. */
export const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Downloads, pop-ups and fullscreen are blocked inside the Lab sandbox (embed, any iframe, or the
 * opaque-origin document served with `sandbox allow-scripts`). Those controls are hidden there.
 */
export const restricted =
  typeof window !== 'undefined' && (params.embed || window.parent !== window || window.origin === 'null')

if (typeof document !== 'undefined') {
  document.documentElement.lang = lang
  document.title = t.title
}
