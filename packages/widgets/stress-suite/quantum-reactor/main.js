(function () {
  let widget = null;

  const canvas = document.getElementById("reactorCanvas");
  const ctx = canvas.getContext("2d");
  const scramOverlay = document.getElementById("scramOverlay");
  const coreLabel = document.getElementById("coreLabel");
  const statusBadge = document.getElementById("statusBadge");
  const egressBadge = document.getElementById("egressBadge");
  const rpmVal = document.getElementById("rpmVal");
  const tempVal = document.getElementById("tempVal");
  const latencyVal = document.getElementById("latencyVal");
  const cyclesVal = document.getElementById("cyclesVal");
  const globalStatePill = document.getElementById("globalStatePill");
  const cookieStatePill = document.getElementById("cookieStatePill");
  const sessionStatePill = document.getElementById("sessionStatePill");

  let speed = 50; // 0 to 100
  let isScram = false;
  let isOverdrive = false;
  let totalCycles = 0;
  let rotationAngle = 0;
  let telemetryUrl = "https://httpbin.org/get";
  let secretRef = "";

  // Dynamic particle simulation
  const NUM_PARTICLES = 36;
  const particles = [];
  for (let i = 0; i < NUM_PARTICLES; i++) {
    particles.push({
      angle: (i / NUM_PARTICLES) * Math.PI * 2,
      radiusOffset: (Math.random() - 0.5) * 20,
      speedMultiplier: 0.75 + Math.random() * 0.5,
      size: 2 + Math.random() * 3,
      pulse: Math.random() * Math.PI * 2,
    });
  }

  // 1. Host-Brokered Fetch Egress Execution
  async function executeEgressFetch() {
    if (!widget) return;
    egressBadge.textContent = "EGRESS: PING";
    egressBadge.className = "badge badge-dim";
    const startTime = performance.now();

    try {
      const url = secretRef
        ? `${telemetryUrl}?key={{secret:${secretRef}}}`
        : telemetryUrl;

      const res = await widget.fetch(url, {
        method: "GET",
        headers: { "X-Client": "quantum-reactor", Accept: "application/json" },
        timeoutMs: 6000,
      });

      const elapsed = Math.round(performance.now() - startTime);
      latencyVal.textContent = `${elapsed} ms`;
      egressBadge.textContent = `EGRESS: ${res.status}`;
      egressBadge.className = res.ok ? "badge" : "badge badge-overdrive";
    } catch {
      latencyVal.textContent = "ERR";
      egressBadge.textContent = "EGRESS: FAIL";
      egressBadge.className = "badge badge-overdrive";
    }
  }

  // 2. Hydrate & Bind Multi-tier State using Widget SDK
  async function bindState() {
    if (!widget) return;

    // Tier 3 (Shared): Real-time synced across all kiosks and screens
    widget.shared.on("reactor_speed", (val) => {
      const num = typeof val === "number" ? val : val?.speed;
      if (typeof num === "number") {
        speed = Math.max(0, Math.min(100, num));
        updateStateAndOutputs();
      }
    });

    widget.shared.on("reactor_lifetime_hours", (val) => {
      const h = typeof val === "number" ? val : val?.hours;
      if (h !== undefined) {
        globalStatePill.textContent = `GLOBAL: ${h}h`;
      }
    });

    // Tier 2 (Storage): Client-scoped personal persistence (isolated from incognito)
    try {
      const savedTheme = await widget.storage.get("reactor_theme");
      if (savedTheme) {
        const themeName = typeof savedTheme === "string" ? savedTheme : savedTheme.theme;
        if (themeName) cookieStatePill.textContent = `CLIENT: ${themeName}`;
      }
    } catch {}
  }

  // 3. Update Status & Publish Output Variables
  function updateStateAndOutputs() {
    const currentRpm = isScram ? 0 : Math.round(speed * 1.6);
    const currentTemp = isScram ? 295 : Math.round(300 + currentRpm * 4.2);

    let status = "NOMINAL";
    if (isScram) status = "SCRAM";
    else if (isOverdrive) status = "OVERDRIVE";
    else if (currentRpm > 120) status = "SUPERCHARGED";

    statusBadge.textContent = status;
    statusBadge.className =
      status === "SCRAM"
        ? "badge badge-scram"
        : status === "OVERDRIVE"
        ? "badge badge-overdrive"
        : "badge";

    scramOverlay.style.display = isScram ? "block" : "none";
    rpmVal.textContent = `${currentRpm} RPM`;
    tempVal.textContent = `${currentTemp} °K`;

    // Publish Output Variables for other widgets on the active canvas
    if (widget) {
      const instId = widget.identity?.instanceId || "quantum-reactor";
      widget.broadcast("reactor.metrics", {
        instanceId: instId,
        rpm: currentRpm,
        temp: currentTemp,
        status: status,
        isScram: isScram,
      });
    }
  }

  // 4. Smooth 60 FPS HTML5 Canvas Animation Loop with HiDPI support
  let lastFrameTime = performance.now();

  function syncCanvasDpi() {
    const dpr = window.devicePixelRatio || 2;
    const rect = canvas.getBoundingClientRect();
    const targetW = Math.round((rect.width || 380) * dpr);
    const targetH = Math.round((rect.height || 220) * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
  }

  function render(time) {
    syncCanvasDpi();

    const dt = Math.min(50, time - lastFrameTime) / 1000;
    lastFrameTime = time;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    const baseRadius = Math.min(w, h) * 0.33;
    const effectiveSpeed = isScram ? 0 : isOverdrive ? speed * 2.2 : speed;
    const angularVelocity = (effectiveSpeed / 100) * Math.PI * 1.6;
    rotationAngle += angularVelocity * dt;

    if (effectiveSpeed > 0) {
      totalCycles += (angularVelocity * dt) / (Math.PI * 2);
      cyclesVal.textContent = Math.floor(totalCycles).toLocaleString();
    }

    // Dynamic Theme Colors
    const primaryColor = isScram ? "#38bdf8" : isOverdrive ? "#ef4444" : "#00f0ff";
    const secondaryColor = isScram ? "#60a5fa" : isOverdrive ? "#f59e0b" : "#38bdf8";
    const glowColor = isScram ? "rgba(56, 189, 248, 0.4)" : isOverdrive ? "rgba(239, 68, 68, 0.6)" : "rgba(0, 240, 255, 0.5)";

    // 1. Outer magnetic containment ring
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotationAngle * 0.35);

    ctx.beginPath();
    ctx.arc(0, 0, baseRadius + 20, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Segmented ring marks (reticle compass ticks)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius + 20, a, a + 0.16);
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = glowColor;
      ctx.stroke();
    }
    ctx.restore();

    // 2. Inner counter-rotating ring
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-rotationAngle * 0.6);

    ctx.beginPath();
    ctx.arc(0, 0, baseRadius - 14, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 3;
    ctx.stroke();

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius - 14, a, a + 0.22);
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    ctx.restore();

    // 3. Central glowing plasma core
    const corePulse = Math.sin(time * 0.006) * 6;
    const coreRadius = Math.max(12, baseRadius * 0.38 + corePulse + (effectiveSpeed / 100) * 12);

    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, coreRadius);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.3, primaryColor);
    grad.addColorStop(0.7, secondaryColor);
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.shadowBlur = isOverdrive ? 30 : 18;
    ctx.shadowColor = primaryColor;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 4. Orbiting flux particles
    for (const p of particles) {
      if (!isScram) {
        p.angle += (angularVelocity * p.speedMultiplier * dt) * 0.85;
      }
      p.pulse += dt * 3.5;

      const r = baseRadius + p.radiusOffset + Math.sin(p.pulse) * 4;
      const px = cx + Math.cos(p.angle) * r;
      const py = cy + Math.sin(p.angle) * r;

      ctx.beginPath();
      ctx.arc(px, py, p.size * (baseRadius / 80), 0, Math.PI * 2);
      ctx.fillStyle = primaryColor;
      ctx.shadowBlur = isOverdrive ? 16 : 8;
      ctx.shadowColor = primaryColor;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    requestAnimationFrame(render);
  }

  // 5. Connect to Glansk Host in background
  function initHostConnection() {
    if (typeof Glansk === "undefined" || !Glansk.connect) {
      setTimeout(initHostConnection, 100);
      return;
    }

    Glansk.connect().then(async (connectedWidget) => {
      widget = connectedWidget;

      // 1. Live Config Handling
      widget.onConfig((cfg) => {
        if (cfg?.label) coreLabel.textContent = cfg.label;
        if (cfg?.telemetryUrl) telemetryUrl = cfg.telemetryUrl;
        if (cfg?.secretRef) secretRef = cfg.secretRef;
      });

      // 2. Display Identity & Multi-tier State Handling
      if (widget.display) {
        cookieStatePill.textContent = `CLIENT: ${widget.display.id}`;
      }

      // 3. Inter-Widget Event Listeners
      widget.onNotification("reactor.scram", (payload) => {
        isScram = Boolean(payload?.active);
        updateStateAndOutputs();
      });

      widget.onNotification("reactor.speed", (payload) => {
        if (typeof payload?.speed === "number") {
          speed = Math.max(0, Math.min(100, payload.speed));
          updateStateAndOutputs();
        }
      });

      widget.onNotification("reactor.overdrive", (payload) => {
        isOverdrive = Boolean(payload?.active);
        updateStateAndOutputs();
      });

      widget.onNotification("reactor.trigger_fetch", () => {
        executeEgressFetch();
      });

      widget.onNotification("reactor.session_ping", (payload) => {
        if (payload?.count) {
          sessionStatePill.textContent = `SESSION: PING #${payload.count}`;
        }
      });

      widget.onNotification("reactor.global_hours", (payload) => {
        if (payload?.hours) {
          globalStatePill.textContent = `GLOBAL: ${payload.hours}h`;
        }
      });

      widget.onNotification("reactor.theme_change", (payload) => {
        if (payload?.theme) {
          cookieStatePill.textContent = `CLIENT: ${payload.theme}`;
        }
      });

      // Hydrate and bind state
      bindState();

      // Broadcast initial metrics
      updateStateAndOutputs();

      // 8. Signal render readiness
      widget.reportReady();
    }).catch(err => console.error("Glansk connect error:", err));
  }

  // START LOCAL ANIMATION AND TELEMETRY IMMEDIATELY!
  updateStateAndOutputs();
  requestAnimationFrame(render);

  // Periodic automatic fetch every 30s once connected
  setInterval(executeEgressFetch, 30000);

  // Connect to host in background
  initHostConnection();
})();
