/**
 * PITSTOP Cloudflare Worker
 * Secrets: GITHUB_TOKEN, ADMIN_PASSWORD
 * Vars: GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH
 */

const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp"];
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;
const DATA_PATH = "data/site-data.json";
const FOLDERS = ["hero", "menu", "atmosphere", "auto-moto", "other"];

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";
      if ((path === "/api/health" || path === "/") && request.method === "GET") {
        return json({ ok: true, service: "PITSTOP" }, 200, cors);
      }
      if (path === "/api/data" && request.method === "GET") {
        return json(await readSiteData(env), 200, cors);
      }
      if (path === "/api/login" && request.method === "POST") {
        return login(request, env, cors);
      }
      const user = await requireAdmin(request, env);
      if (!user.ok) return json({ error: user.error }, 401, cors);

      if (path === "/api/data" && (request.method === "POST" || request.method === "PUT")) {
        const body = await request.json();
        if (!body || typeof body !== "object") {
          return json({ error: "Invalid JSON" }, 400, cors);
        }
        await putGithubFile(env, DATA_PATH, JSON.stringify(body, null, 2), "Update PITSTOP site data");
        return json({ ok: true }, 200, cors);
      }
      if (path === "/api/upload" && request.method === "POST") {
        return upload(request, env, cors);
      }
      if (path === "/api/image" && request.method === "DELETE") {
        return removeImage(request, env, cors);
      }
      return json({ error: "Not found" }, 404, cors);
    } catch (err) {
      return json({ error: "Server error" }, 500, corsHeaders(request));
    }
  }
};

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff"
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers });
}

function timingSafeEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) return false;
  let out = 0;
  for (let i = 0; i < left.length; i++) out |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return out === 0;
}

function bytesToB64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function login(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const password = String(body.password || "");
  if (!env.ADMIN_PASSWORD || !timingSafeEqual(password, env.ADMIN_PASSWORD)) {
    return json({ error: "Неверный пароль" }, 401, cors);
  }
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  const payload = btoa(JSON.stringify({ exp, role: "admin" }));
  const token = payload + "." + await hmac(env.ADMIN_PASSWORD, payload);
  return json({ token, exp }, 200, cors);
}

async function requireAdmin(request, env) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !env.ADMIN_PASSWORD) return { ok: false, error: "Unauthorized" };
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return { ok: false, error: "Unauthorized" };
  const expected = await hmac(env.ADMIN_PASSWORD, payload);
  if (!timingSafeEqual(expected, sig)) return { ok: false, error: "Unauthorized" };
  try {
    const data = JSON.parse(atob(payload));
    if (data.exp < Date.now() || data.role !== "admin") return { ok: false, error: "Unauthorized" };
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  return { ok: true };
}

function ghHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "PITSTOP-worker",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

function repoApi(env, filePath) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || "main";
  return {
    url: `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`,
    put: `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
    branch
  };
}

async function githubGet(env, filePath) {
  const { url } = repoApi(env, filePath);
  const res = await fetch(url, { headers: ghHeaders(env) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("GitHub get failed");
  return res.json();
}

async function putGithubFile(env, filePath, text, message) {
  const existing = await githubGet(env, filePath);
  const body = {
    message,
    content: bytesToB64(new TextEncoder().encode(text)),
    branch: env.GITHUB_BRANCH || "main"
  };
  if (existing && existing.sha) body.sha = existing.sha;
  const { put } = repoApi(env, filePath);
  const res = await fetch(put, {
    method: "PUT",
    headers: { ...ghHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error("GitHub put failed: " + err.slice(0, 200));
  }
  return res.json();
}

async function putGithubBinary(env, filePath, bytes, message) {
  const existing = await githubGet(env, filePath);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const body = {
    message,
    content: btoa(binary),
    branch: env.GITHUB_BRANCH || "main"
  };
  if (existing && existing.sha) body.sha = existing.sha;
  const { put } = repoApi(env, filePath);
  const res = await fetch(put, {
    method: "PUT",
    headers: { ...ghHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("GitHub upload failed");
  return res.json();
}

async function deleteGithubFile(env, filePath, message) {
  const existing = await githubGet(env, filePath);
  if (!existing || !existing.sha) return;
  const { put } = repoApi(env, filePath);
  const res = await fetch(put, {
    method: "DELETE",
    headers: { ...ghHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      sha: existing.sha,
      branch: env.GITHUB_BRANCH || "main"
    })
  });
  if (!res.ok && res.status !== 404) throw new Error("GitHub delete failed");
}

async function readSiteData(env) {
  const file = await githubGet(env, DATA_PATH);
  if (!file || !file.content) throw new Error("No data");
  const raw = Uint8Array.from(atob(file.content.replace(/\n/g, "")), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(raw));
}

function sniff(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

function randomName(ext) {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex}_${Date.now()}.${ext}`;
}

async function upload(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const folder = FOLDERS.includes(body.folder) ? body.folder : "other";
  const b64 = String(body.content || "").replace(/^data:[^;]+;base64,/, "");
  if (!b64) return json({ error: "No file" }, 400, cors);
  let raw;
  try {
    raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } catch {
    return json({ error: "Invalid file" }, 400, cors);
  }
  if (raw.length > MAX_BYTES) return json({ error: "File too large" }, 400, cors);
  const kind = sniff(raw);
  if (!kind || !ALLOWED_MIME.includes(kind.mime) || !ALLOWED_EXT.includes(kind.ext)) {
    return json({ error: "Only JPG, PNG, WebP" }, 400, cors);
  }
  const claimed = String(body.filename || "").toLowerCase();
  const claimedExt = claimed.split(".").pop();
  if (claimedExt && !ALLOWED_EXT.includes(claimedExt)) {
    return json({ error: "Bad extension" }, 400, cors);
  }
  const path = `images/${folder}/${randomName(kind.ext)}`;
  await putGithubBinary(env, path, raw, `Upload ${path}`);
  return json({ ok: true, path }, 200, cors);
}

async function removeImage(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const path = String(body.path || "").replace(/^\/+/, "");
  if (!path.startsWith("images/") || path.includes("..")) {
    return json({ error: "Invalid path" }, 400, cors);
  }
  await deleteGithubFile(env, path, `Delete ${path}`);
  return json({ ok: true }, 200, cors);
}
