// CLI messages and slot defaults of fill-prompt, new-project and bake-area, in English and Simplified Chinese.
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
    bakeUsage: 'Usage: node scripts/bake-area.mjs --bbox "south,west,north,east" --out <area.json> [--title <text>] [--english] [--pin <landmark>]... [--cell 1-5]',
    bakeTooBig: 'The box is {w} by {h} m; keep it under 3.5 km on each side.',
    bakeWroteArea: 'Wrote {file}: {buildings} buildings, {roads} roads, {landmarks} landmarks.',
    bakeOsm: 'Downloading buildings, roads, water, parks and landmarks in the box (Overpass, can take a minute or two)…',
    bakeService: 'A map service failed: {error}. Wait a little and run the same command again; finished downloads are cached.',
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
    bakeUsage: '用法：node scripts/bake-area.mjs --bbox "南,西,北,东" --out <area.json> [--title <标题>] [--english] [--pin <地标>]... [--cell 1-5]',
    bakeTooBig: '这个范围是 {w} × {h} 米；每边请控制在 3.5 公里以内。',
    bakeWroteArea: '已写入 {file}：{buildings} 栋建筑、{roads} 条道路、{landmarks} 个地标。',
    bakeOsm: '正在下载范围内的建筑、道路、水域、公园和地标（Overpass，可能需要一两分钟）…',
    bakeService: '地图服务出错：{error}。稍等片刻后重新运行同一条命令；已完成的下载会被缓存。',
    newDone: '已创建 {dir}（{files} 个文件）。下一步：cd {dir} && npm ci && npm run dev',
  },
}

/** Default values of the optional slots, per language. */
export const SLOT_DEFAULTS = {
  en: {
    landmarks: 'the best-known landmarks the bake finds in the box (tall towers, attractions, places of worship), with one factual line each',
    look: 'a palette per building type that suits the city, glass towers with floor bands, warm low-rises, green parks with trees, blue water with ripples, small cars on the main roads',
    light: 'clear day at the start, sunset through the middle, lit windows and street lamps by night at the end',
    film: '60 seconds at 30 fps: open on the whole area, fly to each landmark in turn while the view turns a quarter around the area, end on a wide night view',
    interaction: 'play or pause the tour, drag to pan, scroll or pinch to zoom, turn the view a quarter at a time, a time-of-day slider, jump to the next landmark and show or hide the labels',
    extraPrompt: '',
  },
  'zh-CN': {
    landmarks: '烘焙在范围内找到的知名地标（高楼、景点、宗教建筑），每个配一句事实介绍',
    look: '按建筑类型配一套贴合这座城市的颜色：玻璃高楼带楼层横纹，低层建筑用暖色，公园有绿地和树，水面是带波纹的蓝色，主路上有小汽车',
    light: '开头是晴朗白天，中段日落，结尾入夜后窗户亮灯、路灯点亮',
    film: '60 秒、30 fps：先俯瞰整个街区，再依次飞到每个地标，同时视角绕街区转四分之一圈，最后停在夜晚的全景',
    interaction: '播放或暂停导览、拖动平移、滚轮或双指缩放、每次旋转四分之一圈、时段滑块、跳到下一个地标、显示或隐藏标注',
    extraPrompt: '',
  },
}
/** Heading of the extra-instructions section (only added when extraPrompt is not blank). */
export const EXTRA_HEADING = { en: 'Extra instructions', 'zh-CN': '额外要求' }

export function msg(lang, key, vars = {}) {
  const text = (MESSAGES[lang] ?? MESSAGES.en)[key] ?? MESSAGES.en[key] ?? key
  return text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`))
}
