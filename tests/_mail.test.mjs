/* Pruebas unitarias del proveedor de correo (Microsoft Graph) con fetch simulado.
   Ejecutar:  node --test tests/_mail.test.mjs
   No envía correos reales ni toca la red: todo va contra un mock. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  encryptToken, decryptToken, loadEncryptionKey,
  makePkce, buildAuthUrl, exchangeCode, refreshAccessToken,
  sanitizeHtml, htmlToText, attachmentAllowed,
  normalizeMessage, normalizeFolder, toRecipients, buildGraphMessage,
  createGraphProvider, messageDedupeKey, ATTACH_MAX_BYTES,
} from "../netlify/functions/_mail.mjs";

const KEY_HEX = "0".repeat(64); /* 32 bytes en hex (solo para test) */

/* ---------- Mock de fetch ---------- */
function mockFetch(routes) {
  /* routes: array de { test(url,opts)->bool, status, json, text } */
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    for (const r of routes) {
      if (r.test(url, opts || {})) {
        return {
          ok: r.status ? r.status < 400 : true,
          status: r.status || 200,
          json: async () => (typeof r.json === "function" ? r.json(url, opts) : r.json),
          text: async () => r.text || "",
        };
      }
    }
    return { ok: false, status: 404, json: async () => ({ error: { message: "no route" } }), text: async () => "" };
  };
  fn.calls = calls;
  return fn;
}

/* ============================================================ */
test("cifrado: round-trip y detección de manipulación", () => {
  const enc = encryptToken("refresh-secreto-123", KEY_HEX);
  assert.ok(enc.startsWith("v1:"));
  assert.notEqual(enc, "refresh-secreto-123");
  assert.equal(decryptToken(enc, KEY_HEX), "refresh-secreto-123");
  /* clave incorrecta o formato inválido no descifran */
  assert.throws(() => decryptToken(enc, "f".repeat(64)));
  assert.throws(() => decryptToken("v1:aa:bb:cc", KEY_HEX));
  assert.throws(() => decryptToken("texto-plano", KEY_HEX));
});

test("cifrado: clave inválida se rechaza", () => {
  assert.throws(() => loadEncryptionKey(""));
  assert.throws(() => loadEncryptionKey("corta"));
  assert.doesNotThrow(() => loadEncryptionKey(KEY_HEX));
});

