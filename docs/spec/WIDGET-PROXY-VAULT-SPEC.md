# Glansk Specification: Host-Proxied Fetch & Secret Vault (Gap 2)

**Document Status**: Proposed Architectural Specification  
**Version**: 1.0.0  
**Target Subsystems**: Core Server (`src/services/vault`, `src/services/proxy`), Protocol (`src/widget-sdk`, `src/shared`), Admin Studio (`admin-ui/src/studio`)

---

## 1. Executive Summary & Problem Statement

Glansk enforces a strict sandbox boundary for all third-party and custom widgets:
- Iframe sandbox: `sandbox="allow-scripts"` without `allow-same-origin`.
- Origin: Opaque `null` origin (inaccessible `localStorage`, `sessionStorage`, `cookies`, `IndexedDB`).
- Content Security Policy: `connect-src 'none'`.

This isolation guarantees that an untrusted or compromised widget cannot:
1. Steal session cookies or tokens from the Glansk admin or kiosk host.
2. Read local dashboard data or access host filesystem / hardware resources.
3. Exfiltrate screen contents or keystrokes to arbitrary remote servers directly.

However, real-world dashboard widgets (e.g. weather forecasts, public transit arrivals, stock tickers, calendars, Home Assistant / IoT telemetry) inherently require data from external APIs. Because `connect-src 'none'` blocks all browser-level `fetch()` / `XMLHttpRequest` / `WebSocket` requests from the iframe, widgets cannot currently query third-party APIs directly.

Furthermore, naive solutions—such as loosening CSP `connect-src *`—introduce severe security vulnerabilities:
- **Exposed Credentials**: Widgets would have to bundle private API keys, bearer tokens, or webhook secrets in their client-side source code, exposing them to any user inspecting the page or sharing dashboard canvas templates.
- **SSRF & Intranet Pivoting**: Malicious or buggy widgets could probe the host's private local area network (e.g. router admin panels, Raspberry Pi local services, IoT devices) using the viewer's browser.
- **Data Exfiltration**: Any widget could siphon canvas state to third-party tracking or command-and-control endpoints.

**Solution**: The **Host-Brokered Outbound HTTP Proxy** and **Encrypted Secret Vault** provide a secure, mediated egress bridge. Outbound requests are initiated by the widget over postMessage, validated and executed by the Glansk host process, injected with vault-stored credentials, and returned to the sandboxed iframe without ever exposing raw secrets or raw network access to the widget.

---

## 2. Threat Model & Security Invariants

### 2.1 Threat Actors & Attack Vectors

| Attack Vector | Threat Mechanism | Mitigating Control |
|---|---|---|
| **Intranet Scanning / SSRF** | Widget asks host to fetch `http://127.0.0.1:8080` or `http://192.168.1.1/admin` to inspect or reconfigure local devices. | **Strict SSRF Gateway**: Pre-flight DNS resolution, loopback / link-local / cloud metadata blocklists, and admin-approved LAN allowlists. |
| **DNS Rebinding** | Domain resolves to public IP during pre-flight check, then resolves to `127.0.0.1` on socket connection. | **IP Pinning**: Socket connection connects directly to the pre-verified IP address with HTTP `Host` header set to the hostname. |
| **Credential Theft** | Widget requests its own config to extract and log private API keys or OAuth tokens. | **Zero-Knowledge Secrets**: Widgets receive opaque references (e.g. `secret:openweather_key`); host injects raw credentials during proxy execution. |
| **Credential Exfiltration** | Widget uses proxy to call an attacker-controlled endpoint with vault credentials in query params or headers. | **Domain-Secret Grant Binding**: Secrets can only be injected into requests whose destination matches admin-authorized domain patterns. |
| **Resource Exhaustion** | Widget loops rapid multi-megabyte requests, saturating Pi network bandwidth and CPU. | **Quotas & Rate Limiting**: Per-widget request rate caps (e.g. 60 req/min), strict timeouts (8s), and bounded response buffers (2 MiB). |
| **Response Smuggling / Hijacking** | Upstream server sends chunked/malformed streams or hops. | **Strict Deserialization**: Buffering and schema validation of response envelopes before sending over iframe boundary. |

