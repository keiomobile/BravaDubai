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
