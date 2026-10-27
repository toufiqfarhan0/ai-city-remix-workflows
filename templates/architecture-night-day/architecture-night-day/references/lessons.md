# Details worth preserving

- Large counts of repeated tiles, brackets, balusters, and carved details are practical with instancing. Replacing the roof with a smooth cone may preserve the outline but loses the sample's visual purpose.
- Detailed geometry needs correct bounds and culling. If distant detail is simplified interactively, keep close film frames stable and avoid detail popping during a shot.
- Blue glazed roofs, red timber, gold accents, and pale stone respond differently to night and day lighting. A sky color change alone is insufficient; fade warm fixtures and adjust the light balance together.
- Closeups must still reveal recognizable structure. Keep enough roof tiers or surrounding context to identify the selected building.
- World-space camera target offsets matter for the additional buildings. A camera that is correct around the origin can point at empty space elsewhere.
- The interaction bar needs its own layout space. Capturing a bare WebGL canvas drops HTML controls; render the full composition when the requested film includes the UI.
- The sample is silent by design. A reference movie having an audio track does not supply permission or evidence to reuse that soundtrack.
- Locally changing UI, camera data, or rendering does not consume SandBase model tokens. Preserve that distinction in the cost summary.
