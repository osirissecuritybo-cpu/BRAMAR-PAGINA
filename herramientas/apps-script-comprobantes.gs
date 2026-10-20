/**
 * BRAMAR · Servidor del portal de copropietarios
 * ---------------------------------------------------------------
 * 1. Comprobantes: guarda cada uno en Google Drive, ordenado así:
 *      Comprobantes Bramar / EDIFICIO / 2026-10 Octubre / Depto 2B / archivo
 *    y lo anota en la hoja "Registro de comprobantes".
 *    En la columna "Estado" elija Pendiente de verificar / Verificado / Rechazado:
 *    el propietario ve ese estado al instante en su portal ("Mis comprobantes").
 *    Desde Gestión LUKA ("Comprobantes del portal") también se pueden ver los
 *    pendientes y marcarlos como verificados o rechazados. LUKA usa una clave
 *    de administración: ejecute una vez crearClaveAdmin() y copie la clave
 *    que aparece en el registro de ejecución.
 *    Cada comprobante nuevo se avisa por correo (solo el enlace, sin adjunto)
 *    a las direcciones de la propiedad CORREOS_AVISO (por defecto Bramar).
 * 2. Contraseñas personales: guarda, por departamento, el código
 *    original cifrado con la contraseña del propietario. Este servidor
 *    nunca recibe ni la contraseña ni el código en texto legible.
 *    Para "resetear" la contraseña de alguien, borre su fila en la
 *    pestaña "Accesos" de la hoja: podrá volver a entrar con su código.
 *
 * 3. Gestión LUKA en la nube: usuarios con clave, y los datos de cada edificio
 *    guardados como archivo en la carpeta "LUKA Datos" de este Drive, para usar
 *    LUKA desde la computadora y el celular con la misma información.
 *
 * INSTALACIÓN (una sola vez, con la cuenta bramargroupsrl@gmail.com):
 * 1. Entre a https://script.google.com y cree un "Proyecto nuevo".
 * 2. Borre el contenido y pegue todo este archivo. Guarde.
 * 3. Menú "Implementar" → "Nueva implementación" → tipo "Aplicación web".
 *      - Ejecutar como: Yo
 *      - Quién tiene acceso: Cualquier usuario
 *    Presione "Implementar" y autorice los permisos que pide Google.
 * 4. Copie la "URL de la aplicación web" (termina en /exec) y péguela en
 *    copropietarios.html, en PORTAL.endpoint.
 * 5. Pruebe enviando un comprobante desde el portal: aparecerá la carpeta
 *    "Comprobantes Bramar" en su Drive y la hoja con el registro.
 *
 * Si cambia este código, use "Implementar" → "Administrar implementaciones"
 * → editar → "Nueva versión", para mantener la misma URL.
 */

const CARPETA_RAIZ = 'Comprobantes Bramar';
const HOJA_REGISTRO = 'Registro de comprobantes';
const MAX_BYTES = 10 * 1024 * 1024;
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.action === 'setPassword') return setPassword_(d);
    if (d.action === 'pendientes') return pendientes_(d);
    if (d.action === 'estado') return cambiarEstado_(d);
    if (d.action === 'archivo') return verArchivo_(d);
    if (String(d.action || '').indexOf('lk_') === 0) return luka_(d);
    if (String(d.action || '').indexOf('pt_') === 0) return portal_(d);
    if (!d.data || !d.filename) return json({ ok: false, error: 'Falta el archivo.' });
    if (TIPOS.indexOf(d.mimeType) === -1) return json({ ok: false, error: 'Tipo de archivo no permitido.' });
    const bytes = Utilities.base64Decode(d.data);
    if (bytes.length > MAX_BYTES) return json({ ok: false, error: 'El archivo es demasiado grande.' });

    const ahora = new Date();
    const edificio = carpetaEdificio_(d.edificio_id, d.edificio);
    const mes = carpeta_(edificio, Utilities.formatDate(ahora, 'America/La_Paz', 'yyyy-MM') + ' ' + MESES[Number(Utilities.formatDate(ahora, 'America/La_Paz', 'M')) - 1]);
    let depto = carpeta_(mes, 'Depto ' + limpiar_(d.depto || 'sin número'));
    if (d.tipo === 'alquiler') depto = carpeta_(depto, 'Alquileres y otros');
    const fecha = Utilities.formatDate(ahora, 'America/La_Paz', 'yyyy-MM-dd HH.mm');
    const nombre = `${fecha} · ${limpiar_(d.filename)}`;
    const archivo = depto.createFile(Utilities.newBlob(bytes, d.mimeType, nombre));

    const sh = registro_();
    sh.appendRow([
      ahora, d.edificio || '', d.depto || '', d.propietario || '',
      d.monto || '', d.fecha || '', (d.tipo === 'alquiler' ? '[Alquiler] ' : '') + (d.nota || ''), archivo.getUrl(), 'Pendiente de verificar',
      /^[0-9a-f]{48}$/.test(d.rk || '') ? d.rk : '',
      String(d.edificio_id || '').slice(0, 60),
      d.tipo === 'alquiler' && /^[0-9a-f]{16}$/.test(d.reserva_id || '') ? d.reserva_id : ''
    ]);
    if (sh.getRange(1, 12).getValue() === '') { sh.getRange(1, 12).setValue('reserva_id'); sh.hideColumns(12); }
    sh.getRange(sh.getLastRow(), 9).setDataValidation(validacionEstado_());
    if (d.tipo === 'alquiler' && /^[0-9a-f]{16}$/.test(d.reserva_id || '')) {
      try { const hr = ptHojaRes_(), fr = hr.getRange('A:A').createTextFinder(d.reserva_id).matchEntireCell(true).findNext(); if (fr) hr.getRange(fr.getRow(), 24).setValue(archivo.getUrl()); } catch (x) {}
    }
    avisarComprobante_(d, archivo.getUrl());
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/** Ejecute esta función una vez desde el editor: autoriza los permisos y crea la hoja. */
function instalar() {
  const sh = registro_(); accesos_(); preparar_(sh);
  Logger.log('Listo. Hoja de registro: ' + sh.getParent().getUrl());
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'alias') return getAlias_(p.id);
  if (p.action === 'recibos') return getRecibos_(p.rk);
  return json({ ok: true, servicio: 'Portal Bramar' });
}

/* ---------- Estado de comprobantes ---------- */
const ESTADOS = ['Pendiente de verificar', 'Verificado', 'Rechazado'];
function validacionEstado_() {
  return SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).setAllowInvalid(false).build();
}
/** Agrega las columnas ocultas "clave" y "edificio_id" y la lista desplegable de Estado (se ejecuta con instalar). */
function preparar_(sh) {
  if (!sh.getRange(1, 10).getValue()) sh.getRange(1, 10).setValue('clave');
  if (!sh.getRange(1, 11).getValue()) sh.getRange(1, 11).setValue('edificio_id');
  const n = Math.max(sh.getMaxRows() - 1, 1);
  sh.getRange(2, 9, n, 1).setDataValidation(validacionEstado_());
  sh.hideColumns(10, 2);
}
function freno_() {
  const cache = CacheService.getScriptCache(), k = 'q' + Math.floor(Date.now() / 60000);
  const n = Number(cache.get(k) || 0) + 1; cache.put(k, String(n), 120);
  return n > 600;
}
function fecha_(v) {
  return v instanceof Date ? Utilities.formatDate(v, 'America/La_Paz', 'yyyy-MM-dd') : String(v || '');
}
function getRecibos_(rk) {
  if (!/^[0-9a-f]{48}$/.test(rk || '')) return json({ ok: false });
  if (freno_()) return json({ ok: false, error: 'Demasiadas consultas, espere un minuto.' });
  const sh = registro_();
  const celdas = sh.getRange('J:J').createTextFinder(rk).matchEntireCell(true).findAll();
  const recibos = celdas.map(function (c) {
    const r = sh.getRange(c.getRow(), 1, 1, 9).getValues()[0];
    return { recibido: fecha_(r[0]), monto: String(r[4] || ''), fecha: fecha_(r[5]), estado: String(r[8] || '') };
  }).reverse();
  return json({ ok: true, recibos: recibos });
}


/* Ejecutar UNA vez desde el editor (Ejecutar → limpiarPruebas).
   Saca de la vista las pruebas hechas antes de que se cargaran los datos reales:
   · comprobantes y solicitudes de reserva del portal recibidos antes de CORTE (y todo lo del edificio "prueba")
     → se MUEVEN a hojas "Archivo pruebas …" (no se pierden, se pueden revisar)
   · en LUKA, las reservas creadas antes de CORTE y los movimientos del diario que generaron. */
