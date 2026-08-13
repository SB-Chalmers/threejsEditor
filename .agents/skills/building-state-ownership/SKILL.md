---
name: building-state-ownership
description: 'Use when changing or debugging building creation, editing, sidebar controls, graph snapshots, simulation capture, reinstatement, imports, or multi-building state in threejsEditor. Enforces one current workspace owner, immutable pure model snapshots, transactional edit drafts, and derived Three.js runtime resources.'
argument-hint: 'Describe the building state flow or mismatch to review'
user-invocable: true
disable-model-invocation: false
---

# Building State Ownership

Use this skill before modifying code that moves building information between the editor, design graph, simulations, sidebar, or Three.js scene.

## Ownership Contract

Keep these roles separate:

| Layer | Owner | Allowed data |
|---|---|---|
| Historical graph | `DesignExplorationService` | Immutable `BuildingModel[]` snapshots and result metadata |
| Current workspace | `useBuildingManager` | Canonical current models plus their runtime scene projection |
| Edit transaction | `useBuildingEditSession` | One temporary `baseDraft` and `draft` for one building ID |
| Sidebar | `BuildingEditPanel` | Controlled rendering of the transaction draft only |
| Scene construction | `BuildingService` | Creates meshes; never owns canonical model state |
| Facade rendering | `WindowService` | Derived cache of pure building models; never canonical state |
| Simulation | Coordinator/API services | One immutable `captureSnapshot()` taken before async work |

`BuildingModel` is serializable model state. `BuildingData` extends it with runtime objects such as `mesh`, `footprintOutline`, and `floorLines`. Never put `BuildingData` in history or backend payloads.

## Procedure

1. Identify whether each field is model state, edit-draft state, or derived runtime state.
2. Read current models through `getBuilding(id)` or `captureSnapshot()`, not through copied component objects.
3. Replace the whole active workspace through `replaceWorkspace(models)` for reinstate/import workflows.
4. Preserve stable building IDs through snapshots and reconstruction.
5. Store selection and hover as IDs; derive objects from the current workspace.
6. Open the sidebar through `useBuildingEditSession.open(id)`.
7. Preview mass, floor lines, footprint, and facade from the same draft.
8. Commit once through the workspace manager. Cancel by rebuilding runtime visuals from the unchanged canonical model.
9. Capture a single immutable snapshot before starting daylight or energy promises; use it for graph storage, both simulations, fingerprints, and metrics.
10. Add regression coverage at the ownership boundary touched by the change.

## Forbidden Patterns

Do not:

- Store or clone Three.js meshes inside a design graph node.
- Treat React's rendered `buildings` array and an internal ref as independent sources of truth.
- Keep selected or hovered `BuildingData` copies when an ID is sufficient.
- Initialize sidebar state from a pre-reinstate object with the same ID.
- Let the sidebar maintain its own canonical building copy.
- Manually clear/rebuild scene objects in `SimpleBuildingCreator`; use workspace commands.
- Read live workspace objects at multiple points during one asynchronous run.
- Let `WindowService` become a second building-state store.

## Review Checklist

Before editing:

- Which layer owns this value?
- Is the value pure data or a derived Three.js resource?
- Can an object with the same ID be stale after `replaceWorkspace()`?
- Can an async callback read a different workspace version than the one submitted?
- Does the change work for two buildings with different floor counts and WWR values?

After editing, run focused ownership tests and then the full suite:

```bash
npm test -- src/services/__tests__/DesignExplorationService.test.ts src/hooks/__tests__/useBuildingManager.test.tsx src/hooks/__tests__/useBuildingEditSession.test.tsx src/components/__tests__/BuildingEditPanel.test.tsx --run
npm test -- --run
npm run build
```

## Key Files

- `src/types/building.ts`
- `src/utils/buildingModel.ts`
- `src/hooks/useBuildingManager.ts`
- `src/hooks/useBuildingEditSession.ts`
- `src/components/BuildingEditPanel.tsx`
- `src/components/SimpleBuildingCreator.tsx`
- `src/services/DesignExplorationService.ts`
- `src/services/WindowService.ts`
