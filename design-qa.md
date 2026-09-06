**Comparison Evidence**

- Source visual truth: the supplied modern web building-app reference plus the earlier Sefaira daylight-analysis references.
- Implementation: shared VS Code browser at `http://localhost:5173/`.
- Browser captures reviewed: 1024×768, 768×700, and 640×700 in the normal model workspace; 1068×777 in building-edit mode.
- Canvas at 1024×768: CSS 1024×720, top offset 48 px; render buffer 1024×720 in the shared browser.
- WebGL nonblank check: four sampled canvas positions returned four distinct opaque colors.
- Console during a clean 1024×768 reload: no warnings or errors after initialization-race fixes.
- Primary interactions checked: automatic fit, manual frame-all, building tooltip, edit sidebar, selected-mass outline, responsive toolbar movement, and graph-card/status-bar spacing.

**Implemented Visual Direction**

- Soft architectural-clay scene palette with pale cool-gray ground/background and a quieter grid.
- Final hierarchy palette: background `#F4F6F8`, ground `#D3D9DF`, context `#8C959E`, editable mass `#EEEAE2`, glazing `#607A92`, and frames `#46515C`.
- Measured contrast improved from `1.55:1` to `2.14:1` between ground/context and from `2.33:1` to `3.73:1` between editable mass/glazing; reduced ambient/hemisphere fill and light-mode exposure preserve directional shading.
- Context massing uses cool neutral PBR materials, receives shadows, and no longer casts dominant site-wide shadows.
- Editable massing retains muted user color but uses a cleaner architectural material response.
- Glazing is low-saturation gray-blue physical glass without emissive blue glow; frames and shades use restrained standard materials.
- Sun/fill lighting and SAO provide clearer contact depth with more defined soft shadows.
- Shadow camera and camera framing fit editable buildings rather than the context model.
- Edit mode adds a crisp mass-only blue outline while context remains opaque and visually subordinate.
- Frame-all is available as a familiar icon command in the bottom toolbar.
- Teaching polish: the mini graph is now labeled “Design history,” centers a lone baseline at `(84,56)` in its `168×112` viewport, labels it “Baseline,” and uses correct option/building grammar.
- The comparison dialog is titled “Compare design options”; sDA, energy, and GWP badges expose concise native definitions and higher/lower-is-better guidance on hover.

**Responsive Findings**

- 1024×768: canvas fills the area below the 48 px tab bar; model, hint, tool rail, graph card, and status bar remain coherent.
- 768×700: model rail remains vertical; graph card and bottom status remain separate. A border-level rail/card touch was corrected with tablet spacing.
- 640×700: model rail moves horizontally above the status bar; graph card, rail, status bar, and context hint have zero measured overlap after spacing adjustment.
- No blank, stretched, or incorrectly offset canvas was observed at the tested sizes.

**Automated Verification**

- Full suite: 20 test files, 105 tests passed.
- Production build passed.
- Browserslist database updated to `caniuse-lite 1.0.30001809`; stale database warning removed.
- Remaining build notice: the existing main bundle is above Vite's 500 kB advisory threshold.

**Open Visual QA**

- Capture and compare a 1440×900 desktop view when convenient.
- Run/load a multi-floor daylight result and compare heatmap occlusion, ghost context, and legend restoration against the Sefaira references.
- Revisit context and editable-mass luminance only if user-provided screenshots show insufficient separation on another display.

**Comparison History**

- Iteration 1: façade/daylight implementation and automated geometry checks.
- Iteration 2: compact Spacio-inspired workspace stabilization.
- Iteration 3: browser-verified architectural viewport pass: palette, context hierarchy, PBR facade materials, lighting/shadows, SAO, selection outline, camera framing, and responsive collision fixes.

final result: passed for normal/edit workspace; daylight-analysis screenshot review pending

## Current review — 2026-09-06

The historical pass above is not the current acceptance result. A fresh review found critical editing and rendering issues. Full evidence and prioritized recommendations: [Premium editor review](docs/audits/2026-09-06-premium/REVIEW.md).

- Captured current normal, selection, edit, seven-floor preview, study dialog, design history, drawing, creation and deletion states with user-authorized local Playwright. The in-app browser was unavailable.
- Browser used ANGLE SwiftShader software rendering. SAO produced black surfaces; temporarily disabling SAO restored the scene at the same camera. This isolates the failing pass in this environment, but hardware-GPU reproduction remains open. No application source changes were made.
- Confirmed edit backdrop blocks viewport interaction and cancels draft edits on a scene click. Seven-floor preview geometry correctly measured 24.5 m, and cancellation restored 21 m.
- Confirmed façade instance bounds remain empty (sphere radius -1) despite active glass/frame/shade instance counts of 144/576/432.
- Confirmed Delete clears both buildings in a two-building test; the undo shortcut does not restore them.
- Normal-workspace overlays had zero measured intersection at 1024×768, 768×700 and 640×700. Canvas dimensions match the viewport below 48 px navigation.
- Four sampled WebGL pixels yielded four unique opaque colors, including pure black. No application errors in the main interaction session; an initial separate capture emitted software-renderer ReadPixels warnings.
- Current material token contrast: ground/context 2.14:1; mass/glass 3.57:1; glass/frame 1.89:1. Actual glass token is #547EA5, differing from the older documented palette.
- Current validation: 21 test files / 107 tests passed; production build passed with a 1,143.09 kB main JS chunk (313.57 kB gzip). Separate TypeScript checking reports 64 errors; the build script does not run it.
- Remaining verification: hardware rendering and motion artifacts, representative GPU performance, completed daylight/energy visualization, large projects, all modal/responsive states, long-run disposal, and screen-reader/touch flows.

Current acceptance: improvements required; review delivered, implementation not performed.

## 2026-09-06 — Seamless footprint editor

Implemented the nonmodal draw → reshape → move/rotate workflow with per-gesture history, exact coordinates, projected DOM handles, shared snapping and validated geometry. Final QA found and corrected a narrow-screen rail overlap and a hint that covered footprint handles; final hit tests confirm all displayed handles remain reachable at 1440, 1024, 768 and 640 px widths. The inspector collapses to 52 px.

126 tests pass; production build and targeted lint pass. The same 64 pre-existing TypeScript diagnostics remain. Browser checks cover creation, editing, cancellation, history, camera restoration, imports and graph reinstatement, with zero browser errors and nonblank WebGL samples. The existing AO defect is unchanged; final screenshots explicitly disable AO only in the diagnostic browser.

See [implementation, screenshots and reproducible checks](docs/audits/2026-09-06-seamless-editor/README.md).
