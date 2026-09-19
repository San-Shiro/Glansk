# Glansk Universal Emitter Specification & Low-Level SDK

This document defines the **Glansk Universal Emitter Protocol**, an ultra-lightweight, language-agnostic integration standard designed for native systems programming (Go, Rust, C/C++) and lightweight embedded environments (Raspberry Pi, Linux daemons, microcontrollers).

---

## 1. Architectural Philosophy: The 3 Planes

Glansk separates emitter handling into three strictly partitioned planes:

```
+-------------------------------------------------------------------------------+
| 1. Presence Plane (In-Memory Ephemeral)                                       |
|    - Tracks heartbeats, TTLs, lastSeen timestamps                             |
|    - Evaluates: online -> stale -> offline -> terminated                     |
|    - Streams real-time updates over consolidated SSE (/api/v1/emitters/events)|
|    - INVARIANT: Routine heartbeats NEVER write to disk or bump canvas drafts  |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| 2. Layout Plane (Transactional & Revision-Aware)                              |
|    - Auto-mounts widget when autoMount.enabled == true                        |
|    - Tags ownership: managedBy: "emitter-auto-mount"                          |
|    - Calculates collision-free bounding boxes on active canvas               |
|    - Prunes ephemeral widgets when offlineBehavior == "auto-remove"           |
|    - INVARIANT: User-created widgets are never clobbered or pruned            |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| 3. Runtime Rendering Plane (Client Canvas UI)                                 |
|    - Single consolidated EventSource per canvas                               |
|    - Dynamic DOM updates: toggle .is-online, .is-stale, .is-offline           |
|    - Sub-300ms recovery when heartbeats resume                                |
+-------------------------------------------------------------------------------+
```

---

## 2. Official Go SDK (`sdk/go/glansk`)

The official Go SDK is written strictly with the **Go Standard Library** (zero third-party dependencies). It compiles into a single static binary consuming under **2 MB of RAM** with **0% idle CPU**.

### Installation & Module Import

```go
import "github.com/glansk/sdk/go/glansk"
```

### Complete Minimal Example: System Sensor

```go
package main

import (
    "context"
    "fmt"
    "log"
    "runtime"
    "time"

    "github.com/glansk/sdk/go/glansk"
)

func main() {
    emitter, err := glansk.NewEmitter(glansk.Config{
        ServerURL: "http://127.0.0.1:3000",
        ID:        "pi-thermal-sensor",
        Name:      "Pi Thermals (Go)",
        Category:  "sensor",
        AutoMount: glansk.AutoMountConfig{
            Enabled: true,
        },
        Lifecycle: glansk.LifecycleConfig{
            TTLSeconds:      20,
            StaleSeconds:    8,
            OfflineBehavior: glansk.BehaviorRetainDormant,
        },
        HeartbeatInterval: 3 * time.Second,
    })
    if err != nil {
        log.Fatal(err)
    }

    emitter.HandleSignals() // Graceful exit on SIGINT/SIGTERM

    ctx := context.Background()
    emitter.StartBackground(ctx)

    for range time.Tick(2 * time.Second) {
        var m runtime.MemStats
        runtime.ReadMemStats(&m)

        _ = emitter.SetState(map[string]interface{}{
            "alloc_mb":   fmt.Sprintf("%.1f MB", float64(m.Alloc)/1024/1024),
            "goroutines": runtime.NumGoroutine(),
            "cpu_temp":   "42.5 C",
        })
    }
}
```

### Media Player Example with Interactive Controls

```go
emitter.OnCommand("play_pause", func(cmd glansk.Command) (map[string]interface{}, error) {
    isPlaying = !isPlaying
    return map[string]interface{}{"playing": isPlaying}, nil
})

emitter.OnCommand("next", func(cmd glansk.Command) (map[string]interface{}, error) {
    trackIndex++
    return nil, nil
})
```

---

## 3. Low-Level Wire Protocol (Rust / C / POSIX)

Any language capable of HTTP or file writes can act as a Glansk emitter.

### A. HTTP REST & SSE Protocol

#### 1. Ingest State & Manifest (`POST /api/v1/emitters/:id/state`)
- **Headers**: `Content-Type: application/json`
- **Payload**:
```json
{
  "manifest": {
    "id": "my-native-emitter",
    "name": "Native C Device",
    "category": "sensor",
    "autoMount": {
      "enabled": true,
      "canvasId": "glansk-demo-showcase"
    },
    "lifecycle": {
      "ttlSeconds": 30,
      "staleSeconds": 10,
      "offlineBehavior": "auto-remove"
    },
    "display": {
      "defaultWidth": 380,
      "defaultHeight": 240,
      "tone": "cyan"
    }
  },
  "state": {
    "temperature": 24.5,
    "humidity": 60.2,
    "status": "nominal"
  }
}
```

#### 2. Dispatch UI Command (`POST /api/v1/emitters/:id/command`)
```json
{
  "command": "play_pause",
  "payload": {},
  "timeoutMs": 3000
}
```

#### 3. Graceful Shutdown & Unregister (`DELETE /api/v1/emitters/:id`)
- Signals that the emitter process is exiting.
- If `offlineBehavior == "auto-remove"`, the widget is instantly pruned from active canvases.

---

### B. High-Performance RAM-Disk Transport (tmpfs)

For microcontrollers, local daemons, or kernel telemetry where network overhead is unacceptable, Glansk supports **RAM-disk zero-overhead IPC**:

- **Path (Linux / Pi)**: `/dev/shm/glansk/emitters/<id>.json`
- **Path (Fallback)**: `.tmp/emitters/<id>.json`

Simply write or `atomic_rename` the JSON state file to that directory. The Glansk kernel automatically picks up updates in <10ms and syncs the canvas without socket overhead!

---

## 4. Minimal Rust Implementation (`ureq` or `reqwest`)

```rust
use std::collections::HashMap;
use std::thread::sleep;
use std::time::Duration;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::blocking::Client::new();
    let url = "http://127.0.0.1:3000/api/v1/emitters/rust-sensor/state";

    loop {
        let mut state = HashMap::new();
        state.insert("load", "0.42");
        state.insert("threads", "8");

        let body = serde_json::json!({
            "manifest": {
                "id": "rust-sensor",
                "name": "Rust Sensor Daemon",
                "category": "sensor",
                "autoMount": { "enabled": true },
                "lifecycle": { "offlineBehavior": "retain-dormant" }
            },
            "state": state
        });

        let _ = client.post(url).json(&body).send();
        sleep(Duration::from_secs(3));
    }
}
```

---

## 5. Offline Lifecycle Matrix

| State | Condition | Visual Indicator | Canvas Action |
| :--- | :--- | :--- | :--- |
| **`ONLINE`** | Elapsed < `staleSeconds` (≤10s) | Emerald pulse dot, animated equalizers | Active in-memory state |
| **`STALE`** | Elapsed between `staleSeconds` and `ttlSeconds` | Amber pulsing dot, "Reconnecting..." badge | Retained in-memory |
| **`OFFLINE`** | Elapsed > `ttlSeconds` (≥30s) | Dimmed glassmorphic surface, muted dot | Retained if `retain-dormant`; Pruned if `auto-remove` |
| **`TERMINATED`** | `DELETE /api/v1/emitters/:id` sent | Instant removal or transition | Pruned if `auto-remove` |
