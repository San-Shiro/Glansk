// Shared widget definitions: sizing constraints (fixed vs free aspect ratio)
// and declared color points for each widget.

export const DEFAULT_COLOR_SLOTS = [
  { key: "bg", label: "Card Background", defaultThemeToken: "--canvas-surface", property: "--tile-bg" },
  { key: "border", label: "Border Color", defaultThemeToken: "--canvas-border", property: "--tile-border" },
  { key: "value", label: "Primary Value / Text", defaultThemeToken: "--canvas-text", property: "--tile-value" },
  { key: "accent", label: "Primary Accent", defaultThemeToken: "--canvas-accent", property: "--tile-accent" },
  { key: "accent2", label: "Secondary Accent", defaultThemeToken: "--canvas-accent-2", property: "--tile-accent-2" },
  { key: "accent3", label: "Tertiary Accent", defaultThemeToken: "--canvas-accent-3", property: "--tile-accent-3" },
];

/**
 * The 8 Universal Core Primitives of Glansk.
 * All complex/domain widgets belong in external packages built with @glansk/widget-sdk.
 */
export const CORE_PRIMITIVE_IDS = [
  "image",
  "shape",
  "icon",
  "video",
  "audio",
  "slideshow",
  "button",
  "label",
];

export const CORE_WIDGET_DEFINITIONS = {
  "image": {
    title: "Image",
    aspectRatio: null,
    minWidth: 80,
    minHeight: 80,
    colorSlots: [
      { key: "bg", label: "Tile Background", defaultThemeToken: "--canvas-surface", property: "--tile-bg" },
      { key: "border", label: "Border Color", defaultThemeToken: "--canvas-border", property: "--tile-border" },
      { key: "overlay", label: "Scrim Overlay", defaultThemeToken: "--canvas-surface-2", property: "--tile-track" },
    ],
    configSchema: [
      { key: "url", type: "string", label: "Image URL / Asset", default: "" },
      { key: "alt", type: "string", label: "Alt Description", default: "Image" },
      { key: "fit", type: "select", label: "Scale Fit Mode", default: "cover", options: [
        { label: "Cover (Fill & Crop)", value: "cover" },
        { label: "Contain (Letterbox)", value: "contain" },
        { label: "Fill (Stretch)", value: "fill" },
        { label: "Center (No Scale)", value: "none" },
      ]},
    ],
  },
  "shape": {
    title: "Shape",
    aspectRatio: null,
    minWidth: 60,
    minHeight: 60,
    colorSlots: [
      { key: "fill", label: "Shape Fill", defaultThemeToken: "--canvas-surface", property: "--shape-fill" },
      { key: "border", label: "Border Color", defaultThemeToken: "--canvas-border", property: "--shape-border" },
      { key: "accent", label: "Accent / Glow", defaultThemeToken: "--canvas-accent", property: "--shape-glow" },
    ],
    configSchema: [
      { key: "shapeType", type: "select", label: "Shape Type", default: "rounded-rect", options: [
        { label: "Rounded Rectangle", value: "rounded-rect" },
        { label: "Rectangle", value: "rectangle" },
        { label: "Circle / Ellipse", value: "circle" },
        { label: "Pill / Capsule", value: "pill" },
        { label: "Divider Line", value: "divider" },
      ]},
      { key: "blur", type: "number", label: "Backdrop Blur (px)", min: 0, max: 32, default: 0 },
    ],
  },
  "icon": {
    title: "Icon Symbol",
    aspectRatio: null,
    minWidth: 48,
    minHeight: 48,
    colorSlots: [
      { key: "iconColor", label: "Icon Color", defaultThemeToken: "--canvas-accent", property: "--icon-color" },
      { key: "iconBg", label: "Container Background", defaultThemeToken: "--canvas-surface", property: "--icon-bg" },
      { key: "border", label: "Border Color", defaultThemeToken: "--canvas-border", property: "--icon-border" },
    ],
    configSchema: [
      { key: "icon", type: "string", label: "Icon Name / SVG", default: "zap" },
      { key: "size", type: "number", label: "Icon Size (px)", min: 16, max: 128, default: 32 },
      { key: "shape", type: "select", label: "Container Shape", default: "rounded", options: [
        { label: "Rounded Box", value: "rounded" },
        { label: "Circle", value: "circle" },
        { label: "Flat / None", value: "none" },
      ]},
      { key: "badge", type: "string", label: "Status Badge / Value", default: "" },
    ],
  },
  "video": {
    title: "Video Stream",
    aspectRatio: null,
    minWidth: 200,
    minHeight: 140,
    colorSlots: DEFAULT_COLOR_SLOTS,
    configSchema: [
      { key: "url", type: "string", label: "Video URL / Stream", default: "" },
      { key: "autoplay", type: "boolean", label: "Autoplay", default: true },
      { key: "loop", type: "boolean", label: "Loop Continuously", default: true },
      { key: "muted", type: "boolean", label: "Mute Audio", default: true },
      { key: "controls", type: "boolean", label: "Show Native Controls", default: false },
      { key: "fit", type: "select", label: "Video Scaling", default: "cover", options: [
        { label: "Cover", value: "cover" },
        { label: "Contain", value: "contain" },
      ]},
    ],
  },
  "audio": {
    title: "Audio Stream",
    aspectRatio: null,
    minWidth: 260,
    minHeight: 90,
    colorSlots: [
      { key: "bg", label: "Card Background", defaultThemeToken: "--canvas-surface", property: "--tile-bg" },
      { key: "border", label: "Border Color", defaultThemeToken: "--canvas-border", property: "--tile-border" },
      { key: "primaryText", label: "Track Title", defaultThemeToken: "--canvas-text", property: "--tile-value" },
      { key: "secondaryText", label: "Artist / Stream", defaultThemeToken: "--canvas-text-muted", property: "--tile-detail" },
      { key: "accent", label: "Playback Accent", defaultThemeToken: "--canvas-accent", property: "--tile-accent" },
      { key: "trackSurface", label: "Scrubber Surface", defaultThemeToken: "--canvas-surface-2", property: "--tile-track" },
    ],
    configSchema: [
      { key: "title", type: "string", label: "Track Title", default: "Audio Track" },
      { key: "artist", type: "string", label: "Artist / Stream", default: "Media Player" },
      { key: "src", type: "string", label: "Audio Stream URL", default: "" },
      { key: "autoplay", type: "boolean", label: "Autoplay", default: false },
      { key: "loop", type: "boolean", label: "Loop", default: false },
    ],
  },
  "slideshow": {
    title: "Image Slideshow",
    aspectRatio: null,
    minWidth: 220,
    minHeight: 140,
    colorSlots: [
      { key: "bg", label: "Card Background", defaultThemeToken: "--canvas-surface", property: "--tile-bg" },
      { key: "border", label: "Border Color", defaultThemeToken: "--canvas-border", property: "--tile-border" },
      { key: "indicatorDot", label: "Indicator Dot", defaultThemeToken: "--canvas-surface-2", property: "--ss-dot-bg" },
      { key: "indicatorActive", label: "Indicator Active", defaultThemeToken: "--canvas-accent", property: "--ss-dot-active" },
    ],
    configSchema: [
      { key: "interval", type: "number", label: "Interval (seconds)", min: 1, max: 120, default: 5 },
      { key: "transition", type: "select", label: "Transition Effect", default: "crossfade", options: [
        { label: "Crossfade", value: "crossfade" },
        { label: "Slide", value: "slide" },
        { label: "Zoom", value: "zoom" },
      ]},
      { key: "fit", type: "select", label: "Image Scale", default: "cover", options: [
        { label: "Cover", value: "cover" },
        { label: "Contain", value: "contain" },
      ]},
      { key: "showIndicators", type: "boolean", label: "Show Indicators", default: true },
    ],
  },
  "button": {
    title: "Action Button",
    aspectRatio: null,
    minWidth: 120,
    minHeight: 48,
    colorSlots: [
      { key: "buttonBg", label: "Button Background", defaultThemeToken: "--canvas-accent", property: "--btn-bg" },
      { key: "buttonText", label: "Button Text", defaultThemeToken: "--canvas-surface", property: "--btn-text" },
      { key: "border", label: "Button Border", defaultThemeToken: "--canvas-border", property: "--btn-border" },
      { key: "hoverBg", label: "Hover / Active Glow", defaultThemeToken: "--canvas-accent-2", property: "--btn-hover" },
    ],
    configSchema: [
      { key: "label", type: "string", label: "Button Text", default: "Action Trigger" },
      { key: "icon", type: "string", label: "Button Icon", default: "zap" },
      { key: "actionType", type: "select", label: "Action Type", default: "toggle-variable", options: [
        { label: "Toggle Boolean Variable", value: "toggle-variable" },
        { label: "Set Global Variable", value: "set-variable" },
        { label: "Increment Number Variable", value: "increment-variable" },
        { label: "Command Bus Dispatch", value: "command" },
        { label: "Open URL Link", value: "url" },
      ]},
      { key: "target", type: "string", label: "Target Variable / Command", default: "showElement" },
      { key: "variableValue", type: "string", label: "Value / Step", default: "true" },
      { key: "variant", type: "select", label: "Visual Variant", default: "solid", options: [
        { label: "Solid Accent", value: "solid" },
        { label: "Outline", value: "outline" },
        { label: "Ghost / Minimal", value: "ghost" },
      ]},
    ],
    outputVariables: {
      "clickCount": { name: "clickCount", type: "number", defaultValue: 0, description: "Total times this button has been pressed in the current session" },
      "lastClickedAt": { name: "lastClickedAt", type: "string", defaultValue: "", description: "ISO timestamp of the most recent button press" },
    },
  },
  "label": {
    title: "Label / Text",
    aspectRatio: null,
    minWidth: 100,
    minHeight: 40,
    colorSlots: [
      { key: "textColor", label: "Text Color", defaultThemeToken: "--canvas-text", property: "--tile-value" },
      { key: "subColor", label: "Subtitle Color", defaultThemeToken: "--canvas-text-muted", property: "--tile-detail" },
      { key: "accentColor", label: "Accent Highlight", defaultThemeToken: "--canvas-accent", property: "--tile-accent" },
    ],
    configSchema: [
      { key: "text", type: "string", label: "Headline / Label", default: "System Metric" },
      { key: "subtitle", type: "string", label: "Subtitle / Annotation", default: "" },
      { key: "fontSize", type: "select", label: "Typography Size", default: "lg", options: [
        { label: "Small (14px)", value: "sm" },
        { label: "Medium (18px)", value: "md" },
        { label: "Large (24px)", value: "lg" },
        { label: "Display XL (32px)", value: "xl" },
        { label: "Display 2XL (48px)", value: "2xl" },
      ]},
      { key: "fontWeight", type: "select", label: "Font Weight", default: "semibold", options: [
        { label: "Normal (400)", value: "normal" },
        { label: "Medium (500)", value: "medium" },
        { label: "Semibold (600)", value: "semibold" },
        { label: "Bold (700)", value: "bold" },
      ]},
      { key: "align", type: "select", label: "Alignment", default: "left", options: [
        { label: "Left Align", value: "left" },
        { label: "Center Align", value: "center" },
        { label: "Right Align", value: "right" },
      ]},
    ],
  },
};

