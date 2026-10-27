// Film timing, chapters, light stops and camera keyframes. Visible copy lives in src/i18n/strings.json.
// World coordinates use Y up; the landmark stands on the origin and faces +Z.
//
// The film is 24 s in four 6 s chapters: the whole island, the main facade, the crown, the island at
// night. Chapters 02 and 03 aim at the landmark's own camera anchors (landmark.views), so a new
// landmark only needs new anchors, not a new shot table.
export const duration = 24;
export const chapterLength = 6;
export const chapters = ['garden', 'facade', 'crown', 'stars'];

// One light value drives sky colour, sun, fill, fog, exposure and every warm window:
// 0 daylight, 1/3 golden hour, 2/3 blue hour, 1 starlight. The film moves from golden hour to
// starlight between 9 and 21 s.
export const lightStops = [['day', 0], ['golden', 1 / 3], ['blue', 2 / 3], ['stars', 1]];
export const filmLight = { from: 1 / 3, to: 1, start: 9, end: 21 };

// Island-wide views, shared by every landmark.
export const island = {
  target: [0, 10.7, 0],
  open: [54.85, 53, 75.13],
  approach: [48, 46, 72],
  night: [-43.7, 53, 81.8],
};

/** Camera keyframes of the film; segments ease with a quintic smoothstep. */
export function filmPoses(views) {
  return [
    { t: 0, p: island.open, aim: island.target },
    { t: 2, p: island.approach, aim: [0, 10, 2] },
    { t: 7, p: views.facade.from, aim: views.facade.target },
    { t: 10.8, p: views.facade.hold, aim: views.facade.target },
    { t: 15, p: views.crown.from, aim: views.crown.target },
    { t: 18.2, p: views.crown.hold, aim: views.crown.target },
    { t: 23, p: island.night, aim: island.target },
    { t: 24, p: island.night, aim: island.target },
  ];
}

/** Each chapter button: the framing { target, position } and the film time whose light it uses. */
export function chapterViews(views) {
  return {
    garden: { target: island.target, position: island.open, at: 0 },
    facade: { target: views.facade.target, position: views.facade.hold, at: 10.8 },
    crown: { target: views.crown.target, position: views.crown.hold, at: 18.2 },
    stars: { target: island.target, position: island.night, at: 23 },
  };
}
