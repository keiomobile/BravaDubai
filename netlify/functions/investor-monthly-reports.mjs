import { getDatabase } from "@netlify/database";
import { sendEmail, emailWrap } from "./api.mjs";

function esc(v){return String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}

/* Resumen mensual sin cifras sensibles en el correo. La posición actual se genera
   dentro del portal autenticado y puede guardarse allí como informe privado. */
export default async () => {
  const db=getDatabase();
  const rows=await db.sql`SELECT u.id,u.name,u.username,u.consent,COUNT(DISTINCT i.id)::int AS contracts
    FROM usuarios u JOIN inversiones i ON i.portal_user_id=u.id OR (i.email<>'' AND LOWER(i.email)=LOWER(u.username))
    WHERE u.activo=TRUE AND u.role IN ('inversor','socio') AND i.estado NOT IN ('Cancelada','Cerrada')
    GROUP BY u.id,u.name,u.username,u.consent`;
  let sent=0;
  for(const u of rows){
    const prefs=u.consent&&typeof u.consent==="object"&&u.consent.investorPreferences||{};
    if(prefs.monthlySummary===false||!/@/.test(u.username||""))continue;
    const first=esc(String(u.name||"").trim().split(/\s+/)[0]||"inversor");
    const body="Hola "+first+",<br><br>Tu resumen patrimonial mensual de BRAVA ya está disponible. Actualmente tienes <b>"+Number(u.contracts||0)+" contrato"+(Number(u.contracts)===1?"":"s")+" activo"+(Number(u.contracts)===1?"":"s")+"</b> vinculado"+(Number(u.contracts)===1?"":"s")+" a tu cuenta.<br><br>Por privacidad, consulta las cifras, movimientos, documentos y próximos hitos únicamente dentro de tu área privada.";
    if(await sendEmail(u.username,"Tu resumen patrimonial mensual · BRAVA",emailWrap("Tu informe mensual ya está disponible",body,"Abrir mi área privada","https://bravaae.com/inversor.html")))sent++;
  }
  console.log(JSON.stringify({ok:true,reviewed:rows.length,sent}));
};

export const config={schedule:"0 8 1 * *"};