function limpiarPruebas() {
  const CORTE = '2026-10-20';
  const ss = registro_().getParent();
  function archivar(sh, colFecha, colEd, colEdNombre, nombreArch) {
    const n = sh.getLastRow(); if (n < 2) return 0;
    const cols = sh.getLastColumn(), vals = sh.getRange(2, 1, n - 1, cols).getValues();
    const borrar = [];
    vals.forEach(function (r, i) {
      const f = fecha_(r[colFecha]).slice(0, 10), ed = slug_(r[colEd] || r[colEdNombre]);
      if ((f && f < CORTE) || ed === 'prueba') borrar.push(i + 2);
    });
    if (!borrar.length) return 0;
    let arch = ss.getSheetByName(nombreArch);
    if (!arch) { arch = ss.insertSheet(nombreArch); arch.getRange(1, 1, 1, cols).setValues(sh.getRange(1, 1, 1, cols).getValues()); }
    const filas = borrar.map(function (f) { return vals[f - 2]; });
    arch.getRange(arch.getLastRow() + 1, 1, filas.length, cols).setValues(filas);
    borrar.slice().reverse().forEach(function (f) { sh.deleteRow(f); });
    return borrar.length;
  }
  const nComp = archivar(registro_(), 0, 10, 1, 'Archivo pruebas · comprobantes');
  const nRes = archivar(ptHojaRes_(), 1, 2, 3, 'Archivo pruebas · reservas');
  // LUKA: reservas de prueba (creadas antes del corte) y sus movimientos en el diario
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let nLuka = 0, nMov = 0;
  try {
    const E = lkEdificios_(), now = new Date().toISOString();
    Object.keys(E).forEach(function (id) {
      const e = E[id]; if (!e || !e.file) return;
      let data; try { data = JSON.parse(DriveApp.getFileById(e.file).getBlob().getDataAsString()); } catch (x) { return; }
      const R = data.reservasSociales || [];
      const fuera = R.filter(function (x) { return x && x.creado && String(x.creado).slice(0, 10) < CORTE; });
      if (!fuera.length) return;
      const ids = {}; fuera.forEach(function (x) { ids[x.id] = 1; });
      data.reservasSociales = R.filter(function (x) { return !(x && ids[x.id]); });
      const antes = (data.diario || []).length;
      data.diario = (data.diario || []).filter(function (m) { return !(m && m.reservaId && ids[m.reservaId]); });
      nMov += antes - data.diario.length; nLuka += fuera.length;
      const txt = JSON.stringify(data);
      DriveApp.getFileById(e.file).setContent(txt);
      e.v = e.v + 1; e.upd = now; e.by = 'Limpieza de pruebas'; e.dev = 'limpieza';
      lkCachePut_(e, txt);
      Logger.log(e.name + ': ' + fuera.length + ' reserva(s) de prueba quitadas');
    });
    lkEscribir_('LUKA_EDIFICIOS', E);
  } finally { lock.releaseLock(); }
  Logger.log('Comprobantes archivados: ' + nComp + ' · Solicitudes de reserva archivadas: ' + nRes + ' · Reservas LUKA quitadas: ' + nLuka + ' · Movimientos del diario quitados: ' + nMov);
}
/* ---------- Administración desde Gestión LUKA ---------- */
/** Ejecute una vez: crea la clave de administración y la muestra en el registro. */
function crearClaveAdmin() {
  const props = PropertiesService.getScriptProperties();
  let k = props.getProperty('CLAVE_ADMIN');
  if (!k) { k = Utilities.getUuid().replace(/-/g, ''); props.setProperty('CLAVE_ADMIN', k); }
  Logger.log('Clave de administración para Gestión LUKA: ' + k);
}
function esAdmin_(k, t, edificioId) {
  const real = PropertiesService.getScriptProperties().getProperty('CLAVE_ADMIN');
  if (real && k && String(k) === real) return true;
  // o una sesión de LUKA con acceso a ese edificio
  const u = t ? sesion_(t) : null;
  return !!u && (!edificioId || puedeVer_(u, edificioId));
}
function slug_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
}
function pendientes_(d) {
  if (!esAdmin_(d.k, d.t)) return json({ ok: false, error: 'Clave de administración incorrecta.' });
  const sh = registro_(), last = sh.getLastRow();
  if (last < 2) return json({ ok: true, recibos: [], otros: [] });
  // Cada comprobante guarda el id del edificio del portal (columna K). Los más
  // antiguos no lo tienen: para ellos se compara el nombre del edificio.
  // "otros" cuenta los pendientes de los demás edificios, para avisar en LUKA.
  // solo las filas pendientes (con muchas filas, leer toda la hoja se vuelve lento)
  const cols = Math.max(11, Math.min(12, sh.getLastColumn())), id = slug_(d.edificio_id || d.edificio), out = [], otros = {};
  const pend = sh.getRange(2, 9, last - 1, 1).createTextFinder('Pendiente de verificar').matchEntireCell(true).findAll().map(function (c) { return c.getRow(); });
  let filas, nums;
  if (pend.length > 60) { filas = sh.getRange(2, 1, last - 1, cols).getValues(); nums = filas.map(function (_, i) { return i + 2; }); }
  else { filas = pend.map(function (n) { return sh.getRange(n, 1, 1, cols).getValues()[0]; }); nums = pend; }
  const usr = d.t ? sesion_(d.t) : null;
  filas.forEach(function (r, j) { const i = nums[j] - 2;
    if (String(r[8]) !== 'Pendiente de verificar') return;
    const rid = r[10] ? slug_(r[10]) : slug_(r[1]);
    if (usr && !puedeVer_(usr, rid) && !lkVinculado_(usr, rid)) return;
    if (id && rid !== id) {
      if (!otros[rid]) otros[rid] = { edificio_id: rid, edificio: String(r[1]), n: 0 };
      otros[rid].n++;
      return;
    }
    out.push({ fila: i + 2, edificio_id: rid, recibido: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), edificio: String(r[1]),
      depto: String(r[2]), propietario: String(r[3]), monto: String(r[4] || ''), fecha: fecha_(r[5]), nota: String(r[6] || ''), archivo: String(r[7] || ''), reserva_id: String(r[11] || '') });
  });
  return json({ ok: true, recibos: out, otros: Object.keys(otros).map(function (k) { return otros[k]; }) });
}
/* LUKA: ver y descargar un comprobante sin salir del programa.
   Solo archivos registrados por el portal (comprobantes y QR de garantía). */
function verArchivo_(d) {
  if (!esAdmin_(d.k, d.t)) return json({ ok: false, error: 'Sin acceso.' });
  const url = String(d.archivo || ''), m = url.match(/\/d\/([\w-]{20,})|[?&]id=([\w-]{20,})/);
  if (!m) return json({ ok: false, error: 'Archivo no válido.' });
  const id = m[1] || m[2];
  const enRegistro = registro_().getRange('H:H').createTextFinder(id).findNext() ||
    ptHojaRes_().getRange('X:Z').createTextFinder(id).findNext();
  if (!enRegistro) return json({ ok: false, error: 'Archivo no registrado.' });
  const f = DriveApp.getFileById(id), b = f.getBlob();
  if (b.getBytes().length > 12 * 1024 * 1024) return json({ ok: false, error: 'El archivo es muy grande para verlo aquí.', url: url });
  return json({ ok: true, nombre: f.getName(), mime: b.getContentType(), data: Utilities.base64Encode(b.getBytes()) });
}
function cambiarEstado_(d) {
  if (!esAdmin_(d.k, d.t)) return json({ ok: false, error: 'Clave de administración incorrecta.' });
  if (ESTADOS.indexOf(d.estado) === -1) return json({ ok: false, error: 'Estado no válido.' });
  const sh = registro_(), fila = Number(d.fila);
  if (!(fila >= 2 && fila <= sh.getLastRow())) return json({ ok: false, error: 'No se encontró el comprobante.' });
  // se confirma que la fila sigue siendo el mismo comprobante (por si alguien movió filas)
  if (String(sh.getRange(fila, 8).getValue()) !== String(d.archivo || '')) return json({ ok: false, error: 'La hoja cambió; actualice la lista.' });
  sh.getRange(fila, 9).setValue(d.estado);
  return json({ ok: true });
}

/* ---------- Contraseñas personales ---------- */
function accesos_() {
  const ss = registro_().getParent();
  return ss.getSheetByName('Accesos') || (function () {
    const sh = ss.insertSheet('Accesos');
    sh.appendRow(['alias', 'clave_cifrada', 'edificio_id', 'depto', 'actualizado']);
    sh.setFrozenRows(1);
    return sh;
  })();
}
function setPassword_(d) {
  if (!/^[0-9a-f]{48}$/.test(d.alias || '') || !d.blob || !d.blob.ct) return json({ ok: false, error: 'Datos inválidos.' });
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = accesos_(), rows = sh.getDataRange().getValues();
    // una sola contraseña personal por departamento: borra la anterior
    for (let i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][2]) === String(d.edificio_id) && String(rows[i][3]) === String(d.depto)) sh.deleteRow(i + 1);
    }
    sh.appendRow([d.alias, JSON.stringify(d.blob), String(d.edificio_id || ''), String(d.depto || ''), new Date()]);
    return json({ ok: true });
  } finally { lock.releaseLock(); }
}
function getAlias_(id) {
  if (!/^[0-9a-f]{48}$/.test(id || '')) return json({ ok: false });
  // freno básico contra intentos masivos: máximo 600 consultas por minuto
  if (freno_()) return json({ ok: false, error: 'Demasiados intentos, espere un minuto.' });
  const f = accesos_().getRange('A:A').createTextFinder(id).matchEntireCell(true).findNext();
  if (!f) return json({ ok: false });
  return json({ ok: true, blob: JSON.parse(accesos_().getRange(f.getRow(), 2).getValue()) });
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function carpeta_(padre, nombre) {
  // las carpetas se recuerdan 6 h: subir un comprobante no tiene que buscarlas cada vez
  const c = CacheService.getScriptCache(), k = 'cf_' + padre.getId() + '_' + Utilities.base64EncodeWebSafe(Utilities.newBlob(nombre).getBytes()).slice(0, 150);
  const id = c.get(k);
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  const it = padre.getFoldersByName(nombre), f = it.hasNext() ? it.next() : padre.createFolder(nombre);
  c.put(k, f.getId(), 21600); return f;
}
/* Carpeta de Drive de cada edificio: la que se configuró en LUKA (Correos y Drive) o
   «Comprobantes Bramar / EDIFICIO». Si se indicaron correos de almacenamiento, la carpeta
   queda compartida con ellos (la ven en su Drive, separada de los demás edificios). */
/* correo de la cuenta dueña del servidor (sin pedir permisos extra a Google) */
function lkCuentaServidor_() {
  const P = PropertiesService.getScriptProperties(); let c = P.getProperty('CUENTA_SERVIDOR');
  if (c) return c;
  try { c = DriveApp.getRootFolder().getOwner().getEmail(); } catch (e) { c = ''; }
  if (c) P.setProperty('CUENTA_SERVIDOR', c);
  return c;
}
function lkEntrada_(portalId) {
  const id = slug_(portalId), E = lkEdificios_();
  const k = Object.keys(E).filter(function (x) { return (E[x].portal || slug_(E[x].name)) === id; })
    .sort(function (x, y) { return ((E[y].res || {}).deptos || 0) - ((E[x].res || {}).deptos || 0); })[0];
  return k ? E[k] : null;
}
function carpetaEdificio_(portalId, nombre) {
  const e = portalId ? lkEntrada_(portalId) : null;
  if (e && e.carpeta) { try { return DriveApp.getFolderById(e.carpeta); } catch (x) {} }
  return carpeta_(carpeta_(DriveApp.getRootFolder(), CARPETA_RAIZ), limpiar_((e && e.name) || nombre || portalId || 'Sin edificio'));
}
function limpiar_(s) { return String(s || '').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80); }
function registro_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('HOJA_ID'), ss;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(HOJA_REGISTRO);
    ss.getSheets()[0].appendRow(['Recibido', 'Edificio', 'Depto', 'Propietario', 'Monto', 'Fecha del pago', 'Nota', 'Archivo', 'Estado', 'clave', 'edificio_id']);
    ss.getSheets()[0].setFrozenRows(1);
    preparar_(ss.getSheets()[0]);
    props.setProperty('HOJA_ID', ss.getId());
    DriveApp.getFileById(ss.getId()).moveTo(carpeta_(DriveApp.getRootFolder(), CARPETA_RAIZ));
  }
  return ss.getSheets()[0];
}

