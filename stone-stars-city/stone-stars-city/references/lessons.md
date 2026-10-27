# Details worth preserving

- The landmark owns the skyline. Houses, trees and clouds stay low and outside the clearance; a taller neighbour or a tree in front of the portals breaks the composition of every chapter.
- Close chapters need geometry that rewards a close look: layered arches, a rose window with petals and spokes, ribs and openings on the spires. A smooth cone keeps the outline but empties chapters 02 and 03.
- Camera anchors are world space and aim at the landmark's own features. When the landmark changes, move `views.facade` and `views.crown`; the old anchors point at empty air.
- Night needs both a darker sky palette and warm emissive windows. Changing the sky alone reads as a dim day; check lanterns on and off at light 1.
- Everything that moves (cars, walkers, wheels, clouds, fountain, finials) must be a function of the motion time. A per-frame increment makes the film depend on frame rate and breaks backward seeks.
- The film shows the HTML editorial layout around the canvas. Recording the bare canvas drops the chapter card and the journey bar.
- The score is decoded from bytes inside the page; do not load it with a URL, which the sample CSP blocks. The AudioContext must be created inside a click handler; the silent autoplay at load must not create it.
- The display serif is part of the look. Wait for the inlined fonts before the first frame so the film never shows a fallback face.
- On-screen film text stays English; Simplified Chinese strings cover the page in `?lang=zh-CN`.
