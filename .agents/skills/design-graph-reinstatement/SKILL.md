---
name: design-graph-reinstatement
description: 'Use when implementing, debugging, or testing baseline creation, design iterations, Design Graph nodes, reinstate configuration, branching after reinstate, stale sliders, wrong floor counts, or multi-building restoration in threejsEditor.'
argument-hint: 'Describe the baseline/iteration/reinstate sequence'
user-invocable: true
disable-model-invocation: false
---

# Design Graph Reinstatement

Use this skill for any baseline, iteration, or historical-node restoration workflow.

## Required Semantics

- A graph node is immutable history.
- The graph stores pure `BuildingModel[]`, never scene resources.
- The first successful design run populates the baseline.
- Later runs create child nodes from one captured workspace snapshot.
- Reinstating a node copies its models into a working workspace.
- Editing after reinstate changes only the working copy.
- The next run creates a child of the reinstated node; it does not overwrite history.
- The sidebar closes during reinstate and reopens only when the user selects a rebuilt building.

## Atomic Reinstate Sequence

Perform reinstatement in this order:

1. Abort active daylight and energy requests.
2. Stop drawing and clear temporary drawing elements.
3. Discard the active `useBuildingEditSession` transaction.
4. Close tooltips, result dialogs, and sidebar selection.
5. Ask `DesignExplorationService` for a detached snapshot and mark it as the active graph parent.
6. Call `replaceWorkspace(node.buildings)` exactly once.
7. Restore node daylight results as hidden overlays.
8. Leave scene appearance in normal mode.
9. Keep selection empty until the user clicks a rebuilt building.

Do not manually loop over node buildings in `SimpleBuildingCreator` to construct meshes. That duplicates workspace-manager responsibilities and can publish partially rebuilt state.

## Debugging Checkpoints

For a failing reinstate, inspect values in this order:

1. `node.buildings[index].floors` in the immutable graph snapshot.
2. `captureSnapshot()` immediately before creating each node.
3. `replaceWorkspace()` input models and stable IDs.
4. `getBuilding(id)?.floors` immediately after replacement.
5. Runtime mesh bounding-box height: `floors * floorHeight`.
6. Floor separator count: `floors - 1`.
7. `WindowService.getBuildingWindowCount(id)` against `buildFacadeLayout(...)`.
8. Edit session base draft after clicking the rebuilt building.
9. Sidebar floor slider value.

If graph and workspace values are correct but the sidebar is wrong, the edit transaction is stale. If the facade changes but the solid mass does not, runtime owners diverged: verify `applyBuildingVisual` mutates the manager-owned mesh and returns that same mesh.

## Required Regression

Always preserve this exact test sequence:

1. Create baseline with one building at 6 floors.
2. Capture and store baseline.
3. Commit/run an iteration at 2 floors.
4. Commit/run an iteration at 10 floors.
5. Reinstate baseline with the same building ID.
6. Assert workspace model is 6 floors.
7. Assert mesh height is 18 m for a 3 m floor height.
8. Assert five floor separators.
9. Assert facade aperture count matches the 6-floor layout.
10. Assert selection/sidebar are closed.
11. Click the building and assert the slider reads 6.
12. Preview 8 floors and assert mass, separators, and facade all show 8.
13. Cancel and assert all return to 6.

Repeat with two buildings using different IDs, floor counts, footprints, and WWR values.

## Validation Commands

```bash
npm test -- src/services/__tests__/DesignExplorationService.test.ts src/hooks/__tests__/useBuildingManager.test.tsx src/hooks/__tests__/useBuildingEditSession.test.tsx --run
npm test -- --run
npm run build
```

After changing snapshot architecture, reload the browser and recreate in-memory graph nodes before manual verification.
