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
