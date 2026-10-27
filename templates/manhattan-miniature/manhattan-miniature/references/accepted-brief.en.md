# Manhattan Miniature — Complete Project Build & Reproduction Prompt

> A reusable English prompt for building the interactive Manhattan Miniature web application. This document covers the application itself: urban planning, procedural architecture, landmarks, environment, branding, interface, camera interaction, lighting, performance, and validation.
>
> It does not request a video, recording workflow, or prerecorded animation.

## How to Use

Give this entire document to a development agent with access to a code workspace, terminal, and browser. Adjust the configuration below before starting. Choose `new` to build the project from scratch, or `upgrade` to improve an existing implementation.

The intended output is a working real-time 3D website with complete source code, documentation, and screenshots of the actual application.

---

# Reusable Execution Prompt

## 1. Your Role and Objective

You are a senior creative developer, Three.js/WebGL engineer, procedural architecture engineer, and interactive experience designer.

Build a premium, colorful, highly detailed, real-time miniature interpretation of Manhattan, New York City, for **SandBase Lab’s AI City Remix** campaign.

Campaign tagline:

**Pick a City. Let AI Tell Its Story.**

The experience should feel like an interactive architectural collectible: a carefully crafted Manhattan diorama that users can rotate, zoom into, pan across, explore through landmark navigation, and transform between day and night.

The result must be recognizable as Manhattan before the user reads any labels. At close range, it should reveal meaningful architectural and street-level details.

Implement the application, run it, inspect the actual rendered scene, fix visible problems, and deliver a complete runnable project. Do not stop at a plan, mockup, static illustration, or untested code.

### Project Configuration

```yaml
project_name: Manhattan Miniature
campaign: AI City Remix
brand: SandBase Lab
campaign_tagline: Pick a City. Let AI Tell Its Story.
mode: new                         # new / upgrade
project_directory: ./manhattan    # Replace with the existing directory when upgrading
preferred_local_url: http://127.0.0.1:5173/
output_directory: ./outputs
interface_language: en
ai_provider: SandBase
ai_model: minimax/minimax-m3.1-flash
reference_images: []               # Attach references if available
publish_site: false                # Build and preview locally by default
```

Treat paths and ports as configurable values. Do not assume another machine has the original project’s absolute paths, running processes, or credentials.

### Execution Modes

- **New project:** Inspect the workspace, establish the application foundation, and implement the complete experience described below.
- **Existing project:** Audit the current source and rendered output. Preserve successful architecture, branding, interface components, and interactions. Improve the application incrementally rather than rebuilding it unnecessarily.

Ask only for information or permissions that are actually required and cannot be discovered from the workspace. Continue independent work while resolving missing inputs.

## 2. Non-Negotiable Principles

1. Build an actual interactive 3D web application. Do not substitute a static image, generated clip, or prerecorded scene for the city.
2. Give buildings genuine geometric identities. Changing the height and color of the same rectangular box does not constitute architectural diversity.
3. Plan streets first, derive coherent blocks and parcels, and then place buildings. Do not scatter buildings and cut roads into disconnected fragments afterward.
4. Every building must belong to a defined parcel or reserved landmark site. Every block must have a meaningful street or pedestrian boundary and access.
5. Geographic compression is acceptable; random landmark placement is not. Describe the result honestly as a stylized interpretation rather than an accurate geographic reconstruction.
6. Major landmarks must be recognizable through their modeled silhouettes and details, not only through labels.
7. Night mode must change the actual scene lighting, environment, and material emissions. A dark overlay is insufficient.
8. Preserve a controlled, vibrant palette and a clean miniature aesthetic. Avoid both a washed-out beige skyline and an arbitrary rainbow toy city.
9. Validate actual rendering and behavior. Do not report planned features, assumed performance, or fabricated checks as completed work.

## 3. Initial Audit and References

Before implementation:

- Read applicable repository instructions and inspect dependencies, startup commands, and existing changes.
- Identify the scene setup, building generators, landmark models, road graph, traffic, materials, camera controls, day/night state, and React interface.
- If upgrading, preserve a recoverable baseline and capture existing overview, top-down, Lower Manhattan, and night screenshots.
- Confirm the real local development address. Avoid starting multiple confusing development servers simply because a preferred port is occupied.
- Inspect reference images if supplied. If none are attached, proceed from this specification and available authoritative references; do not pretend to have seen missing images.
- Use public planning maps and official landmark references to establish approximate relationships and architectural characteristics.

