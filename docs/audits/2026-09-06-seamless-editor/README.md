# Seamless footprint editor — implementation and verification

Implemented the continuous workflow: Polygon / Rectangle → Reshape → Move / Rotate → 3D. Selecting a building opens a docked inspector without a backdrop or building-wide Done/Cancel session. Completed gestures are accepted immediately and can be undone.

## Interaction and model ownership

- `useWorkspaceEditor` owns tools, pointer capture, one active gesture, snapping and geometry shortcuts. Stable DOM listeners call the latest callbacks and coalesce pointer movement. Release flushes the final pointer position. Preview positioning also follows camera changes when the pointer is stationary.
- `useBuildingEditSession` supplies temporary gesture drafts and frame-coalesced previews. Canonical state remains in `useBuildingManager`; mass, façades, floor separators and metrics derive from the same model. Cancellation restores the canonical solid, including gestures that return to their starting point without creating history.
- `WorkspaceHistory` retains 100 immutable before/after model commands. Creation, deletion, property changes and footprint edits are undoable. New commands clear redo; no-ops preserve it. Import and graph reinstatement cancel interactions and clear command history.
- Translation and rotation modify footprint coordinates. Rotation uses the area centroid captured at gesture start, with every preview derived from the original points. Building IDs and the existing JSON format remain intact. ID generation now avoids imported IDs, and replacements validate all models before disposing the current workspace.
- Facade instance bounds refresh after rebuilding. Daylight results are fingerprint-checked after commits and history navigation; incompatible results are hidden and retained in a cache so Undo can make them valid again. Existing energy fingerprint gating remains in place. No studies are launched by editing.

## Controls

- Draw Polygon or Rectangle in top view. Finish a polygon with its starting point, Enter or Finish. Rectangle supports two corners or a drag. Undo/Redo also operates on uncompleted drawing points.
- Reshape exposes constant-size DOM vertex buttons (8 px visible, 24 px targets). Hover an edge to insert at that position, or insert and drag. Keyboard users can select a vertex and use **Add point after**, exact X/Z fields and **Remove point**.
- Move the footprint or its central handle, or set centroid X/Z. Rotate with the ring, keyboard arrows or **Rotate by**; Shift uses 15° increments.
- Closure and vertex snaps outrank alignment and grid snaps. Acquisition/release radii are 10/14 CSS pixels. Grid increments are 0.1, 0.5, 1 and 5 m; Alt bypasses snapping and Shift constrains axes.
- Invalid candidates show red edges and an inline explanation while retaining a valid solid. Invalid release restores the gesture's starting geometry. Escape, pointer cancellation, lost capture and window blur restore controls and geometry.
- 2D / 3D stays visible. Returning to 3D restores its saved camera; dragging never reframes the camera. Right drag orbits in 3D, middle / Space drag pans, and wheel zooms. Plan fitting preserves a true top view.
- Narrow screens use a collapsible inspector sheet. Hints sit below the toolbar so footprint handles remain reachable.

## Verification

**126 tests passed across 26 files.** Production build passed; targeted ESLint and whitespace checks passed. Added regression coverage includes gesture cancellation, final-pointer flushing, one-command drags, no-op restoration, multi-building history, rotation invariants, snapping at different zoom levels, import validation / ID collisions and camera preservation.

The project-wide TypeScript check still reports the same 64 pre-existing diagnostics recorded in the premium audit. No new diagnostics were introduced. The production build retains the existing large-chunk advisory.

Local Chromium / Playwright checks exercised:

- Rectangle creation and rapid polygon clicks, Enter completion and previews across repeated React rerenders.
- Vertex drag, arbitrary edge insertion with dragging, exact coordinates, deletion and minimum-three-point protection.
- Invalid edits, Escape and window blur; one-command Undo/Redo; whole-building movement and deletion.
- Numeric rotation and pointer rotation with Shift; preserved area, properties, IDs and independent neighboring buildings.
- Keyboard slider commits and Undo from a focused slider; Escape in numeric fields.
- Preview position after wheel zoom without a new pointer event; previous 3D camera restoration and right-drag orbit.
- Import cleanup and history reset; baseline graph reinstatement without stale handles.
- 1440×900, 1024×768, 768×700 and 640×700 layouts: zero measured overlap among the inspector, tool rail, command bar, view switch, status bar and hints. Final element hit tests confirmed every displayed footprint handle was accessible. The collapsed inspector measures 52 px high.
- Zero browser errors and multiple opaque colors in sampled WebGL pixels.

Measured text/control contrast against the actual CSS surface colors: body labels 7.58:1; muted labels 4.76:1; active tool text 6.16:1; snapping green 5.48:1; blue controls on white 5.17:1.

Evidence: [interaction checks](verification.json), [final workspace/layout/pixel checks](final-verification.json), [test output](tests.txt), [TypeScript baseline](typecheck.txt).

## Visual evidence and rendering boundary

The separate AO defect remains outside this redesign. The initial [production baseline](baseline.png) and [rotation view with production AO](rotate-production-ao.png) retain that defect. Final visual QA explicitly disabled the `_SAOPass` in the temporary browser only; source renderer settings were not changed. The recorded pass list verifies that diagnostic state. These screenshots therefore demonstrate the new interaction UI, not an AO fix or a hardware frame-rate guarantee.

- [Desktop inspector and handles](final-1440.png)
- [1024 px workspace](final-1024.png)
- [768 px workspace](final-768.png)
- [640 px workspace with reachable handles](final-640.png)
- [Collapsed inspector](final-640-collapsed.png)

Browser scripts are included for reproduction. With the local app running and Playwright installed, run `browser-interactions.mjs` and `browser-workspace.mjs`. Set `PLAYWRIGHT_MODULE` to an installed Playwright module path if it is outside this project. The scripts use a fresh browser profile and an in-memory graph fixture; they do not run simulations.

Multi-selection, holes, curved edges, edge extrusion, custom pivots, durable autosave and AO repair remain outside this release.
