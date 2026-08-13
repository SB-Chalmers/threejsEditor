---
name: threejs-derived-geometry
description: 'Use when Three.js building mass, footprint handles, floor lines, windows, frames, shades, or facade geometry disagree; when sliders update only facade or only mass; or when ghost geometry appears after preview, cancel, delete, import, or graph reinstate in threejsEditor.'
argument-hint: 'Describe which visual layers are out of sync'
user-invocable: true
disable-model-invocation: false
---

# Three.js Derived Geometry Consistency

Use this skill when visual layers disagree even though they represent one building.

## Derived Runtime Contract

For each building ID, these are projections of the same model or edit draft:

- Solid mass mesh
- Footprint outline and edit handles
- Floor separator group
- Window glass instances
- Window frame instances
- Shade/overhang instances
- Metrics shown in the sidebar

None of these is canonical state. The current workspace model is canonical; an active edit draft temporarily drives preview visuals.

## Unified Update Procedure

1. Resolve the current runtime building by stable ID through the workspace manager.
2. Calculate metrics once from draft points, floors, and floor height.
3. Replace geometry on the manager-owned live mesh, not an incoming copied object's mesh.
4. Update mesh position, material color, local matrix, and world matrix.
5. Dispose and recreate the footprint outline from the same points.
6. Dispose and recreate floor lines from the same floors and floor height.
7. Update `WindowService` with a pure snapshot of the same draft.
8. Publish canonical workspace state only on commit.
9. On cancel, regenerate every runtime layer from the unchanged canonical model.

## Ownership Rules

- `BuildingService` constructs meshes but does not own model state.
- `useBuildingManager` owns runtime resources and current models.
- `WindowService` owns shared instanced meshes plus a derived pure-model cache.
- Never remove or dispose the shared `facade-glass`, `facade-frames`, or `facade-shades` meshes during per-building cleanup.
- Clear per-building facade records through `WindowService` APIs.
- Reinstatement uses `replaceWorkspace()` so old mass, lines, and facade records are cleared together.

## Failure Signatures

### Facade/floor lines move but mass stays fixed

The update is mutating a copied `building.mesh` instead of the manager-owned runtime mesh. Resolve the visual owner by ID and return that same mesh in updated runtime state.

### Sidebar changes but scene does not

The panel draft is disconnected from `useBuildingEditSession`, or preview targets a stale selected object. Target by current building ID.

### Mass changes but facade stays old

`WindowService` was not updated from the same draft, or a stale building record with the same ID remains in its map.

### Facade disappears after reinstate

Shared instanced facade meshes were removed or disposed. Rebuild records, not the service's shared render meshes.

### Floating floor rectangles or duplicate masses

Runtime cleanup and workspace replacement were split across layers. Use one `replaceWorkspace()` transaction and ensure each object is disposed once.

## Geometry Assertions

For a model with `floors = n` and floor height `h`:

- Mass bounding-box height should be `n * h`.
- Floor-line child count should be `max(0, n - 1)`.
- Facade count should equal `buildFacadeLayout(points, n, h, getBuildingFacadeParameters(model)).apertures.length`.
- Preview may change runtime geometry, but `captureSnapshot()` must remain unchanged until commit.
- Cancel must restore all three assertions to the canonical model.

## Validation Commands

```bash
npm test -- src/hooks/__tests__/useBuildingManager.test.tsx src/services/__tests__/WindowService.test.ts src/services/__tests__/FacadeGeometry.test.ts --run
npm run build
```

Use the real `THREE.ExtrudeGeometry` bounding box in tests; do not rely only on mocked callback assertions.
