// CLI messages of the app scripts (notices, inline-build, shoot, record) in English and Simplified
// Chinese. Zero dependencies: this folder is copied on its own by new-project. Check ids, rule ids,
// exit codes and JSON keys stay English; only the text shown to people is translated.

export const LANGS = ['en', 'zh-CN']

/** 'zh', 'zh-cn', 'zh_CN', 'zh-Hans' → 'zh-CN'; 'en' → 'en'; anything else → null. */
export function normLang(value) {
  const v = String(value ?? '').trim().toLowerCase().replace(/_/g, '-')
  if (v === 'zh' || v === 'zh-cn' || v === 'zh-hans') return 'zh-CN'
  if (v === 'en' || v === 'en-us' || v === 'en-gb') return 'en'
  return null
}

/**
 * Language for a CLI run: --lang <v> / --lang=<v>, then SCENE_LANG, then 'en'.
 * An invalid value falls back to 'en' and returns the raw value as `invalid`.
 */
export function resolveLang(argv = process.argv.slice(2), env = process.env) {
  let raw
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--lang') raw = argv[i + 1] ?? ''
    else if (argv[i].startsWith('--lang=')) raw = argv[i].slice('--lang='.length)
  }
  if (raw === undefined && env.SCENE_LANG !== undefined && env.SCENE_LANG !== '') raw = env.SCENE_LANG
  if (raw === undefined) return { lang: 'en', invalid: null }
  const lang = normLang(raw)
  return lang ? { lang, invalid: null } : { lang: 'en', invalid: raw }
}

/** argv without the --lang option (both forms). */
export function stripLang(argv) {
  const out = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--lang') i++
    else if (!argv[i].startsWith('--lang=')) out.push(argv[i])
  }
  return out
}

