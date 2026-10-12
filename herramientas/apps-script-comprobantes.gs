/**
 * BRAMAR · Recepción de comprobantes del portal de copropietarios
 * ---------------------------------------------------------------
 * Guarda cada comprobante en Google Drive (una carpeta por edificio)
 * y lo anota en una hoja de cálculo "Registro de comprobantes".
 *
 * INSTALACIÓN (una sola vez, con la cuenta bramargroupsrl@gmail.com):
 * 1. Entre a https://script.google.com y cree un "Proyecto nuevo".
 * 2. Borre el contenido y pegue todo este archivo. Guarde.
 * 3. Menú "Implementar" → "Nueva implementación" → tipo "Aplicación web".
 *      - Ejecutar como: Yo
 *      - Quién tiene acceso: Cualquier usuario
 *    Presione "Implementar" y autorice los permisos que pide Google.
 * 4. Copie la "URL de la aplicación web" (termina en /exec) y péguela en
 *    copropietarios.html, en PORTAL.uploadEndpoint.
 * 5. Pruebe enviando un comprobante desde el portal: aparecerá la carpeta
 *    "Comprobantes Bramar" en su Drive y la hoja con el registro.
 *
 * Si cambia este código, use "Implementar" → "Administrar implementaciones"
 * → editar → "Nueva versión", para mantener la misma URL.
 */

const CARPETA_RAIZ = 'Comprobantes Bramar';
const HOJA_REGISTRO = 'Registro de comprobantes';
const MAX_BYTES = 10 * 1024 * 1024;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (!d.data || !d.filename) return json({ ok: false, error: 'Falta el archivo.' });
    if (TIPOS.indexOf(d.mimeType) === -1) return json({ ok: false, error: 'Tipo de archivo no permitido.' });
    const bytes = Utilities.base64Decode(d.data);
    if (bytes.length > MAX_BYTES) return json({ ok: false, error: 'El archivo es demasiado grande.' });

    const raiz = carpeta_(DriveApp.getRootFolder(), CARPETA_RAIZ);
    const edificio = carpeta_(raiz, limpiar_(d.edificio || d.edificio_id || 'Sin edificio'));
    const fecha = Utilities.formatDate(new Date(), 'America/La_Paz', 'yyyy-MM-dd HH.mm');
    const nombre = `${limpiar_(d.depto)} · ${fecha} · ${limpiar_(d.filename)}`;
    const archivo = edificio.createFile(Utilities.newBlob(bytes, d.mimeType, nombre));

    registro_().appendRow([
      new Date(), d.edificio || '', d.depto || '', d.propietario || '',
      d.monto || '', d.fecha || '', d.nota || '', archivo.getUrl(), 'Pendiente de verificar'
    ]);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doGet() { return json({ ok: true, servicio: 'Comprobantes Bramar' }); }

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