test("PKCE: verifier y challenge S256", () => {
  const p = makePkce();
  assert.equal(p.method, "S256");
  assert.match(p.verifier, /^[A-Za-z0-9_-]+$/);
  assert.match(p.challenge, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(p.verifier, p.challenge);
});

test("buildAuthUrl incluye parámetros obligatorios y scope mínimo", () => {
  const u = buildAuthUrl({ tenantId: "t", clientId: "c", redirectUri: "https://x/cb", state: "s1", nonce: "n1", codeChallenge: "ch" });
  assert.ok(u.startsWith("https://login.microsoftonline.com/t/oauth2/v2.0/authorize?"));
  assert.match(u, /client_id=c/);
  assert.match(u, /code_challenge=ch/);
  assert.match(u, /code_challenge_method=S256/);
  assert.match(u, /state=s1/);
  assert.match(u, /Mail.Send/);
  /* nunca debe pedir permisos de escritura de más: no incluye Directory ni User.ReadWrite */
  assert.doesNotMatch(u, /Directory\./);
});

test("exchangeCode: éxito y error AADSTS de tenant", async () => {
  const okFetch = mockFetch([{ test: (u) => /oauth2\/v2\.0\/token/.test(u), json: { access_token: "AT", refresh_token: "RT", expires_in: 3600 } }]);
  const tok = await exchangeCode({ clientId: "c", tenantId: "t", redirectUri: "https://x/cb" }, "code123", "verifier", okFetch);
  assert.equal(tok.access_token, "AT");
  assert.equal(tok.refresh_token, "RT");

  const badFetch = mockFetch([{ test: (u) => /token/.test(u), status: 400, json: { error: "invalid_grant", error_description: "AADSTS650051: app not registered" } }]);
  await assert.rejects(
    () => exchangeCode({ clientId: "c", tenantId: "t", redirectUri: "https://x/cb" }, "bad", "v", badFetch),
    (e) => { assert.match(e.message, /AADSTS650051/); return true; }
  );
});

test("refreshAccessToken: fallo de refresh se propaga", async () => {
  const badFetch = mockFetch([{ test: (u) => /token/.test(u), status: 400, json: { error: "invalid_grant", error_description: "AADSTS700082: refresh token expired" } }]);
  await assert.rejects(() => refreshAccessToken({ clientId: "c", tenantId: "t" }, "RT", badFetch), /AADSTS700082/);
});

test("sanitizeHtml elimina script, on* y javascript:", () => {
  const dirty = '<p onclick="steal()">hola</p><script>evil()</script><a href="javascript:alert(1)">x</a><img src="data:text/html,evil">';
  const clean = sanitizeHtml(dirty);
  assert.doesNotMatch(clean, /<script/i);
  assert.doesNotMatch(clean, /onclick/i);
  assert.doesNotMatch(clean, /javascript:/i);
  assert.doesNotMatch(clean, /src\s*=\s*"data:/i);
  assert.match(clean, /hola/);
});

test("sanitizeHtml quita iframe/style/link con contenido", () => {
  const dirty = '<style>body{}</style><iframe src="http://x"></iframe><b>ok</b><link rel="stylesheet" href="http://x">';
  const clean = sanitizeHtml(dirty);
  assert.doesNotMatch(clean, /<iframe/i);
  assert.doesNotMatch(clean, /<style/i);
  assert.doesNotMatch(clean, /<link/i);
  assert.match(clean, /<b>ok<\/b>/);
});

test("htmlToText extrae texto plano", () => {
  assert.equal(htmlToText("<p>Hola <b>mundo</b></p>"), "Hola mundo");
});

test("attachmentAllowed bloquea ejecutables y tamaños excesivos", () => {
  assert.equal(attachmentAllowed("factura.pdf", 1000).ok, true);
  assert.equal(attachmentAllowed("virus.exe", 1000).ok, false);
  assert.equal(attachmentAllowed("macro.js", 1000).ok, false);
  assert.equal(attachmentAllowed("grande.pdf", ATTACH_MAX_BYTES + 1).ok, false);
});

test("normalizeMessage produce forma interna y sanea el cuerpo", () => {
  const g = {
    id: "m1", conversationId: "c1", subject: "Asunto",
    from: { emailAddress: { name: "Ana", address: "ANA@X.com" } },
    toRecipients: [{ emailAddress: { address: "b@x.com" } }],
    body: { contentType: "html", content: '<p>hola</p><script>x()</script>' },
    isRead: false, hasAttachments: true, receivedDateTime: "2026-01-01T00:00:00Z",
  };
  const n = normalizeMessage(g);
  assert.equal(n.providerMessageId, "m1");
  assert.equal(n.providerThreadId, "c1");
  assert.equal(n.from.address, "ana@x.com"); /* normaliza a minúsculas */
  assert.equal(n.to[0].address, "b@x.com");
  assert.doesNotMatch(n.bodyHtml, /<script/i);
  assert.equal(n.hasAttachments, true);
  assert.equal(n.isRead, false);
});

test("provider.listFolders normaliza carpetas", async () => {
  const f = mockFetch([{ test: (u) => /mailFolders\?/.test(u), json: { value: [{ id: "inbox", displayName: "Bandeja", unreadItemCount: 3, totalItemCount: 10, wellKnownName: "inbox" }] } }]);
  const p = createGraphProvider({ accessToken: "AT", fetchImpl: f });
  const folders = await p.listFolders();
  assert.equal(folders.length, 1);
  assert.equal(folders[0].name, "Bandeja");
  assert.equal(folders[0].unread, 3);
  /* el token va en la cabecera, nunca en la URL */
  assert.doesNotMatch(f.calls[0].url, /AT/);
  assert.equal(f.calls[0].opts.headers.authorization, "Bearer AT");
});

test("provider.listThreads soporta paginación (nextLink) y no filtra token", async () => {
  const next = "https://graph.microsoft.com/v1.0/me/messages?$skip=25";
  const f = mockFetch([{ test: (u) => /\/messages\?/.test(u), json: { value: [{ id: "m1", conversationId: "c1", subject: "S" }], "@odata.nextLink": next } }]);
  const p = createGraphProvider({ accessToken: "AT", fetchImpl: f });
  const r = await p.listThreads({ folderId: "inbox", top: 25 });
  assert.equal(r.messages.length, 1);
  assert.equal(r.nextLink, next);
  /* segunda página usa el nextLink absoluto (permitido por ser de graph) */
  const r2f = mockFetch([{ test: (u) => u === next, json: { value: [], "@odata.nextLink": null } }]);
  const p2 = createGraphProvider({ accessToken: "AT", fetchImpl: r2f });
  const r2 = await p2.listThreads({ nextLink: next });
  assert.equal(r2.messages.length, 0);
});

test("provider.syncDelta devuelve deltaLink para reanudar", async () => {
  const delta = "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=abc";
  const f = mockFetch([{ test: (u) => /messages\/delta/.test(u), json: { value: [{ id: "m1", conversationId: "c1" }], "@odata.deltaLink": delta } }]);
  const p = createGraphProvider({ accessToken: "AT", fetchImpl: f });
  const r = await p.syncDelta({ folderId: "inbox" });
  assert.equal(r.deltaLink, delta);
  assert.equal(r.messages.length, 1);
});

test("provider.sendMessage NO envía correo real: solo compone y postea a Graph", async () => {
  const f = mockFetch([{ test: (u, o) => /\/sendMail/.test(u) && o.method === "POST", json: {} }]);
  const p = createGraphProvider({ accessToken: "AT", fetchImpl: f });
  const res = await p.sendMessage({ subject: "Hola", bodyHtml: "<p>cuerpo</p><script>x</script>", to: ["dest@x.com"] });
  assert.equal(res.ok, true);
  const posted = JSON.parse(f.calls[0].opts.body);
  assert.equal(posted.message.subject, "Hola");
  assert.equal(posted.message.toRecipients[0].emailAddress.address, "dest@x.com");
  assert.doesNotMatch(posted.message.body.content, /<script/i); /* saneado antes de enviar */
  assert.equal(posted.saveToSentItems, true);
});

test("provider.updateMessage marca leído/destacado", async () => {
  const f = mockFetch([{ test: (u, o) => /\/messages\//.test(u) && o.method === "PATCH", json: { id: "m1", isRead: true, flag: { flagStatus: "flagged" } } }]);
  const p = createGraphProvider({ accessToken: "AT", fetchImpl: f });
  const n = await p.updateMessage("m1", { isRead: true, flagged: true });
  assert.equal(n.isRead, true);
  assert.equal(n.isFlagged, true);
});

test("provider: error HTTP de Graph se convierte en excepción con status", async () => {
  const f = mockFetch([{ test: () => true, status: 403, json: { error: { code: "ErrorAccessDenied", message: "denegado" } } }]);
  const p = createGraphProvider({ accessToken: "AT", fetchImpl: f });
  await assert.rejects(() => p.listFolders(), (e) => { assert.equal(e.status, 403); return true; });
});

test("provider: anti-SSRF rechaza URLs absolutas ajenas a Graph", async () => {
  const f = mockFetch([{ test: () => true, json: { value: [] } }]);
  const p = createGraphProvider({ accessToken: "AT", fetchImpl: f });
  await assert.rejects(() => p.listThreads({ nextLink: "https://evil.example.com/steal" }), /no permitida/);
});

test("createGraphProvider exige accessToken", () => {
  assert.throws(() => createGraphProvider({ fetchImpl: () => {} }), /accessToken/);
});

test("buildGraphMessage + toRecipients", () => {
  const m = buildGraphMessage({ subject: "S", bodyHtml: "<b>x</b>", to: ["a@x.com", { address: "b@x.com", name: "B" }] });
  assert.equal(m.toRecipients.length, 2);
  assert.equal(m.toRecipients[1].emailAddress.name, "B");
  assert.equal(m.body.contentType, "HTML");
});

test("messageDedupeKey es estable por cuenta+mensaje (idempotencia)", () => {
  assert.equal(messageDedupeKey("acc1", "m1"), messageDedupeKey("acc1", "m1"));
  assert.notEqual(messageDedupeKey("acc1", "m1"), messageDedupeKey("acc2", "m1"));
});
