/* ============================================================
   CAPA DE PROVEEDOR DE CORREO — desacoplada del CRM
   ------------------------------------------------------------
   El router del CRM (api.mjs) nunca habla directamente con Microsoft
   Graph: usa la interfaz `mailProvider` que devuelve `createGraphProvider`.
   Todo aquí es puro e inyectable (fetch simulable) para poder probarlo
   con `node --test` sin enviar correos reales ni tocar la red.

   NO registra tokens. NO expone secretos. NO llama a hosts que no sean
   de Microsoft (anti-SSRF).
   ============================================================ */
import crypto from "node:crypto";

export const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
export const LOGIN_BASE = "https://login.microsoftonline.com";

/* Scopes mínimos delegados; User.Read identifica el buzón conectado. */
export const SCOPES_INDIVIDUAL = ["openid", "profile", "email", "offline_access", "User.Read", "Mail.ReadWrite", "Mail.Send"];

/* Límites de adjuntos. Graph acepta adjuntos "simples" hasta ~3 MB en una sola
   petición; por encima requiere upload session (fase posterior de envío). */
export const ATTACH_MAX_BYTES = 25 * 1024 * 1024;          /* tope duro de recepción */
export const ATTACH_SIMPLE_SEND_MAX = 3 * 1024 * 1024;     /* tope de envío simple */
export const ATTACH_BLOCKED_EXT = [
  "exe","scr","bat","cmd","com","pif","msi","msp","cpl","jar","js","jse","vbs","vbe",
  "wsf","wsh","ps1","psm1","hta","lnk","reg","dll","sys","scf","gadget"
];

/* ---------- Utilidades de error sin filtración de secretos ---------- */
export function safeErr(e, max) {
  const m = String((e && e.message) || e || "error");
  return m.replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[oculto]").slice(0, max || 200);
}

/* ============================================================
   CIFRADO DE REFRESH TOKENS (AES-256-GCM)
   Formato almacenado: v1:iv(hex):tag(hex):ciphertext(hex)
   La clave sale de MAIL_TOKEN_ENCRYPTION_KEY (32 bytes en hex o base64).
   ============================================================ */
