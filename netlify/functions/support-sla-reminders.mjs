import { getDatabase } from "@netlify/database";

export default async () => {
  const db = getDatabase();
  const staff = await db.sql`SELECT id FROM usuarios WHERE role IN ('admin','superadmin','equipo') AND activo=TRUE`;
  if (!staff.length) return;
  let chats = [], tickets = [], leads = [];
  try {
    chats = await db.sql`SELECT session_id,MAX(contact_name) AS contact_name,MAX(division) AS division,MAX(created_at) AS last_at FROM ai_chat_log WHERE status IN ('new','open') GROUP BY session_id HAVING MAX(created_at)<NOW()-INTERVAL '15 minutes' LIMIT 100`;
    tickets = await db.sql`SELECT id,nombre,asunto,created_at FROM tickets WHERE estado='Abierto' AND created_at<NOW()-INTERVAL '24 hours' LIMIT 100`;
    leads = await db.sql`SELECT id,nombre,next_action,next_action_at,assigned_user_id FROM leads WHERE next_action<>'' AND next_action_at<NOW() AND estado_lead NOT IN ('Ganado','Perdido') LIMIT 100`;
  } catch (e) { console.error("[support-sla]", e && e.message); return; }
  for (const u of staff.slice(0, 20)) {
    for (const c of chats) {
      const ref = "chat:" + c.session_id;
      const [seen] = await db.sql`SELECT id FROM notificaciones WHERE user_id=${u.id} AND tipo='support_sla' AND propiedad_id=${ref} AND created_at>NOW()-INTERVAL '1 day' LIMIT 1`;
      if (!seen) await db.sql`INSERT INTO notificaciones(user_id,tipo,titulo,cuerpo,propiedad_id) VALUES(${u.id},'support_sla','Chat pendiente de respuesta',${(c.contact_name||'Visitante')+' · '+(c.division||'BRAVA')},${ref})`;
    }
    for (const t of tickets) {
      const ref = "ticket:" + t.id;
      const [seen] = await db.sql`SELECT id FROM notificaciones WHERE user_id=${u.id} AND tipo='support_sla' AND propiedad_id=${ref} AND created_at>NOW()-INTERVAL '1 day' LIMIT 1`;
      if (!seen) await db.sql`INSERT INTO notificaciones(user_id,tipo,titulo,cuerpo,propiedad_id) VALUES(${u.id},'support_sla','Solicitud pendiente más de 24 h',${(t.nombre||'Inversor')+' · '+(t.asunto||'Solicitud')},${ref})`;
    }
    for (const l of leads.filter(x=>!x.assigned_user_id||Number(x.assigned_user_id)===Number(u.id))) {
      const ref = "lead:" + l.id;
      const [seen] = await db.sql`SELECT id FROM notificaciones WHERE user_id=${u.id} AND tipo='commercial_followup' AND propiedad_id=${ref} AND created_at>NOW()-INTERVAL '1 day' LIMIT 1`;
      if (!seen) await db.sql`INSERT INTO notificaciones(user_id,tipo,titulo,cuerpo,propiedad_id) VALUES(${u.id},'commercial_followup','Seguimiento comercial vencido',${(l.nombre||'Contacto')+' · '+(l.next_action||'Próxima acción')},${ref})`;
    }
  }
};

export const config = { schedule: "0 * * * *" };
