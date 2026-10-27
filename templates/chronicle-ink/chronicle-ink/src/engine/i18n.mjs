// User-facing strings (CLI and reports) in en and zh-CN, plus locale formatters. Dependency-free.
//
// Rules: default `en`; `zh` (any case, also zh-Hans / zh_CN) -> `zh-CN`; anything else -> `en`.
// Both dictionaries must have exactly the same keys (tested).

export const LANGS = Object.freeze(['en', 'zh-CN'])
export const DEFAULT_LANG = 'en'

const USAGE_EN = `chronicle-ink: fact-checked, beat-synced ink-scroll knowledge films (120/150/180 s), drawn and scored
by code that your own Agent writes. No model API is called; the only cost is the Agent's tokens.
Usage:
  node scripts/chronicle.mjs <command> --project <dir> [options]
  node scripts/chronicle.mjs doctor
  node scripts/new-project.mjs --out <dir> [--topic <text>] [--qid Q…] [--film-lang <BCP-47>]
Commands:
  doctor | research | facts | script | timeline | music | scenes | render | check | report | all
Common options:
  --lang en|zh-CN    language of these CLI messages only (the film language is brief.lang, any BCP-47 tag)
  --offline          no network at all (research reuses cached sources)
  --fixture <id>     use a bundled fixture (assets/fixtures/<id>) for research, facts and script
  --segment <x>      render only: review window s1…s5 | opening | <section> | <start>-<end> | all
  --redo             run the stage again even when it is up to date
  --strict           failing quality checks exit 8
  --quality draft|final        encoder quality (default final; the canvas size never changes)
  --add-source <url> research only, repeatable (pages the Agent found with its own search)
  --source-file <f>  research only, repeatable: a page the Agent read itself (first line "source: <url>")
  --qid Q…           Wikidata item to use
  --reviewed facts,visuals,listening   report only
  --help             show this help
Exit codes: 0 ok/awaiting the Agent, 1 internal, 2 input or environment, 3 entity, 4 scene code,
5 public source, 6 fact gate, 7 local processing, 8 strict check, 9 script or plan.`
const USAGE_ZH = `chronicle-ink：事实已核对、卡点的水墨卷轴知识短片（120/150/180 秒），画面和音乐都由你自己的 Agent
写的代码绘制、合成。不调用任何模型 API，成本只有 Agent 自己的 token。
用法：
  node scripts/chronicle.mjs <命令> --project <目录> [选项]
  node scripts/chronicle.mjs doctor
  node scripts/new-project.mjs --out <目录> [--topic <题目>] [--qid Q…] [--film-lang <BCP-47>]
命令：
  doctor | research | facts | script | timeline | music | scenes | render | check | report | all
常用选项：
  --lang en|zh-CN    只决定本命令提示的语言（片子语言是 brief.lang，可以是任何 BCP-47 标签）
  --offline          完全不联网（research 复用已缓存的来源）
  --fixture <id>     用随包 fixture（assets/fixtures/<id>）代替 research、facts、script
  --segment <x>      只对 render：分段试片 s1…s5 | opening | <段落> | <开始>-<结束> | all
  --redo             阶段已是最新也重跑
  --strict           质检不通过时退出 8
  --quality draft|final        编码质量（默认 final；画布尺寸不变）
  --add-source <url> 只对 research，可重复（Agent 用自己的搜索找到的页面）
  --source-file <f>  只对 research，可重复：Agent 自己读过的页面（第一行 "source: <url>"）
  --qid Q…           指定 Wikidata 条目
  --reviewed facts,visuals,listening   只对 report
  --help             显示本帮助
退出码：0 完成/等待 Agent，1 内部错误，2 输入或环境，3 实体，4 场景代码，5 公开来源，
6 事实门，7 本地处理，8 严格质检，9 脚本或计划。`
const NEW_USAGE_EN = `Creates a chronicle-ink project folder with brief.json (outside the Skill folder).

Usage:
  node scripts/new-project.mjs --out <dir> [--topic <text>] [--qid Q…] [--seconds 120|150|180]
                               [--aspect 9:16|16:9] [--film-lang en|zh-CN] [--style ink|roman] [--lang en|zh-CN]

  --film-lang   language of the film (written to brief.lang; default en)
  --lang        language of these messages only (does not change the film)
  A topic or a QID is required.`

const NEW_USAGE_ZH = `创建 chronicle-ink 项目目录与 brief.json（必须在 Skill 目录之外）。

用法：
  node scripts/new-project.mjs --out <目录> [--topic <题目>] [--qid Q…] [--seconds 120|150|180]
                               [--aspect 9:16|16:9] [--film-lang en|zh-CN] [--style ink|roman] [--lang en|zh-CN]

  --film-lang   片子的语言（写入 brief.lang；默认 en）
  --lang        只决定这些提示的语言（不改变片子语言）
  题目和 QID 至少给一个。`