/* ============================================================================
   AVISO POR CORREO DE CADA COMPROBANTE
   ============================================================================ */
const LUKA_URL = 'https://osirissecuritybo-cpu.github.io/BRAMAR-PAGINA/luka/';
function avisarComprobante_(d, url) {
  try {
    const to = destinatarios_(d.edificio_id || d.edificio);
    if (!to) return;
    const monto = d.monto ? 'Bs ' + d.monto : 'monto no indicado';
    const asunto = 'Comprobante · ' + (d.edificio || '') + ' · Depto ' + (d.depto || '') + ' · ' + monto;
    const esc = function (x) { return String(x || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    const html = '<div style="font-family:Arial,sans-serif;font-size:15px;color:#0B2440">' +
      '<p><b>' + esc(d.propietario) + '</b> envió un comprobante desde el portal.</p>' +
      '<table cellpadding="4" style="font-size:15px">' +
      '<tr><td style="color:#7d93ab">Edificio</td><td><b>' + esc(d.edificio) + '</b></td></tr>' +
      '<tr><td style="color:#7d93ab">Depto</td><td><b>' + esc(d.depto) + '</b></td></tr>' +
      '<tr><td style="color:#7d93ab">Monto</td><td><b>' + esc(monto) + '</b></td></tr>' +
      '<tr><td style="color:#7d93ab">Fecha del pago</td><td>' + esc(d.fecha || '—') + '</td></tr>' +
      (d.nota ? '<tr><td style="color:#7d93ab">Nota</td><td>' + esc(d.nota) + '</td></tr>' : '') +
      '</table><p><a href="' + url + '">Ver el comprobante</a> &nbsp;·&nbsp; <a href="' + LUKA_URL + '">Abrir Gestión LUKA</a></p>' +
      '<p style="color:#7d93ab;font-size:13px">Revíselo y regístrelo en LUKA. El propietario verá «Verificado» al instante.</p></div>';
    MailApp.sendEmail({ to: to, subject: asunto, htmlBody: html, name: 'Portal Bramar' });
  } catch (e) { /* el comprobante ya quedó guardado aunque el correo falle */ }
}
/** Ejecute una vez para autorizar el envío de correos y probarlo. */
/* Ejecutar UNA vez desde el editor para dar permiso de "conectarse a un servicio externo"
   (lo usa el portal para comprobar los códigos antiguos generados con el Excel). */
function autorizarPortal() { Logger.log(UrlFetchApp.fetch(SITIO + 'data/edificios.json').getResponseCode()); }

function probarCorreo() {
  avisarComprobante_({ edificio: 'PRUEBA', depto: '0X', propietario: 'Prueba de aviso', monto: '1', fecha: '2026-01-01' }, LUKA_URL);
  Logger.log('Correo de prueba enviado a ' + (PropertiesService.getScriptProperties().getProperty('CORREOS_AVISO') || 'bramargroupsrl@gmail.com'));
}

/* ============================================================================
   GESTIÓN LUKA EN LA NUBE
   · Usuarios: propiedad LUKA_USERS (la clave se guarda como hash con sal).
   · Sesiones: propiedad T_<token>, válidas 60 días.
   · Edificios: propiedad LUKA_EDIFICIOS + un archivo .json por edificio en
     la carpeta "LUKA Datos". Cada guardado sube la versión; si otro dispositivo
     guardó antes, se avisa (conflicto) para no pisar cambios.
   ============================================================================ */
const LK_CARPETA = 'LUKA Datos', LK_DIAS = 60;
function lkProps_() { return PropertiesService.getScriptProperties(); }
function lkLeer_(k, def) { try { const v = lkProps_().getProperty(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
function lkEscribir_(k, v) { lkProps_().setProperty(k, JSON.stringify(v)); }
function lkHash_(salt, clave) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + clave, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function lkUsuarios_() { return lkLeer_('LUKA_USERS', []); }
function lkPublico_(u) { return { usuario: u.u, nombre: u.n, correo: u.mail || '', rol: u.rol, edificios: u.eds, activo: u.activo !== false }; }
function lkCorreoValido_(c) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(c || '').trim()); }
function lkToken_(u) {
  const t = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  lkProps_().setProperty('T_' + t, JSON.stringify({ u: u.u, exp: Date.now() + LK_DIAS * 864e5 }));
  // limpieza de sesiones vencidas
  const all = lkProps_().getProperties(), now = Date.now();
  Object.keys(all).forEach(function (k) { if (k.indexOf('T_') === 0) { try { if (JSON.parse(all[k]).exp < now) lkProps_().deleteProperty(k); } catch (e) {} } });
  return t;
}
function sesion_(t) {
  if (!/^[0-9a-f]{64}$/.test(t || '')) return null;
  const s = lkLeer_('T_' + t, null);
  if (!s || s.exp < Date.now()) return null;
  const u = lkUsuarios_().filter(function (x) { return x.u === s.u && x.activo !== false; })[0];
  return u || null;
}
function puedeVer_(u, id) { return u.rol === 'admin' || (u.eds || []).indexOf('*') >= 0 || (u.eds || []).indexOf(id) >= 0; }
function lkCarpeta_() { return carpeta_(DriveApp.getRootFolder(), LK_CARPETA); }
function lkEdificios_() { return lkLeer_('LUKA_EDIFICIOS', {}); }

function luka_(d) {
  const a = d.action;
  if (a === 'lk_estado') return json({ ok: true, hayUsuarios: lkUsuarios_().length > 0 });
  if (a === 'lk_bootstrap') {
    if (lkUsuarios_().length) return json({ ok: false, error: 'Ya existe un administrador. Ingrese con su usuario.' });
    if (!esAdmin_(d.k)) return json({ ok: false, error: 'Clave de administración incorrecta.' });
    const u = lkNuevo_(d.usuario || d.correo, d.nombre, d.clave, 'admin', ['*'], d.correo);
    if (u.error) return json({ ok: false, error: u.error });
    lkEscribir_('LUKA_USERS', [u]);
    return json({ ok: true, token: lkToken_(u), usuario: lkPublico_(u) });
  }
  if (a === 'lk_login') {
    if (freno_()) return json({ ok: false, error: 'Demasiados intentos, espere un minuto.' });
    const q = String(d.usuario || '').trim().toLowerCase();
    const u = lkUsuarios_().filter(function (x) { return x.u === q || (x.mail && x.mail === q); })[0];
    if (!u || u.activo === false || lkHash_(u.salt, String(d.clave || '')) !== u.hash) return json({ ok: false, error: 'Usuario o clave incorrectos.' });
    lkLog_(u, '', 'Ingresó', '');
    return json({ ok: true, token: lkToken_(u), usuario: lkPublico_(u) });
  }
  const u = sesion_(d.t);
  if (!u) return json({ ok: false, sesion: false, error: 'La sesión venció. Vuelva a ingresar.' });
  if (a === 'lk_me') return json({ ok: true, usuario: lkPublico_(u) });
  if (a === 'lk_mi_clave') {
    if (lkHash_(u.salt, String(d.actual || '')) !== u.hash) return json({ ok: false, error: 'La clave actual no es correcta.' });
    if (String(d.nueva || '').length < 6) return json({ ok: false, error: 'La nueva clave debe tener al menos 6 caracteres.' });
    const L = lkUsuarios_(), i = L.map(function (y) { return y.u; }).indexOf(u.u);
    L[i].salt = Utilities.getUuid(); L[i].hash = lkHash_(L[i].salt, String(d.nueva));
    lkEscribir_('LUKA_USERS', L); lkLog_(u, '', 'Cambió su clave', ''); return json({ ok: true });
  }
  if (a === 'lk_mi_correo') {
    const c = String(d.correo || '').trim().toLowerCase();
    if (!lkCorreoValido_(c)) return json({ ok: false, error: 'El correo no es válido.' });
    const L = lkUsuarios_();
    if (L.some(function (y) { return y.mail === c && y.u !== u.u; })) return json({ ok: false, error: 'Ese correo ya lo usa otro usuario.' });
    const i = L.map(function (y) { return y.u; }).indexOf(u.u); L[i].mail = c; lkEscribir_('LUKA_USERS', L);
    lkLog_(u, '', 'Cambió su correo', c); return json({ ok: true, usuario: lkPublico_(L[i]) });
  }
  if (a === 'lk_logout') { lkProps_().deleteProperty('T_' + d.t); return json({ ok: true }); }
  if (a === 'lk_edificios') {
    const E = lkEdificios_();
    return json({ ok: true, borrados: lkLeer_('LUKA_BORRADOS', []), edificios: Object.keys(E).filter(function (id) { return puedeVer_(u, id); })
      .map(function (id) { return { id: id, nombre: E[id].name, v: E[id].v, actualizado: E[id].upd, por: E[id].by, creado: E[id].created, resumen: E[id].res || null }; }) });
  }
  if (a === 'lk_pulso') {
    // consulta liviana cada pocos segundos: versión del edificio abierto y firma de la lista de edificios
    const E = lkEdificios_(), ids = Object.keys(E).filter(function (id) { return puedeVer_(u, id); }).sort();
    const firma = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, ids.map(function (id) { return id + '|' + E[id].name; }).join(','), Utilities.Charset.UTF_8)).slice(0, 16);
    const e = d.id ? E[d.id] : null;
    return json({ ok: true, lista: firma, v: e && puedeVer_(u, d.id) ? e.v : 0, por: e ? e.by : '', borrado: !!(d.id && !e && lkLeer_('LUKA_BORRADOS', []).indexOf(d.id) >= 0) });
  }
  if (a === 'lk_version') {
    const e = lkEdificios_()[d.id];
    if (!e || !puedeVer_(u, d.id)) return json({ ok: false, error: 'Edificio no encontrado.' });
    return json({ ok: true, v: e.v, actualizado: e.upd, por: e.by });
  }
  if (a === 'lk_cargar') {
    const e = lkEdificios_()[d.id];
    if (!e || !puedeVer_(u, d.id)) return json({ ok: false, error: 'Edificio no encontrado.' });
    return json({ ok: true, v: e.v, data: lkDatosTxt_(e) });
  }
  if (a === 'lk_guardar') {
    if (!/^[A-Za-z0-9_-]{2,40}$/.test(d.id || '')) return json({ ok: false, error: 'Edificio inválido.' });
    if (typeof d.data !== 'string' || !d.data) return json({ ok: false, error: 'Sin datos.' });
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const E = lkEdificios_(), e = E[d.id], now = new Date().toISOString();
      if (!e) {
        if (u.rol !== 'admin') return json({ ok: false, error: 'Solo un coordinador general puede crear edificios.' });
        if (lkLeer_('LUKA_BORRADOS', []).indexOf(d.id) >= 0) return json({ ok: false, borrado: true, error: 'Este edificio fue eliminado.' });
        const f = lkCarpeta_().createFile(Utilities.newBlob(d.data, 'application/json', limpiar_(d.nombre || d.id) + ' (' + d.id + ').json'));
        E[d.id] = { name: String(d.nombre || d.id).slice(0, 80), file: f.getId(), v: 1, upd: now, by: u.n, dev: String(d.dev || '').slice(0, 40), created: now, portal: d.portal ? slug_(d.portal) : '' };
        lkLog_(u, E[d.id].name, 'Creó el edificio', '');
      } else {
        if (!puedeVer_(u, d.id)) return json({ ok: false, error: 'Sin acceso a este edificio.' });
        // si la versión no coincide, alguien (otro equipo u OTRA PESTAÑA del mismo) guardó antes:
        // el cliente une los cambios. Nunca se pisa una versión más nueva con una copia vieja.
        if (Number(d.v) !== Number(e.v)) return json({ ok: false, conflicto: true, v: e.v, por: e.by, actualizado: e.upd, error: 'Otro dispositivo guardó cambios antes.' });
        // protección: un guardado sin departamentos nunca reemplaza un edificio que sí los tiene
        if (!d.forzarVacio && ((e.res || {}).deptos || 0) > 0 && d.resumen && !(+d.resumen.deptos > 0)) {
          let nuevos = 0; try { nuevos = (JSON.parse(d.data).deptos || []).length; } catch (x) {}
          if (!nuevos) return json({ ok: false, vacio: true, error: 'Se evitó guardar el edificio vacío.' });
        }
        DriveApp.getFileById(e.file).setContent(d.data);
        e.v = e.v + 1; e.upd = now; e.by = u.n; e.dev = String(d.dev || '').slice(0, 40); if (d.nombre) e.name = String(d.nombre).slice(0, 80);
        if (d.portal) e.portal = slug_(d.portal);
        lkLogCambios_(u, e.name, d.id, d.notas);
      }
      if (d.resumen && typeof d.resumen === 'object') E[d.id].res = { deptos: +d.resumen.deptos || 0, alDia: +d.resumen.alDia || 0, deuda: +d.resumen.deuda || 0, mora: +d.resumen.mora || 0 };
      lkEscribir_('LUKA_EDIFICIOS', E);
      lkCachePut_(E[d.id], d.data);
      return json({ ok: true, v: E[d.id].v });
    } finally { lock.releaseLock(); }
  }
  if (a === 'lk_reservas') {
    if (!puedeVer_(u, d.id)) return json({ ok: false, error: 'Sin acceso a este edificio.' });
    const e = lkEdificios_()[d.id]; if (!e) return json({ ok: true, reservas: [] });
    const pid = e.portal || slug_(e.name);
    return json({ ok: true, reservas: ptReservasLista_(function (r) { return r.edificio_id === pid && (d.todas || r.estado === 'Pendiente'); }),
      garantias: ptReservasLista_(function (r) { return r.edificio_id === pid && r.garEstado === 'Solicitada'; }) });
  }
  if (a === 'lk_garantia_devuelta') {
    const sh = ptHojaRes_(), f = sh.getRange('A:A').createTextFinder(String(d.rid || '')).matchEntireCell(true).findNext();
    if (!f) return json({ ok: false, error: 'Solicitud no encontrada.' });
    const row = sh.getRange(f.getRow(), 1, 1, 9).getValues()[0];
    const E = lkEdificios_(), ok = Object.keys(E).some(function (k) { return (E[k].portal || slug_(E[k].name)) === row[2] && puedeVer_(u, k); });
    if (!ok) return json({ ok: false, error: 'Sin acceso a este edificio.' });
    sh.getRange(f.getRow(), 25).setValue('Devuelta');
    lkLog_(u, String(row[3]), 'Devolvió una garantía', 'Depto ' + row[4] + ' · ' + row[6] + ' · ' + fecha_(row[8]));
    return json({ ok: true });
  }
  if (a === 'lk_reserva_estado') {
    const sh = ptHojaReservas_(), f = sh.getRange('A:A').createTextFinder(String(d.rid || '')).matchEntireCell(true).findNext();
    if (!f || ['Aprobada', 'Rechazada'].indexOf(d.estado) < 0) return json({ ok: false, error: 'Solicitud no encontrada.' });
    const row = sh.getRange(f.getRow(), 1, 1, 15).getValues()[0];
    const E = lkEdificios_(), ok = Object.keys(E).some(function (k) { return (E[k].portal || slug_(E[k].name)) === row[2] && puedeVer_(u, k); });
    if (!ok) return json({ ok: false, error: 'Sin acceso a este edificio.' });
    sh.getRange(f.getRow(), 13, 1, 3).setValues([[d.estado, String(d.nota || '').slice(0, 300), u.n]]);
    ptHojaRes_().getRange(f.getRow(), 23).setValue(new Date());
    lkLog_(u, String(row[3]), d.estado === 'Aprobada' ? 'Aprobó una reserva' : 'Rechazó una reserva', 'Depto ' + row[4] + ' · ' + row[6] + ' · ' + fecha_(row[8]));
    return json({ ok: true });
  }
  if (a === 'lk_edificio_cfg') {
    if (!puedeVer_(u, d.id)) return json({ ok: false, error: 'Sin acceso a este edificio.' });
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const E = lkEdificios_(), e = E[d.id]; if (!e) return json({ ok: false, error: 'Guarde primero el edificio en la nube.' });
      if (d.guardar) {
        const lista = function (t) { return String(t || '').toLowerCase().split(/[\s,;]+/).map(function (c) { return c.trim(); }).filter(function (c) { return c && c !== 'y' && c !== 'u' && c !== 'o'; }); };
        const av = lista(d.avisos); let dr = lista(d.drive); const malos = av.concat(dr).filter(function (c) { return !lkCorreoValido_(c); });
        if (malos.length) return json({ ok: false, error: 'Correo no válido: ' + malos.join(', ') });
        let carpeta = '';
        const m = String(d.carpeta || '').match(/[-\w]{25,}/);
        if (m && u.rol === 'admin') { try { DriveApp.getFolderById(m[0]).getName(); carpeta = m[0]; } catch (x) { return json({ ok: false, error: 'No tengo acceso a esa carpeta. Compártala como «Editor» con ' + (lkCuentaServidor_() || 'la cuenta de Bramar') + '.' }); } }
        e.avisos = av.join(',');
        // el Drive de comprobantes solo lo define el coordinador general
        if (u.rol === 'admin') { e.drive = dr.join(','); e.carpeta = carpeta; } else { dr = String(e.drive || '').split(',').filter(Boolean); }
        lkEscribir_('LUKA_EDIFICIOS', E);
        let compartida = [];
        if (dr.length && u.rol === 'admin') {
          const f = carpetaEdificio_(e.portal || slug_(e.name), e.name), ya = f.getEditors().map(function (x) { return x.getEmail().toLowerCase(); });
          dr.forEach(function (c) { if (ya.indexOf(c) < 0) { try { f.addEditor(c); compartida.push(c); } catch (x) {} } });
        }
        lkLog_(u, e.name, 'Cambió correos y Drive', 'Avisos: ' + av.join(', ') + ' · Drive: ' + dr.join(', ') + (carpeta ? ' · carpeta propia' : ''));
        return json({ ok: true, avisos: av, drive: dr, carpeta: carpeta, compartida: compartida, url: carpetaEdificio_(e.portal || slug_(e.name), e.name).getUrl() });
      }
      let url = ''; try { url = carpetaEdificio_(e.portal || slug_(e.name), e.name).getUrl(); } catch (x) {}
      return json({ ok: true, avisos: String(e.avisos || '').split(',').filter(Boolean), drive: String(e.drive || '').split(',').filter(Boolean), carpeta: e.carpeta || '', url: url, cuenta: lkCuentaServidor_() });
    } finally { lock.releaseLock(); }
  }
  if (u.rol !== 'admin') return json({ ok: false, error: 'Solo un administrador puede hacer esto.' });
  if (a === 'lk_actividad') {
    const sh = lkHojaLog_(), n = sh.getLastRow();
    if (n < 2) return json({ ok: true, actividad: [] });
    const desde = Math.max(2, n - 499), filas = sh.getRange(desde, 1, n - desde + 1, 5).getValues().reverse();
    return json({ ok: true, actividad: filas.filter(function (r) { return !d.edificio || r[2] === d.edificio; }).slice(0, 300)
      .map(function (r) { return { fecha: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), usuario: String(r[1]), edificio: String(r[2]), accion: String(r[3]), detalle: String(r[4]) }; }) });
  }
  if (a === 'lk_borrar') {
    const E = lkEdificios_(), e = E[d.id]; if (!e) return json({ ok: true });
    lkLog_(u, e.name, 'Borró el edificio', '');
    try { DriveApp.getFileById(e.file).setTrashed(true); } catch (x) {}
    delete E[d.id]; lkEscribir_('LUKA_EDIFICIOS', E); lkBorrado_(d.id); return json({ ok: true });
  }
  if (a === 'lk_avisos') {
    const P = PropertiesService.getScriptProperties();
    if (d.guardar) {
      const lista = String(d.correos || '').split(/[,;\s]+/).map(function (c) { return c.trim().toLowerCase(); }).filter(Boolean);
      const malos = lista.filter(function (c) { return !lkCorreoValido_(c); });
      if (malos.length) return json({ ok: false, error: 'Correo no válido: ' + malos.join(', ') });
      if (!lista.length && d.admins === false) return json({ ok: false, error: 'Ponga al menos un correo o active el aviso a los administradores.' });
      P.setProperty('CORREOS_AVISO', lista.join(','));
      P.setProperty('AVISO_ADMINS', d.admins === false ? 'no' : 'si');
      lkLog_(u, '', 'Cambió los correos de aviso', lista.join(', '));
    }
    if (d.probar) {
      const to = destinatarios_('');
      if (!to) return json({ ok: false, error: 'No hay ningún correo configurado.' });
      MailApp.sendEmail({ to: to, name: 'Portal Bramar', subject: 'Prueba de aviso de comprobantes · Gestión LUKA',
        htmlBody: '<div style="font-family:Arial,sans-serif;font-size:15px;color:#0B2440"><p>Este es un correo de prueba.</p><p>Aquí llegarán los avisos cuando un propietario suba un comprobante de pago o pida una reserva en el portal.</p></div>' });
      return json({ ok: true, enviado: to });
    }
    const fijos = P.getProperty('CORREOS_AVISO');
    return json({ ok: true, correos: fijos === null ? 'bramargroupsrl@gmail.com' : fijos, admins: P.getProperty('AVISO_ADMINS') !== 'no' });
  }
  if (a === 'lk_usuarios') return json({ ok: true, usuarios: lkUsuarios_().map(lkPublico_) });
  if (a === 'lk_usuario_guardar') {
    const L = lkUsuarios_(), x = d.usuario || {}, id = String(x.usuario || x.correo || '').trim().toLowerCase();
    const correo = String(x.correo || '').trim().toLowerCase();
    if (correo && !lkCorreoValido_(correo)) return json({ ok: false, error: 'El correo no es válido.' });
    if (correo && L.some(function (y) { return y.mail === correo && y.u !== id; })) return json({ ok: false, error: 'Ese correo ya está usado por otro usuario.' });
    const i = L.map(function (y) { return y.u; }).indexOf(id);
    const rol = x.rol === 'admin' ? 'admin' : 'operador', eds = Array.isArray(x.edificios) && x.edificios.length ? x.edificios.map(String) : ['*'];
    if (i < 0) {
      const n = lkNuevo_(id, x.nombre, d.clave, rol, eds, correo); if (n.error) return json({ ok: false, error: n.error });
      L.push(n);
    } else {
      if (L[i].u === u.u && rol !== 'admin') return json({ ok: false, error: 'No puede quitarse a usted mismo el rol de administrador.' });
      L[i].n = String(x.nombre || L[i].n).slice(0, 60); L[i].rol = rol; L[i].eds = eds; L[i].activo = x.activo !== false; if (correo) L[i].mail = correo;
      if (d.clave) { if (String(d.clave).length < 6) return json({ ok: false, error: 'La clave debe tener al menos 6 caracteres.' }); L[i].salt = Utilities.getUuid(); L[i].hash = lkHash_(L[i].salt, String(d.clave)); }
    }
    lkLog_(u, '', i < 0 ? 'Creó un usuario' : 'Modificó un usuario', id + ' (' + (rol === 'admin' ? 'Dueño' : 'Administrador de edificio') + ')');
    lkEscribir_('LUKA_USERS', L); return json({ ok: true, usuarios: L.map(lkPublico_) });
  }
  if (a === 'lk_usuario_borrar') {
    lkLog_(u, '', 'Borró un usuario', String(d.usuario));
    if (String(d.usuario) === u.u) return json({ ok: false, error: 'No puede borrarse a usted mismo.' });
    const L = lkUsuarios_().filter(function (y) { return y.u !== String(d.usuario); });
    lkEscribir_('LUKA_USERS', L); return json({ ok: true, usuarios: L.map(lkPublico_) });
  }
  return json({ ok: false, error: 'Acción desconocida.' });
}
/* Edificios eliminados: se recuerdan para que ninguna computadora los vuelva a subir */
function lkBorrado_(id) { const B = lkLeer_('LUKA_BORRADOS', []); if (B.indexOf(id) < 0) B.push(id); lkEscribir_('LUKA_BORRADOS', B.slice(-300)); }
/* Ejecutar desde el editor: elimina los edificios que no tienen departamentos (quedan 30 días en la papelera de Drive) */
function limpiarEdificiosVacios() {
  const E = lkEdificios_();
  Object.keys(E).forEach(function (id) {
    let n = 0; try { n = (JSON.parse(DriveApp.getFileById(E[id].file).getBlob().getDataAsString('UTF-8')).deptos || []).length; } catch (x) {}
    Logger.log((n ? 'QUEDA   ' : 'BORRADO ') + E[id].name + ' (' + id + ') · ' + n + ' deptos');
    if (!n) { try { DriveApp.getFileById(E[id].file).setTrashed(true); } catch (x) {} delete E[id]; lkBorrado_(id); }
  });
  lkEscribir_('LUKA_EDIFICIOS', E);
}
function lkNuevo_(usuario, nombre, clave, rol, eds, correo) {
  usuario = String(usuario || '').trim().toLowerCase(); correo = String(correo || '').trim().toLowerCase();
  if (correo && !lkCorreoValido_(correo)) return { error: 'El correo no es válido.' };
  if (!/^[a-z0-9._@+-]{3,60}$/.test(usuario)) return { error: 'Ingrese un correo válido (o un usuario sin espacios).' };
  if (String(clave || '').length < 6) return { error: 'La clave debe tener al menos 6 caracteres.' };
  if (lkUsuarios_().some(function (x) { return x.u === usuario; })) return { error: 'Ese usuario ya existe.' };
  const salt = Utilities.getUuid();
  if (correo && lkUsuarios_().some(function (x) { return x.mail === correo; })) return { error: 'Ese correo ya está usado por otro usuario.' };
  return { u: usuario, n: String(nombre || usuario).slice(0, 60), mail: correo, rol: rol, eds: eds, salt: salt, hash: lkHash_(salt, String(clave)), activo: true };
}

