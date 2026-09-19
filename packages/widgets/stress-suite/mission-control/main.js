(function () {
  let widget = null;

  const panelTitle = document.getElementById("panelTitle");
  const speedSlider = document.getElementById("speedSlider");
  const sliderValDisplay = document.getElementById("sliderValDisplay");
  const scramBtn = document.getElementById("scramBtn");
  const overdriveBtn = document.getElementById("overdriveBtn");
  const fetchBtn = document.getElementById("fetchBtn");
  const stressBtn = document.getElementById("stressBtn");

  const teleRpm = document.getElementById("teleRpm");
  const teleTemp = document.getElementById("teleTemp");
  const teleStatus = document.getElementById("teleStatus");

  const incGlobalBtn = document.getElementById("incGlobalBtn");
  const globalVal = document.getElementById("globalVal");
  const themeSelect = document.getElementById("themeSelect");
  const cookieSavedBadge = document.getElementById("cookieSavedBadge");
  const sessionPingBtn = document.getElementById("sessionPingBtn");
  const sessionPingCount = document.getElementById("sessionPingCount");

  let isScram = false;
  let isOverdrive = false;
  let isStressLoopRunning = false;
  let stressInterval = null;
  let stressAngle = 0;
  let lifetimeHours = 1200;
  let sessionPings = 0;

  // 1. Slider Regulation
  speedSlider.addEventListener("input", (e) => {
    const val = Number(e.target.value);
    sliderValDisplay.textContent = `${val}%`;
    if (val > 0 && isScram) {
      isScram = false;
      scramBtn.style.boxShadow = "";
      scramBtn.textContent = "⚠️ SCRAM HALT";
      widget?.broadcast("reactor.scram", { active: false });
    }
    widget?.broadcast("reactor.speed", { speed: val });
    widget?.shared.set("reactor_speed", val);
  });

  // 2. SCRAM Emergency Halt Toggle
  scramBtn.addEventListener("click", () => {
    isScram = !isScram;
    if (isScram) {
      speedSlider.value = "0";
      sliderValDisplay.textContent = "0%";
      scramBtn.style.boxShadow = "0 0 20px #ef4444";
      scramBtn.textContent = "RESET SCRAM";
      widget?.broadcast("reactor.speed", { speed: 0 });
      widget?.shared.set("reactor_speed", 0);
    } else {
      scramBtn.style.boxShadow = "";
      scramBtn.textContent = "⚠️ SCRAM HALT";
      speedSlider.value = "50";
      sliderValDisplay.textContent = "50%";
      widget?.broadcast("reactor.speed", { speed: 50 });
      widget?.shared.set("reactor_speed", 50);
    }
    widget?.broadcast("reactor.scram", { active: isScram });
  });

  // 3. Overdrive Toggle
  overdriveBtn.addEventListener("click", () => {
    isOverdrive = !isOverdrive;
    overdriveBtn.classList.toggle("active", isOverdrive);
    widget?.broadcast("reactor.overdrive", { active: isOverdrive });
  });

  // 4. Trigger Remote Egress Fetch
  fetchBtn.addEventListener("click", () => {
    fetchBtn.style.transform = "scale(0.95)";
    setTimeout(() => { fetchBtn.style.transform = ""; }, 150);
    widget?.broadcast("reactor.trigger_fetch", { timestamp: Date.now() });
  });

  // 5. High-Frequency 20Hz Stress Test Loop
  stressBtn.addEventListener("click", () => {
    isStressLoopRunning = !isStressLoopRunning;
    stressBtn.classList.toggle("active", isStressLoopRunning);

    if (isStressLoopRunning) {
      stressBtn.textContent = "⏹ STOP (20Hz)";
      stressInterval = setInterval(() => {
        stressAngle += 0.25;
        // Oscillate speed smoothly between 15% and 95% at 20Hz
        const waveSpeed = Math.round(55 + Math.sin(stressAngle) * 40);
        speedSlider.value = String(waveSpeed);
        sliderValDisplay.textContent = `${waveSpeed}%`;
        widget?.broadcast("reactor.speed", { speed: waveSpeed, stress: true });
      }, 50); // 20 updates per second
    } else {
      stressBtn.textContent = "🌀 20Hz STRESS";
      if (stressInterval) clearInterval(stressInterval);
      stressInterval = null;
    }
  });

  // 7. Multi-Tier State Operations
  // Tier A: Global State
  incGlobalBtn.addEventListener("click", () => {
    lifetimeHours += 100;
    globalVal.textContent = `${lifetimeHours}h`;
    widget?.shared.set("reactor_lifetime_hours", lifetimeHours);
    widget?.broadcast("reactor.global_hours", { hours: lifetimeHours });
  });

  // Tier B: Cookie State
  themeSelect.addEventListener("change", async (e) => {
    const selectedTheme = e.target.value;
    cookieSavedBadge.textContent = "SAVING...";
    try {
      if (widget) {
        await widget.storage.set("reactor_theme", selectedTheme);
        cookieSavedBadge.textContent = "SAVED";
        widget.broadcast("reactor.theme_change", { theme: selectedTheme });
      } else {
        cookieSavedBadge.textContent = "QUEUED";
      }
    } catch {
      cookieSavedBadge.textContent = "ERR";
    }
  });

  // Tier C: Ephemeral Session Broadcast
  sessionPingBtn.addEventListener("click", () => {
    sessionPings++;
    sessionPingCount.textContent = `Pings: ${sessionPings}`;
    widget?.broadcast("reactor.session_ping", {
      count: sessionPings,
      timestamp: Date.now(),
    });
  });

  // Hydrate & Bind Multi-tier State using Widget SDK
  async function bindState() {
    if (!widget) return;

    // Tier 3: Shared Speed (syncs across all screens & restores on load)
    widget.shared.on("reactor_speed", (val) => {
      const num = typeof val === "number" ? val : val?.speed;
      if (typeof num === "number") {
        speedSlider.value = String(num);
        sliderValDisplay.textContent = `${num}%`;
        widget.broadcast("reactor.speed", { speed: num, hydrated: true });
      }
    });

    // Tier 3: Shared Global Hours
    widget.shared.on("reactor_lifetime_hours", (val) => {
      const h = typeof val === "number" ? val : val?.hours;
      if (typeof h === "number") {
        lifetimeHours = h;
        globalVal.textContent = `${lifetimeHours}h`;
      }
    });

    // Tier 2: Client Storage Theme
    try {
      const savedTheme = await widget.storage.get("reactor_theme");
      if (savedTheme) {
        const themeName = typeof savedTheme === "string" ? savedTheme : savedTheme.theme;
        if (themeName) themeSelect.value = themeName;
      }
    } catch {}
  }

  // Connect to Glansk Host in background
  function initHostConnection() {
    if (typeof Glansk === "undefined" || !Glansk.connect) {
      setTimeout(initHostConnection, 100);
      return;
    }

    Glansk.connect().then(async (connectedWidget) => {
      widget = connectedWidget;

      // Live Config
      widget.onConfig((cfg) => {
        if (cfg?.operatorName) {
          panelTitle.textContent = cfg.operatorName;
        }
      });

      // 6. Listen for Reactor Telemetry Feedback
      widget.onNotification("reactor.metrics", (payload) => {
        if (payload) {
          if (payload.rpm !== undefined) teleRpm.textContent = `${payload.rpm}`;
          if (payload.temp !== undefined) teleTemp.textContent = `${payload.temp}K`;
          if (payload.status) teleStatus.textContent = payload.status;
        }
      });

      await bindState();

      // Clean up on destroy
      widget.onDestroy(() => {
        if (stressInterval) clearInterval(stressInterval);
      });

      // Signal render readiness
      widget.reportReady();
    }).catch(err => console.error("Glansk connect error:", err));
  }

  initHostConnection();
})();
