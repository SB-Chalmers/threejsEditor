# Footprint preview freeze fix

Reproduced the event scheduling failure with a regression test before changing code: schedule pointer movement, rerender the editor before its animation frame, then move again. The old effect canceled the frame but retained its non-null ID, causing all subsequent movement to return early. A second test demonstrated that the old throttle discarded the final pointer position within a frame.

`useClickHandler` now retains listeners across callback changes, reads callbacks from the latest committed render, coalesces to the latest pointer event, and resets canceled work during cleanup. Building geometry, drawing appearance, and click/double-click semantics were not changed.

Validation:

- Regression tests: two failures before the fix; all three tests pass after it, including pending-frame cancellation on unmount.
- Full suite: 22 files, 110 tests passed.
- Production build passed (existing bundle-size advisory remains).
- ESLint passed for the modified hook and new test file; git diff whitespace check passed.
- User-authorized local Playwright browser: three footprint vertices; five cycles of entering the start-point snap zone, changing floor settings, and moving away. Ten recorded transitions each retain exactly one preview marker and one preview line with three committed points. Cancel clears previews; restart restores cursor preview. No application console errors.
- [Runtime verification](verification.json), [moving preview screenshot](preview-line.png), [snap screenshot](snap-point.png).

Screenshots were opened and inspected. The browser uses SwiftShader software rendering and retains the separately documented AO black-surface artifact from the earlier review. Runtime checks establish continued pointer/geometry updates; these captures do not establish rendering quality on hardware GPUs.
