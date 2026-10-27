// CLI messages in English (default) and Simplified Chinese. `--lang en|zh-CN` (alias `zh`);
// anything else falls back to English. Log event prefixes (warn:, note:, tiles:) stay English.

const MESSAGES = {
  en: {
    usageResolve: 'usage: node scripts/resolve.mjs <project-dir> [--lang en|zh-CN]',
    usageMedia: 'usage: node scripts/media.mjs <project-dir> [--confirm] [--lang en|zh-CN]',
    usageFilm: 'usage: node scripts/film.mjs <project-dir> [--stills t1,t2] [--fps 30] [--lang en|zh-CN]',
    storyProblems: 'story.json problems:',
    resolvedProblems: 'resolved story problems:',
    narrationPlan: ({ n, chars, usd, tool, voice }) => `narration: ${n} clips, ${chars} characters ≈ $${usd} (${tool}, voice ${voice})`,
    artPlan: ({ n, usd, tool }) => `illustrations: ${n} images ≈ $${usd} (${tool}, 1K)`,
    total: ({ usd }) => `estimated total ≈ $${usd}`,
    notConfirmed: 'Nothing generated. Re-run with --confirm to spend this.',
    spent: ({ usd }) => `done, spent ≈ $${usd}`,
    stills: ({ s }) => `stills written (film is ${s} s)`,
    filmSilent: ({ s }) => `film.mp4 (silent, ${s} s)`,
    film: ({ s, n }) => `film.mp4 (${s} s, ${n} narration clips)`,
    playerErrors: 'player errors:',
    mixFailed: 'audio mix failed',
  },
  'zh-CN': {
    usageResolve: '用法：node scripts/resolve.mjs <项目目录> [--lang en|zh-CN]',
    usageMedia: '用法：node scripts/media.mjs <项目目录> [--confirm] [--lang en|zh-CN]',
    usageFilm: '用法：node scripts/film.mjs <项目目录> [--stills t1,t2] [--fps 30] [--lang en|zh-CN]',
    storyProblems: 'story.json 有以下问题：',
    resolvedProblems: '解析后的故事有以下问题：',
    narrationPlan: ({ n, chars, usd, tool, voice }) => `旁白：${n} 段，${chars} 个字符，约 $${usd}（${tool}，音色 ${voice}）`,
    artPlan: ({ n, usd, tool }) => `插画：${n} 张，约 $${usd}（${tool}，1K）`,
    total: ({ usd }) => `预计合计约 $${usd}`,
    notConfirmed: '未生成任何内容。加上 --confirm 重新运行才会产生这笔费用。',
    spent: ({ usd }) => `完成，花费约 $${usd}`,
    stills: ({ s }) => `静帧已写出（成片 ${s} 秒）`,
    filmSilent: ({ s }) => `film.mp4（无声，${s} 秒）`,
    film: ({ s, n }) => `film.mp4（${s} 秒，${n} 段旁白）`,
    playerErrors: '播放器报错：',
    mixFailed: '混音失败',
  },
}

/** Normalises a locale: `zh` → `zh-CN`; unknown or missing → `en`. */
export function normalizeLang(v) {
  if (v === 'zh' || v === 'zh-CN') return 'zh-CN'
  return 'en'
}

/** Reads `--lang <v>` from argv. */
export function langFromArgs(argv) {
  const i = argv.indexOf('--lang')
  return normalizeLang(i >= 0 ? argv[i + 1] : undefined)
}

/** Returns t(key, params) for the language. */
export function messages(lang) {
  const dict = MESSAGES[normalizeLang(lang)]
  return (key, params = {}) => {
    const m = dict[key] ?? MESSAGES.en[key]
    return typeof m === 'function' ? m(params) : m
  }
}

export const MESSAGE_KEYS = { en: Object.keys(MESSAGES.en), 'zh-CN': Object.keys(MESSAGES['zh-CN']) }
