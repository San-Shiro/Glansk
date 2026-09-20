// Built-in widget body markup. Shared so the widgets look identical
// in the kiosk and the admin editor.
// Note: Titles/labels are stripped from the visual tile layout — widgets completely
// own their internal CSS and layout.

export const esc = value => String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
const array = value => Array.isArray(value) ? value : [];
const clampPct = value => Math.max(0, Math.min(100, Number(value) || 0));

export function widgetMarkup(widget) {
  const config = widget.config || {};
  const value = `<div class="value">${esc(config.value ?? config.text ?? '')}</div>`;
  const detail = config.detail ? `<div class="detail">${esc(config.detail)}</div>` : '';

  // --- Core Universal Primitives ---
  if (widget.widgetId === 'image') {
    const app = config.appearance || {};
    const url = config.url || '';
    const alt = esc(config.alt || 'Image');
    const fit = esc(config.fit || 'cover');
    const radius = Number(app.borderRadius !== undefined && app.borderRadius !== null ? app.borderRadius : (config.radius || 0)) || 0;
    const opacity = app.opacity !== undefined ? Number(app.opacity) : (config.opacity !== undefined ? Number(config.opacity) / 100 : 1);
    if (url) {
      return `
        <div class="primitive-image-wrap" style="border-radius: ${radius}px; opacity: ${opacity};">
          <img class="primitive-image" src="${esc(url)}" alt="${alt}" style="object-fit: ${fit}; border-radius: ${radius}px;" />
        </div>
      `;
    }
    return `
      <div class="primitive-image-wrap primitive-image-placeholder" style="border-radius: ${radius}px; opacity: ${opacity};">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <span class="primitive-placeholder-text">Image Primitive</span>
      </div>
    `;
  }

  if (widget.widgetId === 'shape') {
    const app = config.appearance || {};
    const shapeType = esc(config.shapeType || 'rounded-rect');
    const radius = Number(app.borderRadius !== undefined && app.borderRadius !== null ? app.borderRadius : (config.radius ?? 12));
    const borderWidth = Number(app.borderWidth !== undefined && app.borderWidth !== null ? app.borderWidth : (config.borderWidth ?? 1));
    const blur = Number(config.blur ?? 0);
    const styleParts = [];
    if (shapeType === 'circle') styleParts.push('border-radius: 50%');
    else if (shapeType === 'pill') styleParts.push('border-radius: 9999px');
    else if (shapeType === 'rectangle') styleParts.push('border-radius: 0');
    else styleParts.push(`border-radius: ${radius}px`);
    styleParts.push(`border-width: ${borderWidth}px`);
    if (blur > 0) styleParts.push(`backdrop-filter: blur(${blur}px)`);

    return `<div class="primitive-shape primitive-shape-${shapeType}" style="${styleParts.join('; ')}"></div>`;
  }

  if (widget.widgetId === 'icon') {
    const size = Number(config.size || 32);
    const shape = esc(config.shape || 'rounded');
    const badge = config.badge ? `<span class="primitive-icon-badge">${esc(config.badge)}</span>` : '';
    return `
      <div class="primitive-icon-container primitive-icon-${shape}">
        <div class="primitive-icon-glyph" style="font-size: ${size}px; width: ${size}px; height: ${size}px;">
          <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
        </div>
        ${badge}
      </div>
    `;
  }

  if (widget.widgetId === 'video') {
    const url = config.url || '';
    const autoplay = config.autoplay !== false;
    const loop = config.loop !== false;
    const muted = config.muted !== false;
    const controls = Boolean(config.controls);
    const fit = esc(config.fit || 'cover');
    if (url) {
      return `
        <div class="primitive-video-wrap">
          <video class="primitive-video" src="${esc(url)}" ${autoplay ? 'autoplay' : ''} ${loop ? 'loop' : ''} ${muted ? 'muted' : ''} ${controls ? 'controls' : ''} playsinline style="object-fit: ${fit};"></video>
        </div>
      `;
    }
    return `
      <div class="primitive-video-wrap primitive-video-placeholder">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
        </svg>
        <span class="primitive-placeholder-text">Video Stream Primitive</span>
      </div>
    `;
  }

  if (widget.widgetId === 'audio') {
    const title = esc(config.title || 'Audio Track');
    const artist = esc(config.artist || 'Media Primitive');
    const playing = Boolean(config.playing);
    return `
      <div class="primitive-audio-wrap">
        <div class="primitive-audio-disc ${playing ? 'is-playing' : ''}">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </div>
        <div class="primitive-audio-meta">
          <span class="primitive-audio-title">${title}</span>
          <span class="primitive-audio-artist">${artist}</span>
        </div>
        <button type="button" class="primitive-audio-play" data-action="toggle-play">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            ${playing ? '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>' : '<polygon points="5 3 19 12 5 21 5 3"/>'}
          </svg>
        </button>
      </div>
    `;
  }

  if (widget.widgetId === 'button') {
    const app = config.appearance || {};
    const label = esc(config.label || 'Action Trigger');
    const icon = config.icon ? esc(config.icon) : '';
    const variant = esc(config.variant || 'solid');
    const actionType = esc(config.actionType || 'command');
    const target = esc(config.target || config.variableName || 'showElement');
    const variableValue = esc(config.variableValue ?? 'true');
    const radiusVal = app.borderRadius !== undefined && app.borderRadius !== null ? app.borderRadius : config.radius;
    const radiusStyle = radiusVal !== undefined && radiusVal !== null ? `style="border-radius: ${Number(radiusVal)}px;"` : '';
    return `
      <div class="primitive-btn-wrap">
        <button type="button" class="primitive-btn primitive-btn-${variant}" data-action="${actionType}" data-target="${target}" data-value="${variableValue}" ${radiusStyle}>
          ${icon ? `<span class="primitive-btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>` : ''}
          <span class="primitive-btn-label">${label}</span>
        </button>
      </div>
    `;
  }

  if (widget.widgetId === 'label') {
    const text = esc(config.text ?? config.value ?? 'System Metric');
    const subtitle = config.subtitle ?? config.detail ? esc(config.subtitle ?? config.detail) : '';
    const fontSize = esc(config.fontSize || 'lg');
    const fontWeight = esc(config.fontWeight || 'semibold');
    const align = esc(config.align || 'left');
    return `
      <div class="primitive-label primitive-label-${fontSize} primitive-label-${fontWeight} primitive-align-${align}">
        <div class="primitive-label-text">${text}</div>
        ${subtitle ? `<div class="primitive-label-sub">${subtitle}</div>` : ''}
      </div>
    `;
  }

  // --- Domain / Legacy Widgets (Delegated Fallback) ---
  if (widget.widgetId === 'env-hub') {
    const temp = config.temperature ?? config.temp ?? '23.4';
    const target = config.targetTemperature ?? config.target ?? '22.0';
    const humidity = config.humidity ?? '48';
    const aqi = config.airQuality ?? config.aqi ?? '32';
    const location = config.location ?? config.room ?? 'Climate Zone 1';
    const mode = String(config.mode || 'auto').toLowerCase();
    const power = config.power !== false;
    const fan = Number(config.fanSpeed) || 2;
    const history = Array.isArray(config.history) ? config.history : [21, 21.8, 22.4, 23.0, 23.8, 24.2, 23.9, 23.4, 22.8, 22.5, 23.1, 23.4];
    const minH = Math.min(...history);
    const maxH = Math.max(...history);
    const range = (maxH - minH) || 1;

    return `
      <div class="env-hub ${power ? 'is-on' : 'is-off'}">
        <div class="env-header">
          <div class="env-location">
            <span class="env-status-dot"></span>
            <span class="env-loc-name">${esc(location)}</span>
          </div>
          <div class="env-badge">${power ? 'ACTIVE' : 'STANDBY'}</div>
        </div>

        <div class="env-metrics">
          <div class="env-card env-card-temp">
            <span class="env-metric-label">TEMP</span>
            <div class="env-metric-val"><b>${esc(temp)}</b><small>°C</small></div>
            <span class="env-target">Target: ${esc(target)}°C</span>
          </div>
          <div class="env-card env-card-humidity">
            <span class="env-metric-label">HUMIDITY</span>
            <div class="env-metric-val"><b>${esc(humidity)}</b><small>%</small></div>
            <span class="env-target">Optimal</span>
          </div>
          <div class="env-card env-card-aqi">
            <span class="env-metric-label">AIR QUALITY</span>
            <div class="env-metric-val"><b>${esc(aqi)}</b><small>AQI</small></div>
            <span class="env-target">Good</span>
          </div>
        </div>

        <div class="env-trend-section">
          <div class="env-trend-header">
            <span>24H TEMPERATURE TREND</span>
            <small>Peak: ${esc(maxH)}°C</small>
          </div>
          <div class="env-sparkline">
            ${history.map(v => {
              const pct = Math.max(12, Math.min(100, Math.round(((Number(v) - minH) / range) * 88 + 12)));
              return `<i style="height:${pct}%" title="${esc(v)}°C"></i>`;
            }).join('')}
          </div>
        </div>

        <div class="env-controls">
          <div class="env-mode-pills">
            ${['auto', 'heat', 'cool', 'fan'].map(m => `
              <button type="button" class="env-pill ${mode === m ? 'active' : ''}">${esc(m.toUpperCase())}</button>
            `).join('')}
          </div>
          <div class="env-fan-group">
            <span class="env-fan-label">FAN</span>
            ${[1, 2, 3].map(s => `
              <button type="button" class="env-fan-btn ${fan === s ? 'active' : ''}">${s}</button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  if (widget.widgetId === 'energy-matrix') {
    const solarKw = Number(config.solarKw ?? config.solar ?? 5.24).toFixed(2);
    const homeKw = Number(config.homeKw ?? config.home ?? 2.85).toFixed(2);
    const batteryKw = Number(config.batteryKw ?? config.battery ?? 1.95).toFixed(2);
    const batterySoc = Math.max(0, Math.min(100, Math.round(Number(config.batterySoc ?? config.soc ?? 88))));
    const gridKw = Number(config.gridKw ?? config.grid ?? -0.44).toFixed(2);
    const isExporting = Number(gridKw) <= 0;
    const isCharging = config.batteryCharging !== false && Number(batteryKw) >= 0;
    const selfPowered = Math.max(0, Math.min(100, Math.round(Number(config.selfPowered ?? 94))));
    const dailySolarKwh = Number(config.dailySolarKwh ?? 28.4).toFixed(1);

    // SVG Circular SoC progress calculation: circumference = 2 * PI * 22 ~= 138.2
    const circumference = 138.2;
    const socOffset = (circumference * (1 - batterySoc / 100)).toFixed(1);

    // Dynamic animation durations based on flow speed (faster if higher kW)
    const solarSpeed = Math.max(0.6, (3.2 / (Math.max(0.5, Number(solarKw))))).toFixed(2);
    const batterySpeed = Math.max(0.6, (3.2 / (Math.max(0.5, Math.abs(Number(batteryKw)))))).toFixed(2);
    const gridSpeed = Math.max(0.6, (3.2 / (Math.max(0.5, Math.abs(Number(gridKw)))))).toFixed(2);

    return `
      <div class="energy-matrix">
        <div class="em-header">
          <div class="em-title-group">
            <span class="em-pulse-dot"></span>
            <span class="em-title">${esc(config.label || 'Smart Energy Flow')}</span>
          </div>
          <div class="em-badge ${selfPowered >= 80 ? 'em-badge-opt' : 'em-badge-grid'}">
            ${selfPowered}% SELF-POWERED
          </div>
        </div>

        <div class="em-canvas-wrapper">
          <svg class="em-svg" viewBox="0 0 420 220" preserveAspectRatio="xMidYMid meet">
            <!-- Flow Background Tracks -->
            <path class="em-track" d="M 85 60 C 130 60, 160 85, 200 110" />
            <path class="em-track" d="M 65 85 L 65 135" />
            <path class="em-track" d="M 85 160 C 130 160, 160 135, 200 110" />
            <path class="em-track" d="M 335 60 C 290 60, 260 85, 220 110" />

            <!-- Animated Stream Particle Paths -->
            <path class="em-stream em-stream-solar" style="animation-duration: ${solarSpeed}s" d="M 85 60 C 130 60, 160 85, 200 110" />
            <path class="em-stream em-stream-battery ${isCharging ? '' : 'is-discharging'}" style="animation-duration: ${batterySpeed}s" d="${isCharging ? 'M 65 85 L 65 135' : 'M 65 135 L 65 85'}" />
            <path class="em-stream em-stream-bat-home" style="animation-duration: ${batterySpeed}s" d="M 85 160 C 130 160, 160 135, 200 110" />
            <path class="em-stream em-stream-grid ${isExporting ? 'is-exporting' : 'is-importing'}" style="animation-duration: ${gridSpeed}s" d="${isExporting ? 'M 220 110 C 260 85, 290 60, 335 60' : 'M 335 60 C 290 60, 260 85, 220 110'}" />

            <!-- Battery Circular State-of-Charge Ring -->
            <circle class="em-soc-bg" cx="65" cy="160" r="22" />
            <circle class="em-soc-bar" cx="65" cy="160" r="22" stroke-dasharray="138.2" stroke-dashoffset="${socOffset}" />
          </svg>

          <!-- Node Overlays positioned over SVG coordinates -->
          <!-- Solar Node -->
          <div class="em-node em-node-solar" style="top: 12%; left: 6%;">
            <div class="em-node-icon em-icon-solar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            </div>
            <div class="em-node-meta">
              <span class="em-node-name">SOLAR</span>
              <span class="em-node-val"><b>${solarKw}</b> <small>kW</small></span>
              <span class="em-node-sub">${dailySolarKwh} kWh today</span>
            </div>
          </div>

          <!-- Grid Node -->
          <div class="em-node em-node-grid" style="top: 12%; right: 6%;">
            <div class="em-node-icon em-icon-grid">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <div class="em-node-meta text-right">
              <span class="em-node-name">GRID</span>
              <span class="em-node-val"><b>${Math.abs(Number(gridKw)).toFixed(2)}</b> <small>kW</small></span>
              <span class="em-node-sub ${isExporting ? 'em-sub-export' : 'em-sub-import'}">${isExporting ? '↑ Exporting' : '↓ Importing'}</span>
            </div>
          </div>

          <!-- Battery Node -->
          <div class="em-node em-node-battery" style="bottom: 10%; left: 6%;">
            <div class="em-node-icon em-icon-battery">
              <span class="em-soc-pct">${batterySoc}%</span>
            </div>
            <div class="em-node-meta">
              <span class="em-node-name">BATTERY</span>
              <span class="em-node-val"><b>${batteryKw}</b> <small>kW</small></span>
              <span class="em-node-sub">${isCharging ? '⚡ Charging' : 'Discharging'}</span>
            </div>
          </div>

          <!-- Home Consumer Node -->
          <div class="em-node em-node-home" style="top: 50%; left: 50%; transform: translate(-50%, -50%);">
            <div class="em-node-icon em-icon-home">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div class="em-node-meta text-center">
              <span class="em-node-name">HOME LOAD</span>
              <span class="em-node-val"><b>${homeKw}</b> <small>kW</small></span>
              <span class="em-node-sub">Real-time demand</span>
            </div>
          </div>
        </div>

        <div class="em-footer-split">
          <div class="em-split-labels">
            <span>Power Sources Breakdown:</span>
            <span><b>${selfPowered}%</b> Clean Energy</span>
          </div>
          <div class="em-split-bar">
            <div class="em-bar-solar" style="width: ${Math.min(100, Math.round((Number(solarKw) / (Number(homeKw) || 1)) * 60))}%"></div>
            <div class="em-bar-battery" style="width: ${Math.min(40, Math.round(batterySoc * 0.35))}%"></div>
            <div class="em-bar-grid" style="width: ${100 - selfPowered}%"></div>
          </div>
        </div>
      </div>
    `;
  }

  if (widget.widgetId === 'net-sentinel') {
    const threatLevel = String(config.threatLevel || 'DEFCON 5: NOMINAL').toUpperCase();
    const ping = Number(config.ping ?? config.latency ?? 14);
    const jitter = Number(config.jitter ?? 0.8).toFixed(1);
    const throughput = Number(config.throughput ?? 842);
    const packetLoss = Number(config.packetLoss ?? 0.00).toFixed(2);
    const onlineNodes = Number(config.onlineNodes ?? 24);
    const totalNodes = Number(config.totalNodes ?? 24);
    const radarSpeed = Number(config.radarSpeed ?? 4.0);

    const blips = Array.isArray(config.blips) ? config.blips : [
      { id: 'gw-1', x: 68, y: 38, label: 'GW-Alpha', tone: 'ok', ping: 8 },
      { id: 'node-2', x: 122, y: 72, label: 'Edge-West', tone: 'ok', ping: 14 },
      { id: 'srv-3', x: 42, y: 118, label: 'Core-DB', tone: 'ok', ping: 11 },
      { id: 'iot-4', x: 118, y: 128, label: 'Sensor-Mesh', tone: 'warn', ping: 42 },
    ];

    const spectrumBars = [35, 62, 45, 88, 70, 95, 50, 78, 92, 60, 40, 85, 72, 48];

    return `
      <div class="net-sentinel">
        <div class="ns-header">
          <div class="ns-title-group">
            <span class="ns-beacon"></span>
            <span class="ns-title">${esc(config.label || 'Cyber Sentinel & Radar')}</span>
          </div>
          <div class="ns-threat-badge ${threatLevel.includes('5') || threatLevel.includes('NOMINAL') ? 'is-nominal' : 'is-alert'}">
            <span class="ns-threat-dot"></span>
            <span>${esc(threatLevel)}</span>
          </div>
        </div>

        <div class="ns-body-grid">
          <!-- Left: 360 Animated Radar Viewport -->
          <div class="ns-radar-panel">
            <div class="ns-radar-viewport">
              <svg class="ns-radar-svg" viewBox="0 0 160 160">
                <circle class="ns-ring" cx="80" cy="80" r="70" />
                <circle class="ns-ring" cx="80" cy="80" r="48" />
                <circle class="ns-ring" cx="80" cy="80" r="26" />
                <line class="ns-crosshair" x1="10" y1="80" x2="150" y2="80" />
                <line class="ns-crosshair" x1="80" y1="10" x2="80" y2="150" />
                <circle class="ns-center" cx="80" cy="80" r="3" />
              </svg>

              <!-- Rotating Scanning Beam -->
              <div class="ns-sweep-beam" style="animation-duration: ${radarSpeed}s"></div>

              <!-- Coordinate blips with animated ping echoes -->
              ${blips.map(b => `
                <div class="ns-blip ${b.tone === 'warn' ? 'tone-warn' : 'tone-ok'}" style="left: ${(b.x / 160 * 100).toFixed(1)}%; top: ${(b.y / 160 * 100).toFixed(1)}%;" title="${esc(b.label)} (${b.ping}ms)">
                  <i class="ns-blip-dot"></i>
                  <i class="ns-blip-wave"></i>
                </div>
              `).join('')}
            </div>
            <div class="ns-radar-footer">
              <span>SCAN 360° RANGE: 150KM</span>
              <span>NODES: <b>${onlineNodes}/${totalNodes}</b></span>
            </div>
          </div>

          <!-- Right: Telemetry & Traffic Spectrum Deck -->
          <div class="ns-telemetry-panel">
            <div class="ns-metrics-grid">
              <div class="ns-stat-card">
                <span class="ns-stat-label">LATENCY</span>
                <div class="ns-stat-val"><b>${ping}</b><small>ms</small></div>
                <span class="ns-stat-sub">Jitter: ±${jitter}ms</span>
              </div>
              <div class="ns-stat-card">
                <span class="ns-stat-label">THROUGHPUT</span>
                <div class="ns-stat-val"><b>${throughput}</b><small>Mbps</small></div>
                <span class="ns-stat-sub">Symmetric</span>
              </div>
              <div class="ns-stat-card">
                <span class="ns-stat-label">PACKET LOSS</span>
                <div class="ns-stat-val ${packetLoss === '0.00' ? 'ns-val-good' : 'ns-val-warn'}"><b>${packetLoss}</b><small>%</small></div>
                <span class="ns-stat-sub">0 drops / 10s</span>
              </div>
              <div class="ns-stat-card">
                <span class="ns-stat-label">PERIMETER</span>
                <div class="ns-stat-val ns-val-good"><b>SECURE</b></div>
                <span class="ns-stat-sub">Firewall active</span>
              </div>
            </div>

            <!-- Dynamic Network Traffic Spectrum -->
            <div class="ns-spectrum-section">
              <div class="ns-spectrum-header">
                <span>LIVE TRAFFIC EQUALIZER</span>
                <small>${throughput} Mbps Active</small>
              </div>
              <div class="ns-spectrum-bars">
                ${spectrumBars.map((h, i) => `
                  <span class="ns-bar" style="--bar-h: ${h}%; animation-delay: ${(i * 0.08).toFixed(2)}s"></span>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (widget.widgetId === 'slideshow' || widget.widgetId === 'image-slideshow') {
    const raw = config.images ?? '';
    let urls = [];
    if (Array.isArray(raw)) {
      urls = raw.map(s => String(s || '').trim()).filter(Boolean);
    } else if (typeof raw === 'string') {
      urls = raw.split(',').map(s => s.trim()).filter(Boolean);
    }

    const interval = Number(config.interval) || 6;
    const speed = config.transitionSpeed !== undefined ? Number(config.transitionSpeed) : 800;
    const effect = config.transition || 'crossfade';
    const fit = config.fit || 'cover';
    const fitSize = fit === 'fill' ? '100% 100%' : fit;
    const showDots = config.showIndicators !== false;
    const pauseOnHover = Boolean(config.pauseOnHover);
    const shuffle = Boolean(config.shuffle);

    const normalizeUrl = (url) => {
      if (!url) return '';
      if (/^(https?:)?\/\//.test(url) || url.startsWith('/') || url.startsWith('data:')) return url;
      return '/uploads/' + url.replace(/^\/+/, '');
    };

    const firstImg = urls[0] ? `style="background-image: url('${esc(normalizeUrl(urls[0]))}');"` : '';
    const secondImg = urls[1] ? `style="background-image: url('${esc(normalizeUrl(urls[1]))}');"` : '';

    return `
      <div class="ss-wrap ss-${effect === 'slide' ? 'slide-fx' : effect}"
           style="--ss-speed: ${speed}ms; --ss-fit-size: ${fitSize};"
           data-interval="${interval}"
           data-speed="${speed}"
           data-effect="${esc(effect)}"
           data-fit="${esc(fit)}"
           data-pause="${pauseOnHover}"
           data-shuffle="${shuffle}">
        <div class="ss-buf solid" data-buf="0" ${firstImg}></div>
        <div class="ss-buf" data-buf="1" ${secondImg}></div>
        <div class="ss-empty" style="${urls.length ? 'display:none;' : ''}">
          <div class="ss-empty-icon">🖼</div>
          <span>No images configured</span>
          <span style="font-size:10px;opacity:0.5">Add image URLs in widget config</span>
        </div>
        ${showDots && urls.length > 1 ? `
          <div class="ss-indicators">
            ${urls.map((_, i) => `<button type="button" class="ss-dot ${i === 0 ? 'active' : ''}" data-idx="${i}" aria-label="Slide ${i + 1}"></button>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  if (widget.widgetId === 'music-player') {
    const tracks = Array.isArray(config.tracks) && config.tracks.length > 0 ? config.tracks : [
      {
        title: config.title || "Midnight Reverie",
        artist: config.artist || "Aura & The Machines",
        album: config.album || "Synthwave Echoes",
        duration: Number(config.duration) || 215,
        cover: config.cover || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&q=80"
      },
      {
        title: "Cyber Horizon",
        artist: "Kavinsky Drift",
        album: "Neon Grid EP",
        duration: 184,
        cover: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=80"
      },
      {
        title: "Obsidian Pulse",
        artist: "Neural Sync",
        album: "Dark Matter",
        duration: 242,
        cover: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=400&q=80"
      }
    ];

    const currentTrackIdx = Math.max(0, Math.min(tracks.length - 1, Number(config.trackIndex) || 0));
    const track = tracks[currentTrackIdx] || tracks[0];
    const duration = track.duration || 215;
    const currentTime = Math.min(duration, Number(config.currentTime) || 68);
    const progressPct = Math.round((currentTime / duration) * 100);
    const volume = Math.max(0, Math.min(100, Number(config.volume !== undefined ? config.volume : 80)));
    const isPlaying = Boolean(config.playing);

    const fmt = (s) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    };

    return `
      <div class="music-player ${isPlaying ? 'is-playing' : 'is-paused'}" data-tracks='${esc(JSON.stringify(tracks))}' data-current="${currentTrackIdx}" data-duration="${duration}" data-time="${currentTime}" data-volume="${volume}">
        <div class="mp-header">
          <div class="mp-header-left">
            <span class="mp-live-dot"></span>
            <span class="mp-eyebrow">AUDIO ENGINE · STREAM</span>
          </div>
          <div class="mp-eq-bars" title="Audio Spectrum">
            ${[40, 75, 55, 90, 65, 80, 50, 70].map(h => `<i style="--eq-h: ${h}%"></i>`).join('')}
          </div>
        </div>

        <div class="mp-main-layout">
          <!-- Vinyl Disc with groove rings & center art -->
          <div class="mp-disc-column">
            <div class="mp-vinyl-disc ${isPlaying ? 'is-spinning' : ''}">
              <div class="mp-vinyl-grooves"></div>
              <div class="mp-vinyl-label" style="background-image: url('${esc(track.cover || '')}')">
                <div class="mp-vinyl-spindle"></div>
              </div>
            </div>
          </div>

          <!-- Track details and interactive controls -->
          <div class="mp-info-column">
            <div class="mp-meta">
              <h4 class="mp-track-title">${esc(track.title)}</h4>
              <div class="mp-track-artist">${esc(track.artist)} <span class="mp-album-sep">·</span> ${esc(track.album || '')}</div>
            </div>

            <!-- Scrubber Timeline -->
            <div class="mp-timeline">
              <span class="mp-time mp-current-time">${fmt(currentTime)}</span>
              <div class="mp-scrubber-rail" role="slider" aria-valuemin="0" aria-valuemax="${duration}" aria-valuenow="${currentTime}">
                <div class="mp-scrubber-fill" style="width: ${progressPct}%"></div>
                <div class="mp-scrubber-handle" style="left: ${progressPct}%"></div>
              </div>
              <span class="mp-time mp-total-time">${fmt(duration)}</span>
            </div>

            <!-- Controls bar -->
            <div class="mp-controls">
              <button type="button" class="mp-btn mp-btn-shuffle" title="Shuffle" aria-label="Shuffle">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>
              </button>
              <button type="button" class="mp-btn mp-btn-prev" title="Previous Track" aria-label="Previous Track">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
              </button>
              <button type="button" class="mp-btn-play-pause" title="${isPlaying ? 'Pause' : 'Play'}" aria-label="${isPlaying ? 'Pause' : 'Play'}">
                <div class="mp-icon-play" style="${isPlaying ? 'display:none;' : ''}">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </div>
                <div class="mp-icon-pause" style="${isPlaying ? '' : 'display:none;'}">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                </div>
              </button>
              <button type="button" class="mp-btn mp-btn-next" title="Next Track" aria-label="Next Track">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
              </button>
              <button type="button" class="mp-btn mp-btn-repeat" title="Repeat" aria-label="Repeat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Volume slider bar in footer -->
        <div class="mp-footer-bar">
          <button type="button" class="mp-vol-btn" title="Toggle Mute" aria-label="Mute">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          </button>
          <div class="mp-vol-rail">
            <div class="mp-vol-fill" style="width: ${volume}%"></div>
          </div>
          <span class="mp-vol-label">${volume}%</span>
        </div>
      </div>
    `;
  }

  if (widget.widgetId === 'device-switchboard') {
    const devices = Array.isArray(config.devices) && config.devices.length > 0 ? config.devices : [
      { id: "light-main", name: "Living Room Lighting", type: "light", state: true, level: 85, watts: 45 },
      { id: "hvac-unit", name: "Climate HVAC Unit", type: "climate", state: true, mode: "cool", fanSpeed: 2, watts: 580 },
      { id: "desk-power", name: "Workstation Desk Relay", type: "power", state: true, surge: false, watts: 180 },
      { id: "security-gate", name: "Perimeter Security Gate", type: "security", state: false, alert: false, watts: 25 },
    ];

    const activeCount = devices.filter(d => d.state).length;
    const totalWatts = devices.reduce((sum, d) => sum + (d.state ? Number(d.watts || 0) : 0), 0);
    const maxWatts = 1200;
    const loadPct = Math.min(100, Math.round((totalWatts / maxWatts) * 100));

    return `
      <div class="device-switchboard" data-devices='${esc(JSON.stringify(devices))}'>
        <div class="sw-header">
          <div class="sw-title-group">
            <span class="sw-status-pulse"></span>
            <span class="sw-title">${esc(config.label || 'Smart Device Switchboard')}</span>
          </div>
          <div class="sw-load-badge">
            <span class="sw-watts-val"><b>${totalWatts}</b> W</span>
            <div class="sw-mini-gauge" title="${loadPct}% of max load (${maxWatts}W)">
              <div class="sw-gauge-fill" style="width: ${loadPct}%"></div>
            </div>
          </div>
        </div>

        <div class="sw-device-grid">
          ${devices.map(d => {
            const isLight = d.type === 'light';
            const isHvac = d.type === 'climate';
            const isSec = d.type === 'security';
            const level = d.level || 85;
            const fan = d.fanSpeed || 2;

            let iconSvg = '';
            if (isLight) {
              iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 6a6 6 0 0 0-6 6c0 2.22 1.21 4.16 3 5.2V19a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1.8c1.79-1.04 3-2.98 3-5.2a6 6 0 0 0-6-6z"/></svg>`;
            } else if (isHvac) {
              iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>`;
            } else if (isSec) {
              iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
            } else {
              iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
            }

            return `
              <div class="sw-card ${d.state ? 'is-active' : 'is-disabled'}" data-id="${esc(d.id)}">
                <div class="sw-card-top">
                  <div class="sw-icon ${d.state ? 'is-on' : ''}">${iconSvg}</div>
                  <div class="sw-info">
                    <span class="sw-name">${esc(d.name)}</span>
                    <span class="sw-state-sub">${d.state ? (isSec ? 'ARMED · SECURED' : (isLight ? `${level}% DIMMER` : (isHvac ? `COOLING · FAN ${fan}` : 'RELAY ON'))) : (isSec ? 'DISARMED' : 'STANDBY')}</span>
                  </div>
                  <button type="button" class="sw-toggle-btn ${d.state ? 'checked' : ''}" data-action="toggle" data-id="${esc(d.id)}" aria-label="Toggle ${esc(d.name)}">
                    <span class="sw-toggle-thumb"></span>
                  </button>
                </div>

                <div class="sw-card-bottom">
                  ${isLight ? `
                    <div class="sw-dimmer-row">
                      <span class="sw-dimmer-label">BRI</span>
                      <input type="range" class="sw-slider" min="10" max="100" value="${level}" data-id="${esc(d.id)}" ${d.state ? '' : 'disabled'} />
                      <span class="sw-dimmer-val">${level}%</span>
                    </div>
                  ` : isHvac ? `
                    <div class="sw-fan-pills">
                      ${[1, 2, 3].map(spd => `
                        <button type="button" class="sw-fan-opt ${fan === spd ? 'active' : ''}" data-action="fan" data-speed="${spd}" data-id="${esc(d.id)}" ${d.state ? '' : 'disabled'}>
                          ${spd === 1 ? 'ECO' : spd === 2 ? 'AUTO' : 'MAX'}
                        </button>
                      `).join('')}
                    </div>
                  ` : `
                    <div class="sw-power-meta">
                      <span>LOAD CONSUMPTION</span>
                      <b>${d.state ? d.watts : 0} W</b>
                    </div>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="sw-footer-scenes">
          <span class="sw-scenes-label">QUICK SCENES:</span>
          <div class="sw-scenes-buttons">
            <button type="button" class="sw-scene-pill" data-scene="all-off">All Off</button>
            <button type="button" class="sw-scene-pill" data-scene="eco">Eco Mode</button>
            <button type="button" class="sw-scene-pill" data-scene="full-power">Full Power</button>
          </div>
        </div>
      </div>
    `;
  }

  if (widget.widgetId === 'task-matrix') {
    const tasks = Array.isArray(config.tasks) && config.tasks.length > 0 ? config.tasks : [
      { id: "t1", text: "Deploy edge telemetry sync", done: true, priority: "high" },
      { id: "t2", text: "Calibrate thermal dissipation sensors", done: true, priority: "normal" },
      { id: "t3", text: "Review perimeter incident alert log", done: false, priority: "urgent" },
      { id: "t4", text: "Verify dual ping-pong kiosk buffer", done: false, priority: "normal" },
    ];

    const completedCount = tasks.filter(t => t.done).length;
    const totalCount = tasks.length;
    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const filter = config.filter || 'all';

    // SVG Circular Progress Ring (circumference = 2 * PI * 14 ~= 87.96)
    const circum = 88;
    const strokeOffset = (circum * (1 - pct / 100)).toFixed(1);

    return `
      <div class="task-matrix" data-tasks='${esc(JSON.stringify(tasks))}' data-filter="${esc(filter)}">
        <div class="tm-header">
          <div class="tm-title-group">
            <div class="tm-ring-wrap">
              <svg width="34" height="34" viewBox="0 0 36 36">
                <circle class="tm-ring-bg" cx="18" cy="18" r="14" />
                <circle class="tm-ring-bar" cx="18" cy="18" r="14" stroke-dasharray="88" stroke-dashoffset="${strokeOffset}" />
              </svg>
              <span class="tm-ring-text">${pct}%</span>
            </div>
            <div>
              <span class="tm-title">${esc(config.label || 'Task & Operations Matrix')}</span>
              <span class="tm-sub"><b class="tm-done-count">${completedCount}</b> of ${totalCount} Objectives Complete</span>
            </div>
          </div>

          <div class="tm-filter-tabs">
            ${['all', 'active', 'done'].map(f => `
              <button type="button" class="tm-tab ${filter === f ? 'active' : ''}" data-filter="${f}">
                ${f.toUpperCase()}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="tm-list-scroll">
          <ul class="tm-list">
            ${tasks.map(t => {
              const prioClass = t.priority === 'urgent' ? 'tm-prio-urgent' : t.priority === 'high' ? 'tm-prio-high' : 'tm-prio-normal';
              return `
                <li class="tm-item ${t.done ? 'is-done' : ''}" data-id="${esc(t.id)}" data-priority="${esc(t.priority || 'normal')}">
                  <button type="button" class="tm-checkbox ${t.done ? 'checked' : ''}" data-action="toggle" data-id="${esc(t.id)}" aria-label="Toggle task">
                    <svg class="tm-check-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                  <span class="tm-item-text">${esc(t.text)}</span>
                  <button type="button" class="tm-badge ${prioClass}" data-action="priority" data-id="${esc(t.id)}" title="Click to cycle priority">
                    ${esc((t.priority || 'NORMAL').toUpperCase())}
                  </button>
                  <button type="button" class="tm-del-btn" data-action="delete" data-id="${esc(t.id)}" title="Delete objective" aria-label="Delete">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </li>
              `;
            }).join('')}
          </ul>
        </div>

        <div class="tm-add-row">
          <input type="text" class="tm-add-input" placeholder="Add new objective..." maxlength="80" />
          <button type="button" class="tm-add-btn" title="Add objective" aria-label="Add objective">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>
    `;
  }

  if (widget.widgetId === 'quick-notes') {
    const title = config.title || config.label || 'Quick Notes';
    const text = typeof config.text === 'string' ? config.text : '';
    const stateMode = config.stateMode === 'global' ? 'global' : config.stateMode === 'stateless' ? 'stateless' : 'cookie';
    const colorTag = config.colorTag || 'amber';
    const modeBadge = stateMode === 'global'
      ? '<span class="qn-mode-badge qn-mode-global" title="Synchronized live across all kiosk screens and windows"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> GLOBAL</span>'
      : stateMode === 'cookie'
      ? '<span class="qn-mode-badge qn-mode-cookie" title="Stored on server, private to your browser cookie"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><circle cx="8.5" cy="8.5" r="1"/><circle cx="7.5" cy="14.5" r="1"/><circle cx="15.5" cy="14.5" r="1"/></svg> COOKIE</span>'
      : '<span class="qn-mode-badge qn-mode-stateless" title="Ephemeral local note"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> STATELESS</span>';

    return `
      <div class="quick-notes qn-tag-${esc(colorTag)}" data-state-mode="${esc(stateMode)}">
        <div class="qn-header">
          <div class="qn-title-wrap">
            <span class="qn-pin">📌</span>
            <span class="qn-title">${esc(title)}</span>
          </div>
          <div class="qn-meta-wrap">
            ${modeBadge}
            <span class="qn-status" title="Sync status"><i class="qn-dot"></i> <span class="qn-status-text">Saved</span></span>
          </div>
        </div>

        <div class="qn-body">
          <textarea class="qn-textarea" placeholder="${esc(config.placeholder || 'Type notes, memo or reminders here...')}" spellcheck="false">${esc(text)}</textarea>
        </div>

        <div class="qn-footer">
          <span class="qn-counter"><b class="qn-chars">${text.length}</b> chars</span>
          <button type="button" class="qn-clear-btn" title="Clear note" aria-label="Clear note">Clear</button>
        </div>
      </div>
    `;
  }

  if (widget.widgetId === 'emitter-widget') {
    const emitterId = config.emitterId || 'default-emitter';
    const title = config.label || config.name || config.title || emitterId;
    const category = config.category || (config.tracks || config.playing !== undefined || config.album || config.artist ? 'media' : 'sensor');
    const state = config.state || config;
    const isOnline = config.online !== false && (state.online !== false);

    if (category === 'media') {
      const playing = Boolean(state.playing);
      const songTitle = state.title || state.track || 'No media playing';
      const artist = state.artist || state.channel || 'Waiting for stream';
      const album = state.album || '';
      const cover = state.coverUrl || state.cover || state.thumbnail || '';
      const currentTime = Number(state.currentTime) || 0;
      const duration = Number(state.duration) || 180;
      const pct = duration > 0 ? Math.min(100, Math.max(0, Math.round((currentTime / duration) * 100))) : 0;
      const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
      };

      return `
        <div class="emitter-widget emitter-media ${playing ? 'is-playing' : ''}" data-emitter-id="${esc(emitterId)}">
          <div class="em-header">
            <div class="em-badge">
              <span class="em-pulse-dot ${isOnline ? 'online' : 'offline'}"></span>
              <span class="em-emitter-name">${esc(title)}</span>
            </div>
            <span class="em-category-tag">MEDIA RELAY</span>
          </div>

          <div class="em-media-body">
            <div class="em-cover-wrap">
              ${cover ? `<img class="em-cover" src="${esc(cover)}" alt="Album cover" />` : `
                <div class="em-cover-fallback">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                </div>
              `}
              <div class="em-eq-bars ${playing ? 'active' : ''}">
                <i></i><i></i><i></i><i></i>
              </div>
            </div>

            <div class="em-meta">
              <div class="em-track-title">${esc(songTitle)}</div>
              <div class="em-track-artist">${esc(artist)}</div>
              ${album ? `<div class="em-track-album">${esc(album)}</div>` : ''}
            </div>
          </div>

          <div class="em-progress-container">
            <div class="em-progress-bar">
              <div class="em-progress-fill" style="width: ${pct}%"></div>
            </div>
            <div class="em-time-labels">
              <span>${formatTime(currentTime)}</span>
              <span>${formatTime(duration)}</span>
            </div>
          </div>

          <div class="em-controls">
            <button type="button" class="em-btn em-prev" data-action="command" data-command="previous" title="Previous Track">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="3"/></svg>
            </button>
            <button type="button" class="em-btn em-play-pause ${playing ? 'playing' : ''}" data-action="command" data-command="play_pause" title="${playing ? 'Pause' : 'Play'}">
              ${playing ? `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
              ` : `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              `}
            </button>
            <button type="button" class="em-btn em-next" data-action="command" data-command="next" title="Next Track">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="3"/></svg>
            </button>
          </div>
        </div>
      `;
    }

    // Sensor / Metrics view
    const metrics = Array.isArray(state.metrics) ? state.metrics : Object.entries(state)
      .filter(([k]) => !['id', 'name', 'category', 'online', 'controls', 'timestamp', 'lastSeen', 'label', 'title'].includes(k))
      .slice(0, 6)
      .map(([k, v]) => ({ label: k, value: typeof v === 'object' ? JSON.stringify(v) : String(v) }));

    return `
      <div class="emitter-widget emitter-sensor" data-emitter-id="${esc(emitterId)}">
        <div class="em-header">
          <div class="em-badge">
            <span class="em-pulse-dot ${isOnline ? 'online' : 'offline'}"></span>
            <span class="em-emitter-name">${esc(title)}</span>
          </div>
          <span class="em-category-tag">SYSTEM EMITTER</span>
        </div>
        <div class="em-grid">
          ${metrics.map(m => `
            <div class="em-metric-card">
              <div class="em-m-label">${esc(m.label.toUpperCase())}</div>
              <div class="em-m-val">${esc(m.value)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Clean fallback for any generic or custom widget
  return value + (config.trend ? `<div class="trend">${esc(config.trend)}</div>` : '') + detail;
}
