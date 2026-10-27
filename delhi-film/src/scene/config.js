// Film timing, chapters, light stops and camera keyframes. Visible copy lives in src/i18n/strings.json.
// World coordinates use Y up; the landmark stands on the origin and faces +Z.
//
// 60-second film in four 15-second chapters: charbagh garden, red sandstone facade, marble crown, starlight sanctuary.
// Returns to the opening island camera position under starlight.
export const duration = 60;
export const chapterLength = 15;
export const chapters = ['garden', 'facade', 'crown', 'stars'];

// Light transition moves from golden hour to starlight between 22.5 and 52.5 s.
export const lightStops = [['day', 0], ['golden', 1 / 3], ['blue', 2 / 3], ['stars', 1]];
export const filmLight = { from: 1 / 3, to: 1, start: 22.5, end: 52.5 };

// Island-wide views: opening panorama and the starlight return view.
export const island = {
  target: [0, 8.5, 0],
  open: [54.85, 53, 75.13],
  approach: [46, 42, 68],
  night: [54.85, 53, 75.13],
};

/** Camera keyframes of the 60-second film; segments ease with a quintic smoothstep. */
export function filmPoses(views) {
  return [
    { t: 0, p: island.open, aim: island.target },
    { t: 5, p: island.approach, aim: [0, 7, 2] },
    { t: 17.5, p: views.facade.from, aim: views.facade.target },
    { t: 27, p: views.facade.hold, aim: views.facade.target },
    { t: 36, p: views.crown.from, aim: views.crown.target },
    { t: 44, p: views.crown.hold, aim: views.crown.target },
    { t: 56.5, p: island.open, aim: island.target },
    { t: 60, p: island.open, aim: island.target },
  ];
}

/** Each chapter button: the framing { target, position } and the film time whose light it uses. */
export function chapterViews(views) {
  return {
    garden: { target: island.target, position: island.open, at: 0 },
    facade: { target: views.facade.target, position: views.facade.hold, at: 27 },
    crown: { target: views.crown.target, position: views.crown.hold, at: 44 },
    stars: { target: island.target, position: island.open, at: 58 },
  };
}