export function loadEncryptionKey(raw) {
  if (!raw) throw new Error("MAIL_TOKEN_ENCRYPTION_KEY no configurada");
  let key = null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) key = Buffer.from(raw, "hex");
  else { try { const b = Buffer.from(raw, "base64"); if (b.length === 32) key = b; } catch (e) {} }
  if (!key || key.length !== 32) throw new Error("MAIL_TOKEN_ENCRYPTION_KEY debe ser de 32 bytes (64 hex o base64)");
  return key;
}
export function encryptToken(plain, rawKey) {
  const key = loadEncryptionKey(rawKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return "v1:" + iv.toString("hex") + ":" + tag.toString("hex") + ":" + ct.toString("hex");
}
export function decryptToken(blob, rawKey) {
  const key = loadEncryptionKey(rawKey);
  const parts = String(blob || "").split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("token cifrado con formato inválido");
  const iv = Buffer.from(parts[1], "hex"), tag = Buffer.from(parts[2], "hex"), ct = Buffer.from(parts[3], "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/* ============================================================
   OAUTH (Authorization Code + PKCE)
   ============================================================ */
export function b64url(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
export function makePkce() {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge, method: "S256" };
}
export function randomToken(n) { return crypto.randomBytes(n || 24).toString("hex"); }

export function buildAuthUrl(cfg) {
  /* cfg: { tenantId, clientId, redirectUri, scopes, state, nonce, codeChallenge } */
  const tenant = encodeURIComponent(cfg.tenantId || "organizations");
  const p = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    redirect_uri: cfg.redirectUri,
    response_mode: "query",
    scope: (cfg.scopes || SCOPES_INDIVIDUAL).join(" "),
    state: cfg.state,
    nonce: cfg.nonce,
    code_challenge: cfg.codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return LOGIN_BASE + "/" + tenant + "/oauth2/v2.0/authorize?" + p.toString();
}

async function tokenRequest(cfg, params, fetchImpl) {
  const f = fetchImpl || globalThis.fetch;
  const tenant = encodeURIComponent(cfg.tenantId || "organizations");
  const url = LOGIN_BASE + "/" + tenant + "/oauth2/v2.0/token";
  const body = new URLSearchParams(params);
  const res = await f(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  let data = null; try { data = await res.json(); } catch (e) { data = {}; }
  if (!res.ok) {
    /* Mensaje de Microsoft (p. ej. AADSTS...) — útil para diagnosticar bloqueo de tenant. */
    const desc = (data && (data.error_description || data.error)) || ("HTTP " + res.status);
    const err = new Error(String(desc).split("\n")[0].slice(0, 300));
    err.aadsts = /AADSTS\d+/.exec(String(desc));
    err.status = res.status;
    throw err;
  }
  return data; /* { access_token, refresh_token, expires_in, scope, ... } */
}
export function exchangeCode(cfg, code, codeVerifier, fetchImpl) {
  const params = {
    client_id: cfg.clientId,
    grant_type: "authorization_code",
    code: code,
    redirect_uri: cfg.redirectUri,
    code_verifier: codeVerifier,
    scope: (cfg.scopes || SCOPES_INDIVIDUAL).join(" "),
  };
  if (cfg.clientSecret) params.client_secret = cfg.clientSecret;
  return tokenRequest(cfg, params, fetchImpl);
}
export function refreshAccessToken(cfg, refreshToken, fetchImpl) {
  const params = {
    client_id: cfg.clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: (cfg.scopes || SCOPES_INDIVIDUAL).join(" "),
  };
  if (cfg.clientSecret) params.client_secret = cfg.clientSecret;
  return tokenRequest(cfg, params, fetchImpl);
}

/* ============================================================
   SANEADO DE HTML ENTRANTE
   Conservador: elimina scripts, estilos, iframes/objetos, manejadores
   on*, y URLs peligrosas (javascript:, data: en src). No pretende ser un
   DOM completo, sino una defensa robusta antes de mostrar en el CRM.
   ============================================================ */
export function sanitizeHtml(html) {
  let s = String(html == null ? "" : html);
  /* Elimina bloques peligrosos con su contenido */
  s = s.replace(/<\s*(script|style|iframe|object|embed|noscript|template|link|meta|base|form)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  /* Elimina etiquetas de apertura sueltas de esos mismos elementos (sin cierre) */
  s = s.replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form)\b[^>]*>/gi, "");
  /* Quita manejadores de eventos on*="..." / on*='...' / on*=valor */
  s = s.replace(/\son[a-z]+\s*=\s*"(?:[^"]*)"/gi, "");
  s = s.replace(/\son[a-z]+\s*=\s*'(?:[^']*)'/gi, "");
  s = s.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");
  /* Neutraliza javascript:, vbscript: y data: en atributos href/src/xlink */
  s = s.replace(/((?:href|src|xlink:href)\s*=\s*")\s*(?:javascript|vbscript|data)\s*:[^"]*"/gi, '$1#"');
  s = s.replace(/((?:href|src|xlink:href)\s*=\s*')\s*(?:javascript|vbscript|data)\s*:[^']*'/gi, "$1#'");
  /* Quita atributos style con expression()/url(javascript:) por si acaso */
  s = s.replace(/\sstyle\s*=\s*"(?:[^"]*expression\([^"]*)"/gi, "");
  return s;
}
export function htmlToText(html) {
  return String(html == null ? "" : html)
    .replace(/<\s*(script|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ").trim();
}
export function attachmentAllowed(name, size) {
  const ext = String(name || "").toLowerCase().split(".").pop();
  if (ATTACH_BLOCKED_EXT.indexOf(ext) > -1) return { ok: false, reason: "tipo de archivo no permitido" };
  if (Number(size) > ATTACH_MAX_BYTES) return { ok: false, reason: "adjunto demasiado grande" };
  return { ok: true };
}

/* ============================================================
   NORMALIZADORES Graph → forma interna del CRM
   ============================================================ */
function addr(x) { return x && x.emailAddress ? { name: x.emailAddress.name || "", address: (x.emailAddress.address || "").toLowerCase() } : null; }
function addrList(a) { return (a || []).map(addr).filter(Boolean); }

export function normalizeMessage(m) {
  if (!m) return null;
  const body = m.body || {};
  const isHtml = String(body.contentType || "").toLowerCase() === "html";
  const rawHtml = isHtml ? body.content : ("<pre>" + String(body.content || "").replace(/</g, "&lt;") + "</pre>");
  const html = sanitizeHtml(rawHtml);
  return {
    providerMessageId: m.id,
    providerThreadId: m.conversationId || m.id,
    subject: m.subject || "",
    from: addr(m.from) || addr(m.sender),
    to: addrList(m.toRecipients),
    cc: addrList(m.ccRecipients),
    bcc: addrList(m.bccRecipients),
    preview: m.bodyPreview || "",
    bodyHtml: html,
    bodyText: body && !isHtml ? String(body.content || "") : htmlToText(html),
    isRead: !!m.isRead,
    isFlagged: !!(m.flag && m.flag.flagStatus === "flagged"),
    hasAttachments: !!m.hasAttachments,
    receivedAt: m.receivedDateTime || null,
    sentAt: m.sentDateTime || null,
    folderId: m.parentFolderId || null,
    webLink: m.webLink || null,
  };
}
export function normalizeFolder(f) {
  if (!f) return null;
  return { id: f.id, name: f.displayName || "", unread: Number(f.unreadItemCount) || 0, total: Number(f.totalItemCount) || 0 };
}
export function normalizeAttachment(a) {
  if (!a) return null;
  return { providerAttachmentId: a.id, name: a.name || "adjunto", mimeType: a.contentType || "application/octet-stream", size: Number(a.size) || 0, isInline: !!a.isInline };
}

/* ============================================================
   PROVEEDOR: implementación Microsoft Graph
   createGraphProvider({ accessToken, fetchImpl, userPath })
   - userPath: "/me" (individual) o "/users/{upn}" (bandeja compartida)
   ============================================================ */
export function createGraphProvider(opts) {
  const accessToken = opts && opts.accessToken;
  const f = (opts && opts.fetchImpl) || globalThis.fetch;
  const base = (opts && opts.graphBase) || GRAPH_BASE;
  const userPath = (opts && opts.userPath) || "/me";
  if (!accessToken) throw new Error("createGraphProvider requiere accessToken");

  async function call(method, pathOrUrl, body, extraHeaders) {
    const isAbs = /^https?:\/\//i.test(pathOrUrl);
    /* Anti-SSRF: solo se permiten URLs absolutas hacia el propio Graph (las que
       Graph nos devuelve como @odata.nextLink / deltaLink). */
    if (isAbs && pathOrUrl.indexOf(base) !== 0 && !/^https:\/\/graph\.microsoft\.com\//i.test(pathOrUrl)) {
      throw new Error("URL no permitida");
    }
    const url = isAbs ? pathOrUrl : (base + userPath + pathOrUrl);
    const headers = Object.assign({ authorization: "Bearer " + accessToken }, extraHeaders || {});
    if (body !== undefined && body !== null && !headers["content-type"]) headers["content-type"] = "application/json";
    const res = await f(url, { method: method, headers: headers, body: body === undefined || body === null ? undefined : (typeof body === "string" ? body : JSON.stringify(body)) });
    return res;
  }
  async function callJson(method, pathOrUrl, body) {
    const res = await call(method, pathOrUrl, body);
    let data = null; try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      const msg = (data && data.error && data.error.message) || ("HTTP " + res.status);
      const err = new Error(safeErr(msg, 300)); err.status = res.status; err.code = data && data.error && data.error.code; throw err;
    }
    return data;
  }

  return {
    /* Carpetas del buzón */
    async listFolders() {
      const d = await callJson("GET", "/mailFolders?$top=100&$select=id,displayName,unreadItemCount,totalItemCount");
      return (d.value || []).map(normalizeFolder);
    },
    /* Lista de mensajes (base de los hilos). Soporta carpeta, búsqueda y paginación. */
    async listThreads(o) {
      o = o || {};
      let path;
      if (o.nextLink) { path = o.nextLink; }
      else {
        const sel = "id,conversationId,subject,from,sender,toRecipients,ccRecipients,bodyPreview,isRead,hasAttachments,receivedDateTime,sentDateTime,parentFolderId,flag,webLink";
        const qs = ["$select=" + sel, "$top=" + (Math.min(Number(o.top) || 25, 50))];
        if (o.search) { qs.push("$search=" + encodeURIComponent('"' + String(o.search).replace(/"/g, "") + '"')); }
        else { qs.push("$orderby=receivedDateTime desc"); }
        const folder = o.folderId ? ("/mailFolders/" + encodeURIComponent(o.folderId)) : "";
        path = folder + "/messages?" + qs.join("&");
      }
      const res = await call("GET", path, null, o.search ? { ConsistencyLevel: "eventual" } : null);
      let d = null; try { d = await res.json(); } catch (e) { d = null; }
      if (!res.ok) { const err = new Error(safeErr((d && d.error && d.error.message) || ("HTTP " + res.status), 300)); err.status = res.status; throw err; }
      return { messages: (d.value || []).map(normalizeMessage), nextLink: d["@odata.nextLink"] || null };
    },
    /* Todos los mensajes de una conversación (hilo completo) */
    async getThread(conversationId) {
      const sel = "id,conversationId,subject,from,sender,toRecipients,ccRecipients,bccRecipients,bodyPreview,body,isRead,hasAttachments,receivedDateTime,sentDateTime,parentFolderId,flag,webLink";
      const filter = encodeURIComponent("conversationId eq '" + String(conversationId).replace(/'/g, "''") + "'");
      const d = await callJson("GET", "/messages?$filter=" + filter + "&$select=" + sel + "&$orderby=receivedDateTime asc&$top=50");
      return { conversationId: conversationId, messages: (d.value || []).map(normalizeMessage) };
    },
    /* Un mensaje concreto con cuerpo completo */
    async getMessage(messageId) {
      const sel = "id,conversationId,subject,from,sender,toRecipients,ccRecipients,bccRecipients,bodyPreview,body,isRead,hasAttachments,receivedDateTime,sentDateTime,parentFolderId,flag,webLink";
      return normalizeMessage(await callJson("GET", "/messages/" + encodeURIComponent(messageId) + "?$select=" + sel));
    },
    async listAttachments(messageId) {
      const d = await callJson("GET", "/messages/" + encodeURIComponent(messageId) + "/attachments?$select=id,name,contentType,size,isInline");
      return (d.value || []).map(normalizeAttachment);
    },
    /* Descarga el contenido crudo de un adjunto (Buffer + tipo) */
    async downloadAttachment(messageId, attachmentId) {
      const meta = await callJson("GET", "/messages/" + encodeURIComponent(messageId) + "/attachments/" + encodeURIComponent(attachmentId));
      /* fileAttachment trae contentBytes en base64 */
      if (meta && meta.contentBytes) {
        return { name: meta.name || "adjunto", mimeType: meta.contentType || "application/octet-stream", size: Number(meta.size) || 0, buffer: Buffer.from(meta.contentBytes, "base64") };
      }
      throw new Error("adjunto no descargable (referencia o tipo no soportado)");
    },
    /* Enviar un correo nuevo. msg: { subject, bodyHtml, to[], cc[], bcc[], attachments[] } */
    async sendMessage(msg) {
      const payload = { message: buildGraphMessage(msg), saveToSentItems: true };
      const res = await call("POST", "/sendMail", payload);
      if (!res.ok) { let d=null; try{d=await res.json();}catch(e){} const err = new Error(safeErr((d&&d.error&&d.error.message)||("HTTP "+res.status),300)); err.status=res.status; throw err; }
      return { ok: true };
    },
    /* Responder / responder a todos */
    async reply(messageId, msg, all) {
      /* Graph exige elegir entre comment y message.body; usamos body HTML para conservar la plantilla de marca. */
      const payload = { message: buildGraphMessage({ bodyHtml: (msg && (msg.bodyHtml || msg.comment)) || "" }, true) };
      const ep = all ? "/replyAll" : "/reply";
      const res = await call("POST", "/messages/" + encodeURIComponent(messageId) + ep, payload);
      if (!res.ok) { let d=null; try{d=await res.json();}catch(e){} const err = new Error(safeErr((d&&d.error&&d.error.message)||("HTTP "+res.status),300)); err.status=res.status; throw err; }
      return { ok: true };
    },
    /* Reenviar */
    async forward(messageId, msg) {
      const payload = { toRecipients: toRecipients(msg && msg.to), comment: msg && (msg.comment || msg.bodyHtml) ? String(msg.comment || msg.bodyHtml) : "" };
      const res = await call("POST", "/messages/" + encodeURIComponent(messageId) + "/forward", payload);
      if (!res.ok) { let d=null; try{d=await res.json();}catch(e){} const err = new Error(safeErr((d&&d.error&&d.error.message)||("HTTP "+res.status),300)); err.status=res.status; throw err; }
      return { ok: true };
    },
    /* Marcar leído/no leído, destacar */
    async updateMessage(messageId, patch) {
      const body = {};
      if (typeof patch.isRead === "boolean") body.isRead = patch.isRead;
      if (typeof patch.flagged === "boolean") body.flag = { flagStatus: patch.flagged ? "flagged" : "notFlagged" };
      return normalizeMessage(await callJson("PATCH", "/messages/" + encodeURIComponent(messageId), body));
    },
    /* Mover a carpeta (archivar / papelera usan wellKnown: archive / deleteditems) */
    async moveMessage(messageId, destinationId) {
      return await callJson("POST", "/messages/" + encodeURIComponent(messageId) + "/move", { destinationId: destinationId });
    },
    /* Sincronización incremental con delta queries */
    async syncDelta(o) {
      o = o || {};
      let path;
      if (o.deltaLink) path = o.deltaLink;
      else {
        const folder = o.folderId ? encodeURIComponent(o.folderId) : "inbox";
        path = "/mailFolders/" + folder + "/messages/delta?$select=id,conversationId,subject,from,toRecipients,bodyPreview,isRead,hasAttachments,receivedDateTime,parentFolderId";
      }
      const d = await callJson("GET", path);
      return {
        messages: (d.value || []).map(normalizeMessage),
        nextLink: d["@odata.nextLink"] || null,
        deltaLink: d["@odata.deltaLink"] || null,
      };
    },
  };
}

/* Construcción del objeto message de Graph a partir de la forma interna */
export function toRecipients(list) {
  return (list || []).map(function (x) {
    const address = typeof x === "string" ? x : (x && (x.address || x.email));
    const name = typeof x === "string" ? undefined : (x && x.name);
    return { emailAddress: name ? { address: address, name: name } : { address: address } };
  }).filter(function (r) { return r.emailAddress && r.emailAddress.address; });
}
export function buildGraphMessage(msg, minimal) {
  msg = msg || {};
  const out = {
    subject: msg.subject || "",
    body: { contentType: "HTML", content: sanitizeHtml(msg.bodyHtml || msg.body || "") },
  };
  if (!minimal) {
    out.toRecipients = toRecipients(msg.to);
    if (msg.cc && msg.cc.length) out.ccRecipients = toRecipients(msg.cc);
    if (msg.bcc && msg.bcc.length) out.bccRecipients = toRecipients(msg.bcc);
  }
  if (msg.attachments && msg.attachments.length) {
    out.attachments = msg.attachments.map(function (a) {
      return { "@odata.type": "#microsoft.graph.fileAttachment", name: a.name, contentType: a.mimeType || a.contentType || "application/octet-stream", contentBytes: a.contentBytes };
    });
  }
  return out;
}

/* Idempotencia: clave estable de un mensaje para deduplicar en upserts */
export function messageDedupeKey(accountId, providerMessageId) {
  return String(accountId) + "::" + String(providerMessageId);
}