Useful starting references:

- SandBase campaign and visual identity: <https://www.sandbase.ai/lab/contests/city-life#ct-demos>
- NYC Lower Manhattan Pedestrianization Study: <https://www.nyc.gov/assets/planning/download/pdf/plans/transportation/td_fulllowermanhattan.pdf>
- NYC Lower Manhattan district map: <https://zr.planning.nyc.gov/print/pdf/node/18484>
- Official Vessel reference: <https://www.hudsonyardsnewyork.com/discover/vessel>

If a reference is unavailable, find a suitable authoritative replacement and document the source actually used. Respect asset licensing and attribution requirements.

## 4. SandBase and AI-Assisted Development

Use **MiniMax M3.1 Flash through SandBase** to assist development.

The intended model is **M3.1 Flash**, not the earlier mistaken name “H3.1 Flash.” The model identifier above is the project’s intended configuration, but you must inspect the currently available capability and input schema before calling it.

Requirements:

- Prefer the existing authenticated SandBase tools or the project’s securely configured server-side integration.
- Verify the model identifier, callable capability name, parameter schema, and pricing before execution.
- Do not silently switch models or providers.
- Never expose API credentials in client-side code, logs, screenshots, commits, or deliverable archives.
- If authentication or the requested model cannot be verified, report the specific missing configuration. Continue local work that does not depend on it where practical.
- Use the model for substantive assistance such as architectural rules, procedural geometry, planning checks, or test design.
- Inspect and validate AI suggestions. Reject incorrect proportions, geography, geometry, or code rather than integrating them unquestioningly.
- Keep usage efficient and document meaningful adopted suggestions and review decisions.
- The completed application must render locally without an LLM request on every frame.
- Do not use paid media-generation services as a substitute for implementing the application.

## 5. Visual Direction and Diorama Presentation

### Overall Look

Create a polished architectural miniature that combines:

- A museum-quality city model.
- A premium stylized city-building game.
- Detailed architectural visualization.
- A playful but recognizable interpretation of New York City.

Use clean geometry, dimensional facades, soft shadows, warm daylight, restrained reflections, readable materials, and carefully distributed color.

The skyline should have strong visual hierarchy. Streets, parks, water, and buildings must remain distinguishable from both aerial and closer architectural views.

Avoid primitive low-detail silhouettes, excessive bloom, harsh shadows, overexposure, or visual clutter that hides the urban structure.

### Display Platform

Place the city on a refined tabletop-style base with rounded or beveled edges, visible thickness, and soft grounding shadows.

Surround the Manhattan landmass with stylized river water. Clearly separate water, shorelines, roads, sidewalks, parks, and building foundations through elevation and material treatment.

The default camera should reveal the complete miniature, surrounding water, and platform while keeping the city large enough to appreciate.

## 6. Geographic Structure and Neighborhood Identity

Use compressed geography while preserving plausible relationships:

- **Central Park:** A large continuous green space in the northern portion of the miniature.
- **Midtown:** A more regular street grid, recognizable skyscrapers, and commercial density.
- **SoHo / Tribeca:** Lower historic masonry buildings, storefronts, and warmer materials.
- **Financial District:** Dense mixed-period architecture near the southern end, with narrower and more irregular streets.
- **Battery Park:** An intentional southern green space.
- **Hudson Yards:** A modern district on the West Side, near the compressed equivalent of West 34th Street and the Empire State area.
- **Waterfronts:** The Hudson and East River sides, with plausible promenades, piers, docks, and bridge placement.

Do not distribute landmarks randomly, place every tall building together, or position Vessel in the Financial District.

## 7. Road-First Urban Planning

### Recommended Data Model

Adapt the implementation to the existing codebase, but represent these concepts explicitly:

```text
StreetNetwork
  Junctions, traversable edges, street widths, names, intersections, signals.

CityBlock
  Actual boundary, neighborhood identity, street or pedestrian access.

BuildingParcel
  Parent block, footprint, orientation, setbacks, height constraints.

NeighborhoodProfile
  Architectural distribution, density, height range, materials, palette.

LandmarkPlacement
  Reserved site, actual geometric envelope, access, viewing requirements.

PublicSpace
  Parks, plazas, pedestrian areas, planting, street furniture.

Waterfront
  Shorelines, promenades, docks, bridge connections, boat routes.
```

