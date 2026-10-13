/**
 * BRAMAR · Servidor del portal de copropietarios
 * ---------------------------------------------------------------
 * 1. Comprobantes: guarda cada uno en Google Drive, ordenado así:
 *      Comprobantes Bramar / EDIFICIO / 2026-10 Octubre / Depto 2B / archivo
 *    y lo anota en la hoja "Registro de comprobantes".
 * 2. Contraseñas personales: guarda, por departamento, el código
 *    original cifrado con la contraseña del propietario. Este servidor
 *    nunca recibe ni la contraseña ni el código en texto legible.
 *    Para "resetear" la contraseña de alguien, borre su fila en la
 *    pestaña "Accesos" de la hoja: podrá volver a entrar con su código.
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
    if (!d.data || !d.filename) return json({ ok: false, error: 'Falta el archivo.' });
    if (TIPOS.indexOf(d.mimeType) === -1) return json({ ok: false, error: 'Tipo de archivo no permitido.' });
    const bytes = Utilities.base64Decode(d.data);
    if (bytes.length > MAX_BYTES) return json({ ok: false, error: 'El archivo es demasiado grande.' });

    const ahora = new Date();
    const raiz = carpeta_(DriveApp.getRootFolder(), CARPETA_RAIZ);
    const edificio = carpeta_(raiz, limpiar_(d.edificio || d.edificio_id || 'Sin edificio'));
    const mes = carpeta_(edificio, Utilities.formatDate(ahora, 'America/La_Paz', 'yyyy-MM') + ' ' + MESES[Number(Utilities.formatDate(ahora, 'America/La_Paz', 'M')) - 1]);
    const depto = carpeta_(mes, 'Depto ' + limpiar_(d.depto || 'sin número'));
    const fecha = Utilities.formatDate(ahora, 'America/La_Paz', 'yyyy-MM-dd HH.mm');
    const nombre = `${fecha} · ${limpiar_(d.filename)}`;
    const archivo = depto.createFile(Utilities.newBlob(bytes, d.mimeType, nombre));

    registro_().appendRow([
      ahora, d.edificio || '', d.depto || '', d.propietario || '',
      d.monto || '', d.fecha || '', d.nota || '', archivo.getUrl(), 'Pendiente de verificar'
    ]);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/** Ejecute esta función una vez desde el editor: autoriza los permisos y crea la hoja. */
function instalar() {
  const sh = registro_(); accesos_();
  Logger.log('Listo. Hoja de registro: ' + sh.getParent().getUrl());
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'alias') return getAlias_(p.id);
  return json({ ok: true, servicio: 'Portal Bramar' });
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
  const cache = CacheService.getScriptCache(), k = 'q' + Math.floor(Date.now() / 60000);
  const n = Number(cache.get(k) || 0) + 1; cache.put(k, String(n), 120);
  if (n > 600) return json({ ok: false, error: 'Demasiados intentos, espere un minuto.' });
  const f = accesos_().getRange('A:A').createTextFinder(id).matchEntireCell(true).findNext();
  if (!f) return json({ ok: false });
  return json({ ok: true, blob: JSON.parse(accesos_().getRange(f.getRow(), 2).getValue()) });
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function carpeta_(padre, nombre) {
  const it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}
function limpiar_(s) { return String(s || '').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80); }
function registro_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('HOJA_ID'), ss;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(HOJA_REGISTRO);
    ss.getSheets()[0].appendRow(['Recibido', 'Edificio', 'Depto', 'Propietario', 'Monto', 'Fecha del pago', 'Nota', 'Archivo', 'Estado']);
    ss.getSheets()[0].setFrozenRows(1);
    props.setProperty('HOJA_ID', ss.getId());
    DriveApp.getFileById(ss.getId()).moveTo(carpeta_(DriveApp.getRootFolder(), CARPETA_RAIZ));
  }
  return ss.getSheets()[0];
}
