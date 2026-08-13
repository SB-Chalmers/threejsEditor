---
name: threejs-postprocessing
description: 'Use when adding or debugging Three.js EffectComposer passes, SAO/SSAO, bloom, outline, anti-aliasing, color grading, screen-space shaders, resize behavior, blank canvases, or post-processing performance in threejsEditor. Preserves RendererManager ownership and scene-appearance material safety.'
argument-hint: 'Describe the post-processing effect or rendering failure'
user-invocable: true
disable-model-invocation: false
---

# Three.js Post-Processing

Use this skill for EffectComposer pipelines and screen-space effects in this repository.

This is a project-aware adaptation inspired by the MIT-described [CloudAI-X Three.js post-processing skill](https://github.com/CloudAI-X/threejs-skills/blob/main/skills/threejs-postprocessing/SKILL.md), rewritten for this codebase and its renderer architecture.

## Repository Ownership

Post-processing is centralized:

- `src/core/RendererManager.ts` owns `WebGLRenderer`, `EffectComposer`, pass order, resize, render selection, and disposal.
- `src/core/ThreeJSCore.ts` initializes the composer and drives the animation/render loop.
- `src/core/SceneAppearanceManager.ts` owns temporary material replacement for editing and daylight-analysis modes.
- React components must not create composers or call an independent post-processing render loop.

The current pipeline is dynamically imported and ordered as:

1. `RenderPass`
2. `SAOPass`
3. `OutlinePass`
4. `OutputPass`

`RendererManager.render()` uses the composer when available and falls back to `renderer.render()` otherwise.

## Core Rules

- Maintain exactly one composer for the main viewport.
- Add or configure passes inside `RendererManager`.
- Keep the scene render pass first.
- Keep color-space/tone-mapping output handling last (`OutputPass` in the current pipeline).
- Render once per frame. Do not call both composer and renderer for the same normal scene unless implementing a deliberate multi-layer pipeline.
- Update composer and pass-specific resolutions whenever the canvas size or pixel ratio changes.
- Dispose removed passes, render targets, and composer resources.
- Match the repository's `three/examples/jsm/...` import style unless intentionally migrating all imports.

## Adding an Effect

1. Read `RendererManager.initializeComposer`, `setSize`, `render`, and `disposeComposer`.
2. Classify the pass:
   - geometry/depth aware: SAO/SSAO, outline, depth of field;
   - luminance based: bloom;
   - color transform: grading, vignette, gamma/output;
   - edge/AA: FXAA or SMAA;
   - custom screen shader: `ShaderPass`.
3. Dynamically import the pass with the existing composer imports.
4. Construct it from the same scene/camera/viewport used by the render pass.
5. Insert it in a deliberate order before `OutputPass`.
6. Store the pass in the managed pass collection or a typed field when it needs runtime updates.
7. Update it when camera, viewport, pixel ratio, theme, or quality settings change.
8. Dispose it through `disposeComposer`.
9. Preserve fallback rendering if post-processing initialization fails.
10. Add a focused test for pass order, resize, or cleanup when practical.

## Effect Guidance

### Ambient Occlusion

The app already uses `SAOPass`. Tune it before adding a second AO implementation.

- Keep intensity restrained for architectural visualization.
- Test contact around facade frames, floor slabs, and ground intersections.
- Avoid dark halos at silhouettes by adjusting bias, scale, kernel radius, depth cutoff, and blur together.
- Evaluate at several camera distances; screen-space AO changes with projection and resolution.
- Current browser-verified SAO intensity is approximately `0.035`. If the viewport looks washed out, fix palette and fill lighting before increasing it; excessive AO produces dirty halos rather than hierarchy.

### Bloom

- Use thresholded bloom so ordinary white facades do not glow.
- Prefer layers or an isolated render strategy for selective bloom.
- Avoid traversing and swapping every material in this app: `SceneAppearanceManager` already swaps materials for editing/analysis and the two systems can restore the wrong instance.
- Use reduced-resolution bloom targets where quality permits.

### Outline

- Feed `OutlinePass.selectedObjects` from current runtime IDs, not graph snapshot objects.
- Clear selected objects on workspace replacement and disposal.
- Update pass camera and resolution on camera type/viewport changes.
- In this app outline only the active editable mass (`isBuilding` plus stable `buildingId`). Do not outline context, shared facade instances, daylight overlays, floor lines, or graph snapshots.
- Current target is a thin `#2563EB` visible edge with no glow.

### Anti-Aliasing

The renderer already enables WebGL antialiasing. Add FXAA/SMAA only after confirming the current edge quality is insufficient.

- FXAA resolution must include pixel ratio: `1 / (width * pixelRatio)`, `1 / (height * pixelRatio)`.
- SMAA constructor dimensions should use physical render dimensions.
- Do not stack multiple AA techniques without measuring the benefit.

### Color Grading and Output

- Renderer uses sRGB output and ACES filmic tone mapping.
- Keep `OutputPass` last.
- Do not add duplicate gamma correction unless the pipeline genuinely lacks output conversion.
- Tune renderer exposure and grading passes together.

### Depth of Field

Use sparingly in a model editor. The user must inspect geometry accurately; aggressive blur harms selection and comparison workflows. Update focus from a stable target or explicit control, not incidental hover state.

## Custom ShaderPass Contract

A screen-space pass normally requires:

- `tDiffuse` input uniform;
- a passthrough vertex shader that forwards UVs;
- a fragment shader that writes one final color;
- deterministic uniforms for time/intensity/resolution;
- resize handling for resolution-dependent effects;
- a `dispose` path for owned textures or render targets.

Keep custom shaders in dedicated modules once they exceed a small inline definition. Document expected color space and whether the shader operates before or after tone mapping.

## Camera and Resize Handling

On resize or viewport-layout changes:

1. Measure the actual canvas container, not global `window.innerWidth/innerHeight`.
2. Update renderer size and pixel ratio.
3. Update composer size.
4. Update pass-specific resolution uniforms/render targets.
5. Update camera projection separately through the camera manager.

When camera type changes, ensure depth-aware passes and the first `RenderPass` point to the new camera. `RendererManager.render()` already refreshes the first pass camera; new camera-dependent passes need equivalent updates.

## Scene Appearance Safety

`SceneAppearanceManager` clones and restores materials during editing and daylight-analysis modes.

Do not implement a pass by globally replacing materials without coordinating with that manager. In particular:

- material-darkening selective bloom can conflict with ghost/edit restoration;
- graph snapshots contain no runtime objects and cannot populate pass selections;
- workspace replacement invalidates object references held by outline/bloom selections;
- pass state should use stable IDs and resolve current runtime objects after replacement.

## Blank Canvas / Broken Pipeline Checklist

1. Confirm `initializeComposer` completed and did not fall back after an import error.
2. Confirm `RenderPass` uses the active scene and camera.
3. Confirm composer dimensions are non-zero and match the canvas container.
4. Confirm exactly one path renders each frame.
5. Temporarily disable passes one by one to locate the failing pass.
6. Confirm the final output pass remains enabled and last.
7. Inspect render target formats, depth requirements, and WebGL capability errors.
8. Verify camera near/far ranges for depth-based effects.
9. Check for stale object/camera references after workspace or camera replacement.
10. Dispose and recreate the composer after structural pipeline changes during development.

## Performance Budget

Every pass is at least one additional full-screen render, and some effects render several internal targets.

- Keep the normal editor pipeline short.
- Disable expensive effects on low-performance devices or quality modes.
- Use half/quarter-resolution targets for blur-heavy passes.
- Avoid allocation in the animation loop.
- Profile GPU frame time, not only JavaScript time.
- Test with maximum canvas pixel ratio, building count, facade instance count, and analysis overlays.

## Validation

Run:

```bash
npm test -- --run
npm run build
```

Manual checks:

1. Resize the viewport and toggle the top/sidebar layouts; verify no stretched or partially covered output.
2. Switch camera type and confirm depth effects and outlines still use the active camera.
3. Enter/exit building editing and daylight-analysis modes; verify materials restore correctly.
4. Reinstate a graph node and verify no pass retains disposed mesh references.
5. Compare composer enabled/disabled output for color-space or exposure shifts.
6. Inspect renderer memory after repeated composer reinitialization to catch leaked render targets.
7. Capture normal and edit screenshots at the same camera, sample several WebGL pixels, and inspect console warnings/errors after a clean reload.