### Required Planning Order

1. Establish the island outline, major parks, waterfront space, and reserved landmark sites.
2. Build connected street corridors and shared intersection nodes.
3. Form city blocks from street and pedestrian boundaries.
4. Subdivide blocks into suitable parcels.
5. Assign neighborhood-specific building types and heights.
6. Generate buildings and environmental details.
7. Check actual geometry, including overhangs and street widths, for conflicts.

### Midtown Street Network

Create recognizable parallel avenues and cross streets, consistent intersections, different street widths, sidewalks, and coherent blocks.

Local adjustments around compressed landmark sites are acceptable. The district should still read as an organized grid rather than a web of arbitrary diagonal detours.

### Lower Manhattan Street Network

Use irregular intersections, angled corridors, narrow historic streets, different block shapes, and small intentional pedestrian spaces.

Draw approximate relationships from:

- Broadway.
- Church Street.
- West Street.
- Water Street.
- Fulton Street.
- Wall Street.
- Broad Street.

Do not simply extend the Midtown rectangular grid to the southern tip.

### Connectivity and Road Geometry

- The principal road network must form one connected component.
- Every intended crossing must be split into a shared graph junction.
- Use the same graph for road construction and vehicle navigation.
- Include asphalt, lane markings, curbs, sidewalks, crosswalks, traffic signals, and streetlights.
- Align markings, crossings, signals, and vehicles with actual street directions, including diagonal streets.
- Do not let curb or sidewalk geometry block intersections.
- Explicitly distinguish vehicle streets, pedestrian routes, plazas, and intentional dead ends.
- Handle short edges and turns safely; stop distances must not create negative vehicle positions or backward jumps.

### Density and Empty Space

Lower Manhattan should feel like a coherent, densely developed district rather than isolated landmark towers separated by unfinished ground.

Use narrow commercial parcels, mid-rise masonry buildings, Art Deco buildings, modern offices, and smaller historic structures within defined blocks.

Preserve legitimate parks, landmark forecourts, public plazas, and waterfronts. Give open areas an intentional purpose instead of filling them indiscriminately.

A carefully modeled scene of roughly a hundred structures is a useful scale reference, not a mandatory quota. Do not sacrifice spatial coherence or performance to match a fixed object count.

## 8. Ordinary Architecture: At Least Ten Distinct Archetypes

Implement genuinely different geometric families, ideally with at least two recognizable variants per family. Avoid placing identical templates next to each other.

| Archetype | Required visual identity |
|---|---|
| Art Deco office towers | Multiple setbacks, vertical piers, narrow windows, decorative crowns. |
| Prewar residential buildings | Recessed windows, brick or stone, cornices, corner details, water tanks. |
| Contemporary glass towers | Faceted or tapered massing, curtain-wall structure, glass variation, mechanical tops. |
| Historic commercial buildings | Larger display windows, ornamental masonry, retail bases, varied rooflines. |
| Luxury residential towers | Slender proportions, balconies, terraces, glass-and-stone combinations. |
| Classic NYC brick buildings | Red or brown brick, fire escapes, dimensional window frames, parapets, water towers. |
| Terraced buildings | Stepped volumes, planted setbacks, rooftop gardens, material transitions. |
| Corner buildings | Wedge, angled, or curved corners, distinctive entrances, street-facing retail. |
| Mid-century office buildings | Dark glazing, aluminum or bronze grids, strong facade rhythm, flat equipment roofs. |
| Contemporary sculptural buildings | Asymmetry, cantilevers, sloping facades, unusual but plausible roof structures. |

Each family needs its own massing and facade rules. Relabeling the same box is not acceptable.

### Neighborhood Distribution

Use warmer, lower masonry forms in historic districts; taller commercial forms in Midtown; modern glass and metallic architecture around Hudson Yards; and a dense mixture of historic and contemporary buildings in the Financial District.

Vary heights meaningfully. Introduce lower buildings between towers and maintain visible streets and landmark silhouettes.

### Architectural Detail

Assign details appropriately by building type:

- Recessed glazing, frames, sills, and facade divisions.
- Entrances, shopfronts, awnings, and signage.
- Cornices, parapets, decorative piers, and setbacks.
- Rooftop water tanks, HVAC, access structures, antennas, terraces, and planting.
- Fire escapes where architecturally appropriate.

Repeated windows may use instanced thin surfaces, but important facade divisions, roof forms, setbacks, and architectural features need actual geometric depth.

Do not create an individual expensive object or light for every window.

## 9. Dedicated Landmark Models

Create dedicated components or geometry generators for major landmarks. Do not derive them solely from the ordinary building generator.

| Landmark | Essential identifying features |
|---|---|
| Empire State Building | Limestone Art Deco facade, strong vertical rhythm, multiple setbacks, observation structure, narrowing upper tower, detailed spire. |
| Chrysler Building | Stainless-steel tiered crown, curved pointed-arch patterns, triangular panels, dimensional openings or recesses, characteristic setbacks, slender spire. |
| One World Trade Center | Broad square base, tapering faceted tower, triangular glass surfaces, distinctive antenna. |
| Flatiron Building | Triangular wedge footprint, narrow slightly rounded prow, classical window rows, horizontal cornices. |
| Rockefeller Center | Slender limestone slab, stepped terraces, recognizable upper massing. |
| One Vanderbilt | Contemporary glass body, upper taper, distinctive top. |
| 40 Wall Street | Warm stone, Art Deco setbacks, slender upper tower, green copper pyramidal roof. |
| 70 Pine Street | Fine-grained setbacks, ornate crown, lantern-like upper structure, long spire distinct from 40 Wall Street. |
| Woolworth Building | Neo-Gothic pointed arches, pinnacles or buttresses, ornamental stone depth, green copper roof. |
| 56 Leonard Street | Offset glass floor plates, cantilevered balconies, irregular stacked volumes, asymmetrical silhouette. |
| Times Square district | Actual commercial architecture, colorful illuminated signs, surrounding streets and intersections. |
| Central Park | Continuous greenery, clustered trees, lawns, winding paths, water features. |

Preserve plausible relative locations. Do not cluster all new Lower Manhattan landmarks immediately beside One World Trade Center.

Support recognizable skyline views while maintaining surrounding urban density. Do not excavate large empty areas merely to expose landmark models.

## 10. Vessel and Hudson Yards Plaza

Build a dedicated, recognizable **Vessel — Hudson Yards** model on Manhattan’s West Side near the compressed 34th Street area.

### Structure

- A copper or bronze structure that widens upward.
- Multiple staggered levels with radial symmetry.
- Repeated platforms and interconnected stair flights.
- Clearly readable six-sided or honeycomb-like openings.
- An open central void with visible interior depth from above.
- Actual stair treads, landings, structural thickness, and restrained railing details.
- Modular procedural geometry and instanced repeated components.
- Reflective metallic materials with controlled roughness.

It must not resemble a solid tower, a plain cylinder, or a texture wrapped around a closed volume.

Check stair proportions, landing connections, upper and lower radii, and silhouette against authoritative references. Do not adopt implausible AI-generated dimensions without review.

### Surroundings

Provide an open paved plaza with planting, small trees, benches, and a limited number of nearby modern glass towers.

Keep the central structure visible and give it breathing room. Do not crowd it with unrelated buildings.

### Interaction

Add Vessel as the eighth landmark navigation item. Selecting it must activate the real selected state, open an information card, and smoothly frame the complete structure. Users must be able to orbit around it afterward.

Suggested information-card text:

> An iconic honeycomb-like architectural landmark featuring interconnected stairways.

## 11. Controlled Color and Material System

Use a rich architectural palette distributed by neighborhood and building type.

| Category | Suggested colors |
|---|---|
| Historic masonry | Terracotta `#C96B4B`, brick red `#A84E3B`, sandstone `#D8B88A`, warm limestone `#E9D9B5`. |
| Copper and roofs | Oxidized copper `#5C9B85`, warm bronze, restrained metallic brown. |
| Contemporary glazing | Sky blue `#72B9D3`, deep teal `#3D8C98`, steel blue `#6489A6`. |
| Metal and trim | Warm silver `#BFC8CC`, champagne gold `#D9B875`. |
| Residential and retail | Coral `#D98570`, muted peach `#E7B09A`, warm cream `#F1DCC2`, dusty rose `#C98E93`, ochre `#D9AA63`. |

