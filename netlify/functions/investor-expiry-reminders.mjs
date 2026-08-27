import { getDatabase } from "@netlify/database";
import { sendEmail, emailWrap } from "./api.mjs";

function addMonths(dateText,n){const d=new Date(String(dateText||"").slice(0,10)+"T12:00:00Z");if(Number.isNaN(d.getTime()))return null;d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,10);}
function days(dateText){return Math.ceil((new Date(dateText+"T23:59:59Z").getTime()-Date.now())/86400000);}
function esc(v){return String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}

/* Revisión diaria de las dos ventanas: primer aniversario (+10%) y vencimiento
   contractual (+20% o porcentaje configurado). */
export default async () => {
  const db = getDatabase();
  const rows = await db.sql`SELECT i.id,i.inversor,i.proyecto,i.fecha_inicio,i.fecha_fin,i.plazo_meses,i.rentabilidad,i.portal_user_id,u.id AS user_id,u.username AS email
    FROM inversiones i LEFT JOIN usuarios u ON u.id=i.portal_user_id
    WHERE i.estado NOT IN ('Cancelada','Cerrada') AND NULLIF(i.fecha_fin,'') IS NOT NULL`;
  let created = 0;
  for (const inv of rows) {
    const userId = inv.user_id || inv.portal_user_id;
    if (!userId) continue;
    const annual=addMonths(inv.fecha_inicio,12), final=String(inv.fecha_fin).slice(0,10);
    const milestones=[];
    if(annual&&(Number(inv.plazo_meses)>=24||final>=annual))milestones.push({key:"primer_aniversario",date:annual,pct:10,label:"primer aniversario"});
    milestones.push({key:"vencimiento_final",date:final,pct:Number(inv.rentabilidad)||20,label:"vencimiento contractual"});
    for(const h of milestones){
      const remaining=days(h.date);if(remaining<0||remaining>30)continue;
      const [decision]=await db.sql`SELECT id FROM inversion_decisiones WHERE inversion_id=${inv.id} AND user_id=${userId} AND hito=${h.key}`;if(decision)continue;
      const type="decision_"+h.key;
      const [notice]=await db.sql`SELECT id FROM notificaciones WHERE user_id=${userId} AND tipo=${type} AND propiedad_id=${inv.id} LIMIT 1`;
      if(!notice){
        const copy="Se acerca el "+h.label+" de "+(inv.proyecto||"tu inversión")+" el "+h.date+". Puedes solicitar la liquidación según las condiciones de tu contrato o comunicar que deseas continuar.";
        await db.sql`INSERT INTO notificaciones(user_id,tipo,titulo,cuerpo,propiedad_id) VALUES(${userId},${type},'Tu inversión requiere una decisión',${copy},${inv.id})`;created++;
        if(inv.email&&/@/.test(inv.email))await sendEmail(inv.email,"Tu inversión requiere una decisión · BRAVA",emailWrap("Es el momento de revisar tu inversión","Hola "+esc(inv.inversor)+",<br><br>"+esc(copy)+"<br><br>En tu área privada encontrarás las opciones disponibles y el procedimiento correspondiente.","Revisar mi inversión","https://bravaae.com/inversor.html"));
      }
      const taskId="hito_"+h.key+"_"+inv.id;
      await db.sql`INSERT INTO tareas(id,titulo,tipo,fecha,estado,ref,notas) VALUES(${taskId},${"Decisión · "+h.label+" · "+(inv.inversor||"")},'Inversión',${h.date},'Pendiente',${inv.id},${"Contactar al inversor: liquidación con "+h.pct+"% o continuidad · "+(inv.proyecto||"")}) ON CONFLICT(id) DO NOTHING`;
    }
  }
  console.log(JSON.stringify({ ok:true, revisados:rows.length, avisosCreados:created }));
};

export const config = { schedule: "15 5 * * *" };
