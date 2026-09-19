import dns from "node:dns/promises";
import type { SecretVaultService } from "../vault/secret-vault-service";

export interface SsrfValidationResult {
  readonly safe: boolean;
  readonly reason?: string;
  readonly resolvedIps?: string[];
}

// Convert IPv4 string to 32-bit unsigned number
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let num = 0;
  for (let i = 0; i < 4; i++) {
    const part = parts[i]!;
    if (!/^\d+$/.test(part)) return null;
    const n = parseInt(part, 10);
    if (n < 0 || n > 255) return null;
    num = (num << 8) | n;
  }
  return num >>> 0;
}

interface Ipv4Range {
  name: string;
  net: number;
  mask: number;
}

function makeIpv4Range(name: string, cidr: string): Ipv4Range {
  const [netStr, bitsStr] = cidr.split("/");
  const net = ipv4ToInt(netStr!)!;
  const bits = parseInt(bitsStr!, 10);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return { name, net: (net & mask) >>> 0, mask };
}

const BLOCKED_IPV4_RANGES: Ipv4Range[] = [
  makeIpv4Range("unspecified", "0.0.0.0/8"),
  makeIpv4Range("private-10", "10.0.0.0/8"),
  makeIpv4Range("loopback", "127.0.0.0/8"),
  makeIpv4Range("link-local-metadata", "169.254.0.0/16"),
  makeIpv4Range("private-172", "172.16.0.0/12"),
  makeIpv4Range("private-192", "192.168.0.0/16"),
  makeIpv4Range("multicast", "224.0.0.0/4"),
  makeIpv4Range("reserved", "240.0.0.0/4"),
  makeIpv4Range("broadcast", "255.255.255.255/32"),
];

export function isBlockedIpv4(ip: string): { blocked: boolean; reason?: string } {
  const intVal = ipv4ToInt(ip);
  if (intVal === null) return { blocked: true, reason: "invalid_ipv4" };
  for (const range of BLOCKED_IPV4_RANGES) {
    if ((intVal & range.mask) >>> 0 === range.net) {
      return { blocked: true, reason: range.name };
    }
  }
  return { blocked: false };
}

export function isBlockedIpv6(ip: string): { blocked: boolean; reason?: string } {
  const normalized = ip.toLowerCase().trim();

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (normalized.startsWith("::ffff:")) {
    const rest = normalized.slice(7);
    if (rest.includes(".")) {
      return isBlockedIpv4(rest);
    }
  }

  // Loopback ::1
  if (normalized === "::1" || normalized === "0000:0000:0000:0000:0000:0000:0000:0001") {
    return { blocked: true, reason: "loopback_v6" };
  }

  // Unspecified ::
  if (normalized === "::" || normalized === "0000:0000:0000:0000:0000:0000:0000:0000") {
    return { blocked: true, reason: "unspecified_v6" };
  }

  // Link-local: fe80::/10 (fe8, fe9, fea, feb)
  if (/^fe[89ab]/i.test(normalized)) {
    return { blocked: true, reason: "link_local_v6" };
  }

  // Unique Local Address (ULA / private LAN): fc00::/7 (fc, fd)
  if (/^f[cd]/i.test(normalized)) {
    return { blocked: true, reason: "unique_local_v6" };
  }

  // Multicast: ff00::/8
  if (normalized.startsWith("ff")) {
    return { blocked: true, reason: "multicast_v6" };
  }

  return { blocked: false };
}

export function matchDomain(hostname: string, pattern: string): boolean {
  const h = hostname.toLowerCase().trim();
  const p = pattern.toLowerCase().trim();
  if (p === "*") return true;
  if (p.startsWith("*.")) {
    const base = p.slice(2);
    return h === base || h.endsWith("." + base);
  }
  return h === p;
}

export async function validateTargetUrl(
  urlString: string,
  allowedInternalHosts: string[] = []
): Promise<SsrfValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { safe: false, reason: "malformed_url" };
  }

  // 1. Protocol check
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: `forbidden_protocol_${parsed.protocol}` };
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // 2. Allowed internal hosts exception (e.g. homeassistant.local or local gateway)
  if (allowedInternalHosts.some((pattern) => matchDomain(hostname, pattern))) {
    return { safe: true };
  }

  // 3. Localhost hostname checks
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "local") {
    return { safe: false, reason: "loopback_hostname" };
  }

  // 4. If hostname is direct IP literal, validate immediately
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    const chk = isBlockedIpv4(hostname);
    if (chk.blocked) {
      return { safe: false, reason: `blocked_ip_${chk.reason}`, resolvedIps: [hostname] };
    }
    return { safe: true, resolvedIps: [hostname] };
  }

  if (hostname.includes(":")) {
    // Might be IPv6 literal
    const cleanIpv6 = hostname.replace(/^\[|\]$/g, "");
    const chk = isBlockedIpv6(cleanIpv6);
    if (chk.blocked) {
      return { safe: false, reason: `blocked_ip_${chk.reason}`, resolvedIps: [cleanIpv6] };
    }
    return { safe: true, resolvedIps: [cleanIpv6] };
  }

  // 5. Pre-flight DNS resolution
  try {
    const lookupResults = await dns.lookup(hostname, { all: true });
    if (!lookupResults || lookupResults.length === 0) {
      return { safe: false, reason: "dns_resolution_empty" };
    }

    const resolvedIps = lookupResults.map((r) => r.address);

    for (const record of lookupResults) {
      // Check if this resolved IP is explicitly whitelisted
      if (allowedInternalHosts.includes(record.address)) {
        continue;
      }

      if (record.family === 4) {
        const chk = isBlockedIpv4(record.address);
        if (chk.blocked) {
          return { safe: false, reason: `blocked_dns_ip_${chk.reason}`, resolvedIps };
        }
      } else if (record.family === 6) {
        const chk = isBlockedIpv6(record.address);
        if (chk.blocked) {
          return { safe: false, reason: `blocked_dns_ip_${chk.reason}`, resolvedIps };
        }
      }
    }

    return { safe: true, resolvedIps };
  } catch (err: any) {
    return { safe: false, reason: `dns_error_${err?.code || "failed"}` };
  }
}

const SECRET_PLACEHOLDER_REGEX = /\{\{secret:([a-zA-Z0-9_\-:]{2,64})\}\}/g;

export function extractSecretIds(text: string): string[] {
  const ids: string[] = [];
  const matches = text.matchAll(SECRET_PLACEHOLDER_REGEX);
  for (const m of matches) {
    if (m[1]) ids.push(m[1]);
  }
  return ids;
}

export function substituteSecretsInString(
  text: string,
  vault: SecretVaultService,
  targetHostname: string
): { success: true; result: string } | { success: false; error: string } {
  let hasError = false;
  let errorMessage = "";

  const substituted = text.replace(SECRET_PLACEHOLDER_REGEX, (_match, secretId) => {
    if (hasError) return _match;

    const secret = vault.getSecret(secretId);
    if (!secret) {
      hasError = true;
      errorMessage = `Secret '${secretId}' not found in vault`;
      return _match;
    }

    if (secret.allowedDomains && secret.allowedDomains.length > 0) {
      const allowed = secret.allowedDomains.some((dom) => matchDomain(targetHostname, dom));
      if (!allowed) {
        hasError = true;
        errorMessage = `Secret '${secretId}' is not authorized for target domain '${targetHostname}'`;
        return _match;
      }
    }

    return secret.value;
  });

  if (hasError) {
    return { success: false, error: errorMessage };
  }

  return { success: true, result: substituted };
}
