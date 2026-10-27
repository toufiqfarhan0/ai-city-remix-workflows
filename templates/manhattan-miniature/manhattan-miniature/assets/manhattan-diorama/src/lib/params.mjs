// URL parameters of the scene. Pure functions (no DOM), shared by the app and the Node tests.

export const LANGS = ['en', 'zh-CN']

/** Maps a language tag to 'en' or 'zh-CN'. Aliases: zh, zh-cn, zh-hans, zh_CN (any case). Anything else is 'en'. */
export function normLang(value) {
  const s = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
  if (s === 'zh' || s === 'zh-cn' || s === 'zh-hans') return 'zh-CN'
  return 'en'
}

const flag = (v) => v === '1' || v === 'true'

/**
 * Parses a location.search string.
 * lang: en | zh-CN; embed=1 hides the title area; tune is parsed but unused here;
 * quality=low|high forces a tier; capture=1 switches to deterministic stepping.
 */
export function parseParams(search) {
  const q = new URLSearchParams(search ?? '')
  const quality = q.get('quality')
  return {
    lang: normLang(q.get('lang')),
    embed: flag(q.get('embed')),
    tune: flag(q.get('tune')),
    quality: quality === 'low' || quality === 'high' ? quality : null,
    capture: flag(q.get('capture')),
  }
}