/* El id del portal y el id de LUKA pueden ser distintos: un usuario de LUKA ve los
   comprobantes del edificio del portal que esté vinculado a un edificio suyo. */
function lkVinculado_(u, portalId) {
  if (u.rol === 'admin' || (u.eds || []).indexOf('*') >= 0) return true;
  const E = lkEdificios_();
  return (u.eds || []).some(function (id) { return E[id] && E[id].portal === portalId; });
}

/* ---------- Bitácora de actividad (pestaña "Actividad LUKA" de la hoja de registro) ---------- */
function lkHojaLog_() {
  const ss = registro_().getParent();
  return ss.getSheetByName('Actividad LUKA') || (function () {
    const sh = ss.insertSheet('Actividad LUKA');
    sh.appendRow(['Fecha', 'Usuario', 'Edificio', 'Acción', 'Detalle']); sh.setFrozenRows(1);
    return sh;
  })();
}
function lkLog_(u, edificio, accion, detalle) {
  try { lkHojaLog_().appendRow([new Date(), u ? u.n + ' (' + u.u + ')' : '', edificio || '', accion, String(detalle || '').slice(0, 300)]); } catch (e) {}
}
/* Cada guardado trae notas de lo que se hizo (pagos, anulaciones…). Si no trae, se anota
   "Actualizó datos" como máximo una vez cada 30 minutos por usuario y edificio. */
