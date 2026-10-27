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
    parts: 'its foundations, coursed walls with real door and window openings, string courses, battlements, turrets or towers and its roof, as the kit parts that match the real building',
    materials: 'the real stone or brick colours with a lighter trim stone, quiet per-block variation and darker mortar joints',
    stages: 'foundations, walls course by course, floors and terraces, battlements and turrets, upper storeys, roof and crown, each with an English and Chinese label',
    film: '40 seconds at 30 fps: the build in one rising orbit, then two close views, then a floodlit dusk view',
    interaction: 'play or pause the build, scrub it, jump to a stage, view presets, drag to orbit, zoom, a day-to-dusk light slider and reset',
    extraPrompt: '',
  },
  'zh-CN': {
    parts: '基础、带真实门窗洞口的砌筑墙体、腰线、雉堞、角塔或塔楼以及屋顶，选用与真实建筑相符的构件',
    materials: '真实的石材或砖色，配浅色饰面石，构件之间有细微差异，灰缝颜色较深',
    stages: '基础、逐层砌墙、楼面与平台、雉堞与角塔、上部楼层、屋顶与塔顶，每道工序配中英文名称',
    film: '40 秒、30 fps：先在一段上升环绕镜头中完成建造，再给两个近景，最后是泛光照亮的黄昏全景',
    interaction: '播放或暂停建造、拖动进度、跳到某道工序、预设视角、拖动环绕、缩放、从白昼到黄昏的光线滑块和重置',
    extraPrompt: '',
  },
}

/** Heading of the extra-instructions section (only added when extraPrompt is not blank). */
export const EXTRA_HEADING = { en: 'Extra instructions', 'zh-CN': '额外要求' }

export function msg(lang, key, vars = {}) {
  const text = (MESSAGES[lang] ?? MESSAGES.en)[key] ?? MESSAGES.en[key] ?? key
  return text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`))
}