Treat these as a coordinated direction, not a requirement to use every swatch.

Create richness through combinations of facade materials, roof treatments, glazing, frames, and trim. Vary roughness and metalness appropriately.

Avoid pure-white dominance, uniformly pale-blue windows, arbitrary saturated primary colors, and lighting that washes away the material palette.

## 12. Street Life and Environmental Detail

### Vehicles and Pedestrians

Include recognizable miniature yellow taxis, ordinary cars, buses, and small delivery trucks.

Vehicles should follow the road graph, turn coherently, react to signals, and avoid buildings. At night, show appropriate headlights, taillights, and restrained light pools.

Add small stylized pedestrians with varied clothing and subtle walking motion on valid sidewalks, park paths, and public spaces.

Maintain a charming, moderate activity level rather than simulating constant congestion.

### Street Furniture

Place appropriately scaled streetlights, signals, street signs, hydrants, bus shelters, benches, bins, tree pits, and shop entrances.

Use instancing for repeated elements. Keep furniture out of vehicle lanes and essential pedestrian connections.

### Central Park

The park must read as a substantial urban landscape, not a small formal garden.

Include:

- Natural clusters of varied tree species, heights, and canopy forms.
- Open lawns and deliberate visual breathing space.
- Curving connected pedestrian paths and entrances.
- Benches and lighting positioned to serve those paths.
- Irregular shoreline geometry rather than only an oval pond.
- A small bridge at a suitable narrow crossing, connected to paths at both ends.
- Grass-color variation, shrubs, and restrained landscape relief.

Avoid identical trees in evenly spaced rows or covering every open lawn with vegetation.

### Water and Waterfront

Preserve elegant blue-green river water with gentle animated ripples, directional highlights, and subtle reflection cues.

Add low-profile shoreline treatment, promenades, docks, piers, bollards, and a few recognizable boats such as ferries, water taxis, or recreational craft.

Animate boats slowly on valid river routes with restrained wakes. Keep them clear of land and bridge structures.

### Bridges

Model plausible decks, railings, towers, structural beams, suspension details where appropriate, and a little vehicle movement.

Do not label a bridge as Brooklyn Bridge unless both its form and approximate location support that identification. Unnamed stylized bridges are acceptable when geographic compression prevents a faithful representation.

## 13. Day and Night Systems

### Day Mode

Use a light sky or pale blue-gray environment, warm sunlight, soft shadows, readable facade detail, vibrant greenery, and blue-green water.

Glass should have clear highlights without turning the city into an overexposed white model.

### Night Mode

Create a genuinely different scene through:

- A deep navy sky and changed environment lighting.
- Reduced daylight and appropriate cool ambient fill.
- Warm windows with believable variation and some unlit rooms.
- Commercial signs, streetlights, and landmark accents.
- Visible but restrained vehicle lighting.
- Subtle water highlights and waterfront light cues.

Maintain recognizable silhouettes and readable detail. Avoid excessive bloom or uniform yellow illumination across every building.

### Transition and State Synchronization

Use one coherent application state for the selected Day/Night button and scene lighting.

Animate sunlight, ambient light, sky, environment, emissions, and water treatment over approximately 1.5–3 seconds. The interface and scene must agree about the active mode.

Do not simulate night with a black overlay or leave daytime lighting accidentally active.

## 14. SandBase Branding and Interface

For an existing project, preserve the established interface. For a new build, reproduce this visual hierarchy:

- Top-left brand: official SandBase symbol, **SandBase / LAB** wordmark, and **AI CITY REMIX** campaign label.
- Left-side eyebrow: **NEW YORK, REIMAGINED**.
- Main title on two lines: **Manhattan** / **in miniature.**
- Supporting text: **A little island. An extraordinary city.**
- Exploration label: **Explore New York in 3D**.
- Campaign tagline: **Pick a City. Let AI Tell Its Story.**
- Top-right controls: Day, Night, Auto Rotate, Reset View.
- Additional controls: Zoom in, Zoom out, Save screenshot, Fullscreen.
- Bottom landmark navigation and interaction hints.

Interaction hint:

**Drag to rotate · Scroll to zoom · Right-click to pan**

Use the official brand resource when available, or a faithful lightweight vector treatment based on the verified reference. Do not stretch the mark or replace it with an unrelated invented icon.