function lkLogCambios_(u, nombre, id, notas) {
  if (Array.isArray(notas) && notas.length) { notas.slice(0, 20).forEach(function (n) { lkLog_(u, nombre, String(n.accion || 'Cambio').slice(0, 60), n.detalle || ''); }); return; }
  const c = CacheService.getScriptCache(), k = 'lg_' + u.u + '_' + id;
  if (c.get(k)) return;
  c.put(k, '1', 1800); lkLog_(u, nombre, 'Actualizó datos', '');
}

/* Correos que reciben el aviso de un comprobante: los usuarios de LUKA (activos y con
   correo) que administran ese edificio, los súper administradores y, además, las
   direcciones fijas de la propiedad CORREOS_AVISO (si existe). */
function destinatarios_(portalId) {
  const id = slug_(portalId), E = lkEdificios_(), lista = {};
  const avisarAdmins = PropertiesService.getScriptProperties().getProperty('AVISO_ADMINS') !== 'no';
  const idsLuka = Object.keys(E).filter(function (k) { return E[k].portal === id || slug_(E[k].name) === id; });
  lkUsuarios_().forEach(function (u) {
    if (!avisarAdmins || u.activo === false || !u.mail) return;
    const ve = u.rol === 'admin' || (u.eds || []).indexOf('*') >= 0 || idsLuka.some(function (k) { return (u.eds || []).indexOf(k) >= 0; });
    if (ve) lista[u.mail] = 1;
  });
  idsLuka.forEach(function (k) { String(E[k].avisos || '').split(',').filter(Boolean).forEach(function (c) { lista[c] = 1; }); });
  const fijos = PropertiesService.getScriptProperties().getProperty('CORREOS_AVISO');
  (fijos === null ? 'bramargroupsrl@gmail.com' : fijos).split(/[,;\s]+/).filter(Boolean).forEach(function (c) { lista[c.toLowerCase()] = 1; });
  return Object.keys(lista).join(',');
}

