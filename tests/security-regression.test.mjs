import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("el CRM publicado no contiene credenciales maestras ni tokens persistentes", async () => {
  const html = await read("files/crm.html");
  assert.doesNotMatch(html, /jesusleon@keio\.es['"]\s*:\s*\{\s*pass:/i);
  assert.doesNotMatch(html, /localStorage\.setItem\(['"]vlc_token/i);
});

test("el código no incluye documentos reales ni semillas de personas", async () => {
  const [api, docs, policy] = await Promise.all([
    read("netlify/functions/api.mjs"),
    read("netlify/functions/_docs.mjs"),
    read("INGESTA-DRIVE-CRM.md"),
  ]);
  assert.match(api, /const CONTRATOS_REALES = \[\];/);
  assert.match(api, /const SOCIOS_REALES = \[\];/);
  assert.match(docs, /SEED_DOCS = \[\]/);
  assert.doesNotMatch(policy, /Brava2026|@gmail\.com|Pasaporte\s+[A-Z0-9]/i);
});

test("SEO y remitentes usan el dominio principal", async () => {
  const [robots, sitemap, api] = await Promise.all([
    read("files/robots.txt"), read("files/sitemap.xml"), read("netlify/functions/api.mjs"),
  ]);
  assert.doesNotMatch(robots + sitemap, /brava-dubai\.netlify\.app|cool-blini/i);
  assert.doesNotMatch(api, /vlcrealestateinmobiliaria\.com/i);
  assert.match(api, /business@bravaae\.com/);
});

test("el health público es mínimo y no entra al diagnóstico profundo", async () => {
  const api = await read("netlify/functions/api.mjs");
  assert.match(api, /if \(path === "health"\) return json\(\{ ok: true, service: "brava-api" \}\)/);
});

test("los correos transaccionales usan enlace temporal y respaldo Microsoft 365", async () => {
  const api = await read("netlify/functions/api.mjs");
  assert.match(api, /Restablecer contraseña/);
  assert.match(api, /El enlace caduca en 1 hora/);
  assert.match(api, /mailAccessToken\(account\)/);
  assert.match(api, /provider\.sendMessage/);
  assert.doesNotMatch(api, /Tu contraseña (?:es|será):/i);
});

test("socios e inversores reciben una invitación corporativa previsualizable", async () => {
  const [api, crm] = await Promise.all([
    read("netlify/functions/api.mjs"), read("files/crm.html"),
  ]);
  assert.match(api, /seg\[0\] === "socios".*seg\[2\] === "acceso"/s);
  assert.match(api, /portalAccessEmail/);
  assert.match(crm, /Vista previa del email/);
  assert.match(crm, /Preparar y enviar acceso/);
});
