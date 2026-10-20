/* ============================================================================
   Recibos y comprobantes de Bramar / Gestión LUKA en PDF — UN solo diseño para
   todos (expensas, alquiler de áreas, devolución de garantía, ingresos y egresos).
   Hoja carta, siempre UNA página, poca tinta. Lo usan LUKA y el portal.
   Necesita MiniPDF y QR (en LUKA ya existen; en el portal vienen de js/minipdf.js).
   ============================================================================ */
(function () {
  var NAVY = [14, 44, 77], INK = [25, 30, 38], MUT = [110, 120, 132], LINE = [205, 212, 222];
  var VERDE = [24, 120, 72], ROJO = [150, 40, 30];
  function PDFc() { return window.LkMiniPDF || (typeof MiniPDF !== 'undefined' ? MiniPDF : null); }
  function QRc() { return window.LkQR || (typeof QR !== 'undefined' ? QR : null); }
  function dinero(n) {
    n = Math.round((+n || 0) * 100) / 100; var neg = n < 0; n = Math.abs(n);
    var ent = Math.floor(n), dec = Math.round((n - ent) * 100);
    var s = String(ent).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-' : '') + 'Bs. ' + s + (dec ? ',' + String(dec).padStart(2, '0') : '');
  }
  function cargar(src) {
    return new Promise(function (ok) {
      if (!src) { ok(null); return; }
      var i = new Image(); i.crossOrigin = 'anonymous';
      i.onload = function () { try { var c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(i, 0, 0); ok(c); } catch (e) { ok(null); } };
      i.onerror = function () { ok(null); }; i.src = src;
    });
  }
  function encajar(pdf, c, x, y, w, h, der) { if (!c) return 0; var a = c.width / c.height, ww = w, hh = w / a; if (hh > h) { hh = h; ww = h * a; } pdf.image(c, der ? x + w - ww : x, y + (h - hh) / 2, ww, hh); return ww; }

  /* spec = {
       egreso:bool, edificio, subtitulo, noLabel, no, logo, sello, empresa,
       persona:{label,nombre}, campos:[[label,valor],...], concepto, obs,
       lista:{titulo, filas:[{t, v, nota, tipo:'ok'|'info'|'menos'}]},
       monto:{label, valor}, lado:{label, valor, alerta},
       selloDigital:'CANCELADO' | 'PAGADO' | 'ENTREGADO'..., qr:'texto', qrNota, pie, archivo }  */
  window.lukaDocPDF = async function (s) {
    var P = PDFc(); if (!P) { alert('No se pudo generar el PDF.'); return; }
    var fmt = s.dinero || dinero;
    var pdf = new P(); pdf.W = 612; pdf.H = 792;
    var LIM = { '×': 'x', '−': '-', '–': '-', '—': '-', '→': '->', '·': '·', '“': '"', '”': '"', '‘': "'", '’': "'", '…': '...' };
    var limpia = function (t) { return String(t == null ? '' : t).replace(/[×−–—→“”‘’…]/g, function (c) { return LIM[c] || ''; }); };
    var _t = pdf.text.bind(pdf), _w = pdf.wrap.bind(pdf), _tw = pdf.textWidth.bind(pdf);
    pdf.text = function (t, x, y, o) { return _t(limpia(t), x, y, o); };
    pdf.wrap = function (t, w, sz, b) { return _w(limpia(t), w, sz, b); };
    pdf.textWidth = function (t, sz, b) { return _tw(limpia(t), sz, b); };
    var W = 612, H = 792, M = 56, CW = W - 2 * M, y = M;
    var COLOR = s.egreso ? ROJO : VERDE;
    var logo = await cargar(s.logo), sello = await cargar(s.sello);
    // encabezado
    var lw = encajar(pdf, logo, M, y, 70, 58, false), tx = M + (lw ? lw + 16 : 0);
    var nomEd = String(s.edificio || '').toUpperCase(), fsEd = 17;
    while (fsEd > 11 && pdf.textWidth(nomEd, fsEd, true) > (W - M - 150) - tx) fsEd -= 0.5;
    pdf.text(nomEd, tx, y + 8, { size: fsEd, bold: true, color: NAVY });
    pdf.text(String(s.subtitulo || ''), tx, y + 32, { size: 9.5, color: MUT });
    pdf.text(String(s.noLabel || 'RECIBO N.º'), W - M, y + 4, { size: 8.5, bold: true, color: MUT, align: 'right' });
    pdf.text(String(s.no || ''), W - M, y + 16, { size: 22, bold: true, color: NAVY, align: 'right' });
    y += 70; pdf.line(M, y, W - M, y, NAVY, 0.9); y += 22;
    // persona
    if (s.persona && s.persona.nombre) {
      pdf.text(s.persona.label || 'RECIBÍ DE', M, y, { size: 8.5, bold: true, color: MUT });
      pdf.text(String(s.persona.nombre), M, y + 13, { size: 16, bold: true, color: INK }); y += 44;
    }
    // datos (2 columnas)
    var col = CW / 2, C = (s.campos || []).filter(function (f) { return f && f[1] != null && f[1] !== ''; });
    for (var i = 0; i < C.length; i += 2) {
      var alto = 0;
      [0, 1].forEach(function (k) {
        var f = C[i + k]; if (!f) return; var x = M + k * col;
        pdf.text(String(f[0]).toUpperCase(), x, y, { size: 8.5, bold: true, color: MUT });
        var L = pdf.wrap(String(f[1]), col - 16, 11.5, true);
        L.slice(0, 2).forEach(function (t, j) { pdf.text(t, x, y + 13 + j * 14, { size: 11.5, bold: true, color: INK }); });
        alto = Math.max(alto, 13 + Math.min(2, L.length) * 14);
      });
      y += alto + 12;
    }
    pdf.line(M, y, W - M, y, LINE, 0.6); y += 18;
    // concepto
    if (s.concepto) {
      pdf.text(s.conceptoLabel || 'CONCEPTO', M, y, { size: 8.5, bold: true, color: MUT }); y += 14;
      pdf.wrap(String(s.concepto), CW, 11, false).slice(0, 3).forEach(function (t) { pdf.text(t, M, y, { size: 11, color: INK }); y += 14; });
      if (s.obs) pdf.wrap('Obs: ' + s.obs, CW, 9.5, false).slice(0, 2).forEach(function (t) { pdf.text(t, M, y, { size: 9.5, color: MUT }); y += 12; });
      y += 8;
    }
    // lista (meses cubiertos, detalle, ítems…)
    var F = (s.lista && s.lista.filas) || [];
    if (F.length) {
      var maxFilas = Math.floor((H - M - 190 - 90 - y) / 17);   // lo que entra antes del monto y el pie
      var cols = F.length > maxFilas * 2 ? 3 : (F.length > maxFilas ? 2 : 1);
      if (F.length > maxFilas * 3) F = F.slice(0, maxFilas * 3);
      pdf.text(String(s.lista.titulo || 'DETALLE').toUpperCase(), M, y, { size: 8.5, bold: true, color: MUT }); y += 14;
      var cw = CW / cols, rows = Math.ceil(F.length / cols);
      F.forEach(function (f, j) {
        var c = Math.floor(j / rows), r = j - c * rows, x = M + c * cw, yy = y + r * 17;
        var fuerte = f.tipo === 'total';
        var colr = f.tipo === 'info' ? NAVY : (f.tipo === 'menos' ? ROJO : (f.tipo === 'gris' ? MUT : COLOR));
        var izq = String(f.t || ''); while (izq.length > 4 && pdf.textWidth(izq, 10.5, true) > cw - 120) izq = izq.slice(0, -2);
        pdf.text(izq, x, yy, { size: 10.5, bold: true, color: INK });
        pdf.text((f.v != null ? (typeof f.v === 'number' ? fmt(f.v) : f.v) : '') + (f.nota ? '  ·  ' + f.nota : ''), x + cw - 14, yy + 1, { size: fuerte ? 10.5 : 9.5, bold: fuerte, color: fuerte ? INK : colr, align: 'right' });
        pdf.line(x, yy + 14, x + cw - 14, yy + 14, LINE, 0.4);
      });
      y += rows * 17 + 12;
    }
    // monto
    var bh = 64; pdf.rectS(M, y, CW, bh, NAVY, 0.9);
    pdf.text(String((s.monto && s.monto.label) || 'MONTO').toUpperCase(), M + 18, y + 14, { size: 9, bold: true, color: MUT });
    pdf.text(fmt(s.monto ? s.monto.valor : 0), M + 18, y + 28, { size: 24, bold: true, color: COLOR });
    if (s.lado) {
      pdf.text(String(s.lado.label || ''), W - M - 18, y + 16, { size: 9, color: MUT, align: 'right' });
      pdf.text(typeof s.lado.valor === 'number' ? fmt(s.lado.valor) : String(s.lado.valor || ''), W - M - 18, y + 30, { size: 15, bold: true, color: s.lado.alerta ? ROJO : (s.lado.neutro ? NAVY : VERDE), align: 'right' });
    }
    y += bh + 24;
    if (s.nota) pdf.wrap(String(s.nota), CW, 9, false).slice(0, 2).forEach(function (t) { pdf.text(t, M, y, { size: 9, color: MUT }); y += 12; });
    // pie: QR + firma/sello
    var yb = H - M - 150;
    try {
      var Q = QRc(); if (Q && s.qr) {
        var mtx = Q.encode(String(s.qr)), n = mtx.length, q = 104 / (n + 2);
        for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (mtx[r][c]) pdf.rect(M + q + c * q, yb + q + r * q, q + 0.05, q + 0.05, [11, 11, 11]);
        pdf.text('Verifique este documento', M + 112, yb + 40, { size: 9, bold: true, color: INK });
        pdf.text(s.qrNota || 'escaneando el código QR.', M + 112, yb + 53, { size: 9, color: MUT });
      }
    } catch (e) {}
    var fx = W - M - 200, emp = String(s.empresa || 'Gestión LUKA');
    // si hay sello, va SOLO el sello (grande); si no, el sello digital
    if (sello) { var sa = sello.width / sello.height, sh = Math.min(130, 200 / sa), sw = sh * sa; pdf.image(sello, fx + 100 - sw / 2, yb + 76 - sh, sw, sh); }
    else {
      var dw = 170; pdf.rectS(fx + 100 - dw / 2, yb + 16, dw, 52, COLOR, 1.3);
      pdf.text(String(s.selloDigital || (s.egreso ? 'ENTREGADO' : 'PAGO RECIBIDO')), fx + 100, yb + 25, { size: 14, bold: true, color: COLOR, align: 'center' });
      pdf.text(emp.toUpperCase(), fx + 100, yb + 46, { size: 8, bold: true, color: COLOR, align: 'center' });
    }
    pdf.line(fx, yb + 80, W - M, yb + 80, INK, 0.7);
    pdf.text(s.firma || 'Firma / sello administración', fx + 100, yb + 86, { size: 9, color: MUT, align: 'center' });
    pdf.text(emp.toUpperCase(), fx + 100, yb + 99, { size: 9, bold: true, color: INK, align: 'center' });
    pdf.line(M, H - M - 18, W - M, H - M - 18, LINE, 0.5);
    var pie = String(s.pie || ''), fs = 7.5;
    while (fs > 5.5 && pdf.textWidth(pie, fs, false) > CW) fs -= 0.25;
    pdf.text(pie, W / 2, H - M - 10, { size: fs, color: MUT, align: 'center' });
    pdf.save(String(s.archivo || 'Recibo').replace(/[\\/:*?"<>|]+/g, ' ').trim() + '.pdf');
  };
  window.lukaDinero = dinero;
})();
