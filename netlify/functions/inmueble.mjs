import { getDatabase } from "@netlify/database";

const db = getDatabase();

function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function eur(n){ n=Number(n)||0; return n.toLocaleString("es-ES")+" €"; }
function page(status, title, bodyHtml, headExtra){
  const html = "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>"+esc(title)+"</title><link rel=\"icon\" href=\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9IiMwRTFCMkMiLz48cGF0aCBkPSJNMTYgMzRsMTYtMTMgMTYgMTMiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0M3OUE0QiIgc3Ryb2tlLXdpZHRoPSIzLjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik0yMCAzMXYxNmgyNFYzMSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjMuMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHJlY3QgeD0iMjgiIHk9IjM4IiB3aWR0aD0iOCIgaGVpZ2h0PSI5IiByeD0iMS41IiBmaWxsPSIjQzc5QTRCIi8+PC9zdmc+\" type=\"image/svg+xml\">"+(headExtra||"")+
  "<style>:root{--ink:#0E1B2C;--ink2:#26364A;--paper:#F5F6F8;--white:#fff;--grey:#697585;--grey2:#98A2B1;--line:rgba(14,27,44,.12);--line2:rgba(14,27,44,.07);--accent:#1F5F8B;--gold:#C79A4B;--pos:#2E7D5B;--pos-bg:#E7F3EC}"+
  "*{box-sizing:border-box;margin:0;padding:0}body{background:var(--paper);color:var(--ink);font-family:'General Sans','Inter',system-ui,-apple-system,sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased}a{color:var(--ink)}"+
  ".wrap{max-width:1080px;margin:0 auto;padding:0 20px}header.top{border-bottom:1px solid var(--line2);background:var(--white);position:sticky;top:0;z-index:20}.top .wrap{display:flex;align-items:center;justify-content:space-between;height:62px}"+
  ".brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink)}.brand .mk{width:32px;height:32px;border-radius:9px;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;letter-spacing:-1px}.brand b{font-size:17px;font-weight:700;letter-spacing:-.02em}"+
  ".back{font-size:14px;color:var(--grey);text-decoration:none;font-weight:600}.crumbs{font-size:12.5px;color:var(--grey);padding:16px 0 4px}.crumbs a{color:var(--grey);text-decoration:none}"+
  ".gallery{display:grid;grid-template-columns:2fr 1fr 1fr;grid-auto-rows:150px;gap:8px;margin:10px 0 6px;border-radius:16px;overflow:hidden}.gallery a{display:block;background:#e9e9e9 center/cover no-repeat;position:relative}.gallery a:first-child{grid-row:span 2;grid-column:1}.gallery .more{position:absolute;inset:0;background:rgba(14,17,22,.55);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px}"+
  ".noimg{aspect-ratio:16/8;background:var(--white);border:1px solid var(--line2);border-radius:16px;display:flex;align-items:center;justify-content:center;color:var(--grey2);margin:10px 0}"+
  ".grid{display:grid;grid-template-columns:1fr 340px;gap:26px;margin:22px 0 60px;align-items:start}"+
  ".price{font-size:32px;font-weight:800;letter-spacing:-.03em}.h1{font-size:23px;font-weight:700;letter-spacing:-.02em;margin:6px 0 4px}.loc{color:var(--grey);font-size:15px}"+
  ".tags{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.tag{background:var(--white);border:1px solid var(--line2);border-radius:999px;padding:7px 14px;font-size:13px;font-weight:600}"+
  ".feats{display:flex;gap:24px;flex-wrap:wrap;background:var(--white);border:1px solid var(--line2);border-radius:14px;padding:16px 20px;margin:14px 0}.feat b{font-size:18px;font-weight:800;display:block}.feat span{font-size:12.5px;color:var(--grey)}"+
  "h2{font-size:17px;font-weight:700;margin:26px 0 10px}.desc{font-size:15px;color:var(--ink2);line-height:1.7;white-space:pre-line}"+
  ".dtable{display:grid;grid-template-columns:1fr 1fr;gap:0 30px;background:var(--white);border:1px solid var(--line2);border-radius:14px;padding:6px 20px}.drow{display:flex;justify-content:space-between;padding:11px 0;border-bottom:1px solid var(--line2);font-size:14px}.drow:last-child,.drow:nth-last-child(2){border-bottom:0}.drow .k{color:var(--grey)}.drow .v{font-weight:600}"+
  ".chips{display:flex;flex-wrap:wrap;gap:8px}.chip{background:var(--white);border:1px solid var(--line2);border-radius:999px;padding:7px 13px;font-size:13px;font-weight:600}"+
  ".mapbox{border-radius:14px;overflow:hidden;border:1px solid var(--line2);margin-top:10px}.mapbox iframe{width:100%;height:300px;border:0;display:block}"+
  ".contact{position:sticky;top:80px;background:var(--white);border:1px solid var(--line2);border-radius:16px;padding:20px}.contact .cp{font-size:24px;font-weight:800;letter-spacing:-.02em;margin-bottom:2px}.contact .cref{font-size:12px;color:var(--grey);margin-bottom:16px}"+
  ".contact input,.contact textarea,.contact select{width:100%;background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:14px;font-family:inherit;margin-bottom:9px}.contact textarea{min-height:70px;resize:vertical}"+
  ".btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;background:var(--ink);color:#fff;border:0;border-radius:11px;padding:13px;font-size:15px;font-weight:700;cursor:pointer;text-decoration:none}.btn:hover{background:#000}.btn.wa{background:#25D366;margin-top:8px}.btn.ghost{background:var(--white);color:var(--ink);border:1px solid var(--line);margin-top:8px}"+
  ".consent{font-size:11.5px;color:var(--grey);display:flex;gap:7px;margin:4px 0 10px}.consent input{width:16px;height:16px;flex:none;margin:0}.okmsg{background:var(--pos-bg);color:var(--pos);border-radius:10px;padding:11px;font-size:13px;font-weight:600;display:none;text-align:center}"+
  "footer{border-top:1px solid var(--line2);background:var(--white);padding:22px 0;color:var(--grey);font-size:12.5px}.legal{font-size:11.5px;color:var(--grey2);margin-top:16px}"+
  "@media(max-width:820px){.grid{grid-template-columns:1fr}.gallery{grid-template-columns:1fr 1fr;grid-auto-rows:120px}.gallery a:first-child{grid-row:span 1;grid-column:span 2}.dtable{grid-template-columns:1fr}.contact{position:static}}"+
  "</style></head><body>"+
  "<header class=\"top\"><div class=\"wrap\"><a class=\"brand\" href=\"/propiedades\"><img src=\"/logo-realestate.png\" alt=\"Brava Real Estate\" style=\"height:34px;width:auto;display:block\"></a><a class=\"back\" href=\"/propiedades\">← Ver todas las propiedades</a></div></header>"+
  bodyHtml+
  "<footer><div class=\"wrap\"><div><a href=\"/aviso-legal.html\" style=\"color:var(--grey);margin-right:14px\">Aviso legal</a><a href=\"/privacidad.html\" style=\"color:var(--grey);margin-right:14px\">Privacidad</a><a href=\"/cookies.html\" style=\"color:var(--grey)\">Cookies</a></div><div style=\"margin-top:8px\">© 2026 Nueva Gestión Brava Inmobiliaria, S.L.</div></div></footer>"+
  "</body></html>";
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": status===200?"public, max-age=300":"no-store" } });
}

