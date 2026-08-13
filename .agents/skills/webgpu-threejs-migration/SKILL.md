---
name: webgpu-threejs-migration
description: 'Use only when explicitly planning or implementing a migration of threejsEditor from WebGLRenderer to Three.js WebGPURenderer, TSL node materials, WebGPU compute, WGSL integration, or device-loss recovery. Includes compatibility gates because the current app uses Three.js r160 and classic WebGL post-processing.'
argument-hint: 'Describe the WebGPU/TSL migration or experiment'
user-invocable: true
disable-model-invocation: true
---

# WebGPU and TSL Migration

Use this skill only for an explicit WebGPU migration or isolated experiment. It is intentionally disabled for automatic invocation so normal Three.js work continues to use the repository's supported WebGL architecture.

This project-aware migration guide was inspired by the MIT-described [dgreenheck WebGPU Three.js TSL skill](https://github.com/dgreenheck/webgpu-claude-skill), but is rewritten for this repository and its current version constraints.

## Compatibility Gate

Before writing WebGPU or TSL code, verify all of the following:

1. The project has deliberately upgraded from `three@0.160.x` to a tested r171+ release. Prefer a currently supported release and pin it during migration.
2. The exact APIs are checked against documentation for the installed Three.js version. TSL and WebGPU post-processing names change between releases.
3. Existing WebGL behavior remains available as a fallback until feature parity is demonstrated.
4. The migration is isolated from unrelated feature work.

Current repository assumptions that are not drop-in WebGPU APIs:

- `RendererManager` creates `THREE.WebGLRenderer`.
- Post-processing uses classic `EffectComposer`, `RenderPass`, `SAOPass`, and `OutputPass` from `three/examples/jsm/postprocessing`.
- Renderer setup assumes synchronous construction; WebGPU initialization is asynchronous.
- Scene appearance temporarily clones/swaps classic materials.
- Tests and services assume WebGL renderer and classic Three.js materials.

Do not add `three/webgpu`, `three/tsl`, node materials, or WebGPU-only post-processing while the dependency remains r160.

## Ownership Must Remain Stable

A renderer migration must not undo the repository's state architecture:

- `BuildingModel` remains renderer-independent pure data.
- `useBuildingManager` remains the current workspace owner.
- `BuildingService` and `WindowService` remain derived runtime adapters.
- `RendererManager` remains the sole renderer and post-processing owner.
- `LightingManager` remains the sole light/sky owner.
- React components do not create renderers, node pipelines, compute jobs, or animation loops.
- Graph snapshots and simulation payloads never contain GPU resources.

## Migration Phases

### 1. Inventory WebGL Dependencies

Search for:

- `WebGLRenderer`, `WebGLRenderTarget`, `EffectComposer`, and classic passes;
- `ShaderMaterial`, GLSL strings, `onBeforeCompile`, and renderer extensions;
- direct WebGL context access;
- material type assertions and material cloning;
- render-target readback and canvas capture;
- renderer capability checks;
- post-processing pass order and resize logic.

Document each item as compatible, replaceable, or blocked.

### 2. Upgrade Three.js Separately

Upgrade Three.js before changing renderer architecture.

1. Pin one target version.
2. Resolve import and API changes under WebGL first.
3. Run the full test suite and production build.
4. Verify model loading, facade instancing, shadows, sun/sky, post-processing, editing, graph reinstatement, and screenshots.
5. Only then introduce WebGPU.

### 3. Introduce a Renderer Backend Boundary

Keep the public `RendererManager` API stable where practical:

- initialization;
- size/pixel-ratio updates;
- render;
- camera replacement;
- theme/exposure updates;
- scene appearance;
- disposal and device recovery.

Use an internal backend strategy or explicit WebGL/WebGPU implementation rather than scattering renderer checks through components.

### 4. Handle Async Initialization

`WebGPURenderer` requires asynchronous initialization in relevant Three.js versions.

- Keep the loading/error overlay active until renderer initialization completes.
- Do not start camera controls, post-processing, or the animation loop before successful initialization.
- Make fallback selection deterministic.
- Surface capability and initialization failures separately from model-loading failures.

### 5. Migrate Materials Deliberately

For each material category, verify node-material parity:

- building mass;
- glass and frames;
- shades;
- ground/grid/context model;
- selection/edit ghosting;
- daylight overlays;
- sky and atmosphere.

Do not assume `MeshStandardMaterial` customizations map directly to `MeshStandardNodeMaterial`. Rebuild visual baselines with screenshots.

`SceneAppearanceManager` must be redesigned or verified for node materials before enabling WebGPU. Material clone/restore semantics and node graphs may differ from classic materials.

### 6. Replace Post-Processing

Classic `EffectComposer` passes are not the migration target for the WebGPU node pipeline.

- Reproduce the current baseline first: scene render, ambient occlusion, and final output conversion.
- Add optional effects only after parity.
- Confirm exact TSL post-processing APIs for the installed release.
- Keep render target formats, color space, tone mapping, depth, and multisampling explicit.
- Update all effect resolutions from the actual canvas container.
- Verify camera replacement and workspace reinstatement do not leave stale node/pass references.

### 7. Add TSL Features Incrementally

Start with a small node-material experiment before compute or custom WGSL.

- Keep uniforms and node graphs outside the animation loop.
- Update only values per frame.
- Document coordinate spaces for positions, normals, and view vectors.
- Avoid version-sensitive symbols without checking installed-version docs.
- Keep fallback materials until the TSL version is visually and functionally equivalent.

### 8. Introduce Compute Only With a Measured Need

Good candidates may include large particle simulations or analysis visualization, not ordinary building mass generation.

For compute work:

- document buffer layout, alignment, ownership, and update frequency;
- query device limits and required features;
- avoid CPU/GPU synchronization in the frame loop;
- design deterministic disposal and workspace replacement;
- provide a CPU/WebGL fallback or disable the feature clearly.

### 9. Device Loss and Recovery

Treat GPU device loss as a lifecycle event, not just a logged error.

Recovery must preserve pure application state while rebuilding runtime resources:

1. Stop rendering and reject pending GPU work.
2. Preserve `BuildingModel` workspace state, graph history, camera state, and UI state.
3. Dispose invalid runtime adapters.
4. Recreate renderer, post-processing, lights, models, facade instances, and overlays.
5. Resume only after the complete scene is rebuilt.

This aligns with the existing pure-model/runtime-resource separation and is a primary reason not to store GPU objects in graph nodes.

## Feature Detection and Fallback

- Detect WebGPU support before constructing the backend.
- Keep unsupported-browser behavior explicit.
- Do not silently render a blank canvas after initialization failure.
- Record which backend is active for diagnostics.
- Keep a user-visible retry path for device initialization or loss.

Target-browser support must be verified at implementation time; do not rely on old compatibility tables.

## Validation Matrix

Validate both backends until WebGL removal is explicitly approved:

| Area | Required checks |
|---|---|
| Initialization | supported, unsupported, denied, and device-loss paths |
| Geometry | mass, floors, facade instances, context model |
| State | 6 → 2 → 10 → baseline reinstate and multi-building edit isolation |
| Materials | normal, editing ghost, daylight analysis, themes |
| Lighting | realistic sun angles, shadows, sky, exposure |
| Post-processing | AO, output color, resize, camera switch |
| Performance | CPU frame time, GPU frame time, memory, max facade count |
| Responsive canvas | desktop/mobile dimensions and nonblank pixel checks |

Run repository checks after each migration slice:

```bash
npm test -- --run
npm run build
```

For visual completion, capture comparable screenshots from WebGL and WebGPU at fixed camera positions and inspect canvas pixels to detect blank or incorrectly colored output.

## Stop Conditions

Pause the migration rather than applying compatibility shims when:

- required TSL APIs do not exist in the pinned Three.js version;
- classic scene appearance cannot safely restore node materials;
- post-processing lacks AO/output parity;
- facade instancing regresses materially;
- device loss cannot rebuild from pure workspace state;
- the WebGPU path cannot fall back cleanly on unsupported browsers.

## Source Notes

The source repository recommends Three.js r171+ and documents newer API changes through r183-era releases. Treat its snippets as version-specific reference material, not code that can be pasted into this r160 application.