const en = {
  'cli.usage': USAGE_EN,
  'cli.lang_invalid': 'Unknown --lang "{lang}", using en.',
  'cli.error': 'error {code}: {message}',
  'cli.command_unavailable': 'Command "{command}" is not available in this build.',
  'cli.command_unknown': 'Unknown command "{command}". Run with --help.',
  'cli.command_required': 'A command is required. Run with --help.',

  'cli.stage_up_to_date': '[{stage}] up to date',
  'cli.fixture_brief_applied': 'fixture_brief_applied {fixture} ({changes})',
  'cli.awaiting': 'status: {status}',

  'new.usage': NEW_USAGE_EN,
  'new.created': 'Created {dir}/brief.json (film language {lang}, {seconds} s).',

  'doctor.title': 'chronicle-ink doctor',
  'doctor.node_ok': 'Node.js {version}',
  'doctor.node_old': 'Node.js {version}: rendering needs Node 22 or later (pure stages run on 18)',
  'doctor.tool_ok': '{name} {version}',
  'doctor.tool_old': '{name} {version} is older than {min}; render and check may fail',
  'doctor.tool_missing': '{name} not found (needed by render and check)',
  'doctor.chrome_ok': 'Chrome found',
  'doctor.chrome_missing': 'Chrome not found (needed by render; set CHROME to its path)',


  'warn.brief_lang_invalid': 'brief.json lang "{lang}" is not supported; using en.',

  'date.julian': '(Julian)',

  'warn.entity_locked_dominant': 'entity_locked_dominant {qid} (alternatives: {alternatives})',
  'warn.known_entities_missing': 'known_entities_missing: no known-entity table; labels are compared without aliases.',
  'warn.extract_truncated': 'extract_truncated: the 12-call extraction limit skipped {skipped}.',
  'warn.adapter_unparsed': 'adapter_unparsed:{publisher}: the response has an unexpected shape; no claims from it.',
  'warn.robots_disallowed': 'robots_disallowed:{host}: robots.txt forbids this URL; skipped.',
  'warn.fetch_blocked_private': 'fetch_blocked_private:{host}: the host resolves to a private address; skipped.',
  'warn.fetch_too_large': 'fetch_too_large:{host}: the response is larger than 2 MiB; skipped.',
  'warn.fetch_redirects': 'fetch_redirects:{host}: more than 3 redirects; skipped.',

  'err.internal_error': 'Unexpected internal error.',
  'err.drift': 'A Skill copy of the engine differs from the canonical source.',
  'err.brief_invalid': 'brief.json is missing, not valid JSON, or has an invalid field.',
  'err.seconds_invalid': 'seconds must be 120, 150 or 180.',
  'err.lang_both_unsupported': 'lang "both" is not supported yet; run once per language.',
  'err.flag_invalid': 'An option has an invalid value.',
  'err.project_inside_skill': 'The project folder must be outside the Skill folder.',
  'err.deps_missing': 'A required dependency is missing.',
  'err.stage_missing': 'A required earlier stage has not run.',
  'err.stage_stale': 'A required earlier stage is out of date; run it again first.',
  'err.offline_source_missing': 'A source is not cached and --offline forbids fetching it.',
  'err.fixture_unknown': 'Unknown fixture id.',
  'err.fixture_brief_conflict': 'brief.json sets values that conflict with fixture {fixture}: {fields}.',
  'err.project_locked': 'Another command holds the project lock ({command}, since {created_at}).',
  'err.agent_file_invalid': 'An Agent answer file is invalid.',
  'err.entity_not_found': 'No Wikidata item matches the topic.',
  'err.entity_ambiguous': 'Several Wikidata items match; pass --qid to choose one.',
  'err.entity_subject_mismatch': 'The Wikidata item does not match brief.subject.',
  'err.subject_undetermined': 'The subject type (person, landmark, animal, city) cannot be determined.',
  'err.research_failed': 'Wikidata is not available.',
  'err.claim_unverified': 'A narration line uses a claim that did not pass the cross-check.',
  'err.claim_unbound': 'A fact line is not bound to any claim.',
  'err.hedge_missing': 'A line about a disputed claim has no hedge.',
  'err.number_mismatch': 'A number in the narration differs from its claim.',
  'err.superlative_unbound': 'A superlative is not supported by a claim.',
  'err.quote_unsourced': 'A quotation has no verbatim source.',
  'err.entailment_failed': 'A line is not entailed by its claims.',
  'err.ffmpeg_missing': 'FFmpeg is not installed.',
  'err.hyperframes_failed': 'HyperFrames rendering failed.',
  'err.encode_failed': 'Encoding failed.',
  'err.mux_failed': 'Muxing failed.',
  'err.music_track_invalid': 'music/track.json is invalid (file under music/, start, title, by, credit, and a licence of public-domain, cc0, cc-by-3.0, cc-by-4.0 or generated).',
  'err.music_track_decode_failed': 'The music track could not be decoded.',
  'err.voice_invalid': 'voice/voice.json is invalid (lines with shot, text and a file under voice/, generated.model and credit).',
  'err.voice_mismatch': 'A narration line does not say its shot\'s caption; regenerate it from the caption text.',
  'err.voice_too_long': 'A narration clip runs into the next shot; shorten the caption or speed the voice up.',
  'err.voice_decode_failed': 'A narration clip could not be decoded.',
  'err.check_probe_failed': 'The film does not meet the format or layout checks.',
  'err.loudness_out_of_range': 'Loudness is outside the target range.',
  'err.sync_out_of_tolerance': 'Cuts or captions are out of sync.',
  'err.aigc_metadata_missing': 'The AIGC metadata is missing.',
  'err.script_invalid': 'script.json is invalid or does not match the brief.',
  'err.kp_count': 'The number of knowledge points is out of range.',
  'err.rehook_gap': 'Two re-hooks are more than 35 seconds apart.',
  'err.glyph_missing': 'The bundled font has no glyph for a character.',
  'err.caption_too_long': 'A caption is too long.',
  'err.portrait_forbidden': 'A keyframe would portray a living person.',
  'stage.research_done': '[research] {qid} {label}: {count} sources.',
  'stage.facts_done': '[facts] {claims} claims: {verified} verified, {single} single-source, {disputed} disputed, {rejected} rejected.',
  'stage.script_done': '[script] gate passed: {lines} claims bound, {units} {unit}.',
  'stage.render_done': '[render] {file}: {seconds} s render, {ms} ms per frame.',
  'stage.check_done': '[check] {film}: {passed} checks passed, {failed} failed.',
  'stage.report_done': '[report] out/report.json, out/report.en.html, out/report.zh-CN.html (not run: {missing}).',
  'report.title': 'chronicle report',
  'report.generated': 'Generated {date}',
  'report.engine': 'engine',
  'report.mode_real': 'real run',
  'report.mode_fixture': 'fixture sample',
  'report.mode_note_real': 'No film has been rendered yet.',
  'report.mode_note_fixture': 'Fixture sample: no media generated; human review: none.',
  'report.fixture_banner': 'Fixture sample: no media generated; human review: none.',
  'report.not_run': 'Not run',
  'report.not_run_hint': 'The {stage} stage has not run for this project. Run it with',
  'report.stale': 'Stale',
  'report.yes': 'yes',
  'report.no': 'no',
  'report.h_film': 'Film',
  'report.film_alt': 'Film: {title}',
  'report.sheet_alt': 'Contact sheet: one frame every 2 seconds',
  'report.joins_alt': 'Frames before and after every cut',
  'report.h_facts': 'Fact sheet',
  'report.entailment_self': 'Entailment self-checked by the authoring agent',
  'report.entity_line': 'Wikidata {qid}, lock rule {rule}, living: {living}, portrait policy: {portrait}.',
  'report.facts_counts': '{claims} claims; {rejected} rejected, {invalid} with invalid values, {excerpt} with excerpts not found in the source.',
  'report.col_claim': 'Claim',
  'report.col_status': 'Status',
  'report.col_value': 'Value',
  'report.col_sources': 'Sources and excerpts',
  'report.col_lines': 'Used by',
  'report.tier': 'tier {tier}',
  'report.status_verified': 'verified',
  'report.status_single-source': 'single source',
  'report.status_disputed': 'disputed',
  'report.status_rejected': 'rejected',
  'report.h_disputed': 'Disputed claims',
  'report.h_script': 'Narration script',
  'report.gate_line': 'Fact gate: {status}; entailment by {by}; {units} {unit}.',
  'report.col_line': 'Line',
  'report.col_text': 'Text',
  'report.col_claims': 'Claims',
  'report.h_beats': 'Beats and sections',
  'report.plan_line': '{bpm} BPM, {bars} bars, {seconds} s, {kp} knowledge points.',
  'report.bars_alt': 'Sections on the bar grid with re-hook markers',
  'report.col_time': 'Time',
  'report.h_music': 'Music',
  'report.h_visuals': 'Visual review',
  'report.h_checks': 'Quality checks',
  'report.col_check': 'Check',
  'report.col_result': 'Result',
  'report.col_details': 'Details',
  'report.result_pass': 'pass',
  'report.result_fail': 'fail',
  'report.result_skipped': 'skipped',
  'report.result_info': 'info',
  'report.h_spend': 'Spend and models',
  'report.h_compliance': 'Compliance',
  'report.c_badge': 'AIGC badge from {from} s to {to} s at the start of the film.',
  'report.c_end_card': 'End card with the AIGC label from {from} s to {to} s.',
  'report.c_end_card_none': 'End card: the timeline has not been compiled yet.',
  'report.c_metadata': 'Implicit label (MP4 metadata)',
  'report.c_not_rendered': 'written when the film is rendered',
  'report.c_portrait': 'No portrait of a living person (portrait policy: {policy}).',
  'report.c_map': 'Maps never show national or administrative borders.',
  'report.h_review': 'Human review',
  'report.review_facts': 'Facts',
  'report.review_visuals': 'Visuals',
  'report.review_listening': 'Listening',
  'report.reviewed': 'reviewed by a person',
  'report.not_reviewed': 'not reviewed',
  'report.review_note': 'These flags are set only with report --reviewed after a person has checked the film.',
  'report.h_warnings': 'Warnings',
  'new.next': "Next: node scripts/chronicle.mjs all --project {dir} (stops whenever the Agent has to write something; read AGENT_TASK.md)",
  'new.next_blank': "No topic yet: add \"topic\" or \"qid\" to {dir}/brief.json, or try the bundled sample: node scripts/chronicle.mjs all --project {dir} --fixture su-shi",
  'doctor.gpu_ignored': "render always uses the CPU path (--no-browser-gpu) so canvas output is identical on every machine",
  'doctor.cpus': "{cpus} CPUs: HyperFrames --workers {workers}",
  'doctor.no_models': "no model API, key or account is needed: the Agent writes everything, code draws and scores it",
  'err.scene_rejected': "scene code was rejected by the no-network / determinism scan; see the listed lines",
  'err.scene_missing': "a scene file is missing: write scenes/<name>.js (see AGENT_TASK.md)",
  'err.scene_error': "scene code threw in the browser",
  'err.sfx_out_of_sync': "an SFX onset is more than one frame away from its action",
  'err.review_missing': "work/review.json has no visual self-review for every segment",
  'err.rehook_missing': "a planned re-hook has no shot with rehook: true within one bar",
  'err.caption_too_fast': "the caption cannot be read in its shot; shorten it or give the shot more bars",
  'err.segment_invalid': "unknown --segment (use s1…s5, opening, a section id or <start>-<end>)",
  'stage.timeline_done': "[timeline] {shots} shots, {cues} SFX cues; segments: {segments}",
  'stage.music_done': "[music] theme rendered: {bpm} BPM, {bars} bars, {sections} sections (exact beat map)",
  'stage.scenes_done': "[scenes] {scenes} scenes for {shots} shots passed the scan; project written",
  'stage.segment_done': "[render] segment {segment} ({from}–{to} s) -> {file}; contact sheet {sheet}; picture {seconds} s ({ms} ms/frame)",
  'report.music_line': "Theme {theme}: {bpm} BPM, key of {key}, {bars} bars; code-synthesized (no music model).",
  'report.timeline_line': "{shots} shots, {captions} captions ({lang}, {dir}), {cards} cards; {cues} SFX cues ({normal} normal, {emphasis} emphasis, {climax} climax).",
  'report.render_line': "{width}×{height}, {fps} fps, CPU render {seconds} s ({ms} ms/frame, {workers} workers).",
  'report.scenes_line': "{count} scene files (Agent-written code); no-network / determinism scan: {scan}.",
  'report.review_none': "No visual self-review recorded yet (work/review.json).",
  'report.col_segment': "Segment",
  'report.col_rounds': "Rounds",
  'report.col_notes': "Findings and fixes",
  'report.col_shot': "Shot",
  'report.bars': "bars",
  'report.cost_line': "No model API was called (no image, voice, music, vision or LLM call). The only cost is the Agent's own tokens.",
  'report.c_commercial': "Visuals and music are produced by code; fonts are SIL OFL; facts keep their source licences",
}