export default async (req) => {
  const url = new URL(req.url);
  const segs = url.pathname.replace(/^\/inmueble\/?/, "").replace(/\/$/, "").split("/").filter(Boolean);
  const key = decodeURIComponent(segs[segs.length - 1] || "");
  if (!key) return Response.redirect(url.origin + "/propiedades", 302);
  let p, imgs = [];
  try {
    const rows = await db.sql`SELECT * FROM propiedades WHERE (slug = ${key} OR id = ${key}) AND estado = 'Publicada'`;
    p = rows[0];
    if (p) {
      imgs = await db.sql`SELECT id FROM propiedad_imagenes WHERE propiedad_id = ${p.id} ORDER BY is_portada DESC, orden ASC`;
      try { await db.sql`UPDATE propiedades SET visitas = visitas + 1 WHERE id = ${p.id}`; } catch (e) {}
    }
  } catch (e) { /* db error → 404 amable */ }
  if (!p) {
    return page(404, "Propiedad no disponible · Brava Real Estate",
      "<div class=\"wrap\" style=\"padding:70px 20px;text-align:center\"><h1 class=\"h1\">Esta propiedad ya no está disponible</h1><p style=\"color:var(--grey);margin:10px 0 20px\">Puede que se haya vendido, alquilado o retirado.</p><a class=\"btn\" style=\"max-width:280px;margin:0 auto\" href=\"/propiedades\">Ver otras propiedades</a></div>",
      "<meta name=\"robots\" content=\"noindex\">");
  }
  const loc = p.mostrar_direccion === "exacta" ? [p.direccion, p.numero, p.zona, p.municipio, p.provincia].filter(Boolean).join(", ")
            : p.mostrar_direccion === "aproximada" ? [p.zona, p.municipio, p.provincia].filter(Boolean).join(", ")
            : [p.municipio, p.provincia].filter(Boolean).join(", ");
  const shortLoc = [p.zona, p.municipio].filter(Boolean).join(", ") || p.municipio || "";
  const titulo = p.titulo || (p.tipo_inmueble + " en " + (p.municipio || ""));
  const descTxt = (p.descripcion_corta || p.descripcion || (titulo + ". " + (p.operacion || ""))).slice(0, 165);
  const canonical = url.origin + "/inmueble/" + encodeURIComponent(p.slug || p.id);
  const ogImg = imgs[0] ? (url.origin + "/api/img/" + imgs[0].id) : "";
  const caract = Array.isArray(p.caracteristicas) ? p.caracteristicas : [];

  const jsonld = {
    "@context": "https://schema.org", "@type": ["Product", "Residence"], name: titulo, description: descTxt, sku: p.ref || p.id,
    image: imgs.slice(0, 8).map(im => url.origin + "/api/img/" + im.id),
    offers: { "@type": "Offer", price: Number(p.precio) || 0, priceCurrency: p.moneda || "EUR", availability: "https://schema.org/InStock", url: canonical },
    address: { "@type": "PostalAddress", addressLocality: p.municipio || "", addressRegion: p.provincia || "", addressCountry: "ES", postalCode: p.cp || "" },
  };
  const head =
    "<meta name=\"description\" content=\"" + esc(descTxt) + "\">" +
    "<link rel=\"canonical\" href=\"" + esc(canonical) + "\">" +
    "<meta name=\"robots\" content=\"index,follow\">" +
    "<meta property=\"og:type\" content=\"website\"><meta property=\"og:title\" content=\"" + esc(titulo) + "\"><meta property=\"og:description\" content=\"" + esc(descTxt) + "\"><meta property=\"og:url\" content=\"" + esc(canonical) + "\">" +
    (ogImg ? "<meta property=\"og:image\" content=\"" + esc(ogImg) + "\">" : "") +
    "<meta name=\"twitter:card\" content=\"summary_large_image\">" +
    "<script type=\"application/ld+json\">" + JSON.stringify(jsonld).replace(/</g, "\\u003c") + "</script>";

  /* galería */
  let gal;
  if (imgs.length) {
    const show = imgs.slice(0, 5);
    gal = "<div class=\"gallery\">" + show.map((im, i) => {
      const more = (i === 4 && imgs.length > 5) ? "<span class=\"more\">+" + (imgs.length - 5) + " fotos</span>" : "";
      return "<a href=\"/api/img/" + im.id + "\" target=\"_blank\" style=\"background-image:url(/api/img/" + im.id + ")\">" + more + "</a>";
    }).join("") + "</div>";
  } else gal = "<div class=\"noimg\">Sin fotos disponibles</div>";

  const feats = [];
  if (p.habitaciones) feats.push("<div class=\"feat\"><b>" + p.habitaciones + "</b><span>habitaciones</span></div>");
  if (p.banos) feats.push("<div class=\"feat\"><b>" + p.banos + "</b><span>baños</span></div>");
  if (p.sup_construida) feats.push("<div class=\"feat\"><b>" + p.sup_construida + " m²</b><span>construidos</span></div>");
  if (p.planta_inmueble) feats.push("<div class=\"feat\"><b>" + esc(p.planta_inmueble) + "</b><span>planta</span></div>");
  if (p.anio) feats.push("<div class=\"feat\"><b>" + p.anio + "</b><span>año</span></div>");

  const detRows = [
    ["Tipo", p.tipo_inmueble], ["Operación", p.operacion], ["Referencia", p.ref],
    ["Superficie útil", p.sup_util ? p.sup_util + " m²" : ""], ["Superficie parcela", p.sup_parcela ? p.sup_parcela + " m²" : ""],
    ["Aseos", p.aseos || ""], ["Estado", p.estado_conservacion], ["Orientación", p.orientacion],
    ["Certificado energético", p.cert_energetico], ["Gastos comunidad", p.gastos_comunidad ? eur(p.gastos_comunidad) + "/mes" : ""],
    ["IBI", p.ibi ? eur(p.ibi) + "/año" : ""], ["Disponibilidad", p.disponibilidad],
  ].filter(r => r[1]);
  const detTable = "<div class=\"dtable\">" + detRows.map(r => "<div class=\"drow\"><span class=\"k\">" + esc(r[0]) + "</span><span class=\"v\">" + esc(r[1]) + "</span></div>").join("") + "</div>";

  const mapQ = encodeURIComponent(p.mostrar_direccion === "exacta" ? loc : shortLoc);
  const map = mapQ ? "<h2>Ubicación</h2><div class=\"mapbox\"><iframe loading=\"lazy\" src=\"https://www.google.com/maps?q=" + mapQ + "&output=embed\"></iframe></div>" : "";

  const body =
    "<div class=\"wrap\">" +
    "<div class=\"crumbs\"><a href=\"/\">Inicio</a> · <a href=\"/propiedades\">Propiedades</a> · " + esc(p.operacion || "") + " · " + esc(p.municipio || "") + "</div>" +
    gal +
    "<div class=\"grid\"><div>" +
    "<div class=\"price\">" + (p.precio ? eur(p.precio) : "Consultar precio") + (p.operacion && /Alquiler/.test(p.operacion) ? "/mes" : "") + "</div>" +
    "<div class=\"h1\">" + esc(titulo) + "</div><div class=\"loc\">" + esc(loc || shortLoc) + "</div>" +
    "<div class=\"tags\"><span class=\"tag\">" + esc(p.operacion || "") + "</span><span class=\"tag\">" + esc(p.tipo_inmueble || "") + "</span>" + (p.negociable ? "<span class=\"tag\">Precio negociable</span>" : "") + "</div>" +
    (feats.length ? "<div class=\"feats\">" + feats.join("") + "</div>" : "") +
    (p.descripcion ? "<h2>Descripción</h2><div class=\"desc\">" + esc(p.descripcion) + "</div>" : "") +
    "<h2>Detalles</h2>" + detTable +
    (caract.length ? "<h2>Características</h2><div class=\"chips\">" + caract.map(c => "<span class=\"chip\">" + esc(c) + "</span>").join("") + "</div>" : "") +
    map +
    "<div class=\"legal\">Referencia " + esc(p.ref || p.id) + ". Los datos e imágenes son orientativos y no tienen carácter contractual. Brava Real Estate es una marca del grupo Brava Dubai (Nueva Gestión Brava Inmobiliaria, S.L.). Consulta nuestra <a href=\"/privacidad.html\">política de privacidad</a>.</div>" +
    "</div>" +
    "<aside class=\"contact\" id=\"contact\">" +
    "<div class=\"cp\">" + (p.precio ? eur(p.precio) : "Consultar") + "</div><div class=\"cref\">Ref. " + esc(p.ref || p.id) + "</div>" +
    "<div id=\"cok\" class=\"okmsg\">¡Solicitud enviada! Te contactaremos pronto.</div>" +
    "<form id=\"cform\"><input id=\"cn\" placeholder=\"Nombre\" required><input id=\"ct\" placeholder=\"Teléfono\" required><input id=\"ce\" type=\"email\" placeholder=\"Email\"><div style=\"display:flex;gap:9px\"><input id=\"cd\" type=\"date\" style=\"flex:1\"><select id=\"cf\" style=\"flex:1\"><option value=\"\">Franja</option><option>Mañana</option><option>Tarde</option></select></div><textarea id=\"cm\" placeholder=\"Me interesa esta propiedad…\"></textarea>" +
    "<label class=\"consent\"><input type=\"checkbox\" id=\"cc\" required><span>Acepto la <a href=\"/privacidad.html\" target=\"_blank\">política de privacidad</a>.</span></label>" +
    "<button class=\"btn\" type=\"submit\">Solicitar información</button></form>" +
    "<a id=\"waBtn\" class=\"btn wa\" target=\"_blank\" href=\"https://wa.me/34622220591?text=" + encodeURIComponent("Hola, me interesa la propiedad " + (p.ref || "") + " (" + titulo + ")") + "\">WhatsApp</a>" +
    "<a id=\"telBtn\" class=\"btn ghost\" href=\"tel:+34622220591\">Llamar · 622 220 591</a>" +
    "<button id=\"shareBtn\" class=\"btn ghost\">Compartir</button>" +
    "<button id=\"favBtn\" class=\"btn ghost\">♡ Guardar en favoritos</button>" +
    "</aside></div></div>" +
    "<script>(function(){var PID='" + p.id + "';var ev=function(t){try{fetch('/api/public/evento',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({propId:PID,tipo:t}),keepalive:true});}catch(e){}};" +
    "var wb=document.getElementById('waBtn');if(wb)wb.addEventListener('click',function(){ev('whatsapp');});var tb=document.getElementById('telBtn');if(tb)tb.addEventListener('click',function(){ev('telefono');});" +
    "var sb=document.getElementById('shareBtn');if(sb)sb.addEventListener('click',function(){ev('compartir');if(navigator.share){navigator.share({title:document.title,url:location.href});}else{if(navigator.clipboard)navigator.clipboard.writeText(location.href);this.textContent='Enlace copiado';}});" +
    "var fb=document.getElementById('favBtn');if(fb){var favs;try{favs=JSON.parse(localStorage.getItem('vlc_favs')||'[]');}catch(e){favs=[];}var isf=favs.indexOf(PID)>-1;fb.textContent=isf?'♥ En favoritos':'♡ Guardar en favoritos';fb.addEventListener('click',function(){try{favs=JSON.parse(localStorage.getItem('vlc_favs')||'[]');}catch(e){favs=[];}var i=favs.indexOf(PID);if(i>-1){favs.splice(i,1);this.textContent='♡ Guardar en favoritos';}else{favs.push(PID);this.textContent='♥ En favoritos';ev('favorito');}try{localStorage.setItem('vlc_favs',JSON.stringify(favs));}catch(e){}});}" +
    "var g=function(i){return document.getElementById(i);};var f=g('cform');f.addEventListener('submit',function(e){e.preventDefault();if(!g('cc').checked){alert('Debes aceptar la privacidad');return;}var b={nombre:g('cn').value.trim(),tel:g('ct').value.trim(),email:g('ce').value.trim(),mensaje:g('cm').value.trim(),fechaVisita:g('cd').value,franja:g('cf').value};if(!b.nombre||!b.tel){alert('Nombre y telefono obligatorios');return;}var bt=f.querySelector('button');bt.disabled=true;bt.textContent='Enviando…';fetch('/api/public/propiedad/" + encodeURIComponent(p.slug || p.id) + "/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(function(r){return r.json();}).then(function(j){if(j.ok){f.style.display='none';g('cok').style.display='block';}else{bt.disabled=false;bt.textContent='Solicitar información';alert(j.error||'No se pudo enviar');}}).catch(function(){bt.disabled=false;bt.textContent='Solicitar información';alert('Error de conexion');});});})();</script>";

  return page(200, titulo + " · " + shortLoc + " · Brava Real Estate", body, head);
};

export const config = { path: "/inmueble/*" };
