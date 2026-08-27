/* Brava public i18n · deterministic ES/EN/AR, no runtime AI dependency. */
(function () {
  'use strict';
  var KEY='brava_lang', lang='es', originals=window.WeakMap?new WeakMap():null, observer=null;
  var SKIP='script,style,noscript,code,svg,[data-noi18n],[contenteditable]';
  function dict(l){ return (window.BravaDict&&window.BravaDict[l])||{}; }
  function t(es,fallback){ return lang==='es'?es:(dict(lang)[es]||fallback||es); }
  function remember(n){ if(originals&&!originals.has(n)) originals.set(n,n.nodeValue); return originals?originals.get(n):n.nodeValue; }
  function translateNode(n){
    var p=n.parentElement;if(!p||p.closest(SKIP))return;
    var raw=remember(n), trimmed=raw.trim();if(!trimmed)return;
    n.nodeValue=raw.replace(trimmed,t(trimmed));
  }
  function translateAttrs(root){
    Array.prototype.forEach.call((root||document).querySelectorAll('[placeholder],[title],[aria-label]'),function(el){
      ['placeholder','title','aria-label'].forEach(function(a){var k='data-i18n-original-'+a;if(el.hasAttribute(a)){if(!el.hasAttribute(k))el.setAttribute(k,el.getAttribute(a));el.setAttribute(a,t(el.getAttribute(k)));}});
    });
  }
  function apply(root){
    if(!document.body)return;
    var w=document.createTreeWalker(root||document.body,NodeFilter.SHOW_TEXT,null),n;
    while((n=w.nextNode()))translateNode(n);
    translateAttrs(root||document);
  }
  function restore(){
    if(!originals)return;
    var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null),n;
    while((n=w.nextNode()))if(originals.has(n))n.nodeValue=originals.get(n);
    Array.prototype.forEach.call(document.querySelectorAll('[placeholder],[title],[aria-label]'),function(el){['placeholder','title','aria-label'].forEach(function(a){var k='data-i18n-original-'+a;if(el.hasAttribute(k))el.setAttribute(a,el.getAttribute(k));});});
  }
  function highlight(){Array.prototype.forEach.call(document.querySelectorAll('#lang button'),function(b){b.classList.toggle('on',b.getAttribute('data-lang')===lang);});}
  function setLang(next,skipStore){
    lang=['es','en','ar'].indexOf(next)>-1?next:'es';
    document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';
    if(!skipStore)try{localStorage.setItem(KEY,lang);}catch(e){}
    restore();if(lang!=='es')apply(document.body);highlight();
    document.dispatchEvent(new CustomEvent('brava:languagechange',{detail:{lang:lang}}));
  }
  function init(){
    Array.prototype.forEach.call(document.querySelectorAll('#lang button'),function(b){b.onclick=function(){setLang(b.getAttribute('data-lang'));};});
    var saved='es';try{saved=localStorage.getItem(KEY)||'es';}catch(e){}
    setLang(saved,true);
    if(window.MutationObserver){observer=new MutationObserver(function(ms){if(lang==='es')return;ms.forEach(function(m){Array.prototype.forEach.call(m.addedNodes||[],function(n){if(n.nodeType===1)apply(n);else if(n.nodeType===3)translateNode(n);});});});observer.observe(document.body,{childList:true,subtree:true});}
  }
  window.BravaI18n={setLang:setLang,t:t,getLang:function(){return lang;},apply:apply};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* BRAVA contextual support · shared across the three public divisions */
(function(){
  'use strict';if(/\/(crm|inversor|portal)\.html/.test(location.pathname))return;
  function division(){var p=location.pathname.toLowerCase();return /rent|renta-garantizada/.test(p)?'rent':(/real-estate|propiedad|promocion|inmueble/.test(p)?'realestate':'investment');}
  function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  var d=division(),names={investment:'BRAVA Investment',realestate:'Brava Real Estate',rent:'Brava Rent'},hist=[],busy=false,sid='bc_'+Math.random().toString(36).slice(2)+Date.now().toString(36);
  var css=document.createElement('style');css.textContent='.bc-btn{position:fixed;right:22px;bottom:22px;z-index:9990;width:58px;height:58px;border:1px solid rgba(255,255,255,.22);border-radius:18px;background:#101714;color:#fff;box-shadow:0 12px 0 -7px #050806,0 22px 48px rgba(0,0,0,.3);font:700 22px system-ui;cursor:pointer}.bc-panel{position:fixed;right:22px;bottom:94px;z-index:9991;width:min(390px,calc(100vw - 28px));height:min(590px,calc(100vh - 125px));display:none;flex-direction:column;background:#fff;color:#111;border:1px solid #e2e6e4;border-radius:22px;overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.28);font-family:Arial,sans-serif}.bc-panel.on{display:flex}.bc-head{padding:18px 19px;background:#101714;color:#fff;display:flex;justify-content:space-between;align-items:center}.bc-head b{font-size:14px}.bc-head small{display:block;color:#9eb0a8;margin-top:3px}.bc-close{border:0;background:none;color:#fff;font-size:22px;cursor:pointer}.bc-msgs{flex:1;overflow:auto;padding:16px;background:#f5f7f6}.bc-m{max-width:86%;padding:11px 13px;margin:0 0 10px;border-radius:14px;font-size:13.5px;line-height:1.5;white-space:pre-wrap}.bc-m.a{background:#fff;border:1px solid #e2e6e4}.bc-m.u{background:#126f50;color:#fff;margin-left:auto}.bc-form{display:flex;gap:8px;padding:12px;border-top:1px solid #e4e8e6}.bc-form textarea{flex:1;resize:none;min-height:42px;max-height:90px;border:1px solid #d8ddda;border-radius:11px;padding:10px;font:13px Arial}.bc-send{border:0;border-radius:11px;background:#101714;color:#fff;padding:0 15px;font-weight:700;cursor:pointer}@media(max-width:600px){.bc-btn{right:14px;bottom:14px}.bc-panel{right:14px;bottom:84px}}';document.head.appendChild(css);
  var btn=document.createElement('button');btn.className='bc-btn';btn.type='button';btn.setAttribute('aria-label','Abrir soporte BRAVA');btn.innerHTML='<svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.35-4.05A9 9 0 1 1 21 12Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg>';
  var p=document.createElement('section');p.className='bc-panel';p.innerHTML='<div class="bc-head"><div><b>'+names[d]+'</b><small>Asistente de soporte</small></div><button class="bc-close" aria-label="Cerrar">×</button></div><div class="bc-msgs"><div class="bc-m a">Hola. Puedo orientarte sobre BRAVA y esta página. Para condiciones concretas, nuestro equipo revisará tu caso personalmente.</div></div><form class="bc-form"><textarea maxlength="1500" placeholder="¿En qué podemos ayudarte?"></textarea><button class="bc-send">Enviar</button></form>';document.body.appendChild(btn);document.body.appendChild(p);
  btn.onclick=function(){p.classList.toggle('on');};p.querySelector('.bc-close').onclick=function(){p.classList.remove('on');};
  p.querySelector('form').onsubmit=function(e){e.preventDefault();if(busy)return;var ta=p.querySelector('textarea'),q=ta.value.trim();if(!q)return;var box=p.querySelector('.bc-msgs');box.insertAdjacentHTML('beforeend','<div class="bc-m u">'+esc(q)+'</div>');ta.value='';busy=true;var loading=document.createElement('div');loading.className='bc-m a';loading.textContent='Pensando…';box.appendChild(loading);box.scrollTop=box.scrollHeight;fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:q,division:d,page:location.pathname+' · '+document.title,lang:document.documentElement.lang||'es',sessionId:sid,history:hist})}).then(function(r){return r.json().then(function(j){return{ok:r.ok,data:j};});}).then(function(r){var a=r.ok&&r.data.answer?r.data.answer:(r.data.error||'No puedo responder ahora. Utiliza el formulario de contacto.');a=String(a).replace(/^#{1,6}\s*/gm,'').replace(/\*\*(.*?)\*\*/g,'$1').replace(/^[-*]\s+/gm,'• ');loading.textContent=a;hist.push({role:'user',content:q},{role:'assistant',content:a});hist=hist.slice(-8);}).catch(function(){loading.textContent='No puedo responder ahora. Utiliza el formulario de contacto.';}).finally(function(){busy=false;box.scrollTop=box.scrollHeight;});};
})();
