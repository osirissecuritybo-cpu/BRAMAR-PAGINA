/* =====================================================================
   Bramar · Mercado de residentes (portal de propietarios e inquilinos)
   Vitrina de negocios, servicios, productos e inmuebles publicados por
   los residentes de los edificios administrados por Bramar.
   · Cada consulta se valida en el servidor con edificio + depto + código.
   · Cada residente solo puede editar, pausar o eliminar lo suyo.
   ===================================================================== */
(function(){
  "use strict";
  var CSS='\
#mk .mk{padding-top:4px}\
#mk .mk-top{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}\
#mk .mk-top h2{font-size:26px;color:var(--navy);font-weight:300}\
#mk .mk-top p{font-size:14px;color:var(--muted);margin-top:4px}\
#mk .mk-seg{display:flex;gap:26px;margin:14px 0 0;border-bottom:1px solid var(--line)}\
#mk .mk-seg button{position:relative;min-height:48px;padding:0;border:0;background:none;font:inherit;font-size:15px;font-weight:500;color:var(--muted);cursor:pointer}\
#mk .mk-seg button.on{color:var(--navy)}\
#mk .mk-seg button.on::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--navy)}\
#mk .dd{position:relative;min-width:0}\
#mk .dd select{position:absolute;opacity:0;pointer-events:none;width:1px;height:1px}\
#mk .dd-b{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:46px;padding:0 14px;border:1px solid var(--line);border-radius:12px;background:#fff;font:inherit;font-size:15px;font-weight:400;color:var(--ink);cursor:pointer;text-align:left;box-sizing:border-box}\
#mk .dd-b span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
#mk .dd-b svg{flex:0 0 auto;width:16px;height:16px;color:var(--muted);transition:transform .2s}\
#mk .dd.open .dd-b svg{transform:rotate(180deg)}\
#mk .dd-m{position:absolute;z-index:20;left:0;right:0;top:calc(100% + 6px);max-height:300px;overflow:auto;background:#fff;border-radius:14px;padding:6px;box-shadow:0 24px 60px -18px rgba(6,33,69,.4),0 0 0 1px rgba(6,33,69,.06);display:none}\
#mk .dd.open .dd-m{display:block}\
#mk .dd-m button{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:44px;padding:0 12px;border:0;border-radius:10px;background:none;font:inherit;font-size:15px;color:var(--ink);cursor:pointer;text-align:left}\
#mk .dd-m button:hover{background:var(--sand)}\
#mk .dd-m button.on{color:var(--navy);font-weight:500}\
#mk .dd-m button.on::after{content:"";width:12px;height:7px;border:2px solid var(--navy);border-top:0;border-right:0;transform:rotate(-45deg) translateY(-2px)}\
#mk .mk-bar{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}\
#mk .mk-bar input{min-height:46px;border:1px solid var(--line);border-radius:12px;background:#fff;padding:0 14px;font:inherit;font-size:15px;color:var(--ink)}\
#mk .mk-bar input{flex:1 1 200px}#mk .mk-bar .dd{flex:0 1 240px}\
#mk .mk-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 20px;border:0;border-radius:999px;background:var(--navy);color:#fff;font:inherit;font-size:14.5px;font-weight:500;cursor:pointer;text-decoration:none}\
#mk .mk-btn.l{background:#fff;color:var(--navy);box-shadow:inset 0 0 0 1px var(--line)}\
#mk .mk-btn.wa{background:#1F8A5B}\
#mk .mk-btn[disabled]{opacity:.55;pointer-events:none}\
#mk .mk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-top:16px}\
#mk .mk-c{background:#fff;border-radius:16px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;transition:transform .25s,box-shadow .25s;box-shadow:0 1px 0 var(--line)}\
#mk .mk-c:hover{transform:translateY(-2px);box-shadow:0 16px 36px -24px rgba(6,33,69,.5)}\
#mk .mk-c .ph{aspect-ratio:4/3;background:var(--sand);overflow:hidden}\
#mk .mk-c .ph img{width:100%;height:100%;object-fit:cover}\
#mk .mk-c .bd{padding:10px 12px 12px;display:flex;flex-direction:column;gap:2px;flex:1}\
#mk .mk-c .ct{font-size:12.5px;color:var(--muted)}\
#mk .mk-c b{font-size:15px;font-weight:500;color:var(--ink);line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}\
#mk .mk-c .pr{font-size:14.5px;font-weight:500;color:var(--navy)}\
#mk .mk-c .ds{display:none}\
#mk .mk-c .wh{display:none}\
#mk .mk-empty{margin-top:18px;padding:36px 20px;text-align:center;border:1px dashed var(--line);border-radius:18px;color:var(--muted);font-size:15px}\
#mk .mk-empty b{display:block;color:var(--navy);font-weight:500;font-size:17px;margin-bottom:6px}\
#mk .mk-empty .mk-btn{margin-top:16px}\
#mk .mk-back{display:none;align-items:center;gap:6px;min-height:44px;padding:0 14px 0 8px;border:0;border-radius:999px;background:var(--sand);color:var(--navy);font:inherit;font-size:14px;font-weight:500;cursor:pointer}\
#mk .mk-fotos{display:grid;grid-auto-flow:column;grid-auto-columns:100%;overflow-x:auto;scroll-snap-type:x mandatory;border-radius:18px;margin-top:14px;scrollbar-width:none;background:var(--sand)}\
#mk .mk-fotos::-webkit-scrollbar{display:none}\
#mk .mk-fotos img{width:100%;aspect-ratio:4/3;object-fit:cover;scroll-snap-align:start}\
#mk .mk-dots{display:flex;gap:6px;justify-content:center;margin-top:8px}\
#mk .mk-dots i{width:7px;height:7px;border-radius:50%;background:var(--line)}#mk .mk-dots i.on{background:var(--navy)}\
#mk .mk-det{max-width:760px;margin:0 auto}\
#mk .mk-det h3{font-size:24px;font-weight:400;color:var(--navy);margin-top:16px}\
#mk .mk-det .pr{font-size:20px;font-weight:500;color:var(--navy);margin-top:6px}\
#mk .mk-det .ds{white-space:pre-line;margin-top:12px;color:#2a3644;font-size:15.5px}\
#mk .mk-det .wh{margin-top:16px;padding-top:14px;border-top:1px solid var(--line);font-size:14px;color:var(--muted)}\
#mk .mk-det .wh b{display:block;color:var(--ink);font-weight:500;font-size:16px}\
#mk .mk-acts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:16px}\
#mk .mk-link{border:0;background:none;color:var(--muted);font:inherit;font-size:13.5px;text-decoration:underline;cursor:pointer;min-height:44px;padding:0;margin-top:8px}\
#mk .mk-f{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}\
#mk .mk-f .full{grid-column:1/-1}\
#mk .mk-f label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:500;color:var(--muted)}\
#mk .mk-f input,#mk .mk-f textarea{min-height:48px;border:1px solid var(--line);border-radius:12px;padding:10px 14px;font:inherit;font-size:15.5px;font-weight:400;color:var(--ink);background:#fff;width:100%;box-sizing:border-box}\
#mk .mk-f textarea{min-height:110px;resize:vertical}\
#mk .mk-f h4{grid-column:1/-1;margin:10px 0 0;font-size:15px;font-weight:500;color:var(--navy)}\
#mk .mk-ph{grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px}\
#mk .mk-ph div{position:relative;aspect-ratio:1;border-radius:12px;overflow:hidden;background:var(--sand)}\
#mk .mk-ph img{width:100%;height:100%;object-fit:cover}\
#mk .mk-ph .x{position:absolute;right:5px;top:5px;width:30px;height:30px;border:0;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;font-size:16px;cursor:pointer}\
#mk .mk-ph .p{position:absolute;left:6px;bottom:6px;background:var(--navy);color:#fff;font-size:11px;padding:3px 7px;border-radius:6px}\
#mk .mk-ph .add{aspect-ratio:1;border:1.5px dashed #c8bfae;border-radius:12px;background:var(--sand);color:var(--navy);font:inherit;font-size:13px;font-weight:500;cursor:pointer}\
#mk .mk-msg{grid-column:1/-1;color:#B42318;font-size:14px;min-height:1em}\
#mk .mk-foot{grid-column:1/-1;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}\
#mk .mk-mine{margin-top:16px;border:1px solid var(--line);border-radius:18px;overflow:hidden;background:#fff}\
#mk .mk-row{display:grid;grid-template-columns:64px 1fr;gap:12px;padding:12px 14px;border-top:1px solid var(--line)}\
#mk .mk-row:first-child{border-top:0}\
#mk .mk-row img,#mk .mk-row .nofoto{width:64px;height:64px;border-radius:12px;object-fit:cover;background:var(--sand)}\
#mk .mk-row b{font-weight:500;color:var(--ink)}\
#mk .mk-row small{display:block;color:var(--muted);font-size:13px}\
#mk .mk-row .st{font-size:13px;font-weight:500;color:var(--navy)}\
#mk .mk-row .st.off{color:var(--muted)}\
#mk .mk-row .ac{grid-column:1/-1;display:flex;gap:22px;flex-wrap:wrap;padding-left:76px}\
#mk .mk-row .ac button{min-height:40px;padding:0;border:0;background:none;color:var(--navy);font:inherit;font-size:14px;font-weight:500;cursor:pointer}\
#mk .mk-row .ac button.del{color:#9a2a1f}\
#mk .mk-more{display:flex;justify-content:center;margin-top:16px}\
@media (min-width:601px){ .grid>section.panel.p-mk.m-open{padding-inline:max(24px,calc(50vw - 520px))} .p-mk.m-open .m-head{margin-inline:calc(-1*max(24px,calc(50vw - 520px)));padding-inline:max(16px,calc(50vw - 528px))} }\
@media (max-width:600px){ #mk .mk-grid{grid-template-columns:1fr 1fr;gap:10px} #mk .mk-c .ds{display:none} #mk .mk-f{grid-template-columns:1fr} #mk .mk-foot .mk-btn{flex:1} #mk .mk-bar .dd{flex:1 1 100%} #mk .mk-row .ac{padding-left:0} }';
  var st=document.createElement('style'); st.textContent=CSS; document.head.appendChild(st);

  var $=function(s,r){ return (r||document).querySelector(s); };
  var esc=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var foto=function(id,w){ return 'https://lh3.googleusercontent.com/d/'+encodeURIComponent(id)+'=w'+(w||600); };
  var miles=function(n){ return (Math.round((+n||0)*100)/100).toString().replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.'); };
  var tel591=function(t){ t=String(t||'').replace(/\D/g,''); return t.length===8?'591'+t:t; };
  var PRECIO_OPC=['Negocios','Servicios profesionales','Servicios técnicos','Emprendimientos','Gastronomía','Otros'];
  var precioTxt=function(x){ return x.precio>0?(x.moneda==='USD'?'$us ':'Bs ')+miles(x.precio)+(x.precioTexto?' · '+x.precioTexto:''):(x.precioTexto||''); };
  var P=null, D=null, vista='vitrina', q='', cat='', mostrados=24, editando=null, FOT=[], MANT=[], cargando=null;
  function root(){ return $('#mk-root'); }
  var CHEV='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  function ddSync(sel){ var w=sel.closest('.dd'); if(!w||!w._b) return; var o=sel.options[sel.selectedIndex]; w._b.querySelector('span').textContent=o?o.text:'';
    w._m.innerHTML=[].map.call(sel.options,function(op,i){ return '<button type="button" data-ddi="'+i+'" class="'+(i===sel.selectedIndex?'on':'')+'">'+esc(op.text)+'</button>'; }).join(''); }
  function ddInit(r){ [].forEach.call(r.querySelectorAll('.dd'),function(w){ if(w._b) return; var sel=w.querySelector('select');
    var b=document.createElement('button'); b.type='button'; b.className='dd-b'; b.innerHTML='<span></span>'+CHEV; var m=document.createElement('div'); m.className='dd-m';
    w.appendChild(b); w.appendChild(m); w._b=b; w._m=m;
    b.onclick=function(e){ e.preventDefault(); e.stopPropagation(); var ab=w.classList.contains('open'); cerrarDd(); if(!ab){ ddSync(sel); w.classList.add('open'); } };
    m.onclick=function(e){ e.preventDefault(); e.stopPropagation(); var it=e.target.closest('[data-ddi]'); if(!it) return; sel.selectedIndex=+it.dataset.ddi; ddSync(sel); cerrarDd(); sel.dispatchEvent(new Event('change',{bubbles:true})); };
    ddSync(sel); }); }
  function cerrarDd(){ [].forEach.call(document.querySelectorAll('#mk .dd.open'),function(w){ w.classList.remove('open'); }); }
  document.addEventListener('click',function(e){ if(!e.target.closest('#mk .dd')) cerrarDd(); });
  function call(b){ return window.__bramarPortal.call(b); }

  function cargar(){ if(cargando) return cargando;
    return cargando=call({action:'mk_lista'}).then(function(j){ cargando=null; if(!j.ok) throw new Error(j.error||'error'); D=j; return j; },function(e){ cargando=null; throw e; }); }
  function pintar(){ var r=root(); if(!r) return;
    if(!D){ r.innerHTML='<div class="mk"><p style="color:var(--muted);padding:24px 0">Cargando…</p></div>'; return; }
    if(vista==='detalle') return detalle(r);
    if(vista==='form') return form(r);
    r.innerHTML='<div class="mk"><div class="mk-top"><div><h2>Mercado de residentes</h2><p>Negocios, servicios y productos de vecinos de los edificios Bramar.</p></div>'+
      '<button type="button" class="mk-btn" data-a="nuevo">Publicar mi negocio</button></div>'+
      '<div class="mk-seg" role="tablist"><button type="button" data-v="vitrina" class="'+(vista==='vitrina'?'on':'')+'">Vitrina</button><button type="button" data-v="mias" class="'+(vista==='mias'?'on':'')+'">Mis publicaciones'+(D.mias.length?' · '+D.mias.length:'')+'</button></div>'+
      '<div id="mk-body"></div></div>';
    if(vista==='mias') mias(); else vitrina(); }
  function vitrina(){ var b=$('#mk-body');
    var cats=D.categorias.filter(function(c){ return D.publicaciones.some(function(x){ return x.categoria===c; }); });
    b.innerHTML='<div class="mk-bar"><input type="search" id="mk-q" placeholder="Buscar: tortas, plomero, clases…" value="'+esc(q)+'"><div class="dd"><select id="mk-cat" aria-label="Categoría"><option value="">Todas las categorías</option>'+cats.map(function(c){ return '<option'+(c===cat?' selected':'')+'>'+esc(c)+'</option>'; }).join('')+'</select></div></div><div id="mk-list"></div>'; ddInit(b);
    var lista=function(){ var t=q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
      var L=D.publicaciones.filter(function(x){ if(cat&&x.categoria!==cat) return false; if(!t) return true; var s=[x.titulo,x.descripcion,x.categoria,x.anunciante].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); return t.split(/\s+/).every(function(w){ return s.indexOf(w)>=0; }); });
      $('#mk-list').innerHTML=L.length?'<div class="mk-grid">'+L.slice(0,mostrados).map(function(x){ return '<article class="mk-c" data-id="'+esc(x.id)+'" tabindex="0" role="button">'+
        '<div class="ph">'+(x.fotos[0]?'<img src="'+foto(x.fotos[0],500)+'" alt="" loading="lazy" decoding="async">':'')+'</div><div class="bd"><span class="ct">'+esc(x.categoria)+(x.ejemplo?' · Ejemplo':'')+'</span><b>'+esc(x.titulo)+'</b>'+
        (precioTxt(x)?'<span class="pr">'+esc(precioTxt(x))+'</span>':'')+'<span class="ds">'+esc(x.descripcion)+'</span><span class="wh">'+esc(x.anunciante)+(x.edificio?' · '+esc(x.edificio):'')+'</span></div></article>'; }).join('')+'</div>'+
        (L.length>mostrados?'<div class="mk-more"><button type="button" class="mk-btn l" data-a="mas">Ver más</button></div>':'')
        :'<div class="mk-empty"><b>'+(D.publicaciones.length?'Nada coincide con su búsqueda':'Todavía no hay publicaciones')+'</b>'+(D.publicaciones.length?'Pruebe con otra palabra o categoría.':'Sea el primero en mostrar su negocio a sus vecinos.')+(D.publicaciones.length?'':'<br><button type="button" class="mk-btn" data-a="nuevo">Publicar mi negocio</button>')+'</div>'; };
    $('#mk-q').oninput=function(){ q=this.value; mostrados=24; lista(); };
    $('#mk-cat').onchange=function(){ cat=this.value; mostrados=24; lista(); if(cat) interes(grupo({categoria:cat}),1); };
    lista(); }
  function mias(){ var b=$('#mk-body'), hoy=new Date().toISOString();
    var E={publicado:'Publicado',pausado:'Pausado',vencido:'Vencido',rechazado:'Retirado por Bramar',pendiente:'En revisión'};
    b.innerHTML=D.mias.length?'<div class="mk-mine">'+D.mias.map(function(x){ var off=x.estado!=='publicado';
      return '<div class="mk-row" data-id="'+esc(x.id)+'">'+(x.fotos[0]?'<img src="'+foto(x.fotos[0],160)+'" alt="">':'<span class="nofoto"></span>')+
        '<div><b>'+esc(x.titulo)+'</b><small>'+esc(x.categoria)+(precioTxt(x)?' · '+esc(precioTxt(x)):'')+'</small><span class="st'+(off?' off':'')+'">'+(E[x.estado]||x.estado)+'</span>'+
        (x.estado==='publicado'&&x.vence?'<small>Visible hasta el '+new Date(x.vence).toLocaleDateString('es-BO',{day:'numeric',month:'long'})+'</small>':'')+(x.motivo?'<small>Motivo: '+esc(x.motivo)+'</small>':'')+'</div>'+
        '<div class="ac">'+(x.estado!=='rechazado'?'<button type="button" data-a="editar">Editar</button>':'')+
        (x.estado==='publicado'?'<button type="button" data-a="pausar">Pausar</button>':'')+(x.estado==='pausado'?'<button type="button" data-a="activar">Volver a publicar</button>':'')+
        (x.estado==='vencido'||(x.estado==='publicado'&&x.vence&&x.vence<new Date(Date.now()+10*864e5).toISOString())?'<button type="button" data-a="renovar">Renovar</button>':'')+
        '<button type="button" class="del" data-a="eliminar">Eliminar</button></div></div>'; }).join('')+'</div>'
      :'<div class="mk-empty"><b>Aún no publicó nada</b>Muestre su negocio, servicio o producto a sus vecinos.<br><button type="button" class="mk-btn" data-a="nuevo">Publicar mi negocio</button></div>'; }
  function detalle(r){ var x=D.publicaciones.concat(D.mias).filter(function(z){ return z.id===P; })[0]; if(!x){ vista='vitrina'; return pintar(); }
    if(detalle.ult!==x.id&&!D.mias.some(function(z){ return z.id===x.id; })){ detalle.ult=x.id; interes(grupo(x),2); }
    var wa=tel591(x.whatsapp||x.telefono), msg='Hola '+(x.anunciante||'')+', vi su publicación «'+x.titulo+'» en el Mercado de residentes de Bramar.';
    r.innerHTML='<div class="mk mk-det"><button type="button" class="mk-back" data-a="volver">‹ Volver</button>'+
      (x.fotos.length?'<div class="mk-fotos" id="mk-fotos">'+x.fotos.map(function(f){ return '<img src="'+foto(f,1200)+'" alt="">'; }).join('')+'</div>'+(x.fotos.length>1?'<div class="mk-dots" id="mk-dots">'+x.fotos.map(function(f,i){ return '<i class="'+(i?'':'on')+'"></i>'; }).join('')+'</div>':''):'')+
      '<h3>'+esc(x.titulo)+'</h3><span style="font-size:12.5px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--brass)">'+esc(x.categoria)+'</span>'+
      (precioTxt(x)?'<div class="pr">'+esc(precioTxt(x))+'</div>':'')+(x.descripcion?'<p class="ds">'+esc(x.descripcion)+'</p>':'')+(x.ubicacion?'<p class="ds" style="margin-top:8px">Ubicación: '+esc(x.ubicacion)+'</p>':'')+
      '<div class="wh"><b>'+esc(x.anunciante)+'</b>'+(x.edificio?'Vecino de '+esc(x.edificio):'')+'</div><div class="mk-acts">'+
      (wa?'<a class="mk-btn wa" target="_blank" rel="noopener" href="https://wa.me/'+wa+'?text='+encodeURIComponent(msg)+'">WhatsApp</a>':'')+
      (x.telefono?'<a class="mk-btn l" href="tel:+'+tel591(x.telefono)+'">Llamar</a>':'')+
      (x.facebook?'<a class="mk-btn l" target="_blank" rel="noopener nofollow ugc" href="'+esc(x.facebook)+'">Facebook</a>':'')+
      (x.instagram?'<a class="mk-btn l" target="_blank" rel="noopener nofollow ugc" href="'+esc(x.instagram)+'">Instagram</a>':'')+
      (x.web?'<a class="mk-btn l" target="_blank" rel="noopener nofollow ugc" href="'+esc(x.web)+'">Página web</a>':'')+'</div>'+
      (D.mias.some(function(z){ return z.id===x.id; })?'':'<button type="button" class="mk-link" data-a="reportar">Reportar publicación</button>')+'</div>';
    var fs=$('#mk-fotos'); if(fs&&$('#mk-dots')) fs.addEventListener('scroll',function(){ var i=Math.round(fs.scrollLeft/fs.clientWidth); [].forEach.call($('#mk-dots').children,function(d,k){ d.classList.toggle('on',k===i); }); },{passive:true});
    var sec=$('#mk'); if(sec) sec.scrollTop=0; }
  /* ---------- formulario ---------- */
  function comprimir(file){ return new Promise(function(res,rej){
    if(!/^image\/(jpeg|png|webp)$/.test(file.type)) return rej(new Error('Solo fotos JPG, PNG o WEBP.'));
    var u=URL.createObjectURL(file), im=new Image(); im.onload=function(){ URL.revokeObjectURL(u);
      var k=Math.min(1,1400/Math.max(im.width,im.height)), c=document.createElement('canvas'); c.width=Math.round(im.width*k); c.height=Math.round(im.height*k);
      var g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height); g.drawImage(im,0,0,c.width,c.height);
      var qq=.8, d=c.toDataURL('image/jpeg',qq); while(d.length>880000&&qq>.45){ qq-=.08; d=c.toDataURL('image/jpeg',qq); } res(d); };
    im.onerror=function(){ rej(new Error('No se pudo leer una foto.')); }; im.src=u; }); }
  function form(r){ var x=editando||{}, s=window.__bramarPortal.ses()||{};
    r.innerHTML='<div class="mk"><button type="button" class="mk-back" data-a="volver">‹ Volver</button><div class="mk-top" style="margin-top:12px"><div><h2>'+(editando?'Editar publicación':'Publicar mi negocio')+'</h2><p>Lo verán los residentes de los edificios administrados por Bramar.</p></div></div>'+
      '<form class="mk-f" id="mk-form" novalidate>'+
      '<label class="full">Nombre del negocio o publicación<input name="titulo" maxlength="90" value="'+esc(x.titulo||'')+'" placeholder="Ej.: Tortas y postres Ana" required></label>'+
      '<label>Categoría<div class="dd"><select name="categoria" id="mk-fcat">'+D.categorias.map(function(c){ return '<option'+(c===x.categoria?' selected':'')+'>'+esc(c)+'</option>'; }).join('')+'</select></div></label>'+
      '<label>¿Quién lo ve?<div class="dd"><select name="alcance"><option value="todos"'+(x.alcance!=='edificio'?' selected':'')+'>Todos los edificios Bramar</option><option value="edificio"'+(x.alcance==='edificio'?' selected':'')+'>Solo mi edificio</option></select></div></label>'+
      '<label class="full">Descripción<textarea name="descripcion" maxlength="2000" placeholder="Qué ofrece, horarios, zona de entrega…">'+esc(x.descripcion||'')+'</textarea></label>'+
      '<h4>Precio</h4><label>Precio <span id="mk-popc"></span><input name="precio" inputmode="decimal" value="'+(x.precio>0?esc(x.precio):'')+'" placeholder="0"></label>'+
      '<label>Moneda<div class="dd"><select name="moneda"><option value="Bs"'+(x.moneda!=='USD'?' selected':'')+'>Bolivianos</option><option value="USD"'+(x.moneda==='USD'?' selected':'')+'>Dólares</option></select></div></label>'+
      '<label class="full">Nota de precio (opcional)<input name="precioTexto" maxlength="40" value="'+esc(x.precioTexto||'')+'" placeholder="Ej.: desde, por hora, a convenir"></label>'+
      '<h4>Fotos</h4><div class="mk-ph" id="mk-ph"></div><input type="file" id="mk-fin" accept="image/jpeg,image/png,image/webp" multiple hidden>'+
      '<h4>Contacto</h4><label>Su nombre o el de su negocio<input name="anunciante" maxlength="80" value="'+esc(x.anunciante||s.nombre||'')+'" required></label>'+
      '<label>Teléfono<input name="telefono" type="tel" inputmode="tel" value="'+esc(x.telefono||'')+'" placeholder="70000000"></label>'+
      '<label>WhatsApp (si es otro número)<input name="whatsapp" type="tel" inputmode="tel" value="'+esc(x.whatsapp&&x.whatsapp!==x.telefono?x.whatsapp:'')+'"></label>'+
      '<label>Ubicación (opcional)<input name="ubicacion" maxlength="120" value="'+esc(x.ubicacion||'')+'" placeholder="Ej.: entrega en el edificio"></label>'+
      '<label>Facebook<input name="facebook" type="url" inputmode="url" value="'+esc(x.facebook||'')+'" placeholder="https://facebook.com/…"></label>'+
      '<label>Instagram<input name="instagram" type="url" inputmode="url" value="'+esc(x.instagram||'')+'" placeholder="https://instagram.com/…"></label>'+
      '<label class="full">Página web<input name="web" type="url" inputmode="url" value="'+esc(x.web||'')+'" placeholder="https://"></label>'+
      '<p class="mk-msg" id="mk-msg" role="alert"></p><div class="mk-foot"><button type="button" class="mk-btn l" data-a="volver">Cancelar</button><button type="submit" class="mk-btn" id="mk-ok">'+(editando?'Guardar cambios':'Publicar')+'</button></div></form></div>';
    ddInit(r);
    var popc=function(){ $('#mk-popc').textContent=PRECIO_OPC.indexOf($('#mk-fcat').value)>=0?'(opcional)':''; }; $('#mk-fcat').onchange=popc; popc();
    fotos(); var sec=$('#mk'); if(sec) sec.scrollTop=0;
    $('#mk-fin').onchange=function(){ var fs=[].slice.call(this.files||[]).slice(0,8-MANT.length-FOT.length); this.value=''; $('#mk-msg').textContent=fs.length?'Optimizando fotos…':'';
      fs.reduce(function(p,f){ return p.then(function(){ return comprimir(f).then(function(d){ FOT.push(d); fotos(); }); }); },Promise.resolve()).then(function(){ $('#mk-msg').textContent=''; }).catch(function(e){ $('#mk-msg').textContent=e.message; }); };
    $('#mk-form').onsubmit=function(e){ e.preventDefault(); var f=this, v=function(n){ return (f.elements[n].value||'').trim(); };
      var p={titulo:v('titulo'),categoria:v('categoria'),alcance:v('alcance'),descripcion:v('descripcion'),precio:v('precio').replace(/[^\d.,]/g,'').replace(/\.(?=\d{3})/g,'').replace(',','.'),moneda:v('moneda'),precioTexto:v('precioTexto'),
        anunciante:v('anunciante'),telefono:v('telefono'),whatsapp:v('whatsapp'),ubicacion:v('ubicacion'),facebook:v('facebook'),instagram:v('instagram'),web:v('web')};
      var bad=['facebook','instagram','web'].filter(function(k){ return p[k]&&!/^https?:\/\//i.test(p[k]); });
      var err=!p.titulo?'Escriba el nombre del negocio o la publicación.':!p.anunciante?'Escriba su nombre.':(!p.telefono&&!p.whatsapp)?'Escriba un teléfono o WhatsApp.':bad.length?'Los enlaces deben empezar con https://':'';
      $('#mk-msg').textContent=err; if(err) return; var bt=$('#mk-ok'); bt.disabled=true; bt.textContent='Guardando…';
      call({action:'mk_guardar',id:editando?editando.id:'',publicacion:p,fotos:FOT,mantener:MANT}).then(function(j){ if(!j.ok) throw new Error(j.error==='codigo'?'Su sesión venció. Vuelva a ingresar.':j.error);
        FOT=[]; MANT=[]; editando=null; volverA='mias'; if(history.state&&history.state.mk) history.back(); else salir(); return cargar().then(pintar); })
        .catch(function(e2){ bt.disabled=false; bt.textContent=editando?'Guardar cambios':'Publicar'; $('#mk-msg').textContent=e2.message==='Failed to fetch'?'Sin conexión. Intente de nuevo.':e2.message; }); }; }
  function fotos(){ var c=$('#mk-ph'); if(!c) return; var n=0;
    c.innerHTML=MANT.map(function(id,i){ return '<div><img src="'+foto(id,240)+'" alt="">'+(n++===0?'<span class="p">Principal</span>':'')+'<button type="button" class="x" data-xm="'+i+'" aria-label="Quitar">×</button></div>'; }).join('')+
      FOT.map(function(d,i){ return '<div><img src="'+d+'" alt="">'+(n++===0?'<span class="p">Principal</span>':'')+'<button type="button" class="x" data-xf="'+i+'" aria-label="Quitar">×</button></div>'; }).join('')+
      (MANT.length+FOT.length<8?'<button type="button" class="add" data-a="foto">+ Agregar fotos</button>':''); }

  /* ---------- acciones ---------- */
  document.addEventListener('click',function(e){
    var r=root(); if(!r||!r.contains(e.target)) return;
    var t=e.target.closest('[data-a],[data-v],[data-xm],[data-xf],.mk-c');
    if(!t) return;
    if(t.dataset.v){ vista=t.dataset.v; return pintar(); }
    if(t.dataset.xm!=null){ MANT.splice(+t.dataset.xm,1); return fotos(); }
    if(t.dataset.xf!=null){ FOT.splice(+t.dataset.xf,1); return fotos(); }
    if(t.classList.contains('mk-c')){ P=t.dataset.id; sub('detalle'); return; }
    var a=t.dataset.a, row=t.closest('.mk-row'), id=row&&row.dataset.id, x=id&&D.mias.filter(function(z){ return z.id===id; })[0];
    if(a==='nuevo'){ editando=null; FOT=[]; MANT=[]; sub('form'); return; }
    if(a==='volver'){ if(history.state&&history.state.mk) history.back(); else salir(); return; }
    if(a==='mas'){ mostrados+=24; return vitrina(); }
    if(a==='foto') return $('#mk-fin').click();
    if(a==='reportar'){ var m=prompt('¿Qué problema tiene esta publicación?'); if(!m||!m.trim()) return; call({action:'mk_reportar',id:P,motivo:m.trim()}).then(function(){ alert('Gracias, Bramar lo revisará.'); }); return; }
    if(a==='editar'&&x){ editando=x; MANT=x.fotos.slice(); FOT=[]; sub('form'); return; }
    if((a==='pausar'||a==='activar'||a==='renovar'||a==='eliminar')&&x){
      if(a==='eliminar'&&!confirm('¿Eliminar «'+x.titulo+'»? No se puede deshacer.')) return;
      t.disabled=true; call({action:'mk_estado',id:x.id,op:a}).then(function(j){ if(!j.ok) throw new Error(j.error); return cargar(); }).then(pintar).catch(function(e2){ t.disabled=false; alert(e2.message); });
    }
  });
  document.addEventListener('keydown',function(e){ if(e.key==='Enter'&&e.target.classList&&e.target.classList.contains('mk-c')) e.target.click(); });
  /* contactar a un vecino cuenta como interés fuerte */
  document.addEventListener('click',function(e){ var l=e.target.closest('#mk .mk-det .mk-acts a'); if(!l||!D) return; var x=D.publicaciones.filter(function(z){ return z.id===P; })[0]; if(x) interes(grupo(x),3); });
  /* vistas internas (detalle, formulario) con su propia entrada en el historial:
     el gesto de volver del celular regresa a la vitrina en vez de cerrar el mercado */
  var volverA='vitrina';
  function sub(v){ volverA=(vista==='mias'||vista==='vitrina')?vista:volverA; vista=v; try{ history.pushState({hoja:'mk',mk:v},''); }catch(e){} pintar(); }
  function salir(){ vista=volverA; editando=null; P=null; pintar(); }
  window.__mkVolver=function(){ var sec=document.getElementById('mk');
    if(sec&&sec.classList.contains('m-open')&&(vista==='detalle'||vista==='form')){ salir(); return true; } return false; };
  /* ---------- inicio: vitrina que pasa sola (publicidad de los vecinos) ---------- */
  var AD_CSS='\
#mk-ad{background:var(--paper);border-radius:20px;padding:14px var(--g,16px) 12px;overflow:hidden;margin:16px 0 0}\
#mk-ad .h{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}\
#mk-ad .h b{font-size:15px;font-weight:500;color:var(--navy)}\
#mk-ad .h button{border:0;background:none;font:inherit;font-size:14px;color:var(--navy);text-decoration:underline;text-underline-offset:3px;cursor:pointer;min-height:36px;padding:0}\
#mk-ad .tr{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch}\
#mk-ad .tr::-webkit-scrollbar{display:none}\
#mk-ad .sl{flex:0 0 100%;scroll-snap-align:start;display:grid;grid-template-columns:92px 1fr;gap:14px;align-items:center;border:0;background:none;padding:0;text-align:left;font:inherit;color:inherit;cursor:pointer}\
#mk-ad .sl img{width:92px;height:92px;border-radius:14px;object-fit:cover;background:var(--sand)}\
#mk-ad .sl div{min-width:0}\
#mk-ad .sl small{display:block;font-size:12.5px;color:var(--muted)}\
#mk-ad .sl strong{display:block;font-size:16px;font-weight:500;color:var(--ink);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
#mk-ad .sl em{display:block;font-style:normal;font-size:14.5px;font-weight:500;color:var(--navy);margin-top:2px}\
#mk-ad .sl span{display:block;font-size:13px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
#mk-ad .dt{display:flex;gap:5px;justify-content:center;margin-top:12px}\
#mk-ad .dt i{width:6px;height:6px;border-radius:50%;background:var(--line);transition:width .3s,background .3s}\
#mk-ad .dt i.on{width:16px;border-radius:3px;background:var(--navy)}';
  var adSt=document.createElement('style'); adSt.textContent=AD_CSS; document.head.appendChild(adSt);
  var adClave='', adTimer=null;
  function abrirPub(id){ P=id; window.__bramarPortal.abrir('mk'); setTimeout(function(){ sub('detalle'); },0); }
  /* grupo de interés: la categoría del mercado; todo lo que es inmueble cuenta como «Inmuebles» */
  function grupo(x){ return x.inm||/^inmueble/i.test(x.categoria||'')?'Inmuebles':(x.categoria||'Otros'); }
  function interes(g,peso){ if(!g) return; try{ D&&D.gustos&&(D.gustos[g]=(D.gustos[g]||0)+peso); }catch(e){} call({action:'mk_interes',grupo:g,peso:peso}).catch(function(){}); }
  window.__mkInteres=interes;
  /* barajado estable por día: varía cada día sin saltar en cada recarga */
  function barajar(L,semilla){ var a=L.slice(), h=0; for(var k=0;k<semilla.length;k++) h=(h*31+semilla.charCodeAt(k))|0;
    for(var i=a.length-1;i>0;i--){ h=(h*1103515245+12345)|0; var j=Math.abs(h)%(i+1), t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
  /* 70 % de lo que más le interesa y 30 % de lo demás, intercalado */
  function mezcla(L,gustos,semilla){
    var N=Math.min(12,L.length), sc={}, tot=0; L.forEach(function(x){ var g=grupo(x); sc[g]=+((gustos||{})[g]||0); });
    Object.keys(sc).forEach(function(g){ tot+=sc[g]; });
    var B=barajar(L,semilla).sort(function(a,b){ return (b.destacado?1:0)-(a.destacado?1:0); });
    if(tot<3) return B.slice(0,N);
    var gs=Object.keys(sc).sort(function(a,b){ return sc[b]-sc[a]; }), pref=[], acc=0;
    gs.forEach(function(g){ if(sc[g]>0&&(pref.length===0||(acc<tot*.6&&pref.length<2))){ pref.push(g); acc+=sc[g]; } });
    var P=B.filter(function(x){ return pref.indexOf(grupo(x))>=0; }), resto={}, out=[];
    B.forEach(function(x){ var g=grupo(x); if(pref.indexOf(g)<0) (resto[g]=resto[g]||[]).push(x); });
    /* lo demás, turnando categorías para que se vea variedad */
    var O=[], gr=Object.keys(resto); while(gr.some(function(g){ return resto[g].length; })) gr.forEach(function(g){ if(resto[g].length) O.push(resto[g].shift()); });
    for(var k=0;k<N;k++){ var otro=(k%10===2||k%10===5||k%10===8);
      var src=otro?(O.length?O:P):(P.length?P:O); if(!src.length) break; out.push(src.shift()); }
    return out; }
  function anuncios(){ var bp=window.__bramarPortal, s=bp&&bp.ses(), perfil=$('#view-profile'), grid=$('.profile .grid');
    var visible=perfil&&!perfil.hidden&&s;
    if(!visible){ var v=$('#mk-ad'); if(v) v.remove(); adClave=''; return; }
    var clave=s.b+'|'+s.d+'|'+s.modo; if(adClave===clave) return; adClave=clave; D=null;
    Promise.all([cargar(),call({action:'pub_inm_lista'}).catch(function(){ return {}; })]).then(function(r){
      var inm=((r[1]&&r[1].inmuebles)||[]).filter(function(x){ return x.foto&&!x.cerrado; }).map(function(x){
        return {id:x.id,inm:1,titulo:x.titulo,categoria:'Inmuebles Bramar · '+({venta:'Venta',alquiler:'Alquiler',anticretico:'Anticrético'}[x.operacion]||''),fotos:[x.foto],precio:x.precio,moneda:x.moneda,
          precioTexto:x.operacion==='alquiler'?'por mes':'',anunciante:x.zona||'',destacado:x.destacado,ejemplo:x.ejemplo}; });
      var pool=D.publicaciones.filter(function(x){ return x.fotos.length; }).concat(inm);
      var L=mezcla(pool,D.gustos,new Date().toISOString().slice(0,10)+clave);
      var old=$('#mk-ad'); if(old) old.remove(); if(!L.length||!grid) return;
      var el=document.createElement('div'); el.id='mk-ad'; el.setAttribute('role','region'); el.setAttribute('aria-label','Publicaciones de vecinos e inmuebles');
      el.innerHTML='<div class="h"><b>Para usted</b><button type="button" data-ad="todo">Ver mercado</button></div><div class="tr">'+L.map(function(x){
        return '<button type="button" class="sl" data-ad="'+esc(x.id)+'"'+(x.inm?' data-inm="1"':'')+'><img src="'+foto(x.fotos[0],240)+'" alt="" loading="lazy"><div><small>'+esc(x.categoria)+(x.ejemplo?' · Ejemplo':'')+'</small><strong>'+esc(x.titulo)+'</strong>'+(precioTxt(x)?'<em>'+esc(precioTxt(x))+'</em>':'')+'<span>'+esc(x.anunciante)+'</span></div></button>'; }).join('')+'</div>'+
        (L.length>1?'<div class="dt">'+L.map(function(x,i){ return '<i class="'+(i?'':'on')+'"></i>'; }).join('')+'</div>':'');
      grid.parentNode.insertBefore(el,grid);
      var tr=el.querySelector('.tr'), dots=el.querySelectorAll('.dt i'), i=0, pausa=0;
      var marcar=function(){ var k=Math.round(tr.scrollLeft/tr.clientWidth); [].forEach.call(dots,function(d,j){ d.classList.toggle('on',j===k); }); i=k; };
      tr.addEventListener('scroll',function(){ clearTimeout(tr._t); tr._t=setTimeout(marcar,80); },{passive:true});
      ['touchstart','pointerdown','wheel'].forEach(function(ev){ tr.addEventListener(ev,function(){ pausa=Date.now(); },{passive:true}); });
      clearInterval(adTimer);
      if(L.length>1&&!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)) adTimer=setInterval(function(){
        if(!document.body.contains(el)) return clearInterval(adTimer); if(Date.now()-pausa<7000||document.hidden) return;
        i=(i+1)%L.length; tr.scrollTo({left:i*tr.clientWidth,behavior:'smooth'}); },4500);
      el.addEventListener('click',function(e){ var b=e.target.closest('[data-ad]'); if(!b) return;
        if(b.dataset.ad==='todo'){ vista='vitrina'; window.__bramarPortal.abrir('mk'); return; }
        var x=L.filter(function(z){ return z.id===b.dataset.ad; })[0]; if(x) interes(grupo(x),2);
        if(b.dataset.inm) window.open('inmuebles.html?id='+encodeURIComponent(b.dataset.ad),'_blank','noopener'); else abrirPub(b.dataset.ad); });
    }).catch(function(){ adClave=''; }); }
  setInterval(anuncios,1500);

  /* al abrir la sección se cargan las publicaciones */
  function alAbrir(){ var s=window.__bramarPortal&&window.__bramarPortal.ses(); var r=root(); if(!r) return;
    if(!s){ r.innerHTML='<div class="mk"><div class="mk-empty"><b>El mercado aún no está disponible para su edificio</b>Consulte con Bramar.</div></div>'; return; }
    if(vista==='form') return; pintar();
    cargar().then(pintar).catch(function(e){ r.innerHTML='<div class="mk"><div class="mk-empty"><b>'+(e.message==='codigo'?'El mercado aún no está disponible para su edificio':'No se pudo cargar el mercado')+'</b>'+(e.message==='codigo'?'Consulte con Bramar.':'Revise su conexión e intente de nuevo.')+'</div></div>'; }); }
  function vigilar(){ var sec=document.getElementById('mk'); if(!sec) return setTimeout(vigilar,300); var abierto=false;
    new MutationObserver(function(){ var on=sec.classList.contains('m-open'); if(on&&!abierto) alAbrir(); abierto=on; }).observe(sec,{attributes:true,attributeFilter:['class']}); }
  vigilar();
})();