The UI should have restrained translucent panels, soft corners, elegant typography, subtle hover states, and generous but purposeful spacing.

Keep brand text, labels, controls, and information cards readable in both lighting modes. A dark wordmark must not disappear into the night background.

Do not expose debug controls or implementation jargon in the product interface.

### Landmark Navigation Order

1. Empire State.
2. Chrysler Building.
3. One World Trade.
4. Central Park.
5. Times Square.
6. Flatiron Building.
7. Rockefeller Center.
8. Vessel — Hudson Yards.

Every selection must synchronize the actual selected button, concise information card, and camera target. Allow the card to be closed and the overview to be restored.

### Responsive Layout

Ensure controls remain inside the viewport and are usable at narrower widths. Landmark navigation may scroll or reflow appropriately. Avoid clipping text, inaccessible controls, or overflow outside the screen.

## 15. Camera Interaction, Safety, and Composition

Use OrbitControls or an equivalent controller with smooth damping.

Required behavior:

- Full 360-degree horizontal rotation.
- Useful elevated and architectural viewing angles.
- Scroll-to-zoom and dedicated zoom controls.
- Right-click pan; keyboard pan where appropriate.
- Auto-rotate that can be stopped reliably.
- Smooth landmark focus and reset transitions.
- Close inspection without entering buildings or going below the ground.
- Manual interaction that can interrupt an automated focus transition.

Manage minimum distance, near clipping, polar limits, ground constraints, and collision handling. When moving between distant landmarks, use a safe path above the skyline where necessary rather than flying through towers.

Clear or consume residual OrbitControls damping before programmatic travel so the camera and target do not drift after reaching the intended endpoint.

Reset must clear the selected landmark, stop auto-rotation, close the relevant card, and accurately restore the original overview.

### UI-Safe Framing

Place the city within the screen area available to the right of the large title in the default desktop view.

Retain the complete island and display platform without shrinking the city excessively. Use responsive projection offsets, target adjustment, and sensible camera distance where appropriate.

Check projected model bounds against the title, top controls, viewport edges, and bottom navigation. Important spires and bases should remain visible in landmark views.

Camera collision safety does not guarantee visibility: inspect the actual line of sight so another building does not hide the selected subject.

## 16. Technical Architecture and Performance

For a new project, prefer **React + TypeScript + Three.js + Vite**. React Three Fiber and Drei are optional. Do not migrate a working project simply to change frameworks.

Separate responsibilities into clear modules for urban planning, archetypes, dedicated landmarks, environment, traffic, camera safety, lighting, and React UI.

Use:

- Seeded procedural generation for repeatable layouts.
- Instanced meshes for repeated objects.
- Shared materials and geometry.
- Compatible static-geometry merging.
- Distance-based detail reduction for windows, equipment, and small street objects.
- Appropriate frustum culling and LOD.
- Controlled pixel ratio and shadow quality.
- Efficient shadow updates and animation loops.
- Proper disposal of GPU resources, controls, observers, and event listeners.

Do not rebuild the entire scene every frame, create thousands of independent lights, or allocate expensive geometry for every repeated window.

Target approximately 60 FPS on a modern desktop with graceful quality reduction where necessary. Report measured performance with viewport and device context; do not present the target as an achieved result.

Prioritize recognizable landmarks, coherent streets, and visible architectural detail over distant micro-detail when optimizing.

## 17. Implementation Sequence

Follow this dependency order:

1. Audit the workspace, establish a baseline, and confirm SandBase configuration.
2. Establish the island, public spaces, geographic relationships, and reserved landmark sites.
3. Build the connected road graph, intersections, blocks, and building parcels.
4. Implement the ten architectural families and dedicated landmark models.
5. Establish neighborhood density and build Vessel with its Hudson Yards plaza.
6. Add streetscape furniture, vehicles, pedestrians, storefronts, and rooftop details.
7. Improve parks, water, piers, boats, and bridges.
8. Refine materials, palette, day/night lighting, branding, and camera composition.
9. Optimize rendering and resource handling.
10. Run meaningful checks, inspect the real browser output, fix problems, and deliver.

Keep the application runnable through the process. Produce visible, reviewable progress rather than accumulating an untested implementation until the end.

## 18. Validation Requirements

### Automated or Programmatic Checks

