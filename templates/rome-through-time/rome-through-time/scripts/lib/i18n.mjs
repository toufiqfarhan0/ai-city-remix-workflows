// CLI messages and slot defaults of fill-prompt and new-project, in English and Simplified Chinese.
// English is the default; option names, slot keys and exit codes stay English.

export const LANGS = ['en', 'zh-CN']

/** 'zh', 'zh-cn', 'zh_CN', 'zh-Hans' → 'zh-CN'; 'en' → 'en'; anything else → null. */
export function normLang(value) {
  const v = String(value ?? '').trim().toLowerCase().replace(/_/g, '-')
  if (v === 'zh' || v === 'zh-cn' || v === 'zh-hans') return 'zh-CN'
  if (v === 'en' || v === 'en-us' || v === 'en-gb') return 'en'
  return null
}

/** --lang <v> / --lang=<v>; default 'en'; an invalid value falls back to 'en' and is returned as `invalid`. */
export function resolveLang(argv) {
  let raw
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--lang') raw = argv[i + 1] ?? ''
    else if (argv[i].startsWith('--lang=')) raw = argv[i].slice('--lang='.length)
  }
  if (raw === undefined) return { lang: 'en', invalid: null }
  const lang = normLang(raw)
  return lang ? { lang, invalid: null } : { lang: 'en', invalid: raw }
}

export const MESSAGES = {
  en: {
    langInvalid: 'Unknown language "{value}", using English.',
    fillUsage: 'Usage: node scripts/fill-prompt.mjs --slots <slots.json> [--lang en|zh-CN] [--out <file>]',
    slotsMissing: 'Slots file not found: {file}',
    slotsInvalidJson: 'The slots file is not valid JSON: {file}',
    slotsNotObject: 'The slots file must contain one JSON object.',
    slotsUnknown: 'Unknown slots: {keys}. Known slots: {known}.',
    slotNotString: 'Slot "{key}" must be a string.',
    slotTooLong: 'Slot "{key}" is longer than {max} characters.',
    slotRequired: 'Required slot "{key}" is missing or blank.',
    fillLeftover: 'Internal error: unfilled placeholders remain: {list}',
    fillWrote: 'Wrote the {lang} prompt to {file}.',
    newUsage: 'Usage: node scripts/new-project.mjs --out <dir> [--name <package-name>] [--lang en|zh-CN]',
    newNotEmpty: 'The folder {dir} exists and is not empty. Choose a new or empty folder.',
    newBadName: 'Invalid package name "{name}": use lowercase letters, digits and hyphens (up to 64 characters).',
    newIoError: 'Could not copy the project: {error}',
    newDone: 'Created {dir} ({files} files). Next: cd {dir} && npm ci && npm run dev',
  },
  'zh-CN': {
    langInvalid: '未知语言“{value}”，改用英文。',
    fillUsage: '用法：node scripts/fill-prompt.mjs --slots <slots.json> [--lang en|zh-CN] [--out <文件>]',
    slotsMissing: '找不到槽位文件：{file}',
    slotsInvalidJson: '槽位文件不是有效的 JSON：{file}',
    slotsNotObject: '槽位文件必须是一个 JSON 对象。',
    slotsUnknown: '未知槽位：{keys}。可用槽位：{known}。',
    slotNotString: '槽位“{key}”必须是字符串。',
    slotTooLong: '槽位“{key}”超过 {max} 个字符。',
    slotRequired: '必填槽位“{key}”缺失或为空。',
    fillLeftover: '内部错误：仍有未填的占位符：{list}',
    fillWrote: '已把 {lang} 提示词写入 {file}。',
    newUsage: '用法：node scripts/new-project.mjs --out <目录> [--name <包名>] [--lang en|zh-CN]',
    newNotEmpty: '目录 {dir} 已存在且不为空。请换一个新目录或空目录。',
    newBadName: '包名“{name}”无效：只能用小写字母、数字和连字符（最多 64 个字符）。',
    newIoError: '复制项目失败：{error}',
    newDone: '已创建 {dir}（{files} 个文件）。下一步：cd {dir} && npm ci && npm run dev',
  },
}

/** Default values of the optional slots, per language. */
export const SLOT_DEFAULTS = {
  en: {
    style: 'a warm, finely detailed museum-style miniature on a rounded relief base, with an ivory editorial interface and a serif title',
    camera: 'elevated three-quarter views that keep the landmark anchors framed, a gentle push-in and a final pullback held for two seconds',
    interaction: 'a continuous timeline slider, four era stops, play and pause, drag to orbit, zoom, reset and historical notes',
    extraPrompt: '',
  },
  'zh-CN': {
    style: '温暖、精细的博物馆式微缩模型，圆角浮雕底座，配象牙白杂志式界面和衬线标题',
    camera: '抬高的四分之三视角，始终框住地标锚点，轻微推近，最后拉远并停留两秒',
    interaction: '连续的时间轴滑块、四个时代节点、播放与暂停、拖动环绕、缩放、重置和历史说明',
    extraPrompt: '',
  },
}

/** Heading of the extra-instructions section (only added when extraPrompt is not blank). */
export const EXTRA_HEADING = { en: 'Extra instructions', 'zh-CN': '额外要求' }

export function msg(lang, key, vars = {}) {
  const text = (MESSAGES[lang] ?? MESSAGES.en)[key] ?? MESSAGES.en[key] ?? key
  return text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`))
}
