// CLI messages and slot defaults of fill-prompt, new-project and bake-poster, in English and Simplified Chinese.
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
    bakeUsage: 'Usage: node scripts/bake-poster.mjs --center "lat,lon" --out <poster.json> [--radius 500-6000] [--title <text>] [--subtitle <text>] [--mark "lat,lon,Label"]... [--paths] [--english] [--kinds map,skyline,food,landmark] [--skyline-from south|north|east|west] [--landmark <name>]...',
    bakeRadius: 'The radius must be between 500 and 6000 metres (got {radius}).',
    bakeMark: 'A mark must be "lat,lon,Label" (got {mark}).',
    bakeMarks: 'Use at most five marks.',
    bakeLandmarks: 'Use at most four landmarks.',
    bakeLandmarkMissing: 'No outline named "{name}" was found in the box; check the exact mapped name.',
    bakeTiles: 'Downloading building heights and food places in {tiles} tiles (Overpass; dense centres can take several minutes)…',
    bakeTile: '  tile {done}/{total}',
    bakeWroteKinds: 'Skyline: {mapped} of {buildings} buildings have a mapped height. Food: {food} places. Landmarks: {landmarks}.',
    bakeWrote: 'Wrote {file}: {roads} road lines, {water} water features, {parks} parks ({kb} KB).',
    bakeOsm: 'Downloading roads, railways, water and parks around the centre (Overpass, can take a minute or two)…',
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
    bakeUsage: '用法：node scripts/bake-poster.mjs --center "纬度,经度" --out <poster.json> [--radius 500-6000] [--title <标题>] [--subtitle <副标题>] [--mark "纬度,经度,名称"]... [--paths] [--english] [--kinds map,skyline,food,landmark] [--skyline-from south|north|east|west] [--landmark <名称>]...',
    bakeRadius: '半径必须在 500 到 6000 米之间（收到 {radius}）。',
    bakeMark: '标记的格式必须是 "纬度,经度,名称"（收到 {mark}）。',
    bakeMarks: '标记最多五个。',
    bakeLandmarks: '地标最多四个。',
    bakeLandmarkMissing: '范围内没有找到名为“{name}”的轮廓，请核对地图上登记的准确名称。',
    bakeTiles: '正在分 {tiles} 块下载建筑高度和餐饮地点（Overpass；市中心密集区域可能需要几分钟）…',
    bakeTile: '  第 {done}/{total} 块',
    bakeWroteKinds: '天际线：{buildings} 栋建筑中有 {mapped} 栋登记了高度。美食：{food} 处。地标：{landmarks} 个。',
    bakeWrote: '已写入 {file}：{roads} 条道路线、{water} 处水域、{parks} 处公园（{kb} KB）。',
    bakeOsm: '正在下载中心周围的道路、铁路、水域和公园（Overpass，可能需要一两分钟）…',
    bakeService: '地图服务出错：{error}。稍等片刻后重新运行同一条命令；已完成的下载会被缓存。',
    newDone: '已创建 {dir}（{files} 个文件）。下一步：cd {dir} && npm ci && npm run dev',
  },
}

/** Default values of the optional slots, per language. */
export const SLOT_DEFAULTS = {
  en: {
    radius: '3 km around the centre (a square of about 6 by 6 km)',
    marks: 'no marked places',
    kinds: 'all four posters: the street map, the skyline seen from the south, the food map and the landmark posters',
    landmarks: 'no landmark posters (name up to four mapped buildings to add them)',
    themes: 'five themes: a dark one with white streets, a cream paper one with dark ink and a serif title, a blueprint, a dusky sunset and a light mint',
    type: 'the city name in widely spaced capitals, a short rule, the country or region, and the coordinates of the centre',
    film: '60 seconds at 30 fps: the street map draws outward from the centre, then a slanted wipe every six or seven seconds moves through the themes and poster kinds: the skyline rises, the food places spread out, each landmark outline draws itself, and it ends on a round map',
    interaction: 'play or pause the tour, poster kind tabs (map, skyline, food, landmark; the landmark tab again for the next landmark), theme swatches, poster format (3:4, 1:1, 16:9), full or round map, drag to pan, scroll or pinch to zoom, redraw the lines and show or hide the marks',
    extraPrompt: '',
  },
  'zh-CN': {
    radius: '以中心为圆心 3 公里（约 6×6 公里的正方形）',
    marks: '不标记地点',
    kinds: '四种海报都做：街道地图、从南面看的天际线、美食地图和地标海报',
    landmarks: '不做地标海报（最多写四个地图上登记的建筑名称即可加上）',
    themes: '五个主题：深色底白色街道、米色纸张配深色墨线和衬线标题、蓝图、暮色晚霞和浅薄荷色',
    type: '城市名用字距很宽的大写字母，下方一条短线、国家或地区，以及中心点坐标',
    film: '60 秒、30 fps：先由中心向外画出街道地图，之后每六七秒用一道斜向擦除切换主题和海报类型：天际线升起、美食地点向外铺开、地标轮廓逐笔画出，最后停在圆形地图',
    interaction: '播放或暂停导览、海报类型标签（地图、天际线、美食、地标；再点地标换下一个）、主题色块、海报尺寸（3:4、1:1、16:9）、完整或圆形地图、拖动平移、滚轮或双指缩放、重新绘制线条、显示或隐藏标记',
    extraPrompt: '',
  },
}
/** Heading of the extra-instructions section (only added when extraPrompt is not blank). */
export const EXTRA_HEADING = { en: 'Extra instructions', 'zh-CN': '额外要求' }

export function msg(lang, key, vars = {}) {
  const text = (MESSAGES[lang] ?? MESSAGES.en)[key] ?? MESSAGES.en[key] ?? key
  return text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`))
}
