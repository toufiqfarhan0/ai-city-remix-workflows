// CLI messages in English (default) and Simplified Chinese. `--lang en|zh-CN` (alias `zh`).

const MESSAGES = {
  en: {
    usageBuild: 'usage: node scripts/build-city.mjs <project-dir> [--colouring <building_attributes.csv>] [--victorian <footprints.gpkg>] [--lang en|zh-CN]',
    usageVoice: 'usage: node scripts/voice.mjs <project-dir> [--confirm] [--lang en|zh-CN]',
    usageFilm: 'usage: node scripts/film.mjs <project-dir> [--stills t1,t2] [--fps 30] [--chrome <path>] [--lang en|zh-CN]',
    usageCheck: 'usage: node scripts/check.mjs <project-dir> [--film] [--lang en|zh-CN]',
    storyProblems: 'story.json problems:',
    storyOk: ({ n, s }) => `story.json is valid: ${n} eras, about ${s} s`,
    overpassRetry: ({ url, code }) => `overpass busy (${code}) at ${url}, retrying`,
    overpassFailed: 'every Overpass mirror failed; try again later (footprints already fetched stay cached)',
    footprints: ({ n, tiles }) => `footprints: ${n} from ${tiles} tiles (© OpenStreetMap contributors)`,
    colouring: ({ n, dated }) => `Colouring records in the box: ${n}, with a year: ${dated}`,
    victorian: ({ n }) => `1890s footprints in the box: ${n}`,
    landmarkMiss: ({ name }) => `note: no footprint under landmark "${name}"; it is drawn as a marker only`,
    cityWritten: ({ n, dated, pct }) => `city.json: ${n} buildings, ${dated} with a recorded year (${pct}%)`,
    ground: ({ water, parks, roads }) => `ground: ${water} water areas, ${parks} parks, ${roads} streets (OpenFreeMap)`,
    missingCity: 'city.json is missing: run scripts/build-city.mjs first',
    voicePlan: ({ n, chars, usd, tool, voice }) => `narration: ${n} clips, ${chars} characters ≈ $${usd} (${tool}, voice ${voice})`,
    notConfirmed: 'Nothing generated. Re-run with --confirm to spend this.',
    voiceDone: ({ usd }) => `narration done, spent ≈ $${usd}`,
    noChrome: 'Google Chrome not found: pass --chrome <path> or set CHROME',
    stills: ({ s }) => `stills written (film is ${s} s)`,
    film: ({ s, n }) => `film.mp4 (${s} s, ${n} narration clips)`,
    playerErrors: 'player errors:',
    mixFailed: 'audio mix failed',
    checkOk: ({ s }) => `film.mp4 checks passed (${s} s)`,
    checkFailed: 'film.mp4 checks failed:',
  },
  'zh-CN': {
    usageBuild: '用法：node scripts/build-city.mjs <项目目录> [--colouring <building_attributes.csv>] [--victorian <轮廓.gpkg>] [--lang en|zh-CN]',
    usageVoice: '用法：node scripts/voice.mjs <项目目录> [--confirm] [--lang en|zh-CN]',
    usageFilm: '用法：node scripts/film.mjs <项目目录> [--stills t1,t2] [--fps 30] [--chrome <路径>] [--lang en|zh-CN]',
    usageCheck: '用法：node scripts/check.mjs <项目目录> [--film] [--lang en|zh-CN]',
    storyProblems: 'story.json 有以下问题：',
    storyOk: ({ n, s }) => `story.json 有效：${n} 个时代，约 ${s} 秒`,
    overpassRetry: ({ url, code }) => `Overpass 繁忙（${code}），${url}，重试中`,
    overpassFailed: '所有 Overpass 镜像都失败了，请稍后再试（已取到的轮廓保存在缓存里）',
    footprints: ({ n, tiles }) => `建筑轮廓：${n} 个，共 ${tiles} 块（© OpenStreetMap contributors）`,
    colouring: ({ n, dated }) => `范围内的 Colouring 记录：${n} 条，有年份的：${dated} 条`,
    victorian: ({ n }) => `范围内的 1890 年代轮廓：${n} 个`,
    landmarkMiss: ({ name }) => `提示：地标「${name}」下没有建筑轮廓，只画成标记`,
    cityWritten: ({ n, dated, pct }) => `city.json：${n} 栋建筑，其中 ${dated} 栋有记录的建成年份（${pct}%）`,
    ground: ({ water, parks, roads }) => `地面：水面 ${water} 块、公园 ${parks} 块、街道 ${roads} 条（OpenFreeMap）`,
    missingCity: '缺少 city.json：先运行 scripts/build-city.mjs',
    voicePlan: ({ n, chars, usd, tool, voice }) => `旁白：${n} 段，${chars} 个字符，约 $${usd}（${tool}，音色 ${voice}）`,
    notConfirmed: '未生成任何内容。加上 --confirm 重新运行才会产生这笔费用。',
    voiceDone: ({ usd }) => `旁白完成，花费约 $${usd}`,
    noChrome: '没有找到 Google Chrome：用 --chrome <路径> 或设置 CHROME',
    stills: ({ s }) => `静帧已写出（成片 ${s} 秒）`,
    film: ({ s, n }) => `film.mp4（${s} 秒，${n} 段旁白）`,
    playerErrors: '播放器报错：',
    mixFailed: '混音失败',
    checkOk: ({ s }) => `film.mp4 检查通过（${s} 秒）`,
    checkFailed: 'film.mp4 检查未通过：',
  },
}

export const MESSAGE_KEYS = Object.fromEntries(Object.entries(MESSAGES).map(([k, v]) => [k, Object.keys(v).sort()]))
export const normalizeLang = (v) => (v === 'zh' || v === 'zh-CN' ? 'zh-CN' : 'en')
export function langFromArgs(argv) { const i = argv.indexOf('--lang'); return normalizeLang(i >= 0 ? argv[i + 1] : undefined) }
export function messages(lang) {
  const dict = MESSAGES[normalizeLang(lang)]
  return (key, params = {}) => { const m = dict[key] ?? MESSAGES.en[key]; return typeof m === 'function' ? m(params) : m }
}