### 2.2 Core Invariants
1. **The Iframe Sandbox is Inviolable**: `sandbox="allow-scripts"` without `allow-same-origin` and CSP `connect-src 'none'` remain permanently intact.
2. **Secrets Never Enter the Browser**: The sandboxed iframe, admin UI inspector, and canvas JSON templates never receive plaintext secret values.
3. **Fail-Closed Egress**: Network requests to unapproved domains, unresolved hosts, or private addresses fail immediately with explicit error codes.
4. **Audit Trail**: Every proxied request, outbound host, and vault secret injection is logged with correlation IDs for security forensics.

---

## 3. Secret Vault Architecture (`SecretVaultService`)

The Secret Vault stores, manages, and provides scoped access to sensitive credentials required by widgets.

### 3.1 Storage & Cryptographic Model
- **Storage Location**: `data/vault/secrets.enc` (or encrypted SQLite table).
- **Encryption Algorithm**: Authenticated Encryption with Associated Data (AEAD) using **AES-256-GCM**.
- **Master Key Custody**:
  - Derived from an environment variable `GLANSK_MASTER_KEY` (32-byte base64/hex) or a local machine key file `data/vault/master.key` generated with `0600` permissions on initial startup.
  - Key derivation utilizes **HKDF-SHA256** with a project-specific salt (`glansk-secret-vault-v1`).
- **Data Structure**:
  ```json
  {
    "version": 1,
    "cipher": "aes-256-gcm",
    "nonce": "base64...",
    "tag": "base64...",
    "ciphertext": "base64..."
  }
  ```
- **Decrypted Payload Structure**:
  ```typescript
  export interface VaultSecretEntry {
    readonly id: string;               // e.g. "sec_openweather_prod"
    readonly name: string;             // Human-readable label: "OpenWeather API Key"
    readonly description?: string;
    readonly value: string;            // Raw plaintext secret
    readonly allowedDomains: string[]; // e.g. ["api.openweathermap.org"]
    readonly createdAt: number;
    readonly updatedAt: number;
  }
  ```

### 3.2 Secret Grant Model
To prevent a rogue widget from using a secret intended for OpenWeather to authenticate against an arbitrary service:
1. **Domain Whitelisting**: Each secret defines `allowedDomains: string[]`. Injection is only permitted if the proxied URL's hostname matches an allowed domain or glob (e.g. `*.openweathermap.org`).
2. **Widget Grant Assignment**: The canvas document or widget instance configuration specifies which secret references the widget is authorized to bind:
   ```json
   {
     "id": "weather-tile-1",
     "widgetId": "weather-forecast",
     "config": {
       "location": "London, UK",
       "apiKey": "secret:sec_openweather_prod"
     }
   }
   ```
3. **Template Substitution Syntax**:
   The widget requests proxy execution with template placeholders:
   - Header: `Authorization: Bearer {{secret:sec_openweather_prod}}`
   - Header: `X-Api-Key: {{secret:sec_openweather_prod}}`
   - Query Parameter: `https://api.openweathermap.org/data/2.5/weather?appid={{secret:sec_openweather_prod}}&q=London`
   The host proxy replaces `{{secret:...}}` with the plaintext secret if and only if all grant criteria are met.

---

## 4. Widget Proxy Service Architecture (`WidgetProxyService`)

The Widget Proxy Service validates, authorizes, and executes outbound HTTP requests on behalf of sandboxed widgets.

```
+------------------+                    +--------------------+                    +------------------+
| Sandboxed Widget |                    |   Glansk Host    |                    |   External API   |
| (Null Origin)    |                    |  (WidgetProxySvc)  |                    |  (e.g. Weather)  |
+------------------+                    +--------------------+                    +------------------+
         |                                         |                                        |
         |  postMessage('fetch', { url, headers }) |                                        |
         |---------------------------------------->|                                        |
         |                                         | 1. Validate caller identity            |
         |                                         | 2. Check SSRF & DNS Pinning            |
         |                                         | 3. Resolve & Inject Secrets            |
         |                                         | 4. Check Rate Limits                   |
         |                                         |                                        |
         |                                         |  HTTPS GET (pinned IP, Host header)    |
         |                                         |--------------------------------------->|
         |                                         |                                        |
         |                                         |  HTTP 200 OK (Body <= 2MB)             |
         |                                         |<---------------------------------------|
         |                                         |                                        |
         |                                         | 5. Scrub sensitive response headers    |
         |  postMessage('fetch-result', { data })  |                                        |
         |<----------------------------------------|                                        |
         |                                         |                                        |
```