Cover meaningful properties, including:

- Road-network connectivity and reachability.
- Shared junctions at all intended geometric crossings.
- Parcel containment within actual block boundaries.
- Non-overlapping parcels and building geometry.
- Clearance between full-width roads and building envelopes, including overhangs.
- Reserved landmark sites with meaningful street or pedestrian access.
- No floating buildings, invalid transforms, NaN values, or obvious intersections.
- Genuine geometric diversity between architectural families and dedicated landmarks.
- An open Vessel center and plausible widening-upward structure.
- Consistency between traffic paths, road geometry, and signal logic.
- Safe camera motion and useful projected landmark framing.
- Actual day/night material changes and synchronized UI state.
- Appropriate cleanup of resources and event listeners.

Do not satisfy checks merely by adding metadata, counting labels, or writing tests that only restate the implementation.

### Actual Browser Review

Run the application and inspect the real rendered result. Check console errors and exercise normal interactions.

Capture and review:

1. Full daytime city overview.
2. Full top-down view clearly showing connected streets and coherent blocks.
3. Lower Manhattan close-up.
4. Midtown close-up.
5. Individual views of 40 Wall Street, 70 Pine Street, Woolworth, and 56 Leonard.
6. Vessel from an isometric angle, a second side, and above.
7. Central Park.
8. Street-level and waterfront details.
9. Full nighttime city overview.
10. Before-and-after comparison when upgrading an existing implementation.

Test all eight landmark buttons, real information cards, zoom, pan, drag rotation, auto-rotation, reset, Day/Night, screenshot, fullscreen, and responsive layout.

Fix visible broken roads, unexplained empty areas, hidden landmarks, intersections, lighting problems, or UI overlap before declaring completion.

## 19. Final Deliverables

Provide the following in the configured output directory:

- Complete runnable source code and dependency manifests.
- Clear installation, startup, build, and test instructions.
- The actual working local preview address.
- Secure SandBase configuration instructions without credentials.
- A concise explanation of the architecture and important technical decisions.
- References and asset attribution actually used.
- A record of meaningful AI assistance and validation decisions.
- Implemented features, geographic compression, measured performance, and known limitations.
- Actual application screenshots covering the required views.
- A before-and-after comparison if upgrading.
- A downloadable project archive when useful, excluding credentials, `node_modules`, and unnecessary temporary files.

The final response should identify completed and verified work, link to the runnable project and deliverables, and disclose any unresolved issue specifically.

Do not include media production as a deliverable for this task. The requested product is the interactive city application.

## 20. Acceptance Checklist

- [ ] The result is a real-time interactive 3D Manhattan web application.
- [ ] The city has a premium, colorful architectural-diorama aesthetic.
- [ ] Midtown, Lower Manhattan, SoHo / Tribeca, Hudson Yards, and Central Park have distinct identities.
- [ ] The street network is genuinely connected.
- [ ] Midtown reads as a grid, while Lower Manhattan contains coherent irregular streets and blocks.
- [ ] Buildings occupy meaningful parcels, with no large unexplained urban gaps.
- [ ] At least ten ordinary architectural families differ in actual geometry.
- [ ] Adjacent buildings do not mechanically repeat the same model.
- [ ] Dedicated landmarks have recognizable silhouettes and characteristic details.
- [ ] Vessel is an open honeycomb staircase structure on the West Side and is accessible from navigation item eight.
- [ ] Central Park includes natural planting, lawns, winding paths, irregular water, and a connected small bridge.
- [ ] Streets, rooftops, vehicles, pedestrians, boats, and waterfront structures contain appropriately scaled detail.
- [ ] Materials and color remain vibrant, controlled, and readable.
- [ ] Day and night are distinct scene states with smooth transitions.
- [ ] Branding and interface remain readable in both modes.
- [ ] Default framing respects the left-side title without making the city excessively small.
- [ ] Camera exploration and all required controls have been tested.
- [ ] Actual geometry, rendering, and performance have been checked.
- [ ] Source code, documentation, screenshots, and the agreed project deliverables are provided.

**Prioritize coherent urban planning, recognizable architecture, clear composition, polished interaction, meaningful environmental detail, and measured performance.**

Begin by inspecting the workspace and confirming the execution mode, then build, validate, and deliver the complete interactive Manhattan Miniature project.
