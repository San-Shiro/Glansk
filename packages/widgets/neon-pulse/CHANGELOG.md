# Changelog - Neon Pulse HUD (`glansk.neon-pulse`)

All notable changes to this widget package are documented in this file.

## [1.1.0] - 2026-09-20
### Added
- **Particle Pulse Waveform**: Real-time canvas rendering an ambient undulating cyber-wave reacting to pulse triggers.
- **Multi-Palette Theme Switcher**: Instant switching between *Neon Cyan* (`#00f3ff`), *Cyber Amber* (`#ffaa00`), *Aurora Emerald* (`#00ff9d`), and *Synthwave Violet* (`#d946ef`).
- **State Broadcaster**: Interactive trigger modifying `glansk.pulse.temperature` and publishing real-time pulse events.
- **Integrated Release Notes**: In-widget slide-out modal allowing users to inspect changelogs directly inside the kiosk or dashboard.
- **Manifest Changelog Metadata**: Formal RFC 8785 canonical changelog records embedded directly in `manifest.json`.

### Security & Hardening
- Strictly compliant with CSP `connect-src 'none'` (all state communication flows through `@glansk/widget-sdk` message bus).

---

## [1.0.0] - 2026-09-15
### Added
- Digital neon HUD clock with local time, seconds bar, and milliseconds.
- Core telemetry indicators (Core Temp, Frequency, Pulse Status).
- Initial package release for Glansk platform.