### 4.1 SSRF Defense Pipeline

Before opening a TCP socket to an upstream host, `WidgetProxyService` executes a multi-stage validation pipeline:

1. **Protocol Check**:
   - Only `http:` and `https:` schemes are permitted. Schemes such as `file:`, `gopher:`, `ftp:`, `data:`, and `javascript:` are rejected immediately.
2. **Pre-flight DNS Resolution**:
   - The hostname is resolved using system DNS.
   - All returned IPv4 and IPv6 addresses are checked against forbidden CIDR ranges:
     - `127.0.0.0/8`, `::1` (Loopback)
     - `169.254.0.0/16`, `fe80::/10` (Link-local & Cloud Metadata e.g. AWS/GCP 169.254.169.254)
     - `0.0.0.0/8`, `::/128` (Unspecified)
     - `224.0.0.0/4`, `ff00::/8` (Multicast)
3. **Private LAN Policy**:
   - RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) and ULA (`fc00::/7`) are blocked by default.
   - **Exception Rule**: For smart home dashboards connecting to local IoT hubs (e.g. Home Assistant at `http://192.168.1.50:8123`), the admin can explicitly configure an **Allowed Internal Host List** in server settings.
4. **Socket Pinning (Anti-DNS-Rebinding)**:
   - The connection is established directly to the verified IP address (`socket.connect(port, verifiedIp)`).
   - The TLS SNI and HTTP `Host` header are set to the original hostname, preventing DNS rebinding between verification and connection.
5. **Redirect Confinement**:
   - Redirects (`301`, `302`, `307`, `308`) are followed up to a maximum of 3 hops.
   - Each redirect target URL must undergo the exact same SSRF and domain checks as the initial URL.

### 4.2 Quotas & Boundaries

| Parameter | Limit | Failure Response |
|---|---|---|
| Max Request Body | 256 KiB | `413 Payload Too Large` / `{ ok: false, error: 'body_too_large' }` |
| Max Response Body | 2 MiB | `413 Response Exceeded 2MB` / `{ ok: false, error: 'response_too_large' }` |
| Request Timeout | 8,000 ms | `{ ok: false, error: 'timeout' }` |
| Rate Limit per Widget | 60 requests / minute | `{ ok: false, error: 'rate_limited' }` |
| Concurrency per Widget | 4 active requests | `{ ok: false, error: 'concurrency_exceeded' }` |

### 4.3 Header Scrubbing

To prevent session fixation, header injection, or protocol downgrade:
- **Forbidden Request Headers**: `Host`, `Cookie`, `Set-Cookie`, `Connection`, `Upgrade`, `Keep-Alive`, `Proxy-Authorization`, `TE`, `Transfer-Encoding`.
- **Scrubbed Response Headers**: All upstream `Set-Cookie` and server identification headers are stripped before delivering the response to the widget.

---

## 5. Protocol & SDK Contracts

### 5.1 Protocol Messages (`glansk.widget.v1`)

#### 1. Outbound Fetch Request (`widget` -> `host`):
```typescript
export interface WidgetFetchRequest {
  readonly protocol: "glansk.widget.v1";
  readonly type: "fetch";
  readonly instanceId: string;
  readonly nonce: string;
  readonly correlationId: string;
  readonly url: string;
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly headers?: Record<string, string>;
  readonly body?: string | JsonValue;
  readonly timeoutMs?: number;
}
```

#### 2. Fetch Result Reply (`host` -> `widget`):
```typescript
export interface WidgetFetchResultSuccess {
  readonly protocol: "glansk.widget.v1";
  readonly type: "fetch-result";
  readonly instanceId: string;
  readonly nonce: string;
  readonly correlationId: string;
  readonly ok: true;
  readonly status: number;
  readonly statusText: string;
  readonly headers: Record<string, string>;
  readonly data: string; // Plain text or serialized JSON string
}

export interface WidgetFetchResultError {
  readonly protocol: "glansk.widget.v1";
  readonly type: "fetch-result";
  readonly instanceId: string;
  readonly nonce: string;
  readonly correlationId: string;
  readonly ok: false;
  readonly error: {
    readonly code: "forbidden" | "ssrf_denied" | "secret_denied" | "timeout" | "rate_limited" | "network_error" | "response_too_large";
    readonly message: string;
  };
}

export type WidgetFetchResult = WidgetFetchResultSuccess | WidgetFetchResultError;
```