/**
 * Legacy widget definitions maintained for backwards compatibility with
 * existing saved canvas files and earlier test suites.
 */
export const LEGACY_WIDGET_DEFINITIONS = {
  "env-hub": {
    title: "Environment Control Hub",
    aspectRatio: null,
    minWidth: 280,
    minHeight: 220,
    colorSlots: [
      { key: "bg", label: "Card Background", defaultThemeToken: "--canvas-surface", property: "--tile-bg" },
      { key: "border", label: "Border Color", defaultThemeToken: "--canvas-border", property: "--tile-border" },
      { key: "primaryText", label: "Primary Text & Numbers", defaultThemeToken: "--canvas-text", property: "--tile-value" },
      { key: "secondaryText", label: "Labels & Muted Details", defaultThemeToken: "--canvas-text-muted", property: "--tile-detail" },
      { key: "tempAccent", label: "Temperature Accent", defaultThemeToken: "--canvas-accent", property: "--tile-accent" },
      { key: "humidityAccent", label: "Humidity Accent", defaultThemeToken: "--canvas-accent-2", property: "--tile-accent-2" },
      { key: "aqiAccent", label: "Air Quality Accent", defaultThemeToken: "--canvas-accent-3", property: "--tile-accent-3" },
      { key: "onlineStatus", label: "Status (Online)", defaultThemeToken: "--canvas-positive", property: "--tile-positive" },
      { key: "warningStatus", label: "Status (Warning)", defaultThemeToken: "--canvas-warning", property: "--tile-warning" },
      { key: "controlBg", label: "Control Surface", defaultThemeToken: "--canvas-surface-2", property: "--tile-track" },
      { key: "controlActive", label: "Active Control Pill", defaultThemeToken: "--canvas-surface-raised", property: "--tile-raised" },
    ],
    configSchema: [
      { key: "label", type: "string", label: "Hub Display Title", default: "Environment Hub" },
      { key: "location", type: "string", label: "Room / Location Tag", default: "Living Room Hub" },
      { key: "targetTemperature", type: "number", label: "Target Temperature (°C)", min: 16, max: 32, step: 0.5, default: 22.0 },
      { key: "mode", type: "select", label: "HVAC Operation Mode", default: "auto", options: [
        { label: "Auto Climate Control", value: "auto" },
        { label: "Cooling Only", value: "cool" },
        { label: "Heating Only", value: "heat" },
        { label: "Eco Energy Saver", value: "eco" },
      ]},
      { key: "fanSpeed", type: "select", label: "Fan Velocity", default: "2", options: [
        { label: "1 — Ultra Quiet", value: "1" },
        { label: "2 — Balanced Normal", value: "2" },
        { label: "3 — High Turbo", value: "3" },
      ]},
      { key: "power", type: "boolean", label: "Climate Engine Power", default: true },
      { key: "apiKey", type: "secret-ref", label: "Weather Provider Secret", hint: "Vault secret for weather provider API authentication" },
    ],
  },
  "energy-matrix": {
    title: "Smart Energy & Grid Matrix",
    aspectRatio: null,
    minWidth: 320,
    minHeight: 240,
    colorSlots: [
      { key: "bg", label: "Card Background", defaultThemeToken: "--canvas-surface", property: "--tile-bg" },
      { key: "border", label: "Border Color", defaultThemeToken: "--canvas-border", property: "--tile-border" },
      { key: "primaryText", label: "Primary Text & Values", defaultThemeToken: "--canvas-text", property: "--tile-value" },
      { key: "secondaryText", label: "Labels & Unit Details", defaultThemeToken: "--canvas-text-muted", property: "--tile-detail" },
      { key: "solarAccent", label: "Solar Generation", defaultThemeToken: "--canvas-accent", property: "--tile-accent" },
      { key: "batteryAccent", label: "Battery Storage", defaultThemeToken: "--canvas-positive", property: "--tile-positive" },
      { key: "gridAccent", label: "Grid Exchange", defaultThemeToken: "--canvas-accent-2", property: "--tile-accent-2" },
      { key: "homeAccent", label: "Home Load", defaultThemeToken: "--canvas-accent-3", property: "--tile-accent-3" },
      { key: "flowTrack", label: "Circuit Tracks", defaultThemeToken: "--canvas-surface-2", property: "--tile-track" },
    ],
    configSchema: [
      { key: "label", type: "string", label: "Matrix Title", default: "Energy Flow Matrix" },
      { key: "solarKw", type: "number", label: "Solar Generation (kW)", min: 0, max: 100, step: 0.1, default: 5.2 },
      { key: "homeKw", type: "number", label: "Current Home Draw (kW)", min: 0, max: 100, step: 0.1, default: 2.8 },
      { key: "batterySoc", type: "number", label: "Battery Reserve (%)", min: 0, max: 100, step: 1, default: 85 },
      { key: "batteryCharging", type: "boolean", label: "Battery State: Charging", default: true },
      { key: "selfPowered", type: "number", label: "Self-Powered Efficiency (%)", min: 0, max: 100, step: 1, default: 94 },
    ],
  },
  "net-sentinel": {
    title: "Cyber Sentinel & Radar",
    aspectRatio: null,
    minWidth: 300,
    minHeight: 220,
    colorSlots: [
      { key: "bg", label: "Card Background", defaultThemeToken: "--canvas-surface", property: "--tile-bg" },
      { key: "border", label: "Border Color", defaultThemeToken: "--canvas-border", property: "--tile-border" },
      { key: "primaryText", label: "Telemetry Values", defaultThemeToken: "--canvas-text", property: "--tile-value" },
      { key: "secondaryText", label: "Labels & Headers", defaultThemeToken: "--canvas-text-muted", property: "--tile-detail" },
      { key: "radarBeam", label: "Radar Scanner Beam", defaultThemeToken: "--canvas-accent", property: "--tile-accent" },
      { key: "nodeActive", label: "Active Node Blips", defaultThemeToken: "--canvas-positive", property: "--tile-positive" },
      { key: "threatAlert", label: "Threat / Alert Badge", defaultThemeToken: "--canvas-danger", property: "--tile-danger" },
      { key: "warningGlow", label: "Latency Warning", defaultThemeToken: "--canvas-warning", property: "--tile-warning" },
      { key: "radarGrid", label: "Radar Gridlines", defaultThemeToken: "--canvas-surface-2", property: "--tile-track" },
    ],
    configSchema: [
      { key: "label", type: "string", label: "Sentinel Title", default: "Cyber Sentinel Radar" },
      { key: "threatLevel", type: "select", label: "Alert Readiness Status", default: "DEFCON 5: NOMINAL", options: [
        { label: "DEFCON 5 — Nominal Security", value: "DEFCON 5: NOMINAL" },
        { label: "DEFCON 4 — Elevated Watch", value: "DEFCON 4: ELEVATED" },
        { label: "DEFCON 3 — Round House Alert", value: "DEFCON 3: ROUND HOUSE" },
        { label: "DEFCON 2 — Fast Pace Threat", value: "DEFCON 2: FAST PACE" },
        { label: "DEFCON 1 — Cocked Pistol Critical", value: "DEFCON 1: COCKED PISTOL" },
      ]},
      { key: "radarSpeed", type: "number", label: "Sweep Velocity (seconds/rev)", min: 1, max: 12, step: 0.5, default: 4.0 },
      { key: "ping", type: "number", label: "Gateway Ping Latency (ms)", min: 1, max: 1000, step: 1, default: 14 },
      { key: "packetLoss", type: "number", label: "Packet Loss Rate (%)", min: 0, max: 100, step: 0.1, default: 0.0 },
      { key: "apiKey", type: "secret-ref", label: "Gateway Bearer Secret", hint: "Vault secret for authenticated network gateway telemetry" },
    ],
  },
  "image-slideshow": {
    title: "Image Slideshow",
    aspectRatio: null,
    minWidth: 200,
    minHeight: 120,
    colorSlots: [
      { key: "bg", label: "Card Background", defaultThemeToken: "--canvas-surface", property: "--tile-bg" },
      { key: "border", label: "Border Color", defaultThemeToken: "--canvas-border", property: "--tile-border" },
      { key: "indicatorDot", label: "Indicator Dot", defaultThemeToken: "--canvas-surface-2", property: "--ss-dot-bg" },
      { key: "indicatorActive", label: "Indicator Active", defaultThemeToken: "--canvas-accent", property: "--ss-dot-active" },
    ],
    configSchema: [
      { key: "label", type: "string", label: "Deck Title", default: "Image Slideshow" },
      { key: "interval", type: "number", label: "Slide Interval (seconds)", min: 1, max: 120, step: 1, default: 6 },
      { key: "transitionSpeed", type: "number", label: "Animation Duration (ms)", min: 200, max: 3000, step: 100, default: 800 },
      { key: "transition", type: "select", label: "Transition Effect", default: "crossfade", options: [
        { label: "Smooth Crossfade", value: "crossfade" },
        { label: "Horizontal Slide", value: "slide" },
        { label: "Subtle Zoom Fade", value: "zoom" },
      ]},
      { key: "fit", type: "select", label: "Image Scale Mode", default: "cover", options: [
        { label: "Cover (Fill tile, clip edges)", value: "cover" },
        { label: "Contain (Fit whole image, letterbox)", value: "contain" },
      ]},
      { key: "showIndicators", type: "boolean", label: "Display Indicator Dots", default: true },
      { key: "pauseOnHover", type: "boolean", label: "Pause Timer on Hover", default: false },
      { key: "shuffle", type: "boolean", label: "Shuffle Order", default: false },
      { key: "cdnToken", type: "secret-ref", label: "Private CDN Token", hint: "Vault secret for authenticated private asset CDN requests" },
    ],
  },
  "music-player": {
    title: "Interactive Music Player",
    aspectRatio: null,
    minWidth: 320,
    minHeight: 220,
    colorSlots: [
      { key: "bg", label: "Card Background", defaultThemeToken: "--canvas-surface", property: "--tile-bg" },
      { key: "border", label: "Border Color", defaultThemeToken: "--canvas-border", property: "--tile-border" },
      { key: "primaryText", label: "Track Title & Time", defaultThemeToken: "--canvas-text", property: "--tile-value" },
      { key: "secondaryText", label: "Artist & Album", defaultThemeToken: "--canvas-text-muted", property: "--tile-detail" },
      { key: "playerAccent", label: "Play Button & Progress", defaultThemeToken: "--canvas-accent", property: "--tile-accent" },
      { key: "playerSecondary", label: "Equalizer Bars", defaultThemeToken: "--canvas-accent-2", property: "--tile-accent-2" },
      { key: "discSurface", label: "Vinyl Grooves", defaultThemeToken: "--canvas-surface-2", property: "--tile-track" },
    ],
    configSchema: [
      { key: "stateMode", type: "select", label: "State Storage Mode", default: "global", options: [
        { label: "🌐 Global (Synced Across All Screens)", value: "global" },
        { label: "🍪 Cookie-based (Saved Personal)", value: "cookie" },
        { label: "⚡ Stateless (Ephemeral Session)", value: "stateless" },
      ]},
      { key: "title", type: "string", label: "Deck Title", default: "Music Player" },
    ],
  },
  "device-switchboard": {
    title: "Smart Device Switchboard",
    aspectRatio: null,
    minWidth: 340,
    minHeight: 240,
    colorSlots: [
      { key: "bg", label: "Card Background", defaultThemeToken: "--canvas-surface", property: "--tile-bg" },
      { key: "border", label: "Border Color", defaultThemeToken: "--canvas-border", property: "--tile-border" },
      { key: "primaryText", label: "Device Titles & Watts", defaultThemeToken: "--canvas-text", property: "--tile-value" },
      { key: "secondaryText", label: "Status & Subtitles", defaultThemeToken: "--canvas-text-muted", property: "--tile-detail" },
      { key: "switchActive", label: "Active Toggle & Accent", defaultThemeToken: "--canvas-accent", property: "--tile-accent" },
      { key: "statusNominal", label: "Secured / Online State", defaultThemeToken: "--canvas-positive", property: "--tile-positive" },
      { key: "controlTrack", label: "Card Tracks & Sliders", defaultThemeToken: "--canvas-surface-2", property: "--tile-track" },
    ],
    configSchema: [
      { key: "stateMode", type: "select", label: "State Storage Mode", default: "global", options: [
        { label: "🌐 Global (Synced Across All Screens)", value: "global" },
        { label: "🍪 Cookie-based (Saved Personal)", value: "cookie" },
        { label: "⚡ Stateless (Ephemeral Session)", value: "stateless" },
      ]},
      { key: "title", type: "string", label: "Switchboard Title", default: "Device Switchboard" },
    ],
  },
  "task-matrix": {
    title: "Task & Action Matrix",
    aspectRatio: null,
    minWidth: 300,
    minHeight: 220,
    colorSlots: [
      { key: "bg", label: "Card Background", defaultThemeToken: "--canvas-surface", property: "--tile-bg" },
      { key: "border", label: "Border Color", defaultThemeToken: "--canvas-border", property: "--tile-border" },
      { key: "primaryText", label: "Task Labels & Stats", defaultThemeToken: "--canvas-text", property: "--tile-value" },
      { key: "secondaryText", label: "Headers & Counters", defaultThemeToken: "--canvas-text-muted", property: "--tile-detail" },
      { key: "checkAccent", label: "Active Checkbox Accent", defaultThemeToken: "--canvas-accent", property: "--tile-accent" },
      { key: "taskComplete", label: "Completed Ring & Badge", defaultThemeToken: "--canvas-positive", property: "--tile-positive" },
      { key: "taskUrgent", label: "Urgent Priority Tag", defaultThemeToken: "--canvas-danger", property: "--tile-danger" },
    ],
    configSchema: [
      { key: "stateMode", type: "select", label: "State Storage Mode", default: "global", options: [
        { label: "🌐 Global (Synced Across All Screens)", value: "global" },
        { label: "🍪 Cookie-based (Saved Personal)", value: "cookie" },
        { label: "⚡ Stateless (Ephemeral Session)", value: "stateless" },
      ]},
      { key: "title", type: "string", label: "Board Title", default: "Task Matrix" },
    ],
  },
  "quick-notes": {
    title: "Quick Notes / Sticky Board",
    aspectRatio: null,
    minWidth: 260,
    minHeight: 180,
    colorSlots: [
      { key: "bg", label: "Card Background", defaultThemeToken: "--canvas-surface", property: "--tile-bg" },
      { key: "border", label: "Border Color", defaultThemeToken: "--canvas-border", property: "--tile-border" },
      { key: "primaryText", label: "Note Text", defaultThemeToken: "--canvas-text", property: "--tile-value" },
      { key: "secondaryText", label: "Labels & Metadata", defaultThemeToken: "--canvas-text-muted", property: "--tile-detail" },
      { key: "noteAccent", label: "Pin & Active Accent", defaultThemeToken: "--canvas-accent", property: "--tile-accent" },
      { key: "noteSurface", label: "Paper Surface", defaultThemeToken: "--canvas-surface-2", property: "--tile-track" },
      { key: "badgeBg", label: "State Badge Background", defaultThemeToken: "--canvas-surface-raised", property: "--tile-raised" },
    ],
    configSchema: [
      { key: "stateMode", type: "select", label: "State Storage Mode", default: "cookie", options: [
        { label: "🌐 Global (Synced Across All Screens)", value: "global" },
        { label: "🍪 Cookie-based (Saved Personal)", value: "cookie" },
        { label: "⚡ Stateless (Ephemeral Session)", value: "stateless" },
      ]},
      { key: "title", type: "string", label: "Note Title", default: "Quick Notes" },
      { key: "colorTag", type: "select", label: "Note Tag Color", default: "amber", options: [
        { label: "Amber / Warm Glow", value: "amber" },
        { label: "Cyan / Neon Blue", value: "cyan" },
        { label: "Emerald / Mint Green", value: "emerald" },
        { label: "Purple / Cyber Violet", value: "purple" },
        { label: "Rose / Sunset Crimson", value: "rose" },
      ]},
      { key: "text", type: "textarea", label: "Default / Initial Note Text", default: "" },
    ],
  },
  "emitter-widget": {
    title: "Universal App Emitter",
    aspectRatio: null,
    minWidth: 280,
    minHeight: 180,
    colorSlots: [
      { key: "bg", label: "Card Background", defaultThemeToken: "--canvas-surface", property: "--tile-bg" },
      { key: "border", label: "Border Color", defaultThemeToken: "--canvas-border", property: "--tile-border" },
      { key: "primaryText", label: "Primary Track / Metric", defaultThemeToken: "--canvas-text", property: "--tile-value" },
      { key: "secondaryText", label: "Artist / Subtitle", defaultThemeToken: "--canvas-text-muted", property: "--tile-detail" },
      { key: "accent", label: "Control Button & Track", defaultThemeToken: "--canvas-accent", property: "--tile-accent" },
      { key: "statusActive", label: "Playing / Online Dot", defaultThemeToken: "--canvas-positive", property: "--tile-positive" },
      { key: "surfaceTrack", label: "Progress Track / Sliders", defaultThemeToken: "--canvas-surface-2", property: "--tile-track" },
    ],
    configSchema: [
      { key: "label", type: "string", label: "Display Title" },
    ],
  },
};

export const WIDGET_DEFINITIONS = {
  ...CORE_WIDGET_DEFINITIONS,
  ...LEGACY_WIDGET_DEFINITIONS,
};

export function getWidgetDefinition(widgetId) {
  return WIDGET_DEFINITIONS[widgetId] || {
    title: widgetId,
    aspectRatio: null,
    minWidth: 160,
    minHeight: 100,
    colorSlots: DEFAULT_COLOR_SLOTS,
    configSchema: [],
  };
}