const zh = {
  'cli.usage': USAGE_ZH,
  'cli.lang_invalid': '未知的 --lang「{lang}」，改用 en。',
  'cli.error': '错误 {code}：{message}',
  'cli.command_unavailable': '当前版本还没有命令「{command}」。',
  'cli.command_unknown': '未知命令「{command}」，请用 --help 查看。',
  'cli.command_required': '需要一个命令，请用 --help 查看。',

  'cli.stage_up_to_date': '[{stage}] 已是最新',
  'cli.fixture_brief_applied': 'fixture_brief_applied {fixture}（{changes}）',
  'cli.awaiting': '状态：{status}',

  'new.usage': NEW_USAGE_ZH,
  'new.created': '已创建 {dir}/brief.json（片子语言 {lang}，{seconds} 秒）。',

  'doctor.title': 'chronicle-ink 环境检查',
  'doctor.node_ok': 'Node.js {version}',
  'doctor.node_old': 'Node.js {version}：渲染需要 Node 22 或更高（纯逻辑阶段可在 18 上运行）',
  'doctor.tool_ok': '{name} {version}',
  'doctor.tool_old': '{name} {version} 低于 {min}，render 与 check 可能失败',
  'doctor.tool_missing': '没有找到 {name}（render 与 check 需要）',
  'doctor.chrome_ok': '已找到 Chrome',
  'doctor.chrome_missing': '没有找到 Chrome（render 需要；可用 CHROME 指定路径）',


  'warn.brief_lang_invalid': 'brief.json 的 lang「{lang}」不受支持，改用 en。',

  'date.julian': '（儒略历）',

  'warn.entity_locked_dominant': 'entity_locked_dominant {qid}（其他候选：{alternatives}）',
  'warn.known_entities_missing': 'known_entities_missing：没有已知实体表，比较标签时不使用别名。',
  'warn.extract_truncated': 'extract_truncated：全片 12 次抽取的上限跳过了 {skipped}。',
  'warn.adapter_unparsed': 'adapter_unparsed:{publisher}：响应结构不符合预期，不从中产出 claim。',
  'warn.robots_disallowed': 'robots_disallowed:{host}：robots.txt 禁止抓取该地址，已跳过。',
  'warn.fetch_blocked_private': 'fetch_blocked_private:{host}：主机解析到私网地址，已跳过。',
  'warn.fetch_too_large': 'fetch_too_large:{host}：响应超过 2 MiB，已跳过。',
  'warn.fetch_redirects': 'fetch_redirects:{host}：重定向超过 3 次，已跳过。',

  'err.internal_error': '未预期的内部错误。',
  'err.drift': 'Skill 里的引擎副本与规范源码不一致。',
  'err.brief_invalid': 'brief.json 缺失、不是合法 JSON，或有字段不合法。',
  'err.seconds_invalid': 'seconds 只能是 120、150 或 180。',
  'err.lang_both_unsupported': '暂不支持 lang「both」，请每种语言各跑一次。',
  'err.flag_invalid': '有选项的值不合法。',
  'err.project_inside_skill': '项目目录必须在 Skill 目录之外。',
  'err.deps_missing': '缺少必需的依赖。',
  'err.stage_missing': '必需的上游阶段还没有运行。',
  'err.stage_stale': '必需的上游阶段已过期，请先重跑它。',
  'err.offline_source_missing': '来源没有缓存，--offline 不允许抓取。',
  'err.fixture_unknown': '未知的 fixture。',
  'err.fixture_brief_conflict': 'brief.json 里的值与 fixture {fixture} 冲突：{fields}。',
  'err.project_locked': '另一个命令正持有项目锁（{command}，自 {created_at} 起）。',
  'err.agent_file_invalid': 'Agent 写的回答文件不合法。',
  'err.entity_not_found': '没有与题目匹配的 Wikidata 条目。',
  'err.entity_ambiguous': '有多个 Wikidata 条目匹配，请用 --qid 指定。',
  'err.entity_subject_mismatch': 'Wikidata 条目与 brief.subject 不符。',
  'err.subject_undetermined': '无法判断题材类型（人物、地标、动物）。',
  'err.research_failed': 'Wikidata 不可用。',
  'err.claim_unverified': '旁白用到了未通过交叉核对的 claim。',
  'err.claim_unbound': '事实句没有绑定任何 claim。',
  'err.hedge_missing': '涉及有争议 claim 的句子缺少限定语。',
  'err.number_mismatch': '旁白里的数字与 claim 不一致。',
  'err.superlative_unbound': '最高级说法没有 claim 支持。',
  'err.quote_unsourced': '引语没有逐字来源。',
  'err.entailment_failed': '句子不能由它的 claim 推出。',
  'err.ffmpeg_missing': '没有安装 FFmpeg。',
  'err.hyperframes_failed': 'HyperFrames 渲染失败。',
  'err.encode_failed': '编码失败。',
  'err.mux_failed': '混流失败。',
  'err.music_track_invalid': 'music/track.json 无效（文件须在 music/ 下，并有 start、title、by、credit，授权须为 public-domain、cc0、cc-by-3.0、cc-by-4.0 或 generated）。',
  'err.music_track_decode_failed': '音乐文件无法解码。',
  'err.voice_invalid': 'voice/voice.json 无效（每行要有 shot、text 和 voice/ 下的文件，并有 generated.model 与 credit）。',
  'err.voice_mismatch': '有一句旁白和所在镜头的字幕不一致；请按字幕原文重新生成。',
  'err.voice_too_long': '有一句旁白超出了所在镜头；请缩短字幕或加快语速。',
  'err.voice_decode_failed': '旁白音频无法解码。',
  'err.check_probe_failed': '成片未通过格式或版式检查。',
  'err.loudness_out_of_range': '响度超出目标范围。',
  'err.sync_out_of_tolerance': '切点或字幕不同步。',
  'err.aigc_metadata_missing': '缺少 AIGC 元数据。',
  'err.script_invalid': 'script.json 不合法或与 brief 不一致。',
  'err.kp_count': '知识点数量超出范围。',
  'err.rehook_gap': '两次再钩间隔超过 35 秒。',
  'err.glyph_missing': '随包字体缺少某个字的字形。',
  'err.caption_too_long': '字幕过长。',
  'err.portrait_forbidden': '关键帧会画出在世人物。',
  'stage.research_done': '[research] {qid} {label}：{count} 个来源。',
  'stage.facts_done': '[facts] {claims} 条 claim：已核实 {verified}，单一来源 {single}，有争议 {disputed}，已拒绝 {rejected}。',
  'stage.script_done': '[script] 事实门通过：绑定 {lines} 条 claim，{units} {unit}。',
  'stage.render_done': '[render] {file}：渲染 {seconds} 秒，每帧 {ms} 毫秒。',
  'stage.check_done': '[check] {film}：{passed} 项通过，{failed} 项未通过。',
  'stage.report_done': '[report] out/report.json、out/report.en.html、out/report.zh-CN.html（未运行：{missing}）。',
  'report.title': 'chronicle 报告',
  'report.generated': '生成于 {date}',
  'report.engine': '引擎',
  'report.mode_real': '真实运行',
  'report.mode_fixture': 'fixture 示例',
  'report.mode_note_real': '还没有渲染成片。',
  'report.mode_note_fixture': 'fixture 示例：未生成任何媒体；人工复核：无。',
  'report.fixture_banner': 'fixture 示例：未生成任何媒体；人工复核：无。',
  'report.not_run': '未运行',
  'report.not_run_hint': '本项目还没有运行 {stage} 阶段。运行方式：',
  'report.stale': '已过期',
  'report.yes': '是',
  'report.no': '否',
  'report.h_film': '成片',
  'report.film_alt': '成片：{title}',
  'report.sheet_alt': '拼图：每 2 秒一帧',
  'report.joins_alt': '每个切点前后的画面',
  'report.h_facts': '事实表',
  'report.entailment_self': '蕴含检查由写稿 Agent 自检',
  'report.entity_line': 'Wikidata {qid}，锁定规则 {rule}，在世：{living}，肖像规则：{portrait}。',
  'report.facts_counts': '共 {claims} 条 claim；已拒绝 {rejected}，值无效 {invalid}，摘录不在原文 {excerpt}。',
  'report.col_claim': 'Claim',
  'report.col_status': '状态',
  'report.col_value': '值',
  'report.col_sources': '来源与摘录',
  'report.col_lines': '引用句',
  'report.tier': '{tier} 级',
  'report.status_verified': '已核实',
  'report.status_single-source': '单一来源',
  'report.status_disputed': '有争议',
  'report.status_rejected': '已拒绝',
  'report.h_disputed': '有争议的 claim',
  'report.h_script': '旁白脚本',
  'report.gate_line': '事实门：{status}；蕴含检查：{by}；{units} {unit}。',
  'report.col_line': '句子',
  'report.col_text': '文本',
  'report.col_claims': 'Claim',
  'report.h_beats': '节拍与段落',
  'report.plan_line': '{bpm} BPM，{bars} 小节，{seconds} 秒，知识点 {kp} 个。',
  'report.bars_alt': '小节网格上的段落与再钩点',
  'report.col_time': '时间',
  'report.h_music': '音乐',
  'report.h_visuals': '视觉复核',
  'report.h_checks': '质检',
  'report.col_check': '检查项',
  'report.col_result': '结果',
  'report.col_details': '详情',
  'report.result_pass': '通过',
  'report.result_fail': '未通过',
  'report.result_skipped': '跳过',
  'report.result_info': '信息',
  'report.h_spend': '花费与模型',
  'report.h_compliance': '合规说明',
  'report.c_badge': '片头 {from}–{to} 秒有 AIGC 角标。',
  'report.c_end_card': '片尾卡（含 AIGC 标识）从 {from} 秒到 {to} 秒。',
  'report.c_end_card_none': '片尾卡：时间线还没有编译。',
  'report.c_metadata': '隐式标识（MP4 元数据）',
  'report.c_not_rendered': '渲染成片时写入',
  'report.c_portrait': '不画在世人物肖像（肖像规则：{policy}）。',
  'report.c_map': '地图不画国界和行政区划线。',
  'report.h_review': '人工复核',
  'report.review_facts': '事实',
  'report.review_visuals': '画面',
  'report.review_listening': '试听',
  'report.reviewed': '已由真人复核',
  'report.not_reviewed': '未复核',
  'report.review_note': '只有真人看过成片后，才用 report --reviewed 设置这些标记。',
  'report.h_warnings': '警告',
  'new.next': "下一步：node scripts/chronicle.mjs all --project {dir}（每当需要 Agent 写东西时会停下，读 AGENT_TASK.md）",
  'new.next_blank': "还没有题目：在 {dir}/brief.json 里填 \"topic\" 或 \"qid\"，或者先试随包样例：node scripts/chronicle.mjs all --project {dir} --fixture su-shi",
  'doctor.gpu_ignored': "render 总是走 CPU 路径（--no-browser-gpu），保证每台机器上的画布输出一致",
  'doctor.cpus': "{cpus} 个 CPU：HyperFrames --workers {workers}",
  'doctor.no_models': "不需要任何模型 API、key 或账号：所有写作由 Agent 完成，画面和音乐由代码生成",
  'err.scene_rejected': "场景代码没有通过禁网/确定性扫描，见列出的行",
  'err.scene_missing': "缺少场景文件：请写 scenes/<name>.js（见 AGENT_TASK.md）",
  'err.scene_error': "场景代码在浏览器里抛出了错误",
  'err.sfx_out_of_sync': "有音效的起音和动作相差超过一帧",
  'err.review_missing': "work/review.json 里没有覆盖每一段的画面自检",
  'err.rehook_missing': "计划的 re-hook 在一小节内没有 rehook: true 的镜头",
  'err.caption_too_fast': "这个镜头里读不完这条字幕：缩短字幕或给镜头更多小节",
  'err.segment_invalid': "未知的 --segment（可用 s1…s5、opening、段落名或 <开始>-<结束>）",
  'stage.timeline_done': "[timeline] {shots} 个镜头，{cues} 个音效点；分段：{segments}",
  'stage.music_done': "[music] 主题曲已合成：{bpm} BPM，{bars} 小节，{sections} 个段落（精确节拍图）",
  'stage.scenes_done': "[scenes] {scenes} 个场景（{shots} 个镜头）通过扫描，工程已写出",
  'stage.segment_done': "[render] 分段 {segment}（{from}–{to} 秒）-> {file}；联系表 {sheet}；画面渲染 {seconds} 秒（每帧 {ms} 毫秒）",
  'report.music_line': "主题曲 {theme}：{bpm} BPM，{key} 调，{bars} 小节；由代码合成（未用音乐模型）。",
  'report.timeline_line': "{shots} 个镜头，{captions} 条字幕（{lang}，{dir}），{cards} 张知识卡；{cues} 个音效点（普通 {normal}，强调 {emphasis}，高潮 {climax}）。",
  'report.render_line': "{width}×{height}，{fps} fps，CPU 渲染 {seconds} 秒（每帧 {ms} 毫秒，{workers} 个 worker）。",
  'report.scenes_line': "{count} 个场景文件（Agent 写的代码）；禁网/确定性扫描：{scan}。",
  'report.review_none': "还没有画面自检记录（work/review.json）。",
  'report.col_segment': "分段",
  'report.col_rounds': "轮次",
  'report.col_notes': "问题与修改",
  'report.col_shot': "镜头",
  'report.bars': "小节",
  'report.cost_line': "没有调用任何模型 API（没有图像、配音、音乐、视觉或 LLM 调用）。成本只有 Agent 自己的 token。",
  'report.c_commercial': "画面和音乐由代码生成；字体为 SIL OFL；事实与摘录沿用来源的许可",
}

