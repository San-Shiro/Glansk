# Image carousel operations

Use only package-owned files below `src/widgets/glansk.media/image-carousel/assets/`. Limits are 32 configured images, 256 KiB per file, 2 MiB package media total, and JPEG/PNG/WebP/AVIF only. Keep filenames lowercase and relative (`assets/name.png`). Never add remote URLs, SVG/GIF, data/blob URLs, query strings, fragments, or traversal.

Run `bun run validate` and `bun run test:carousel-long`. Browser checks verify two image elements, one candidate maximum, stable DOM, transition, reduced motion, failure retention, remount cleanup, CSP and opaque-origin isolation. Before production acceptance, repeat a representative playlist on physical Pi Zero 2 W hardware and record process PSS and steady-state CPU; automated desktop results are not substitutes.