/* ============================================================================
   PORTAL EN LÍNEA (sin Excel): el estado de cuenta, los recibos y las áreas
   reservables se leen de los datos de LUKA del edificio vinculado.
   El propietario se identifica con su código de acceso: el que LUKA guarda en
   «Accesos del portal» o, para los códigos antiguos, el que generó el Excel
   (se comprueba que exista su archivo en el sitio).
   ============================================================================ */
const SITIO = 'https://osirissecuritybo-cpu.github.io/BRAMAR-PAGINA/';
function ptNormCode_(s) { return String(s || '').toUpperCase().replace(/[^0-9A-Z]/g, ''); }
function ptNormDepto_(s) { return String(s == null ? '' : s).toUpperCase().replace(/\s+/g, '').replace(/^DEPTO\.?|^DPTO\.?/, ''); }
function ptHex_(bytes) { return bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); }
function ptLuka_(portalId) {
  const id = slug_(portalId), E = lkEdificios_();
  // si hay varios con el mismo nombre (duplicados), el que tenga departamentos cargados
  const k = Object.keys(E).filter(function (x) { return (E[x].portal || slug_(E[x].name)) === id && E[x].file; })
    .sort(function (x, y) { return ((E[y].res || {}).deptos || 0) - ((E[x].res || {}).deptos || 0); })[0];
  return k ? { id: k, e: E[k] } : null;
}
function ptDatos_(lk) { return JSON.parse(lkDatosTxt_(lk.e)); }
/* Datos de un edificio: se guardan en memoria (6 h) por versión, así el portal y LUKA
   no leen el archivo de Drive en cada consulta. Al guardar cambia la versión. */