export const DICTS = Object.freeze({ en: Object.freeze(en), 'zh-CN': Object.freeze(zh) })

/**
 * Normalises a language tag. `zh`, `zh-CN`, `zh-Hans`, `zh_cn` -> `zh-CN`; `en*` -> `en`;
 * missing or anything else -> `en` (calls `warn` for a non-empty invalid value).
 */
export function normalizeLang(value, { warn } = {}) {
  if (value == null || value === true || value === '') return DEFAULT_LANG
  const v = String(value).trim().replace(/_/g, '-').toLowerCase()
  if (v === 'zh' || v === 'zh-cn' || v === 'zh-hans' || v === 'zh-hans-cn') return 'zh-CN'
  if (v === 'en' || /^en-[a-z]{2}$/.test(v)) return 'en'
  if (typeof warn === 'function') warn(value)
  return DEFAULT_LANG
}

/** Looks up `key` in the dictionary of `lang` (falls back to en, then to the key) and fills `{var}`. */
export function t(lang, key, vars = {}) {
  const l = normalizeLang(lang)
  const text = DICTS[l][key] ?? DICTS.en[key] ?? key
  return text.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m))
}

const locale = (lang) => (normalizeLang(lang) === 'zh-CN' ? 'zh-CN' : 'en-US')

export function formatNumber(lang, n, options = {}) {
  return new Intl.NumberFormat(locale(lang), options).format(n)
}

