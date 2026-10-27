// Narrative templates (design §5.2): the nine sections, their music part, and the role each section
// plays for every subject × structure. Data only; the section order is fixed for every structure.

/** Section ids in film order = the sections of the series theme (audio/theme.mjs). */
export const SECTIONS = Object.freeze([
  Object.freeze({ id: 'intro', music: 'intro', role: 'hook' }),
  Object.freeze({ id: 'verse', music: 'verse', role: 'origin' }),
  Object.freeze({ id: 'build', music: 'build', role: 'turn' }),
  Object.freeze({ id: 'drop', music: 'drop', role: 'climax1' }),
  Object.freeze({ id: 'breakdown', music: 'breakdown', role: 'cost' }),
  Object.freeze({ id: 'build2', music: 'build', role: 'suspense' }),
  Object.freeze({ id: 'drop2', music: 'drop', role: 'climax2' }),
  Object.freeze({ id: 'outro', music: 'outro', role: 'echo' }),
])
export const SECTION_IDS = Object.freeze(SECTIONS.map((s) => s.id))

/** Structures per subject; the first one is the default (design §4). */
export const STRUCTURES = Object.freeze({
  person: Object.freeze(['arc']),
  landmark: Object.freeze(['time-travel']),
  animal: Object.freeze(['superpower', 'day', 'life']),
  city: Object.freeze(['life']),
})

/** Default structure of a subject (null for an unknown subject). */
export const defaultStructure = (subject) => STRUCTURES[subject]?.[0] ?? null

/** Whether a structure belongs to a subject. */
export const structureAllowed = (subject, structure) => !!STRUCTURES[subject]?.includes(structure)

const r = (en, zh) => Object.freeze({ en, 'zh-CN': zh })

/** What each section tells, per `<subject>/<structure>` (design §5.2 table). */
export const ROLE_TEXT = Object.freeze({
  'person/arc': Object.freeze({
    intro: r('the most striking moment or question', '最反差的瞬间/问题'),
    verse: r('origins: the era plus one concrete detail', '来处（时代 + 具体细节）'),
    build: r('the turn begins', '转折开始'),
    drop: r('the first high point', '第一次高光'),
    breakdown: r('cost and controversy (hedged when present)', '代价与争议（有就写，按 hedge 规则）'),
    build2: r('the suspense of a comeback', '再起的悬念'),
    drop2: r('the defining achievement', '代表成就（最高光）'),
    outro: r('the link to today, a closing line', '与今天的连接、金句'),
  }),
  'landmark/time-travel': Object.freeze({
    intro: r('today\'s panorama plus a curious question', '今日全景 + 冷知识问题'),
    verse: r('why it was built here', '为什么建在这里'),
    build: r('construction begins', '开始建造'),
    drop: r('the principle revealed (section or breakdown)', '原理揭晓（剖面/拆解）'),
    breakdown: r('fragility and loss', '脆弱与失去'),
    build2: r('"why is it still standing?"', '「为什么还没倒？」'),
    drop2: r('then and now', '今昔对比'),
    outro: r('echo', '回响'),
  }),
  'animal/superpower': Object.freeze({
    intro: r('the superpower on show', '展示超能力'),
    verse: r('habitat', '栖息地'),
    build: r('the challenge it meets', '遇到的挑战'),
    drop: r('the mechanism revealed', '机制揭晓'),
    breakdown: r('cost or predators', '代价或天敌'),
    build2: r('the suspense of its conservation status', '保护现状的悬念'),
    drop2: r('protection status and an astonishing fact', '保护等级与惊人事实'),
    outro: r('echo', '回响'),
  }),
  'animal/day': Object.freeze({
    intro: r('a moment before dawn', '黎明前的一个瞬间'),
    verse: r('dawn, waking up', '黎明、苏醒'),
    build: r('foraging', '觅食'),
    drop: r('the hunting or foraging climax', '捕食/觅食高潮'),
    breakdown: r('danger', '危险'),
    build2: r('dusk', '黄昏'),
    drop2: r('night', '夜晚'),
    outro: r('echo', '回响'),
  }),
  'city/life': Object.freeze({
    intro: r('the city today plus the question of its age', '今天的城市 + 它有多老的问题'),
    verse: r('birth: the river or site, the founding date, the name', '诞生：河流与地形、建城年代、名字由来'),
    build: r('growth begins: trade, roads, becoming a capital (map: the built-up area spreads)', '成长开始：商贸、道路、成为都城（地图：城区扩张）'),
    drop: r('the height of its first life, with a number (population, walls, area)', '第一次鼎盛，配一个数字（人口、城墙、面积）'),
    breakdown: r('scars: sack, fire, plague, war, a lost wall or river (hedged when disputed)', '伤痕：劫掠、大火、瘟疫、战争、消失的城墙或河道（有争议就 hedge）'),
    build2: r('the suspense of a rebirth', '重生的悬念'),
    drop2: r('today: the same map then and now', '今天：同一张地图的今昔'),
    outro: r('echo, optionally the author\'s line "me and this city"', '回响，可选作者的「我和这座城」'),
  }),
  'animal/life': Object.freeze({
    intro: r('the moment of birth', '出生的瞬间'),
    verse: r('birth and early life', '出生与幼年'),
    build: r('the trials of growing up', '成长的考验'),
    drop: r('the first migration or independence', '第一次迁徙或独立'),
    breakdown: r('cost and wear', '代价与损耗'),
    build2: r('the suspense of passing it on', '传承的悬念'),
    drop2: r('legacy', '传承'),
    outro: r('echo', '回响'),
  }),
})

/** Role table of a subject/structure, or null. */
export const rolesFor = (subject, structure) => ROLE_TEXT[`${subject}/${structure}`] ?? null