### 5.2 Widget SDK API Surface

The SDK exposes `widget.fetch()` which mimics the standard browser `fetch` signature:

```javascript
// Inside widget iframe code:
const widget = await Glansk.connect();

// 1. Simple GET request
const response = await widget.fetch('https://api.weather.gov/gridpoints/TOP/31,80/forecast');
const weatherData = await response.json();

// 2. Authenticated POST with Vault Secret injection
const haResponse = await widget.fetch('https://homeassistant.local:8123/api/states/light.living_room', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer {{secret:homeassistant_token}}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ state: 'on' }),
});
```

`ResponseLike` object structure:
- `response.ok`: boolean (`status >= 200 && status < 300`)
- `response.status`: number
- `response.statusText`: string
- `response.headers`: `{ get(name: string): string | null }`
- `response.text()`: `Promise<string>`
- `response.json()`: `Promise<any>`

---

## 6. Admin Studio Integration & UI Controls

### 6.1 Secret Vault Management View (`/admin/secrets`)
A dedicated admin panel for managing encrypted credentials:
- **Secret List**: Displays ID, Name, Description, Allowed Domains, and Last Used Timestamp (values are never echoed back).
- **Create Secret Dialog**:
  - `ID`: Unique slug (e.g. `openweather_key`).
  - `Name`: Display name (e.g. "OpenWeather API Key").
  - `Secret Value`: Masked input (`password` field) with confirm field.
  - `Allowed Domains`: Comma-separated domains (e.g. `api.openweathermap.org`).
- **Rotate / Delete Controls**: Admin can rotate secret values or revoke access without modifying canvas widgets.

### 6.2 Schema-Driven Inspector Integration
In Slice 1, we implemented the `secret-ref` field type in `admin-ui/src/studio/controls/SchemaFields.tsx`:

```typescript
export interface WidgetConfigField {
  name: string;
  label: string;
  type: "string" | "number" | "boolean" | "select" | "color" | "textarea" | "secret-ref" | "string[]";
  secretFilter?: string[]; // Optional domain filter
  // ...
}
```

When a widget manifest specifies:
```json
{
  "name": "apiKey",
  "label": "Weather API Key",
  "type": "secret-ref",
  "secretFilter": ["api.openweathermap.org"]
}
```

The Admin Inspector automatically renders a secure dropdown populated by `/api/v1/vault/secrets` matching the domain filter. The canvas document only stores the reference ID `secret:openweather_key`, maintaining 100% zero-knowledge security.

---

## 7. Delivery Roadmap & Implementation Phases

| Phase | Milestone | Core Deliverables |
|---|---|---|
| **Phase 1** | Secret Vault Engine | `src/services/vault/secret-vault-service.ts` with AES-256-GCM encryption, disk persistence, and unit tests. |
| **Phase 2** | Outbound Proxy & SSRF Engine | `src/services/proxy/widget-proxy-service.ts` with DNS pre-flight checking, IP pinning, CIDR blocklists, and quota enforcement. |
| **Phase 3** | Host & SDK Wire Protocol | Message handlers in `widget-host.js`, `contracts.ts`, `widget-protocol.js`, and `widget.fetch()` implementation in `widget-sdk.js` and all 6 widget copies. |
| **Phase 4** | Admin Studio Vault UI | Vault management view in `admin-ui/src/settings/VaultSettings.tsx` and API endpoints `GET /api/v1/vault/secrets`, `POST /api/v1/vault/secrets`. |
| **Phase 5** | Verification & Integration Tests | Comprehensive end-to-end test suite testing SSRF blocking, DNS rebinding prevention, secret injection, and quota limits. |

---

## 8. Conclusion

By maintaining the strict null-origin sandbox and routing outbound communication through a hardened, DNS-pinned, secret-substituting host proxy, Glansk gains the full extensible power of the MagicMirror ecosystem while preserving complete resistance against XSS, SSRF, credential exfiltration, and local network intrusion.