/** USD amount. Two decimals by default; pass { maximumFractionDigits } for small per-call prices. */
export function formatCurrency(lang, usd, options = {}) {
  return new Intl.NumberFormat(locale(lang), { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2, ...options }).format(usd)
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/**
 * Year in astronomical numbering (0 = 1 BCE, -43 = 44 BCE).
 * en: `1037`, `44 BCE`; zh-CN: `1037 年`, `公元前 44 年`.
 */
export function formatYear(lang, year, { compact = false } = {}) {
  const zhCN = normalizeLang(lang) === 'zh-CN'
  const y = Number(year)
  if (!Number.isInteger(y)) throw new TypeError(`year must be an integer: ${year}`)
  const sp = compact ? '' : ' '
  if (y <= 0) return zhCN ? `公元前${sp}${1 - y}${sp}年` : `${1 - y} BCE`
  return zhCN ? `${y}${sp}年` : String(y)
}

/** Parses `YYYY`, `YYYY-MM`, `YYYY-MM-DD` with an optional sign (astronomical years). */
function parseDate(value) {
  let d
  if (value && typeof value === 'object') d = { year: value.year, month: value.month || null, day: value.day || null, calendar: value.calendar ?? 'gregorian' }
  else {
    const m = String(value).match(/^([+-]?\d{1,6})(?:-(\d{2})(?:-(\d{2}))?)?$/)
    if (!m) throw new TypeError(`unsupported date: ${value}`)
    // Wikidata-style `-00` month/day means "unknown" and is treated as absent.
    d = { year: Number(m[1]), month: Number(m[2] ?? 0) || null, day: Number(m[3] ?? 0) || null, calendar: 'gregorian' }
  }
  if (d.month != null && !(Number.isInteger(d.month) && d.month >= 1 && d.month <= 12)) throw new TypeError(`unsupported month: ${d.month}`)
  if (d.day != null && !(Number.isInteger(d.day) && d.day >= 1 && d.day <= 31)) throw new TypeError(`unsupported day: ${d.day}`)
  return d
}

/**
 * Formats a (possibly partial) date for structured-claim templates and reports.
 * `value`: `YYYY[-MM[-DD]]` (astronomical year, optional sign) or { year, month?, day?, calendar? }.
 * A Julian date gets a marker: en `8 January 1037 (Julian)`, zh-CN `1037 年 1 月 8 日（儒略历）`.
 * BCE: en `15 March 44 BCE`, zh-CN `公元前 44 年 3 月 15 日`.
 * `compact: true` drops the spaces of the zh-CN form (`1037年1月8日（儒略历）`), as used inside sentences.
 */
export function formatDate(lang, value, { compact = false } = {}) {
  const l = normalizeLang(lang)
  const { year, month, day, calendar } = parseDate(value)
  const y = formatYear(l, year, { compact })
  const sp = compact ? '' : ' '
  let text
  if (l === 'zh-CN') text = `${y}${month ? `${sp}${month}${sp}月` : ''}${month && day ? `${sp}${day}${sp}日` : ''}`
  else if (month && day) text = `${day} ${MONTHS_EN[month - 1]} ${y}`
  else if (month) text = `${MONTHS_EN[month - 1]} ${y}`
  else text = y
  if (calendar === 'julian') text += l === 'zh-CN' ? t(l, 'date.julian') : ` ${t(l, 'date.julian')}`
  return text
}
