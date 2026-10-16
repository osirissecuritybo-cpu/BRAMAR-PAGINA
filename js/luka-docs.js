/* Documentos de reservas de Gestión LUKA (los usa LUKA y el portal de propietarios,
   así el recibo es idéntico en los dos lados).
   · Recibo de alquiler de área social: el alquiler y los extras son INGRESO; la
     garantía se recibe como depósito en custodia (reembolsable), no es ingreso.
   · Comprobante de devolución de garantía: salida del depósito en custodia (no es gasto).
   Requiere el codificador QR (variable global QR) que ya traen LUKA y luka-recibo.js. */
(function () {
  var SECRET = 'LIMCO-II::clave-interna::9f3a7b2e5c1d';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function money(n) { return 'Bs. ' + Number(n || 0).toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
  function fLarga(iso) { if (!iso) return '—'; var p = String(iso).slice(0, 10).split('-'); var M = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']; return parseInt(p[2], 10) + ' de ' + M[parseInt(p[1], 10) - 1] + ' de ' + p[0]; }
  function fCorta(iso) { if (!iso) return ''; var p = String(iso).slice(0, 10).split('-'); var M = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']; return parseInt(p[2], 10) + ' ' + M[parseInt(p[1], 10) - 1] + ' ' + p[0]; }
  function hoy() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function sinTildes(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/º/g, 'o'); }
  function firma(t) { var h = 0x811c9dc5, s = t + '||' + SECRET; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36).toUpperCase().padStart(7, '0'); }
  function qrSVG(text) {
    try { var m = QR.encode(text), n = m.length, q = 4, T = n + q * 2, r = ''; for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (m[y][x]) r += '<rect x="' + (x + q) + '" y="' + (y + q) + '" width="1" height="1"/>';
      return '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 ' + T + ' ' + T + '" shape-rendering="crispEdges"><rect width="' + T + '" height="' + T + '" fill="#ffffff"/><g fill="#0b0b0b">' + r + '</g></svg>'; } catch (e) { return ''; }
  }
  function qrTexto(lineas) { var t = sinTildes(lineas.join('\n')); return t + '\nCod. verificacion: ' + firma(t); }
  function textoPago(E, U, p) { return qrTexto([String(E.nombreRecibo || E.nombre || 'Gestión LUKA').toUpperCase(), 'Recibo No ' + p.no, 'Alquiler de area social', 'Depto ' + (U.depto || '-'), 'Recibido: ' + money(p.total), 'Fecha: ' + fCorta(p.fecha)]); }
  function textoDev(E, U, d) { return qrTexto([String(E.nombreRecibo || E.nombre || 'Gestión LUKA').toUpperCase(), 'Devolucion No ' + d.no, 'Garantia de area social', 'Depto ' + (U.depto || '-'), 'Devuelto: ' + money(d.monto), 'Fecha: ' + fCorta(d.fecha)]); }
  function cab(E, sub, no) {
    var nombre = String(E.nombreRecibo || E.nombre || 'Gestión LUKA'), logo = E.logo || '';
    return (logo ? '<img class="r-watermark" src="' + esc(logo) + '" alt="">' : '') + '<div class="r-band"></div>' +
      '<div class="r-header">' + (logo ? '<img class="r-logo-img" src="' + esc(logo) + '" alt="">' : '') + '<div class="r-title">' + esc(nombre.toUpperCase()) + '</div><div class="r-sub">' + esc(sub) + '</div></div>' +
      '<div class="r-no-wrap"><span class="r-no-badge">' + esc(no) + '</span></div>';
  }
  function pie(E, qr) {
    var nombre = String(E.nombreRecibo || E.nombre || 'Gestión LUKA'), empresa = E.empresa || 'Gestión LUKA', sello = E.sello || E.logo || '';
    return '<div class="r-qr-row"><div class="r-qr">' + qr + '</div></div>' +
      '<div class="r-sign"><div class="r-seal">' + (sello ? '<img src="' + esc(sello) + '" alt="">' : '') + '<div class="r-seal-text">' + esc(empresa.toUpperCase()) + '</div></div><div class="line"></div>Firma / sello administración</div>' +
      '<div class="r-footer">Documento generado digitalmente el ' + fLarga(hoy()) + ' · Administrado por ' + esc(empresa) + ' · ' + esc(nombre) + '</div>';
  }
  function tabla(filas) { return '<table class="r-lines">' + filas.map(function (f) { return '<tr class="' + (f[2] || '') + '"><td>' + f[0] + '</td><td>' + f[1] + '</td></tr>'; }).join('') + '</table>'; }

  /* p = { no, fecha, metodo, recibido, obs, area, fechaEvento, horario, responsable, lineas:[{concepto,monto}], garantia, total } */
  window.lukaDocReserva = function (E, U, p) {
    var ingreso = (p.lineas || []).reduce(function (a, l) { return a + (+l.monto || 0); }, 0);
    var filas = (p.lineas || []).map(function (l) { return [esc(l.concepto), money(l.monto)]; });
    filas.push(['<b>Ingreso por alquiler</b>', '<b>' + money(ingreso) + '</b>', 'sub']);
    if (+p.garantia > 0) filas.push(['Garantía (depósito reembolsable, no es ingreso)', money(p.garantia), 'gar']);
    return '<div class="receipt-box r-reserva">' + cab(E, 'Recibo de alquiler de área social', 'Recibo N.º ' + p.no) +
      '<div class="r-info-grid">' +
      '<div class="r-info-item"><div class="r-label">Departamento</div><div class="r-value">' + esc(U.depto || '—') + (U.bloque ? ' · ' + esc(U.bloque) : '') + '</div></div>' +
      '<div class="r-info-item"><div class="r-label">Fecha de pago</div><div class="r-value">' + fLarga(p.fecha) + '</div></div>' +
      '<div class="r-info-item"><div class="r-label">Método de pago</div><div class="r-value">' + esc(p.metodo || '—') + '</div></div>' +
      '<div class="r-info-item"><div class="r-label">Recibido por</div><div class="r-value">' + esc(p.recibido || '—') + '</div></div></div>' +
      '<div class="r-concept-box"><div class="r-concept-label">Reserva</div>' + esc(p.area || '') + ' · ' + fLarga(p.fechaEvento) + (p.horario ? ' · ' + esc(p.horario) : '') +
      (p.responsable ? '<br>Responsable: ' + esc(p.responsable) : '') + (p.obs ? '<br><span style="color:var(--r-muted)">Obs: ' + esc(p.obs) + '</span>' : '') + '</div>' +
      tabla(filas) +
      '<div class="r-total-band"><div class="r-total-label">Total recibido</div><div class="r-total-value">' + money(p.total) + '</div></div>' +
      (+p.garantia > 0 ? '<p class="r-nota">La garantía de ' + money(p.garantia) + ' se devuelve después del evento, previa revisión del área.</p>' : '') +
      pie(E, qrSVG(textoPago(E, U, p))) + '</div>';
  };
  /* d = { no, fecha, monto, garantia, metodo, destino, comprobante, obs, area, fechaEvento } */
  window.lukaDocDevolucion = function (E, U, d) {
    var desc = Math.max(0, (+d.garantia || 0) - (+d.monto || 0));
    var filas = [['Garantía recibida', money(d.garantia)]];
    if (desc > 0.004) filas.push(['Descuento' + (d.obs ? ' (' + esc(d.obs) + ')' : ''), '− ' + money(desc)]);
    filas.push(['<b>Monto devuelto</b>', '<b>' + money(d.monto) + '</b>', 'sub']);
    return '<div class="receipt-box r-reserva r-egreso">' + cab(E, 'Comprobante de devolución de garantía', 'Devolución N.º ' + d.no) +
      '<div class="r-info-grid">' +
      '<div class="r-info-item"><div class="r-label">Departamento</div><div class="r-value">' + esc(U.depto || '—') + (U.bloque ? ' · ' + esc(U.bloque) : '') + '</div></div>' +
      '<div class="r-info-item"><div class="r-label">Fecha de devolución</div><div class="r-value">' + fLarga(d.fecha) + '</div></div>' +
      '<div class="r-info-item"><div class="r-label">Medio</div><div class="r-value">' + esc(d.metodo || '—') + '</div></div>' +
      '<div class="r-info-item"><div class="r-label">N.º de transacción</div><div class="r-value">' + esc(d.comprobante || '—') + '</div></div></div>' +
      '<div class="r-concept-box"><div class="r-concept-label">Reserva</div>' + esc(d.area || '') + (d.fechaEvento ? ' · ' + fLarga(d.fechaEvento) : '') +
      (d.destino ? '<br>Destino: ' + esc(d.destino) : '') + '</div>' + tabla(filas) +
      '<div class="r-total-band"><div class="r-total-label">Devuelto al propietario</div><div class="r-total-value">' + money(d.monto) + '</div></div>' +
      pie(E, qrSVG(textoDev(E, U, d))) + '</div>';
  };
  window.lukaDocCodigoReserva = function (E, U, p) { return textoPago(E, U, p).split('Cod. verificacion: ')[1]; };
  window.lukaDocCodigoDevolucion = function (E, U, d) { return textoDev(E, U, d).split('Cod. verificacion: ')[1]; };
  window.lukaDocCSS = '.receipt-box .r-lines{width:100%;border-collapse:collapse;margin:4px 0 6px;font-size:13px}' +
    '.receipt-box .r-lines td{padding:7px 2px;border-bottom:1px dashed var(--r-line);color:var(--r-ink-soft)}' +
    '.receipt-box .r-lines td:last-child{text-align:right;white-space:nowrap;color:var(--r-ink);font-variant-numeric:tabular-nums}' +
    '.receipt-box .r-lines tr.sub td{color:var(--r-ink);border-bottom:1px solid var(--r-line)}' +
    '.receipt-box .r-lines tr.gar td{color:var(--r-muted);font-style:italic}' +
    '.receipt-box .r-nota{font-size:11px;color:var(--r-muted);text-align:center;margin:6px 0 0}' +
    '.receipt-box.r-egreso .r-total-band{background:#eef2f7;border-color:#d5deea}' +
    '.receipt-box.r-egreso .r-total-band .r-total-label,.receipt-box.r-egreso .r-total-band .r-total-value{color:#1e4e86}';
  try { var st = document.createElement('style'); st.textContent = window.lukaDocCSS; (document.head || document.documentElement).appendChild(st); } catch (e) {}
})();