function lkCacheKey_(e) { return 'df_' + e.file + '_' + e.v; }
function lkCachePut_(e, t) {
  try {
    const k = lkCacheKey_(e), sz = 45000, n = Math.ceil(t.length / sz); if (n > 80) return;
    const parts = {}; for (let i = 0; i < n; i++) parts[k + '_' + i] = t.substr(i * sz, sz);
    parts[k + '_n'] = String(n); CacheService.getScriptCache().putAll(parts, 21600);
  } catch (x) {}
}
function lkDatosTxt_(e) {
  const c = CacheService.getScriptCache(), k = lkCacheKey_(e), n = +c.get(k + '_n') || 0;
  if (n) { const keys = []; for (let i = 0; i < n; i++) keys.push(k + '_' + i); const m = c.getAll(keys); if (keys.every(function (x) { return m[x] != null; })) return keys.map(function (x) { return m[x]; }).join(''); }
  const t = DriveApp.getFileById(e.file).getBlob().getDataAsString('UTF-8');
  lkCachePut_(e, t); return t;
}
function ptInqHash_(pid, dep, code) { return ptHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'inq|' + pid + '|' + dep + '|' + ptNormCode_(code), Utilities.Charset.UTF_8)); }
function ptInquilino_(pid, dep, code) {
  if (ptNormCode_(code).length < 6) return null;
  const x = lkLeer_('PT_INQ', {})[pid + '|' + dep];
  return x && x.h === ptInqHash_(pid, dep, code) ? x : null;
}
function ptCodigoOk_(portalId, depto, code, data) {
  const c = ptNormCode_(code), dep = ptNormDepto_(depto);
  if (c.length < 6) return false;
  const acc = (((data.config || {}).portal || {}).deptos || {})[dep];
  if (acc && acc.codigo) return ptNormCode_(acc.codigo) === c;
  // código antiguo del Excel: existe su archivo cifrado en el sitio
  const cache = CacheService.getScriptCache(), ck = 'pc_' + ptHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, portalId + '|' + dep + '|' + c)).slice(0, 40);
  if (cache.get(ck)) return true;
  const fid = ptHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(portalId).trim().toLowerCase() + '|' + dep + '|' + c, Utilities.Charset.UTF_8)).slice(0, 40);
  try {
    const r = UrlFetchApp.fetch(SITIO + 'data/u/' + fid + '.json', { muteHttpExceptions: true });
    if (r.getResponseCode() === 200) { cache.put(ck, '1', 21600); return true; }
  } catch (e) { return null; }   // sin permiso de UrlFetch: el portal usa el archivo del sitio
  return false;
}
const PT_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function ptFecha_(v) {
  if (!v) return '';
  const s = String(v), m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  const n = s.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/); if (n) return (n[3].length === 2 ? '20' + n[3] : n[3]) + '-' + ('0' + n[2]).slice(-2) + '-' + ('0' + n[1]).slice(-2);
  return s;
}
function ptEstado_(portalId, lk, data, depto) {
  const dep = ptNormDepto_(depto);
  const d = (data.deptos || []).filter(function (x) { return ptNormDepto_(x.depto) === dep; })[0];
  if (!d) return null;
  const cfg = data.config || {}, acc = ((cfg.portal || {}).deptos || {})[dep] || {};
  const mov = [];
  (d.meses_adeudados || []).forEach(function (m) {
    const mi = PT_MESES.indexOf(m.mes);
    mov.push({ fecha: m.anio ? m.anio + '-' + ('0' + (mi + 1)).slice(-2) + '-01' : '', concepto: 'Expensa ' + (m.mes || '') + ' ' + (m.anio || ''), cargo: +m.monto || 0, abono: 0 });
  });
  if ((+d.ascensor_debt || 0) > 0.005) mov.push({ fecha: '', concepto: 'Cuota extraordinaria ascensor', cargo: +d.ascensor_debt, abono: 0 });
  (d.cargos_extra || []).forEach(function (c) { mov.push({ fecha: ptFecha_(c.fecha), concepto: String(c.nombre || 'Cargo'), cargo: +c.monto || 0, abono: 0 }); });
  (d.pagos_registrados || []).forEach(function (p) {
    mov.push({ fecha: ptFecha_(p.fecha), concepto: String(p.concepto || 'Pago'), cargo: 0, abono: +p.monto || 0,
      // datos crudos del pago: el portal arma el MISMO recibo que LUKA (diseño y QR con su código)
      recibo: { no: String(p.recibo_no || ''), fecha: String(p.fecha || ''), monto: +p.monto || 0, metodo: String(p.metodo || ''), concepto: String(p.concepto || ''),
        obs: String(p.obs || ''), recibido: String(p.recibido || ''), a_nombre: String(p.a_nombre || ''), saldo: +p.saldo_restante || 0,
        meses_pagados: p.meses_pagados || [], meses_cubiertos: p.meses_cubiertos || [], prepagados: (p._anula && p._anula.prepagados) || [] } });
  });
  const deuda = Math.round(((+d.total_debt) || mov.reduce(function (a, m) { return a + m.cargo; }, 0)) * 100) / 100;
  return {
    modo: 'luka',
    edificio: { id: portalId, nombre: cfg.nombreEdificio || lk.e.name, nombreRecibo: cfg.nombreEdificio || 'Gestión LUKA', logo: cfg.logo || '', sello: cfg.sello || '',
      empresa: (cfg.empresaAdmin && String(cfg.empresaAdmin).trim()) || 'Gestión LUKA', moneda: 'Bs',
      // datos de cobro tal como están en LUKA (Configuración → Datos de cobro)
      titular: String(cfg.cuentaTitular || cfg.titular || ''), banco: String(cfg.cuentaBanco || cfg.banco || ''), cuenta: String(cfg.cuentaNumero || cfg.cuentaText || ''),
      tipo_cuenta: String(cfg.cuentaTipo || ''), moneda_cuenta: String(cfg.cuentaMoneda || ''), nit: String(cfg.cuentaNit || cfg.nit || ''), qr: cfg.qr || '' },
    unidad: { depto: d.depto, bloque: String(d.bloque || ''), propietario: acc.propietario || '', expensa: +d.expensaMensual || +cfg.expensaMensual || 0 },
    resumen: { deuda: deuda, vencimiento: '', actualizado: String(lk.e.upd || '').slice(0, 10) },
    movimientos: mov,
    servicios: ptServicios_(cfg),
    areas: ptAreas_(cfg).map(function (a) { return { id: a.id, nombre: a.nombre, garantia: +a.garantia || 0, garantiaInq: a.garantiaInq, tramos: (a.tramos || []).map(function (t) { return { label: t.label, monto: +t.monto || 0, montoInq: t.montoInq }; }) }; })
  };
}
const PT_AREAS_DEF = {
  churrasquera_normal: { label: 'Churrasquera normal', precios: { '10': 50, '+10': 100, '+20': 140 } },
  churrasquera_inox: { label: 'Churrasquera inox.', precios: { '10': 100, '+10': 150, '+20': 190 } },
  salon_social: { label: 'Salón social', precios: { '10': 100, '+10': 150, '+20': 200, '+40': 300 } },
  ch_normal_salon: { label: 'Ch. normal + salón', precios: { '10': 150, '+10': 250, '+20': 340, '+40': 430 } },
  ch_inox_salon: { label: 'Ch. inox + salón', precios: { '10': 200, '+10': 300, '+20': 390, '+40': 480 } }
};
function ptAreas_(cfg) {
  if (Array.isArray(cfg.areasLuka) && cfg.areasLuka.length) return cfg.areasLuka.map(function (a) { return a.tramos ? a : { id: a.id, nombre: a.nombre, garantia: a.garantia, tramos: [{ label: 'General', monto: a.monto || 0 }] }; });
  const src = cfg.areasSociales || PT_AREAS_DEF, gar = (cfg.garantiaAreaSocial && cfg.garantiaAreaSocial.normal) || 300;
  const lab = { '10': 'Hasta 10 personas', '+10': '+10 personas', '+20': '+20 personas', '+40': '+40 personas' };
  return Object.keys(src).map(function (k) { const pr = src[k].precios || {};
    return { id: k, nombre: src[k].label || k, garantia: gar, tramos: Object.keys(pr).filter(function (t) { return pr[t] != null; }).map(function (t) { return { label: lab[t] || t, monto: pr[t] }; }) }; });
}
function ptHojaReservas_() {
  const ss = registro_().getParent();
  return ss.getSheetByName('Reservas portal') || (function () {
    const sh = ss.insertSheet('Reservas portal');
    sh.appendRow(['id', 'Recibida', 'edificio_id', 'Edificio', 'Depto', 'Responsable', 'Área', 'Horario', 'Fecha', 'Inicio', 'Fin', 'Evento', 'Estado', 'Nota de Bramar', 'Atendió', 'Personas', 'Teléfono']);
    sh.setFrozenRows(1); sh.hideColumns(1); sh.hideColumns(3);
    return sh;
  })();
}
const PT_RES_COLS = 26;
function ptHojaRes_() {
  const sh = ptHojaReservas_();
  if (sh.getRange(1, 18).getValue() === '') {
    sh.getRange(1, 18, 1, 5).setValues([['Extras', 'Alquiler Bs', 'Garantía Bs', 'Total Bs', 'extras_json']]);
    sh.hideColumns(22);
  }
  if (sh.getRange(1, 23).getValue() === '') sh.getRange(1, 23, 1, 4).setValues([['Respondida', 'Comprobante de pago', 'Garantía', 'Datos para devolver la garantía']]);
  return sh;
}
/* Carpeta del departamento para alquileres y otros pagos (separada de las expensas) */
function ptCarpetaAlquiler_(edificio, depto, pid) {
  const ahora = new Date(), ed = carpetaEdificio_(pid, edificio);
  const mes = carpeta_(ed, Utilities.formatDate(ahora, 'America/La_Paz', 'yyyy-MM') + ' ' + MESES[Number(Utilities.formatDate(ahora, 'America/La_Paz', 'M')) - 1]);
  return carpeta_(carpeta_(mes, 'Depto ' + limpiar_(depto || 'sin número')), 'Alquileres y otros');
}
function ptHora_(v) { return v instanceof Date ? Utilities.formatDate(v, 'America/La_Paz', 'HH:mm') : String(v || ''); }
function ptTxt_(v) { const t = String(v == null ? '' : v); return t.charAt(0) === '#' ? '' : t; }
/* Servicios extra que el edificio alquila (sillas, mesas, freezer…), como en LUKA */
function ptServicios_(cfg) {
  const s = cfg.servicios || { silla: { nombre: 'Sillas', precio: 2, unidad: 'c/u' }, mesa: { nombre: 'Mesas pequeñas', precio: 3, unidad: 'c/u' }, mesaNueva: { nombre: 'Mesas nuevas 6-8p', precio: 10, unidad: 'c/u' } };
  // «oculto» = quitado en LUKA; «enabled:false» = se presta sin costo
  return Object.keys(s).filter(function (k) { return s[k] && s[k].nombre && s[k].oculto !== true; })
    .map(function (k) { return { id: k, nombre: String(s[k].nombre || k), precio: s[k].enabled === false ? 0 : (+s[k].precio || 0), unidad: String(s[k].unidad || 'c/u') }; });
}
/* Reservas que ya hay ese día (de LUKA y solicitudes pendientes del portal) */
function ptOcupadas_(pid, data, fecha) {
  const out = [];
  (data.reservasSociales || []).forEach(function (x) {
    const f = String(x.fecha || x.inicio || '').slice(0, 10);
    if (f === fecha && x.estado !== 'Cancelada') out.push({ areaId: String(x.areaId || ''), area: String(x.areaNombre || ''), hora: String(x.inicio || '').slice(11, 16), estado: 'Confirmada' });
  });
  ptReservasLista_(function (r) { return r.edificio_id === pid && r.fecha === fecha && r.estado === 'Pendiente'; })
    .forEach(function (r) { out.push({ areaId: r.areaId, area: r.area.replace(/^[^·]*·\s*/, ''), hora: r.hini, estado: 'Pendiente' }); });
  return out;
}
function ptReservasLista_(filtro) {
  const sh = ptHojaRes_(), n = sh.getLastRow(); if (n < 2) return [];
  const cols = Math.min(PT_RES_COLS, sh.getLastColumn());
  return sh.getRange(2, 1, n - 1, cols).getValues().map(function (r) {
    let ex = []; try { ex = JSON.parse(r[21] || '[]'); } catch (e) {}
    return { id: String(r[0]), recibida: r[1] instanceof Date ? r[1].toISOString() : String(r[1]), edificio_id: String(r[2]), edificio: String(r[3]), depto: ptTxt_(r[4]),
      responsable: String(r[5]), areaId: String(r[6]).split(' · ')[0], area: String(r[6]), tramo: ptTxt_(r[7]), fecha: fecha_(r[8]), hini: ptHora_(r[9]), hfin: ptHora_(r[10]),
      evento: String(r[11]), estado: String(r[12] || 'Pendiente'), nota: String(r[13] || ''), personas: ptTxt_(r[15]), telefono: ptTxt_(r[16]),
      respondida: r[22] instanceof Date ? r[22].toISOString() : '', pago: String(r[23] || ''), garEstado: String(r[24] || ''), garDatos: String(r[25] || ''),
      extrasTxt: String(r[17] || ''), alquiler: r[18] === '' || r[18] == null ? null : +r[18], garantia: r[19] === '' || r[19] == null ? null : +r[19], total: r[20] === '' || r[20] == null ? null : +r[20], extras: ex };
  }).filter(filtro).reverse();
}
function portal_(d) {
  if (freno_()) return json({ ok: false, error: 'Demasiadas consultas, espere un minuto.' });
  if (d.action === 'pt_edificios') {
    const E = lkEdificios_(), m = {};
    Object.keys(E).forEach(function (k) { const e = E[k], id = e.portal || slug_(e.name), n = e.res ? +e.res.deptos || 0 : 1;
      if (!e.file || n < 1) return;
      if (!m[id] || n > m[id].n) m[id] = { id: id, nombre: e.name, n: n }; });
    return json({ ok: true, edificios: Object.keys(m).map(function (k) { return { id: m[k].id, nombre: m[k].nombre }; }) });
  }
  const pid = slug_(d.edificio_id), lk = ptLuka_(pid);
  if (!lk) return json({ ok: false, error: 'no_vinculado' });
  const data = ptDatos_(lk);
  // edificio aún sin departamentos en LUKA: el portal sigue usando el archivo del sitio
  if (!(data.deptos || []).some(function (x) { return ptNormDepto_(x.depto) === ptNormDepto_(d.depto); })) return json({ ok: false, error: 'no_vinculado' });
  const okc = ptCodigoOk_(pid, d.depto, d.codigo, data);
  const dep = ptNormDepto_(d.depto);
  let inq = null;
  if (!okc) { inq = ptInquilino_(pid, dep, d.codigo); if (!inq) return json({ ok: false, error: okc === null ? 'no_vinculado' : 'codigo' }); }
  // cada portal acepta solo sus códigos: propietarios en copropietarios.html, inquilinos en inquilinos.html
  if (d.portal === 'inquilino' && !inq) return json({ ok: false, error: okc ? 'otro_portal' : 'codigo' });
  if (d.portal === 'propietario' && inq) return json({ ok: false, error: 'otro_portal' });
  const est = ptEstado_(pid, lk, data, d.depto);
  if (!est) return json({ ok: false, error: 'codigo' });
  const INQ = lkLeer_('PT_INQ', {}), ik = pid + '|' + dep;
  est.rol = inq ? 'inquilino' : 'propietario';
  est.areas = (est.areas || []).map(function (a) {
    const g = inq && a.garantiaInq != null && a.garantiaInq !== '' ? +a.garantiaInq : a.garantia;
    return { id: a.id, nombre: a.nombre, garantia: g, tramos: (a.tramos || []).map(function (t) { return { label: t.label, monto: inq && t.montoInq != null && t.montoInq !== '' ? +t.montoInq : t.monto }; }) }; });
  if (inq) { est.unidad.inquilino = inq.n; }
  else if (INQ[ik]) est.inquilino = { nombre: INQ[ik].n, desde: INQ[ik].c };
  if (d.action === 'pt_inquilino') {
    if (inq) return json({ ok: false, error: 'Solo el propietario puede hacer esto.' });
    if (d.op === 'quitar') { delete INQ[ik]; lkEscribir_('PT_INQ', INQ); return json({ ok: true }); }
    const nombre = String(d.nombre || '').trim().slice(0, 60);
    if (!nombre) return json({ ok: false, error: 'Escriba el nombre del inquilino.' });
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 10; i++) c += A.charAt(Math.floor(Math.random() * A.length));
    INQ[ik] = { n: nombre, h: ptInqHash_(pid, dep, c), c: Utilities.formatDate(new Date(), 'America/La_Paz', 'yyyy-MM-dd') };
    lkEscribir_('PT_INQ', INQ);
    return json({ ok: true, codigo: c, nombre: nombre });
  }
  if (d.action === 'pt_estado') return json({ ok: true, data: est });
  if (d.action === 'pt_reservas') {
    const ahora = new Date(), hoy = Utilities.formatDate(ahora, 'America/La_Paz', "yyyy-MM-dd'T'HH:mm");
    const LR = {}; (data.reservasSociales || []).forEach(function (x) { if (x.portalId) LR[x.portalId] = x; });
    const devueltas = {};
    Object.keys(LR).forEach(function (k) { const x = LR[k], h = (x.garDev && x.garDev.historial) || [];
      // la reserva sigue visible 7 días después de devolver la garantía (para ver su comprobante)
      if (x.garDev && x.garDev.estado === 'devuelta') { const t = new Date((h[h.length - 1] || {}).at || 0); if (isNaN(t) || ahora - t > 7 * 864e5) devueltas[k] = 1; } });
    // sin historial: rechazadas se ocultan 24 h después; aprobadas, después del evento (o al devolver la garantía)
    const L = ptReservasLista_(function (r) {
      if (r.edificio_id !== pid || ptNormDepto_(r.depto) !== dep) return false;
      const fin = r.fecha + 'T' + (r.hfin && r.hfin > (r.hini || '') ? r.hfin : '23:59');
      if (r.estado === 'Rechazada') { const t = new Date(r.respondida || r.recibida); return isNaN(t) || ahora - t < 864e5; }
      if (r.estado === 'Pendiente') return fin >= hoy;
      if (fin >= hoy) return true;
      r.terminado = true;
      return !devueltas[r.id] && r.garantia !== 0;
    }).slice(0, 20);
    L.forEach(function (r) {
      if (r.total != null) return;
      const a = (est.areas || []).filter(function (x) { return x.id === r.areaId; })[0] || {};
      const t = (a.tramos || []).filter(function (x) { return x.label === r.tramo; })[0] || {};
      r.alquiler = +t.monto || 0; r.garantia = +a.garantia || 0; r.total = r.alquiler + r.garantia;
    });
    // datos aprobados en LUKA (montos finales)
    L.forEach(function (r) { const x = (data.reservasSociales || []).filter(function (z) { return z.portalId === r.id; })[0];
      if (x) { r.alquiler = +x.monto || 0; r.garantia = +x.garantia || 0; r.extrasMonto = +x.extras || 0; r.total = r.alquiler + r.garantia + r.extrasMonto;
        if (x.pago) r.recibo = x.pago;
        const h = (x.garDev && x.garDev.historial) || [];
        if (x.garDev && x.garDev.estado === 'devuelta' && h.length) { const u = h[h.length - 1]; r.devolucion = { no: String(u.no || ''), fecha: String(u.fecha || ''), monto: +u.monto || 0, garantia: +u.garantia || +x.garantia || 0, comprobante: String(u.comprobante || ''), obs: String(u.obs || ''), metodo: String(u.metodo || ''), destino: String(u.destino || ''), area: String(u.area || x.areaNombre || ''), fechaEvento: String(u.fechaEvento || x.fecha || '') }; r.garEstado = 'Devuelta'; }
        r.areaNombre = String(x.areaNombre || ''); } });
    return json({ ok: true, reservas: L.filter(function (r) { return !(r.terminado && !(r.garantia > 0)); }) });
  }
  if (d.action === 'pt_garantia') {
    const sh = ptHojaRes_(), f = sh.getRange('A:A').createTextFinder(String(d.rid || '')).matchEntireCell(true).findNext();
    if (!f) return json({ ok: false, error: 'Reserva no encontrada.' });
    const r = ptReservasLista_(function (x) { return x.id === String(d.rid); })[0];
    if (!r || r.edificio_id !== pid || ptNormDepto_(r.depto) !== dep || r.estado !== 'Aprobada') return json({ ok: false, error: 'Reserva no encontrada.' });
    let datos = '';
    if (d.metodo === 'transferencia') {
      const falta = ['banco', 'cuenta', 'titular'].filter(function (k) { return !String(d[k] || '').trim(); });
      if (falta.length) return json({ ok: false, error: 'Complete banco, número de cuenta y titular.' });
      datos = 'Transferencia · ' + String(d.banco).slice(0, 60) + ' · Cta. ' + String(d.cuenta).slice(0, 40) + ' · Titular: ' + String(d.titular).slice(0, 80);
    } else if (d.metodo === 'qr') {
      if (!d.data || TIPOS.indexOf(d.mimeType) < 0) return json({ ok: false, error: 'Suba la imagen de su QR.' });
      const bytes = Utilities.base64Decode(d.data); if (bytes.length > MAX_BYTES) return json({ ok: false, error: 'La imagen es demasiado grande.' });
      const carp = ptCarpetaAlquiler_(est.edificio.nombre, est.unidad.depto, pid);
      const file = carp.createFile(Utilities.newBlob(bytes, d.mimeType, Utilities.formatDate(new Date(), 'America/La_Paz', 'yyyy-MM-dd HH.mm') + ' · QR para devolver garantía'));
      datos = 'QR · ' + file.getUrl();
    } else return json({ ok: false, error: 'Elija cómo quiere recibir la garantía.' });
    sh.getRange(f.getRow(), 25, 1, 2).setValues([['Solicitada', datos]]);
    try { const to = destinatarios_(pid); if (to) MailApp.sendEmail({ to: to, name: 'Portal Bramar', subject: 'Devolución de garantía · ' + est.edificio.nombre + ' · Depto ' + est.unidad.depto,
      htmlBody: '<div style="font-family:Arial,sans-serif;font-size:15px;color:#0B2440"><p>El Depto ' + est.unidad.depto + ' pide la devolución de su garantía (' + r.area.replace(/^[^·]*·\s*/, '') + ', ' + r.fecha + ').</p><p>' + datos.replace(/</g, '&lt;') + '</p><p><a href="' + LUKA_URL + '">Abrir Gestión LUKA</a></p></div>' }); } catch (e) {}
    return json({ ok: true });
  }
  if (d.action === 'pt_ocupadas') {
    const hoy = Utilities.formatDate(new Date(), 'America/La_Paz', 'yyyy-MM-dd'), out = {};
    (data.reservasSociales || []).forEach(function (x) { const f = String(x.fecha || x.inicio || '').slice(0, 10);
      if (f >= hoy && x.estado !== 'Cancelada' && (!d.areaId || String(x.areaId || '') === d.areaId)) out[f] = { fecha: f, hora: String(x.inicio || '').slice(11, 16), estado: 'Reservada' }; });
    ptReservasLista_(function (r) { return r.edificio_id === pid && r.fecha >= hoy && (r.estado === 'Pendiente' || r.estado === 'Aprobada') && (!d.areaId || r.areaId === d.areaId); })
      .forEach(function (r) { if (!out[r.fecha]) out[r.fecha] = { fecha: r.fecha, hora: r.hini, estado: r.estado === 'Aprobada' ? 'Reservada' : 'Solicitada' }; });
    return json({ ok: true, fechas: Object.keys(out).sort().map(function (k) { return out[k]; }) });
  }
  if (d.action === 'pt_ocupado') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '')) return json({ ok: true, ocupadas: [] });
    return json({ ok: true, ocupadas: ptOcupadas_(pid, data, d.fecha) });
  }
  if (d.action === 'pt_reserva') {
    const area = (est.areas || []).filter(function (a) { return a.id === d.areaId; })[0];
    if (!area) return json({ ok: false, error: 'Elija un área.' });
    const tramo = (area.tramos || []).filter(function (t) { return t.label === d.tramo; })[0];
    if (!tramo && (area.tramos || []).length) return json({ ok: false, error: 'Elija el horario o tarifa.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '')) return json({ ok: false, error: 'Elija la fecha.' });
    const hoy = Utilities.formatDate(new Date(), 'America/La_Paz', 'yyyy-MM-dd');
    if (d.fecha < hoy) return json({ ok: false, error: 'La fecha ya pasó.' });
    const req = { hini: 'la hora de inicio', hfin: 'la hora de fin', responsable: 'el nombre del responsable', telefono: 'el teléfono', personas: 'la cantidad de personas', evento: 'el tipo de evento' };
    const falta = Object.keys(req).filter(function (k) { return !String(d[k] || '').trim(); });
    if (falta.length) return json({ ok: false, error: 'Complete ' + falta.map(function (k) { return req[k]; }).join(', ') + '.' });
    if (!/^\d{2}:\d{2}$/.test(d.hini) || !/^\d{2}:\d{2}$/.test(d.hfin)) return json({ ok: false, error: 'Revise las horas.' });
    // servicios extra (opcionales)
    const svc = est.servicios || [], pedidos = [];
    svc.forEach(function (x) { const q = Math.floor(+((d.extras || {})[x.id]) || 0); if (q > 0 && q <= 500) pedidos.push({ id: x.id, nombre: x.nombre, cant: q, precio: x.precio, subtotal: q * x.precio }); });
    const alquiler = tramo ? +tramo.monto || 0 : 0, garantia = +area.garantia || 0;
    const totExtras = pedidos.reduce(function (a, x) { return a + x.subtotal; }, 0), total = alquiler + garantia + totExtras;
    const ocup = ptOcupadas_(pid, data, d.fecha);
    const id = Utilities.getUuid().replace(/-/g, '').slice(0, 16), T = function (v, n) { return "'" + String(v || '').slice(0, n); };
    ptHojaRes_().appendRow([id, new Date(), pid, est.edificio.nombre, T(est.unidad.depto, 20), (inq ? 'Inquilino · ' : '') + String(d.responsable).slice(0, 80),
      area.id + ' · ' + area.nombre, T(d.tramo, 60), d.fecha, T(d.hini, 5), T(d.hfin, 5),
      String(d.evento).slice(0, 120), 'Pendiente', '', '', T(d.personas, 10), T(d.telefono, 30),
      pedidos.map(function (x) { return x.nombre + ' x' + x.cant; }).join(', '), alquiler, garantia, total, JSON.stringify(pedidos)]);
    const mismo = ocup.filter(function (o) { return o.areaId === area.id; });
    try {
      const to = destinatarios_(pid);
      if (to) MailApp.sendEmail({ to: to, name: 'Portal Bramar', subject: 'Solicitud de reserva · ' + est.edificio.nombre + ' · Depto ' + est.unidad.depto + ' · ' + area.nombre + ' · ' + d.fecha + (mismo.length ? ' · YA HAY RESERVA ESE DÍA' : ''),
        htmlBody: '<div style="font-family:Arial,sans-serif;font-size:15px;color:#0B2440"><p>Nueva solicitud de reserva desde el portal.</p><p><b>' + area.nombre + '</b> · ' + (d.tramo || '') + '<br>' + d.fecha + ' ' + d.hini + '–' + d.hfin +
          '<br>Depto ' + est.unidad.depto + ' · ' + String(d.responsable).replace(/</g, '&lt;') + ' · Tel. ' + String(d.telefono).replace(/</g, '&lt;') + '<br>Evento: ' + String(d.evento).replace(/</g, '&lt;') +
          (pedidos.length ? '<br>Extras: ' + pedidos.map(function (x) { return x.nombre + ' x' + x.cant; }).join(', ') : '') + '<br><b>Total: Bs ' + total + '</b> (incluye garantía Bs ' + garantia + ')</p>' +
          (ocup.length ? '<p style="color:#8E2A20"><b>Atención:</b> ese día ya hay ' + ocup.map(function (o) { return o.area + (o.hora ? ' ' + o.hora : '') + ' (' + o.estado.toLowerCase() + ')'; }).join(', ') + '.</p>' : '') +
          '<p><a href="' + LUKA_URL + '">Abrir Gestión LUKA</a> para aprobarla o rechazarla.</p></div>' });
    } catch (e) {}
    return json({ ok: true, id: id, total: total, ocupadas: ocup });
  }
  return json({ ok: false, error: 'Acción desconocida.' });
}
