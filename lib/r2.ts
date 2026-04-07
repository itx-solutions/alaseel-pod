const REGION = "auto";
const SERVICE = "s3";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} must be set`);
  return v;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256HexOfBytes(data: Uint8Array): Promise<string> {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const hash = await crypto.subtle.digest("SHA-256", copy);
  return toHex(new Uint8Array(hash));
}

async function sha256HexOfString(data: string): Promise<string> {
  return sha256HexOfBytes(new TextEncoder().encode(data));
}

async function hmacSha256Bytes(
  keyBytes: Uint8Array,
  data: string,
): Promise<Uint8Array> {
  const keyCopy = new Uint8Array(keyBytes.byteLength);
  keyCopy.set(keyBytes);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyCopy,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(data),
  );
  return new Uint8Array(sig);
}

async function getSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<Uint8Array> {
  const kDate = await hmacSha256Bytes(
    new TextEncoder().encode(`AWS4${secretAccessKey}`),
    dateStamp,
  );
  const kRegion = await hmacSha256Bytes(kDate, region);
  const kService = await hmacSha256Bytes(kRegion, service);
  return hmacSha256Bytes(kService, "aws4_request");
}

/** Path-style: /bucket/key segments URI-encoded per SigV4. */
function canonicalUriPath(bucket: string, objectKey: string): string {
  const segments = [bucket, ...objectKey.split("/").filter((s) => s.length > 0)];
  return "/" + segments.map((s) => uriEncodeRfc3986(s)).join("/");
}

/**
 * URI encode for SigV4 (RFC 3986; AWS excludes a few characters for path segments).
 * For query values, use encodeURIComponent-style rules from AWS docs.
 */
function uriEncodeRfc3986(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Canonical query string: sorted keys, RFC 3986 encoded key=value joined with &. */
function canonicalQueryString(params: Record<string, string>): string {
  const keys = Object.keys(params).sort();
  return keys
    .map((k) => `${uriEncodeRfc3986(k)}=${uriEncodeRfc3986(params[k])}`)
    .join("&");
}

/** Copy into a fresh Uint8Array so fetch/crypto get plain ArrayBuffer-backed types (TS + Workers). */
function normalizeBody(body: Uint8Array | ArrayBuffer): Uint8Array {
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  const u = new Uint8Array(body.byteLength);
  u.set(body);
  return u;
}

function r2Env() {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
  const bucketName = requireEnv("R2_BUCKET_NAME");
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}`;
  return { accountId, accessKeyId, secretAccessKey, bucketName, host, endpoint };
}

/**
 * Upload bytes to a private R2 bucket. Returns the object key (never a public URL).
 * Uses SigV4 + fetch (Web Crypto) — compatible with Cloudflare Workers (no Node fs).
 */
export async function uploadToR2(
  key: string,
  body: Uint8Array | ArrayBuffer,
  contentType: string,
): Promise<string> {
  const { accessKeyId, secretAccessKey, bucketName, host, endpoint } = r2Env();
  const bytes = normalizeBody(body);
  const amzDate = formatAmzDate(new Date());
  const dateStamp = amzDate.slice(0, 8);
  const path = canonicalUriPath(bucketName, key);
  const payloadHash = await sha256HexOfBytes(bytes);

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    "PUT",
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const canonicalRequestHash = await sha256HexOfString(canonicalRequest);
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  const signingKey = await getSigningKey(
    secretAccessKey,
    dateStamp,
    REGION,
    SERVICE,
  );
  const signature = toHex(await hmacSha256Bytes(signingKey, stringToSign));

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `${endpoint}${path}`;
  // Do not set Host — Workers forbid overriding Host; URL hostname must match canonical host.
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
    body: bytes as BodyInit,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `R2 upload failed: ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 500)}` : ""}`,
    );
  }

  return key;
}

function formatAmzDate(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${mo}${day}T${h}${mi}${s}Z`;
}

/**
 * Presigned GET URL for a private object. Uses SigV4 query-string auth + Web Crypto only.
 */
export async function getSignedR2Url(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { accessKeyId, secretAccessKey, bucketName, host, endpoint } = r2Env();
  const amzDate = formatAmzDate(new Date());
  const dateStamp = amzDate.slice(0, 8);
  const path = canonicalUriPath(bucketName, key);
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const credential = `${accessKeyId}/${credentialScope}`;

  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
  };

  const signedQuery = canonicalQueryString(params);

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [
    "GET",
    path,
    signedQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const canonicalRequestHash = await sha256HexOfString(canonicalRequest);
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  const signingKey = await getSigningKey(
    secretAccessKey,
    dateStamp,
    REGION,
    SERVICE,
  );
  const signature = toHex(await hmacSha256Bytes(signingKey, stringToSign));

  const finalQuery = `${signedQuery}&${uriEncodeRfc3986("X-Amz-Signature")}=${uriEncodeRfc3986(signature)}`;
  return `${endpoint}${path}?${finalQuery}`;
}
