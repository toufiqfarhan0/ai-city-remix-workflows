/** Version of this scene; posted to the embedding page with the ready message. */
export const VERSION = '0.2.0'
export const SLUG = 'manhattan-miniature'

export type QualityTier = 'high' | 'low'
export interface QualitySettings {
  /** Upper bound of the device pixel ratio. */
  pixelRatio: number
  shadowMap: number
}
export const QUALITY: Record<QualityTier, QualitySettings> = {
  high: { pixelRatio: 1.6, shadowMap: 2048 },
  low: { pixelRatio: 1, shadowMap: 1024 },
}

export function isLikelyMobile() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 600
}

/** Stable landmark ids, in the order of the landmark bar. Names and texts live in i18n/strings.json. */
export const LANDMARK_IDS = ['empire', 'chrysler', 'one-world', 'central-park', 'times-square', 'flatiron', 'rockefeller', 'vessel'] as const
export type LandmarkId = (typeof LANDMARK_IDS)[number]

/** strings.json key prefix of a landmark: 'one-world' → 'lmOneWorld'. */
export const landmarkKey = (id: LandmarkId) => `lm${id.replace(/(^|-)(\w)/g, (_, _d, c: string) => c.toUpperCase())}`