export const MESSAGES = {
  en: {
    langInvalid: 'Unknown language "{value}", using English.',
    noticesUsage: 'Usage: node scripts/notices.mjs <out-file> [--lang en|zh-CN]',
    noticesNoInstall: 'package-lock.json or node_modules is missing: run npm ci first.',
    noticesNoLicense: 'Package {pkg} has no licence file and no "license" field in its package.json.',
    noticesWrote: 'Wrote {file}: {count} packages.',
    inlineUsage: 'Usage: node scripts/inline-build.mjs <dist-dir> <out-file> [--lang en|zh-CN]',
    inlineViolations: 'The build cannot be inlined into one file:',
    inlineUnexpectedTag: 'unexpected tag: {tag}',
    inlineUnexpectedFile: 'unexpected file: {file}',
    inlineMissingScript: 'expected exactly one <script type="module" crossorigin src="./assets/….js">, found {count}',
    inlineMissingFile: 'missing file: {file}',
    inlineNoCharset: 'no <meta charset="UTF-8" /> inside <head> to place the notices after',
    inlineChecksFailed: 'The single file failed these checks: {ids}',
    inlineUtf8: 'The single file is not valid UTF-8.',
    inlineWrote: 'Wrote {file}: {bytes} bytes, sha256 {sha}',
    nodeTooOld: 'This script needs Node {need} or newer (found {have}).',
    chromeMissing: 'Chrome was not found at {path}. Pass --chrome <path> or set CHROME_PATH.',
    ffmpegMissing: 'ffmpeg was not found on PATH.',
    shootUsage: 'Usage: npm run shoot -- --file dist-single/index.html [--out shots] [--chrome <path>] [--lang en|zh-CN]',
    fileMissing: 'File not found: {file}',
    shootViewport: 'Viewport {size} ({lang}): landmarks, day and night, orbit, pan, zoom, reset…',
    shootCheckFailed: 'Check failed: {id} = {value}',
    shootDone: 'Verification {result}: {passed}/{total} checks passed. Report: {file}',
    resultPass: 'passed',
    resultFail: 'failed',
    recordReady: 'Scene ready, stepping {frames} frames of the cover timeline…',
    recordWrote: 'Wrote {file}',
    reportTitle: 'Manhattan Miniature: verification report',
    reportIntro: 'Headless Chrome run of the single-file build under the sandbox Content-Security-Policy.',
    reportSummaryOk: 'All checks passed.',
    reportSummaryFail: 'Some checks failed.',
    reportCheck: 'Check',
    reportResult: 'Result',
    reportValue: 'Value',
    reportPass: 'pass',
    reportFail: 'fail',
    reportFps: 'Frame rate (frames per second)',
    reportTier: 'Quality tier',
    reportMobile: 'Phone (touch, low tier)',
    reportViewport: 'Viewport',
    reportEnv: 'Environment',
    reportWhen: 'Checked at',
    reportChrome: 'Browser',
    reportNode: 'Node',
    reportShots: 'Screenshots are written next to report.json and are not part of this report.',
  },
  'zh-CN': {
    langInvalid: '未知语言“{value}”，改用英文。',
    noticesUsage: '用法：node scripts/notices.mjs <输出文件> [--lang en|zh-CN]',
    noticesNoInstall: '缺少 package-lock.json 或 node_modules：请先运行 npm ci。',
    noticesNoLicense: '依赖包 {pkg} 既没有许可证文件，package.json 里也没有 "license" 字段。',
    noticesWrote: '已写入 {file}：共 {count} 个依赖包。',
    inlineUsage: '用法：node scripts/inline-build.mjs <dist 目录> <输出文件> [--lang en|zh-CN]',
    inlineViolations: '构建产物无法合并成单个文件：',
    inlineUnexpectedTag: '多余的标签：{tag}',
    inlineUnexpectedFile: '多余的文件：{file}',
    inlineMissingScript: '应当恰好有一个 <script type="module" crossorigin src="./assets/….js">，实际找到 {count} 个',
    inlineMissingFile: '缺少文件：{file}',
    inlineNoCharset: '<head> 里没有 <meta charset="UTF-8" />，无法在其后放置第三方许可声明',
    inlineChecksFailed: '单文件没有通过这些检查：{ids}',
    inlineUtf8: '单文件不是有效的 UTF-8。',
    inlineWrote: '已写入 {file}：{bytes} 字节，sha256 {sha}',
    nodeTooOld: '这个脚本需要 Node {need} 或更高版本（当前是 {have}）。',
    chromeMissing: '在 {path} 没有找到 Chrome。请用 --chrome <路径> 指定，或设置 CHROME_PATH。',
    ffmpegMissing: 'PATH 里没有找到 ffmpeg。',
    shootUsage: '用法：npm run shoot -- --file dist-single/index.html [--out shots] [--chrome <路径>] [--lang en|zh-CN]',
    fileMissing: '找不到文件：{file}',
    shootViewport: '视口 {size}（{lang}）：地标、昼夜、环绕、平移、缩放、重置…',
    shootCheckFailed: '检查未通过：{id} = {value}',
    shootDone: '验证{result}：{passed}/{total} 项检查通过。报告：{file}',
    resultPass: '通过',
    resultFail: '未通过',
    recordReady: '场景已就绪，按封面时间线逐帧推进 {frames} 帧…',
    recordWrote: '已写入 {file}',
    reportTitle: '曼哈顿微缩城市：验证报告',
    reportIntro: '在沙盒内容安全策略（CSP）下，用无头 Chrome 运行单文件构建的结果。',
    reportSummaryOk: '全部检查通过。',
    reportSummaryFail: '有检查未通过。',
    reportCheck: '检查项',
    reportResult: '结果',
    reportValue: '数值',
    reportPass: '通过',
    reportFail: '未通过',
    reportFps: '帧率（每秒帧数）',
    reportTier: '画质档位',
    reportMobile: '手机（触屏，低画质）',
    reportViewport: '视口',
    reportEnv: '运行环境',
    reportWhen: '检查时间',
    reportChrome: '浏览器',
    reportNode: 'Node',
    reportShots: '截图保存在 report.json 旁边，不包含在这份报告里。',
  },
}

/** Localized message with {name} placeholders filled from `vars`. Missing keys fall back to English. */
export function msg(lang, key, vars = {}) {
  const table = MESSAGES[lang] ?? MESSAGES.en
  const text = table[key] ?? MESSAGES.en[key] ?? key
  return text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`))
}
