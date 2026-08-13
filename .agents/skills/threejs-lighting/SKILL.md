---
name: threejs-lighting
description: 'Use when adding or debugging Three.js lights, sun position, shadows, sky, environment lighting, exposure, shadow acne, missing illumination, or lighting performance in threejsEditor. Extends the existing LightingManager and renderer settings instead of creating competing scene-level ownership.'
argument-hint: 'Describe the lighting, shadow, sky, or exposure change'
user-invocable: true
disable-model-invocation: false
---

# Three.js Lighting

Use this skill for lighting, shadows, sun/sky, and environment illumination in this repository.

This is a project-aware adaptation inspired by the MIT-described [CloudAI-X Three.js lighting skill](https://github.com/CloudAI-X/threejs-skills/blob/main/skills/threejs-lighting/SKILL.md), rewritten for this codebase and its manager architecture.

## Repository Ownership

Lighting is centralized:

- `src/core/LightingManager.ts` owns lights, sky, realistic sun updates, and shadow helpers.
- `src/core/RendererManager.ts` owns renderer shadow type, output color space, tone mapping, and exposure.
- `src/core/ThreeJSCore.ts` constructs and coordinates both managers.
- `src/utils/sunPosition.ts` computes solar position and time-dependent intensities.
- `src/utils/themeColors.ts` resolves theme-driven light colors.
- `src/components/SunController.tsx` is UI only; it must not create scene lights.

Do not create persistent lights directly in React components or services. Add capabilities to `LightingManager` and expose narrow methods through `ThreeJSCore`/`useThreeJS`.

## Current Lighting Stack

The app currently uses:

- One `DirectionalLight` as the sun and primary shadow caster.
- One low-intensity `AmbientLight` for fill.
- One `HemisphereLight` for sky/ground fill.
- Optional `Sky` from `three/examples/jsm/objects/Sky.js`.
- `PCFSoftShadowMap` configured by `RendererManager`.
- `ACESFilmicToneMapping`, sRGB output, and theme-sensitive exposure.
- Realistic sun elevation/azimuth updates through `updateRealisticSunPosition`.

Browser-verified light-mode baseline:

- ambient intensity `0.28`;
- hemisphere intensity `0.30`;
- renderer tone-mapping exposure `0.98`;
- 2048 directional shadow map;
- shadow radius `4`, blur samples `16`;
- bias `-0.00008`, normal bias `0.035`.

These values were tuned with the established architectural palette. Treat them as a known-good starting point, not arbitrary defaults.

Preserve this stack unless the task explicitly calls for a different rendering model.

## Light Selection

| Need | Preferred light | Notes |
|---|---|---|
| Outdoor sun | `DirectionalLight` | One shadow-casting sun is usually enough |
| Broad sky/ground fill | `HemisphereLight` | Cheap, no shadows |
| Flat emergency fill | `AmbientLight` | Keep intensity restrained or forms look flat |
| Local bulb | `PointLight` | Expensive shadows: six shadow renders |
| Focused fixture | `SpotLight` | Add target to scene and update it |
| Soft luminous panel/window | `RectAreaLight` | PBR materials only; no native shadows |
| Reflections and ambient realism | HDR environment map | Use PMREM and dispose source texture/generator |

## Procedure

1. Identify whether the issue belongs to light energy, material response, exposure/tone mapping, or post-processing.
2. Inspect `LightingManager`, `RendererManager`, and current PBR materials before adding anything.
3. Prefer tuning the existing sun, ambient, and hemisphere lights over adding more lights.
4. If adding a light, add creation, update, helper, and disposal behavior to `LightingManager`.
5. For a directional or spot target, add the target to the scene and call `target.updateMatrixWorld()` after moving it.
6. Configure all three shadow requirements:
   - renderer shadow map enabled;
   - light `castShadow = true`;
   - relevant meshes set `castShadow`/`receiveShadow`.
7. Fit shadow near/far planes and orthographic bounds to the active model extent. Large unused frustums waste resolution.
8. Tune shadow artifacts in this order: camera bounds, near/far, `normalBias`, then `bias`, then map size.
9. Preserve realistic sun behavior across negative, low, and daytime elevation ranges.
10. Keep theme color updates idempotent and do not replace materials managed by `SceneAppearanceManager`.
11. Dispose shadow maps, helpers, environment textures, render targets, and PMREM resources when replaced.
12. Validate at several camera distances and solar angles, not only one static view.
13. Capture a browser screenshot and sample WebGL pixels before declaring a lighting change complete.

## Shadow Guidance

Start with the existing project defaults rather than generic maximum quality:

- Interactive map size: usually 1024–2048.
- One primary shadow caster.
- Tight directional-light camera bounds.
- Small `normalBias` for acne; avoid excessive values that detach shadows.
- Use helpers temporarily to inspect the shadow camera.
- Disable shadows on small decorative objects when they add cost without useful form information.

When changing model dimensions dynamically, ensure the shadow camera still contains the entire workspace. If bounds are computed automatically, derive them from current runtime building bounds after atomic workspace replacement.

## Environment Lighting

If adding image-based lighting:

1. Load through `RGBELoader` from `three/examples/jsm/loaders/RGBELoader.js` to match repository imports.
2. Convert through `PMREMGenerator` for PBR materials.
3. Set `scene.environment`; set `scene.background` only when requested.
4. Dispose the source HDR texture and PMREM generator after conversion.
5. Keep environment intensity and renderer exposure balanced; do not compensate for overexposure by darkening every material.
6. Add loading/error/fallback behavior so scene initialization still succeeds without the asset.

## Interaction With Analysis Modes

- Daylight overlays and facade instancing have their own materials and visibility rules.
- `SceneAppearanceManager` temporarily clones/swaps materials for editing and daylight analysis.
- Lighting changes must not assume each object keeps one permanent material instance.
- Do not make light updates depend on sidebar or graph state; consume scene/workspace bounds through core APIs.

## Failure Signatures

### Scene looks flat

Ambient or hemisphere fill is too strong relative to the sun, or material roughness/metalness is inappropriate.

If ground, context, and the active mass occupy similar midtones, fix the palette hierarchy before increasing AO. The established light palette is background `#F4F6F8`, ground `#D3D9DF`, context `#8C959E`, active mass `#EEEAE2`, glazing `#607A92`, and frames `#46515C`.

### Scene looks washed out

1. Measure ground/context and mass/glazing contrast.
2. Confirm theme refresh is not restoring old high ambient, hemisphere, shadow blur, or exposure values.
3. Reduce fill/exposure modestly before darkening every material.
4. Preserve warm/cool separation between active mass and environment.
5. Recheck the same camera screenshot; do not judge from CSS swatches alone.

### Shadows disappear after changing floors

The shadow camera no longer covers the resized model, or the rebuilt runtime mesh lacks `castShadow`/`receiveShadow`.

### Shadow acne or stripes

Tighten shadow bounds first, then adjust `normalBias` and `bias`. Increasing map size alone rarely fixes the root cause.

### Peter-panning / floating shadows

Bias is too large. Reduce `normalBias`/`bias` after verifying geometry normals.

### Light points in the wrong direction

Update the light target, ensure it is in the scene, and update its world matrix.

### Correct light values but wrong brightness

Inspect renderer tone mapping, exposure, output color space, post-processing `OutputPass`, and material type.

## Performance Checklist

- Count shadow-casting lights.
- Inspect renderer draw calls and shadow-map memory.
- Avoid 4096+ shadow maps for the normal interactive viewport.
- Update dynamic shadows only when necessary if the scene becomes expensive.
- Keep helper objects hidden or removed outside debugging.
- Test with the maximum expected building count and floor count.

## Validation

Run relevant manager/core tests, then:

```bash
npm test -- --run
npm run build
```

Manual checks:

1. Rotate around the whole workspace and verify no geometry falls outside the shadow frustum.
2. Test low sun, midday sun, and below-horizon values.
3. Toggle theme and verify colors/exposure update once without duplicating lights.
4. Reinstate and resize buildings; verify rebuilt mass, windows, and floor lines receive consistent lighting and shadows.
