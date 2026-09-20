# Glansk Package Cryptographic Signing & Origin Continuity Specification

## 1. Overview & Security Model

Glansk extensions and widgets are packaged as `.glpkg` archives (standard ZIP container). To provide strong security guarantees comparable to modern application packaging ecosystems (such as Android APK signature scheme v2/v3), Glansk enforces:
1. **Developer Origin Authenticity & Integrity**: Packages are cryptographically signed using asymmetric **Ed25519** keypairs via WebCrypto API.
2. **Origin Continuity (Signer Pinning / Trust-On-First-Use)**: Once a package is installed with a developer key fingerprint, all subsequent updates for that package ID must be signed with the identical private key. Any attempt to update the package with a different key (or unsigned) is rejected with `SignerMismatchError`.
3. **Anti-Rollback (Monotonic `versionCode`)**: Packages declare an integer `versionCode` ($1 \le \text{versionCode} \le 2,147,483,647$). Downgrades (`new.versionCode < installed.versionCode`) are blocked by default to prevent replay attacks and exploitation of known patched vulnerabilities, unless an administrative override (`allowDowngrade: true`) is explicitly supplied.
4. **Bidirectional Archive Verification**: The archive must contain strictly the files declared in `manifest.files` plus `manifest.json`. Any unlisted file injection (e.g. `backdoor.js`) causes immediate rejection.
5. **Atomic Extraction**: Staging directories are used during extraction to ensure zero partial/corrupted disk writes if verification fails.

---

## 2. Package Format (`.glpkg`)

The package format is strictly `.glpkg`. All legacy extensions (such as `.gdpkg`) are deprecated and prohibited.

### 2.1 Archive Structure
```
package-name-1.0.0.glpkg
├── manifest.json
├── index.html
├── styles.css
└── assets/
    └── icon.svg
```

### 2.2 Manifest Schema (`manifest.json`)
```json
{
  "manifestVersion": 2,
  "id": "com.example.sensor-gauge",
  "name": "Sensor Gauge",
  "version": "1.2.0",
  "versionCode": 120,
  "kind": "widget",
  "description": "Real-time industrial sensor readout",
  "author": "Example Corp",
  "entry": "index.html",
  "files": {
    "index.html": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "styles.css": "d41d8cd98f00b204e9800998ecf8427e00000000000000000000000000000000"
  },
  "signer": {
    "algorithm": "Ed25519",
    "publicKey": "<base64-encoded-raw-32-byte-public-key>",
    "fingerprint": "SHA256:<lowercase-hex-of-sha256(rawPublicKey)>",
    "signature": "<base64-encoded-64-byte-ed25519-signature>",
    "signedAt": "2026-09-20T10:00:00.000Z"
  }
}
```

---

## 3. Cryptographic Invariants

### 3.1 Keypair Generation
- **Algorithm**: Ed25519 (`{ name: "Ed25519" }` via WebCrypto `crypto.subtle`).
- **Public Key**: Raw 32-byte Ed25519 public key, Base64-encoded.
- **Private Key**: PKCS#8 DER envelope (48 bytes) or raw 32-byte seed, Base64-encoded.
- **Origin Fingerprint**: `SHA256:<hex>`, computed as:
  $$\text{fingerprint} = \text{"SHA256:"} + \text{hex}(\text{SHA-256}(\text{rawPublicKeyBytes}))$$

### 3.2 Canonical Manifest Serialization (RFC 8785)
Before computing the signature, the manifest is normalized to an unsigned state:
1. `signer.signature` is omitted.
2. Legacy `signature` is omitted.
3. Object keys are recursively sorted lexicographically (RFC 8785 JSON Canonicalization Scheme).
4. Signature is computed over the UTF-8 bytes of this canonical JSON string.

### 3.3 Bidirectional File Verification
1. Every file in the archive (except `manifest.json`) MUST exist as an entry in `manifest.files`. Extra files trigger `unlisted file in package`.
2. Every entry in `manifest.files` MUST exist in the archive and its SHA-256 digest MUST match exactly.

---

## 4. Developer Workflow via `@glansk/widget-sdk` CLI

### 4.1 Generate Keypair
```bash
bunx glansk-widget keygen --out ./keys --name developer
```
Generates:
- `./keys/developer.private.key`
- `./keys/developer.public.key`
- Displays developer origin identity (`SHA256:<fingerprint>`).

### 4.2 Pack & Sign
```bash
bunx glansk-widget pack ./my-widget --sign ./keys/developer.private.key --version-code 100 --out ./my-widget-1.0.0.glpkg
```
Automatically digests files, canonicalizes manifest, signs with Ed25519, and generates `.glpkg`.

### 4.3 Verify Package
```bash
bunx glansk-widget verify ./my-widget-1.0.0.glpkg
```
Inspects bidirectional archive digests, checks `versionCode`, and verifies cryptographic developer origin signature.

---

## 5. Host Platform Enforcement & Anti-Rollback

### 5.1 Signer Pinning (Trust-On-First-Use)
When package `id` is installed for the first time, its `signerFingerprint` is persisted in the package registry.
When an update with the same `id` is imported:
- If `installed.signerFingerprint` exists:
  $$\text{update.signerFingerprint} == \text{installed.signerFingerprint}$$
- If fingerprints do not match, the update is rejected with `SignerMismatchError` (HTTP 400 `signer_mismatch`).

### 5.2 Anti-Rollback (`versionCode`)
- If both `installed.versionCode` and `new.versionCode` are defined:
  $$\text{new.versionCode} \ge \text{installed.versionCode}$$
- If $\text{new.versionCode} < \text{installed.versionCode}$ and `allowDowngrade: false`, the operation is aborted with `PackageDowngradeError` (HTTP 400 `downgrade_rejected`).
- To allow administrative rollback, pass `allowDowngrade: true` (or `?allowDowngrade=true` via REST API).
