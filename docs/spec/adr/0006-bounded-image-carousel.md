# ADR 0006: bounded packaged image carousel

Glansk carries `glansk.media/image-carousel` as a signed/package-local vertical slice. Configuration accepts 1–32 `assets/` JPEG, PNG, WebP, or AVIF paths in a 12 KiB envelope. Remote, absolute, encoded, traversing, query/fragment, SVG/GIF, data and blob sources are rejected.

Runtime uses exactly two `<img>` layers, one decode candidate, one-shot timers, generation tokens, and opacity-only fades. It retains the last good layer on failure, applies bounded exponential retry, clears the hidden old source, honors reduced motion and visibility, and destroys timers/sources/listeners on host teardown/pagehide/remount. No canvas, ImageBitmap, custom cache, cache busting, forced reflow, permanent `will-change`, interval timer, or unbounded preload is used.

Automated tests establish structural bounds and long-run DOM/timer behavior. Pi Zero 2 W PSS and CPU acceptance numbers remain pending physical measurement; no measured hardware performance is claimed.
