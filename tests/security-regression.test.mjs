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
  const emailTemplate = api.slice(api.indexOf("function emailWrap"), api.indexOf("function portalAccessEmail"));
  assert.match(emailTemplate, /brava-investment-color\.png/);
  assert.doesNotMatch(emailTemplate, /Brava CAPITAL/);
  assert.match(crm, /Vista previa del email/);
  assert.match(crm, /Preparar y enviar acceso/);
});

test("el correo se sincroniza automáticamente y los formularios confirman recepción", async () => {
  const [api, sync, crm] = await Promise.all([
    read("netlify/functions/api.mjs"),
    read("netlify/functions/mail-auto-sync.mjs"),
    read("files/crm.html"),
  ]);
  assert.match(sync, /schedule:\s*"\*\/5 \* \* \* \*"/);
  assert.match(sync, /syncDelta/);
  assert.match(sync, /last_delta_link/);
  assert.match(api, /Hemos recibido tu solicitud/);
  assert.match(api, /Solicitud de colaboración recibida/);
  assert.match(api, /Ficha de propiedad recibida/);
  assert.match(api, /Solicitud recibida · Brava Rent/);
  assert.match(api, /path === "mail\/status"/);
  assert.match(crm, /Actualización automática/);
  assert.match(crm, /Configuración de buzones/);
  assert.doesNotMatch(crm, /id="mailSyncBtn"/);
});

test("los hitos del inversor generan aviso corporativo por email", async () => {
  const reminder = await read("netlify/functions/investor-expiry-reminders.mjs");
  assert.match(reminder, /sendEmail/);
  assert.match(reminder, /Tu inversión requiere una decisión · BRAVA/);
  assert.match(reminder, /https:\/\/bravaae\.com\/inversor\.html/);
});

test("las tres divisiones comparten chat contextual gobernado desde el CRM", async () => {
  const [api,widget,crm]=await Promise.all([read("netlify/functions/api.mjs"),read("files/i18n.js"),read("files/crm.html")]);
  assert.match(api,/path === "chat"/);
  assert.match(api,/ai_chat_log/);
  assert.match(api,/path === "ai\/chat-config"/);
  assert.match(api,/path === "ai\/prompt\/improve"/);
  assert.match(api,/gpt-4o-mini/);
  assert.match(widget,/BRAVA contextual support/);
  assert.match(widget,/investment.*realestate.*rent/s);
  assert.match(crm,/IA de soporte web/);
  assert.match(crm,/Mejorar prompt con IA/);
});

test("el asistente del inversor usa sesión privada y contexto calculado en servidor", async () => {
  const [api, portal] = await Promise.all([read("netlify/functions/api.mjs"), read("files/inversor.html")]);
  assert.match(api, /path === "mi-asistente"/);
  assert.match(api, /portal_user_id=\$\{user\.id\}/);
  assert.match(api, /CONTEXTO PRIVADO/);
  assert.match(api, /No ejecutes decisiones, liquidaciones, firmas, transferencias o cambios/);
  assert.match(portal, /Asistente privado BRAVA/);
  assert.match(portal, /api\('mi-asistente'/);
  assert.doesNotMatch(portal, /portal_user_id|inversor_documentos/);
});

test("los chats se transfieren al CRM con bandeja unificada y control de SLA", async () => {
  const [api, widget, crm, reminder] = await Promise.all([
    read("netlify/functions/api.mjs"), read("files/i18n.js"), read("files/crm.html"), read("netlify/functions/support-sla-reminders.mjs"),
  ]);
  assert.match(api, /path === "chat\/handoff"/);
  assert.match(api, /path === "support\/inbox"/);
  assert.match(api, /path === "chat\/poll"/);
  assert.match(api, /seg\[3\] === "reply"/);
  assert.match(api, /path === "commercial\/pipeline"/);
  assert.match(api, /path === "commercial\/pipeline\/auto"/);
  assert.match(api, /classifyAndRouteLead/);
  assert.match(api, /seg\[3\] === "draft"/);
  assert.match(api, /requiresHumanReview:true/);
  assert.match(api, /lead_activities/);
  assert.match(api, /logLeadActivity/);
  assert.match(api, /seg\[3\] === "activities"/);
  assert.match(api, /lead_score/);
  assert.match(api, /path === "commercial\/dossier"/);
  assert.match(api, /assigned_user_id/);
  assert.match(widget, /Hablar con el equipo/);
  assert.match(widget, /chat\/handoff/);
  assert.match(widget, /chat\/poll/);
  assert.match(widget, /Support assistant/);
  assert.match(widget, /مساعد الدعم/);
  assert.match(crm, /Centro de atención/);
  assert.match(crm, /viewAtencion/);
  assert.match(crm, /viewPipeline/);
  assert.match(crm, /Pipeline comercial/);
  assert.match(crm, /Clasificar pendientes con IA/);
  assert.match(crm, /Reclasificar con IA/);
  assert.match(crm, /Preparar email/);
  assert.match(crm, /Preparar WhatsApp/);
  assert.match(crm, /Leads calientes/);
  assert.match(crm, /Registrar actividad o agendar/);
  assert.match(crm, /Cargando actividad/);
  assert.match(crm, /Enviar respuesta/);
  assert.match(crm, /Expediente 360º/);
  assert.match(reminder, /schedule: "0 \* \* \* \*"/);
  assert.match(reminder, /Chat pendiente de respuesta/);
  assert.match(reminder, /Seguimiento comercial vencido/);
});
