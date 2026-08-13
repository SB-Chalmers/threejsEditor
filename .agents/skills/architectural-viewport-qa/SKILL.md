---
name: architectural-viewport-qa
description: 'Use when reviewing or improving the visual quality, palette, contrast, hierarchy, camera framing, responsive overlays, or modern architectural look-and-feel of the threejsEditor viewport. Requires browser screenshots, WebGL pixel checks, console review, measured color contrast, and before/after visual QA.'
argument-hint: 'Describe the viewport look, screenshot, or visual hierarchy problem'
user-invocable: true
disable-model-invocation: false
---

# Architectural Viewport QA

Use this skill for visual reviews and rendering-polish work in the model viewport. Do not judge visual quality from source constants alone: inspect the live WebGL result at fixed camera and viewport states.

## Target Character

The established direction is a modern, restrained architectural editor:

- soft architectural-clay massing;
- pale but distinct ground and background;
- cool, subordinate context buildings;
- warm off-white default editable mass;
- low-saturation blue-gray glazing;
- medium-dark frames and shades;
- readable directional shadows and restrained contact AO;
- crisp blue selection outline with no glow;
- compact white operational UI surfaces.

Avoid atmospheric decoration, bloom, depth of field, saturated default masses, and palettes where ground, context, and editable buildings collapse into one midtone band.

## Current Light Palette Baseline

Preserve this hierarchy unless screenshots demonstrate a specific problem:

| Role | Color |
|---|---|
| Scene background | `#F4F6F8` |
| Ground | `#D3D9DF` |
| Context massing | `#8C959E` |
| Default editable mass | `#EEEAE2` |
| Glazing | `#607A92` |
| Frames | `#46515C` |
| Shades | `#737E87` |
| Selection outline | `#2563EB` |

Measured reference contrasts:

- ground/context: approximately `2.14:1`;
- editable mass/glazing: approximately `3.73:1`;
- glazing/frame: approximately `1.81:1`.

These are hierarchy checks, not WCAG text requirements. Material response, directional shading, and edges also contribute.

## Visual Review Procedure

1. Read `design-qa.md` and inspect the latest user reference screenshot.
2. Record a deterministic baseline:
   - viewport dimensions and DPR;
   - canvas CSS and pixel dimensions;
   - perspective/orthographic mode;
   - camera position/target or fixed view;
   - sun date/time;
   - grid state;
   - model configuration.
3. Capture the normal workspace screenshot.
4. Open building edit mode and capture the selection/ghost hierarchy.
5. When relevant, capture daylight-analysis mode and a dialog/sidebar state.
6. Read browser console warnings/errors from a clean reload.
7. Perform a nonblank canvas-pixel check by sampling multiple WebGL pixels; require more than one opaque color.
8. Measure palette luminance/contrast before changing source tokens.
9. Form one visual hypothesis and change one coordinated layer at a time:
   - palette/material hierarchy;
   - light/fill/exposure;
   - AO/shadows;
   - camera framing;
   - UI overlay spacing.
10. Re-capture at the same camera and viewport. Compare side by side.
11. Validate responsive overlays at 1024×768, 768×700, and 640×700; measure bounding-box overlap instead of relying only on sight.
12. Update `design-qa.md` with evidence, changes, remaining differences, tests, and build status.

## Palette Diagnosis

### Washed-out midtones

Symptoms:

- ground, context, and editable mass have similar luminance;
- context edges disappear into ground;
- surfaces look flat despite shadows;
- increasing AO makes the scene dirty instead of clearer.

Check these in order:

1. Measure ground/context and ground/building contrast.
2. Separate roles by both value and temperature: cool ground/context, slightly warm active mass.
3. Darken context before adding outlines to every context object.
4. Deepen glass/frame values enough to define facade rhythm.
5. Reduce ambient and hemisphere fill if directional shading remains flat.
6. Lower exposure modestly before darkening every material.
7. Tune SAO only after palette and fill lighting are correct.

Do not solve washout by making the ground nearly white and every building medium gray. Do not make context transparent in edit mode: Rhino interiors become visible and visually noisy. Use opaque lightened context instead.

## Established Lighting Baseline

Light-mode values after browser tuning:

- ambient intensity: `0.28`;
- hemisphere intensity: `0.30`;
- renderer exposure: `0.98`;
- one primary directional shadow caster;
- 2048 shadow map;
- directional shadow radius `4`, blur samples `16`;
- SAO intensity approximately `0.035`.

Treat these as a known-good baseline. Change them from screenshots, not intuition.

## Context and Selection Rules

- Context uses `analysisRole = 'context-massing'`.
- Context is high-roughness, zero-metalness, receives shadows, and does not cast site-wide shadows.
- In normal mode it is clearly darker/cooler than the active design.
- In edit mode it remains opaque and is lightened/subordinated; never expose internal context surfaces through transparency.
- Selection outline resolves only the active runtime mass mesh by stable building ID.
- Shared facade instanced meshes, context, overlays, floor lines, and graph snapshots are not outline targets.
- Clear outline targets on cancel, delete, graph reinstate, camera/composer rebuild, workspace replacement, and disposal.

## Camera and Responsive Checks

- Frame editable building meshes only; exclude context, grid, lights, handles, and analysis overlays.
- Auto-frame after sample creation, import, and graph reinstatement, not on slider previews.
- Keep 8–12% visual margin and inspect both horizontal and vertical FOV constraints.
- At narrow widths verify zero overlap among `.model-tool-rail`, `.model-status-bar`, `.model-graph-overview`, and `.model-context-hint`.
- Confirm canvas top equals the navigation height and canvas dimensions match the remaining viewport.

## Browser Evidence Template

Record:

```text
Viewport: WIDTH × HEIGHT, DPR
Canvas CSS: WIDTH × HEIGHT at TOP/LEFT
Canvas pixels: WIDTH × HEIGHT
Camera/view:
Sun/grid/model state:
Console warnings/errors:
Sampled WebGL colors / unique count:
Overlay overlap areas:
Normal screenshot:
Edit screenshot:
Analysis screenshot:
```

## Validation Commands

```bash
npm test -- src/core/__tests__/SceneAppearanceManager.test.ts src/core/__tests__/RendererManager.test.ts src/services/__tests__/WindowService.test.ts --run
npm test -- --run
npm run build
```

Acceptance requires clean automated checks plus browser evidence. A build-only result is insufficient for visual-quality work.
