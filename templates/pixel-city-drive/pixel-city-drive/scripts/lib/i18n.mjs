// CLI messages and slot defaults of fill-prompt, new-project and bake-route, in English and Simplified Chinese.
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
    bakeUsage: 'Usage: node scripts/bake-route.mjs --from "lat,lon" --to "lat,lon" [--via "lat,lon"]... --out <route.json> [--title <text>] [--english] [--pin <landmark>]... [--drive right|left] [--corridor 30-400] [--landmark-radius 100-2000]',
    bakeRoute: 'Routing the drive (OSRM)…',
    bakeDistance: 'Route: {km} km.',
    bakeTooLong: 'The route is {km} km; keep one drive under 30 km (split a longer trip into several).',
    bakeNoRoute: 'No drivable route connects these points. Move a point onto the road network or add a --via point.',
    bakeOsm: 'Downloading buildings, water, parks, bridges and landmarks along the route (Overpass, can take a minute)…',
    bakePiece: '  part {n}/{total}: {elements} map elements',
    bakeService: 'A map service failed: {error}. Wait a little and run the same command again; finished downloads are cached.',
    bakeWrote: 'Wrote {file}: {fronts} buildings, {landmarks} landmarks, {bridges} overhead bridges.',
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
    bakeUsage: '用法：node scripts/bake-route.mjs --from "纬度,经度" --to "纬度,经度" [--via "纬度,经度"]... --out <route.json> [--title <标题>] [--english] [--pin <landmark>]... [--drive right|left] [--corridor 30-400] [--landmark-radius 100-2000]',
    bakeRoute: '正在规划路线（OSRM）…',
    bakeDistance: '路线：{km} 公里。',
    bakeTooLong: '这条路线有 {km} 公里；单次驾驶请控制在 30 公里以内（较长的行程拆成几段）。',
    bakeNoRoute: '这些点之间没有可驾驶的路线。请把点移到道路上，或加一个 --via 途经点。',
    bakeOsm: '正在下载沿途的建筑、水域、公园、桥梁和地标（Overpass，可能需要一分钟）…',
    bakePiece: '  第 {n}/{total} 段：{elements} 个地图要素',
    bakeService: '地图服务出错：{error}。稍等片刻后重新运行同一条命令；已完成的下载会被缓存。',
    bakeWrote: '已写入 {file}：{fronts} 栋建筑、{landmarks} 个地标、{bridges} 座头顶的桥。',
    newDone: '已创建 {dir}（{files} 个文件）。下一步：cd {dir} && npm ci && npm run dev',
  },
}

/** Default values of the optional slots, per language. */
export const SLOT_DEFAULTS = {
  en: {
    landmarks: 'the best-known landmarks the bake finds within 650 m of the road, with one factual line each',
    look: 'warm pastel facades with tiled fronts on some terraces, paved sidewalks, street trees and a yellow car seen from behind',
    light: 'golden afternoon at the start, sunset in the middle, lit windows and floodlit landmarks by night at the end',
    film: '90 seconds at 30 fps, slowing down at each landmark and under any big bridge, with a short hold at the end',
    interaction: 'play or pause the tour, scrub the route, scroll or drag to change speed (reverse included), a time-of-day slider, jump to the next landmark and a route map',
    extraPrompt: '',
  },
  'zh-CN': {
    landmarks: '烘焙在道路 650 米内找到的知名地标，每个配一句事实介绍',
    look: '暖色粉彩立面，部分联排建筑贴瓷砖，铺装人行道、行道树，以及从后方看到的一辆黄色汽车',
    light: '开头是午后黄金时刻，中段日落，结尾入夜后窗户亮灯、地标泛光',
    film: '90 秒、30 fps，经过每个地标和大桥下方时减速，结尾短暂停留',
    interaction: '播放或暂停导览、拖动路线进度、滚动或拖动改变速度（可倒车）、时段滑块、跳到下一个地标和路线地图',
    extraPrompt: '',
  },
}

/** Heading of the extra-instructions section (only added when extraPrompt is not blank). */
export const EXTRA_HEADING = { en: 'Extra instructions', 'zh-CN': '额外要求' }

export function msg(lang, key, vars = {}) {
  const text = (MESSAGES[lang] ?? MESSAGES.en)[key] ?? MESSAGES.en[key] ?? key
  return text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`))
}
