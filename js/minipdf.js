/* MiniPDF + QR (copiados de Gestión LUKA) para generar recibos en PDF desde el portal. */
(function(){
var QR = (function () {
  // Galois field GF(256) tables (primitive poly 0x11d)
  var EXP = new Array(512), LOG = new Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
    for (var i2 = 255; i2 < 512; i2++) EXP[i2] = EXP[i2 - 255];
  })();
  function gmul(a, b) { if (a === 0 || b === 0) return 0; return EXP[LOG[a] + LOG[b]]; }
  function rsGenPoly(deg) {
    var poly = [1];
    for (var i = 0; i < deg; i++) {
      var np = new Array(poly.length + 1).fill(0);
      for (var j = 0; j < poly.length; j++) {
        np[j] ^= gmul(poly[j], 1);
        np[j + 1] ^= gmul(poly[j], EXP[i]);
      }
      poly = np;
    }
    return poly;
  }
  function rsEncode(data, ecLen) {
    var gen = rsGenPoly(ecLen);
    var res = new Array(ecLen).fill(0);
    for (var i = 0; i < data.length; i++) {
      var factor = data[i] ^ res[0];
      res.shift(); res.push(0);
      for (var j = 0; j < ecLen; j++) res[j] ^= gmul(gen[j + 1], factor);
    }
    return res;
  }

  // ECC level M block structure per version [ecCodewordsPerBlock, numBlocksG1, dataCwG1, numBlocksG2, dataCwG2]
  var ECM = [
    null,
    [10,1,16,0,0],[16,1,28,0,0],[26,1,44,0,0],[18,2,32,0,0],[24,2,43,0,0],
    [16,4,27,0,0],[18,4,31,0,0],[22,2,38,2,39],[22,3,36,2,37],[26,4,43,1,44],
    [30,1,50,4,51],[22,6,36,2,37],[22,8,37,1,38],[24,4,40,5,41],[24,5,41,5,42],
    [28,7,45,3,46],[28,10,46,1,47],[26,9,43,4,44],[26,3,44,11,45],[26,3,41,13,42],
    [26,17,42,0,0],[28,17,46,0,0],[28,4,47,14,48],[28,6,45,14,46],[28,8,47,13,48],
    [28,19,46,4,47],[28,22,45,3,46],[28,3,45,23,46],[28,21,45,7,46],[28,19,47,10,48],
    [28,2,46,29,47],[28,10,46,23,47],[28,14,46,21,47],[28,14,46,23,47],[28,12,47,26,48],
    [28,6,47,34,48],[28,29,46,14,47],[28,13,46,32,47],[28,40,47,7,48],[28,18,47,31,48]
  ];
  // Total data codewords per version (level M) — derived, but we compute from ECM.
  function dataCapacity(ver) {
    var b = ECM[ver];
    return b[1] * b[2] + b[3] * b[4];
  }
  // Alignment pattern center positions per version
  var ALIGN = [
    [],[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],
    [6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],
    [6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],
    [6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],
    [6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],
    [6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],
    [6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]
  ];

  function chooseVersion(len) {
    for (var v = 1; v <= 40; v++) {
      var cap = dataCapacity(v);
      // header: mode(4) + count(8 or 16) + terminator handled later
      var ccBits = v < 10 ? 8 : 16;
      var need = 4 + ccBits + len * 8;
      if (need <= cap * 8) return v;
    }
    throw new Error('Datos demasiado largos para QR');
  }

  function buildData(bytes, ver) {
    var cap = dataCapacity(ver);
    var ccBits = ver < 10 ? 8 : 16;
    var bits = [];
    function push(val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); }
    push(4, 4);                 // byte mode
    push(bytes.length, ccBits); // char count
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);
    // terminator
    var capBits = cap * 8;
    var term = Math.min(4, capBits - bits.length);
    for (var t = 0; t < term; t++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);
    var dcw = [];
    for (var b = 0; b < bits.length; b += 8) {
      var v = 0; for (var k = 0; k < 8; k++) v = (v << 1) | bits[b + k];
      dcw.push(v);
    }
    var pad = [0xEC, 0x11], pi = 0;
    while (dcw.length < cap) { dcw.push(pad[pi % 2]); pi++; }
    return dcw;
  }

  function interleave(dcw, ver) {
    var st = ECM[ver], ecLen = st[0];
    var blocks = [];
    var idx = 0;
    for (var g = 0; g < 2; g++) {
      var nb = g === 0 ? st[1] : st[3], dc = g === 0 ? st[2] : st[4];
      for (var b = 0; b < nb; b++) {
        var data = dcw.slice(idx, idx + dc); idx += dc;
        blocks.push({ data: data, ec: rsEncode(data, ecLen) });
      }
    }
    var result = [];
    var maxData = 0; blocks.forEach(function (bl) { if (bl.data.length > maxData) maxData = bl.data.length; });
    for (var i = 0; i < maxData; i++) blocks.forEach(function (bl) { if (i < bl.data.length) result.push(bl.data[i]); });
    for (var j = 0; j < ecLen; j++) blocks.forEach(function (bl) { result.push(bl.ec[j]); });
    return result;
  }

  function buildMatrix(ver) {
    var size = ver * 4 + 17;
    var m = []; var reserved = [];
    for (var r = 0; r < size; r++) { m.push(new Array(size).fill(0)); reserved.push(new Array(size).fill(false)); }
    function setF(r, c, v) { m[r][c] = v ? 1 : 0; reserved[r][c] = true; }
    // finder + separators
    function finder(r0, c0) {
      for (var r = -1; r <= 7; r++) for (var c = -1; c <= 7; c++) {
        var rr = r0 + r, cc = c0 + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        var inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
        var inCore = (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        setF(rr, cc, inRing || inCore ? 1 : 0);
      }
    }
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
    // timing
    for (var i = 8; i < size - 8; i++) { if (!reserved[6][i]) setF(6, i, i % 2 === 0 ? 1 : 0); if (!reserved[i][6]) setF(i, 6, i % 2 === 0 ? 1 : 0); }
    // alignment — placed at every center pair EXCEPT the three that collide with the
    // finder patterns; note they DO sit on the timing lines and overwrite them there.
    var ac = ALIGN[ver];
    for (var a = 0; a < ac.length; a++) for (var b = 0; b < ac.length; b++) {
      var ar = ac[a], cc2 = ac[b];
      if ((ar === 6 && cc2 === 6) || (ar === 6 && cc2 === size - 7) || (ar === size - 7 && cc2 === 6)) continue;
      for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) {
        var on = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
        setF(ar + dr, cc2 + dc, on ? 1 : 0);
      }
    }
    // dark module
    setF(size - 8, 8, 1);
    // reserve format areas
    for (var f = 0; f < 9; f++) { if (!reserved[8][f]) { reserved[8][f] = true; } if (!reserved[f][8]) { reserved[f][8] = true; } }
    for (var f2 = 0; f2 < 8; f2++) { reserved[8][size - 1 - f2] = true; reserved[size - 1 - f2][8] = true; }
    // reserve version info (v>=7)
    if (ver >= 7) {
      for (var vr = 0; vr < 6; vr++) for (var vc = 0; vc < 3; vc++) {
        reserved[vr][size - 11 + vc] = true; reserved[size - 11 + vc][vr] = true;
      }
    }
    return { m: m, reserved: reserved, size: size };
  }

  function placeData(mat, codewords) {
    var m = mat.m, reserved = mat.reserved, size = mat.size;
    var bits = [];
    for (var i = 0; i < codewords.length; i++) for (var b = 7; b >= 0; b--) bits.push((codewords[i] >> b) & 1);
    var bi = 0, dirUp = true;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (var t = 0; t < size; t++) {
        var row = dirUp ? size - 1 - t : t;
        for (var c2 = 0; c2 < 2; c2++) {
          var cc = col - c2;
          if (reserved[row][cc]) continue;
          m[row][cc] = bi < bits.length ? bits[bi] : 0; bi++;
        }
      }
      dirUp = !dirUp;
    }
    return m;
  }

  function maskFn(k) {
    return [
      function (r, c) { return (r + c) % 2 === 0; },
      function (r, c) { return r % 2 === 0; },
      function (r, c) { return c % 3 === 0; },
      function (r, c) { return (r + c) % 3 === 0; },
      function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
      function (r, c) { return (r * c) % 2 + (r * c) % 3 === 0; },
      function (r, c) { return ((r * c) % 2 + (r * c) % 3) % 2 === 0; },
      function (r, c) { return ((r + c) % 2 + (r * c) % 3) % 2 === 0; }
    ][k];
  }

  function applyMask(mat, k) {
    var size = mat.size, out = [];
    for (var r = 0; r < size; r++) out.push(mat.m[r].slice());
    var fn = maskFn(k);
    for (var r2 = 0; r2 < size; r2++) for (var c = 0; c < size; c++) {
      if (!mat.reserved[r2][c] && fn(r2, c)) out[r2][c] ^= 1;
    }
    return out;
  }

  // BCH format info for level M (bits '00') + mask
  function formatBits(mask) {
    var data = (0 << 3) | mask; // level M = 0b00
    var d = data << 10, rem = d;
    var g = 0x537;
    for (var i = 14; i >= 10; i--) if ((rem >> i) & 1) rem ^= g << (i - 10);
    var bits = ((data << 10) | rem) ^ 0x5412;
    return bits & 0x7fff;
  }
  function versionBits(ver) {
    var d = ver << 12, rem = d, g = 0x1f25;
    for (var i = 17; i >= 12; i--) if ((rem >> i) & 1) rem ^= g << (i - 12);
    return (ver << 12) | rem;
  }

  function placeFormat(grid, mat, mask) {
    var size = mat.size, fb = formatBits(mask);
    var bitsArr = [];
    for (var i = 0; i <= 14; i++) bitsArr.push((fb >> i) & 1);
    // around top-left
    var coords1 = [[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[7,8],[8,8],[8,7],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0]];
    for (var j = 0; j < 15; j++) grid[coords1[j][0]][coords1[j][1]] = bitsArr[j];
    // second copy: 7 bits horizontal (top-right) then 8 bits vertical (bottom-left)
    var coords2 = [[8,size-1],[8,size-2],[8,size-3],[8,size-4],[8,size-5],[8,size-6],[8,size-7],
                   [size-8,8],[size-7,8],[size-6,8],[size-5,8],[size-4,8],[size-3,8],[size-2,8],[size-1,8]];
    for (var j2 = 0; j2 < 15; j2++) grid[coords2[j2][0]][coords2[j2][1]] = bitsArr[j2];
    grid[size-8][8] = 1; // dark module
  }

  function placeVersion(grid, mat, ver) {
    if (ver < 7) return;
    var size = mat.size, vb = versionBits(ver);
    for (var i = 0; i < 18; i++) {
      var bit = (vb >> i) & 1;
      var r = Math.floor(i / 3), c = i % 3;
      grid[r][size - 11 + c] = bit;
      grid[size - 11 + c][r] = bit;
    }
  }

  function penalty(grid) {
    var n = grid.length, p = 0;
    // rule 1: runs
    for (var r = 0; r < n; r++) {
      var run = 1;
      for (var c = 1; c < n; c++) {
        if (grid[r][c] === grid[r][c-1]) { run++; } else { if (run >= 5) p += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) p += 3 + (run - 5);
    }
    for (var c2 = 0; c2 < n; c2++) {
      var run2 = 1;
      for (var r2 = 1; r2 < n; r2++) {
        if (grid[r2][c2] === grid[r2-1][c2]) { run2++; } else { if (run2 >= 5) p += 3 + (run2 - 5); run2 = 1; }
      }
      if (run2 >= 5) p += 3 + (run2 - 5);
    }
    // rule 2: 2x2 blocks
    for (var r3 = 0; r3 < n-1; r3++) for (var c3 = 0; c3 < n-1; c3++) {
      var v = grid[r3][c3];
      if (v === grid[r3][c3+1] && v === grid[r3+1][c3] && v === grid[r3+1][c3+1]) p += 3;
    }
    // rule 3: finder-like patterns
    var pat1 = [1,0,1,1,1,0,1,0,0,0,0], pat2 = [0,0,0,0,1,0,1,1,1,0,1];
    function match(arr, i, get) {
      for (var k = 0; k < 11; k++) if (get(i + k) !== arr[k]) return false; return true;
    }
    for (var r4 = 0; r4 < n; r4++) for (var c4 = 0; c4 <= n-11; c4++) {
      if (match(pat1, c4, function(x){return grid[r4][x];}) || match(pat2, c4, function(x){return grid[r4][x];})) p += 40;
    }
    for (var c5 = 0; c5 < n; c5++) for (var r5 = 0; r5 <= n-11; r5++) {
      if (match(pat1, r5, function(x){return grid[x][c5];}) || match(pat2, r5, function(x){return grid[x][c5];})) p += 40;
    }
    // rule 4: dark ratio
    var dark = 0; for (var r6 = 0; r6 < n; r6++) for (var c6 = 0; c6 < n; c6++) if (grid[r6][c6]) dark++;
    var ratio = dark / (n * n) * 100;
    p += Math.floor(Math.abs(ratio - 50) / 5) * 10;
    return p;
  }

  function encode(text) {
    var bytes = [];
    var utf8 = unescape(encodeURIComponent(text));
    for (var i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i));
    var ver = chooseVersion(bytes.length);
    var dcw = buildData(bytes, ver);
    var codewords = interleave(dcw, ver);
    var matBase = buildMatrix(ver);
    placeData(matBase, codewords);
    var best = null, bestP = Infinity, bestGrid = null;
    for (var k = 0; k < 8; k++) {
      var grid = applyMask(matBase, k);
      placeFormat(grid, matBase, k);
      placeVersion(grid, matBase, ver);
      var pen = penalty(grid);
      if (pen < bestP) { bestP = pen; best = k; bestGrid = grid; }
    }
    return bestGrid;
  }

  return { encode: encode, __internals: { buildData:buildData, interleave:interleave, buildMatrix:buildMatrix, placeData:placeData, applyMask:applyMask, placeFormat:placeFormat, placeVersion:placeVersion, penalty:penalty } };
})();
const WINANSI = { 'á':0xE1,'é':0xE9,'í':0xED,'ó':0xF3,'ú':0xFA,'ü':0xFC,'ñ':0xF1,'Á':0xC1,'É':0xC9,'Í':0xCD,'Ó':0xD3,'Ú':0xDA,'Ü':0xDC,'Ñ':0xD1,'¿':0xBF,'¡':0xA1,'·':0xB7,'º':0xBA,'ª':0xAA,'°':0xB0,'–':0x96,'—':0x97,'’':0x92,'‘':0x91,'“':0x93,'”':0x94,'€':0x80,'…':0x85 };
class MiniPDF {
  constructor() {
    // Tamaño de hoja global (carta por defecto). Se puede cambiar en Ajustes del
    // edificio; todos los generadores calculan su diseño a partir de W/H, así que
    // al cambiar el tamaño se reorganizan solos.
    var __d = (typeof window!=='undefined' && window.LK_PAPER_PT) ? window.LK_PAPER_PT() : [612, 792];
    this.W = __d[0]; this.H = __d[1];
    this.pages = []; this.imgs = [];
    this._mc = document.createElement('canvas').getContext('2d');
    this.addPage();
  }
  addPage() { this.page = { ops: [] }; this.pages.push(this.page); return this.page; }
  _c(c) { return (c[0] / 255).toFixed(3) + ' ' + (c[1] / 255).toFixed(3) + ' ' + (c[2] / 255).toFixed(3); }
  _f(n) { return (Math.round(n * 100) / 100).toString(); }
  rect(x, y, w, h, c) { this.page.ops.push(`${this._c(c)} rg ${this._f(x)} ${this._f(this.H - y - h)} ${this._f(w)} ${this._f(h)} re f`); }
  rectS(x, y, w, h, c, lw) { this.page.ops.push(`${this._c(c)} RG ${this._f(lw || 0.5)} w ${this._f(x)} ${this._f(this.H - y - h)} ${this._f(w)} ${this._f(h)} re S`); }
  line(x1, y1, x2, y2, c, lw) { this.page.ops.push(`${this._c(c)} RG ${this._f(lw || 0.5)} w ${this._f(x1)} ${this._f(this.H - y1)} m ${this._f(x2)} ${this._f(this.H - y2)} l S`); }
  _enc(str) {
    let o = '';
    for (const ch of String(str)) {
      const code = ch.charCodeAt(0);
      if (ch === '(' || ch === ')' || ch === '\\') o += '\\' + ch;
      else if (code >= 32 && code <= 126) o += ch;
      else { const w = WINANSI[ch]; o += w ? '\\' + w.toString(8).padStart(3, '0') : '?'; }
    }
    return o;
  }
  textWidth(str, size, bold) { this._mc.font = `${bold ? 'bold ' : ''}${size}px Helvetica, Arial, sans-serif`; return this._mc.measureText(String(str)).width; }
  text(str, x, yTop, o) {
    o = o || {}; const size = o.size || 10, bold = !!o.bold, color = o.color || [0, 0, 0], align = o.align || 'left';
    let tx = x; const baseline = yTop + size * 0.78;
    if (align !== 'left') { const w = this.textWidth(str, size, bold); tx = align === 'right' ? x - w : x - w / 2; }
    this.page.ops.push(`BT /${bold ? 'FB' : 'FR'} ${this._f(size)} Tf ${this._c(color)} rg ${this._f(tx)} ${this._f(this.H - baseline)} Td (${this._enc(str)}) Tj ET`);
  }
  wrap(str, maxW, size, bold) {
    const out = [];
    String(str).split('\n').forEach(para => {
      const words = para.split(/\s+/); let line = '';
      words.forEach(w => {
        const t = line ? line + ' ' + w : w;
        if (this.textWidth(t, size, bold) > maxW && line) { out.push(line); line = w; }
        else line = t;
      });
      out.push(line);
    });
    return out;
  }
  image(canvas, x, yTop, w, h) {
    const jpeg = atob(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]);
    const id = this.imgs.length;
    this.imgs.push({ w: canvas.width, h: canvas.height, data: jpeg });
    this.page.ops.push(`q ${this._f(w)} 0 0 ${this._f(h)} ${this._f(x)} ${this._f(this.H - yTop - h)} cm /Im${id} Do Q`);
    return id;
  }
  build() {
    const nImg = this.imgs.length, nPage = this.pages.length;
    const FR = 3, FB = 4, imgBase = 5, pageBase = imgBase + nImg;
    const totalObjs = pageBase + nPage * 2 - 1;
    const parts = []; let bytes = 0; const offsets = {};
    const put = (s) => { parts.push(s); bytes += s.length; };
    const obj = (n, body) => { offsets[n] = bytes; put(n + ' 0 obj\n' + body + '\nendobj\n'); };
    put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    const kids = this.pages.map((_, i) => (pageBase + i * 2) + ' 0 R').join(' ');
    obj(2, `<< /Type /Pages /Kids [ ${kids} ] /Count ${nPage} >>`);
    obj(FR, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj(FB, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    this.imgs.forEach((im, i) => {
      const head = `<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.data.length} >>\nstream\n`;
      offsets[imgBase + i] = bytes;
      put((imgBase + i) + ' 0 obj\n' + head + im.data + '\nendstream\nendobj\n');
    });
    let xobj = '';
    if (nImg) xobj = ' /XObject << ' + this.imgs.map((_, i) => `/Im${i} ${imgBase + i} 0 R`).join(' ') + ' >>';
    this.pages.forEach((p, i) => {
      const pn = pageBase + i * 2, cn = pn + 1;
      obj(pn, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this._f(this.W)} ${this._f(this.H)}] /Resources << /Font << /FR ${FR} 0 R /FB ${FB} 0 R >>${xobj} >> /Contents ${cn} 0 R >>`);
      const stream = p.ops.join('\n');
      obj(cn, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    });
    const xrefPos = bytes;
    let xref = 'xref\n0 ' + (totalObjs + 1) + '\n0000000000 65535 f \n';
    for (let n = 1; n <= totalObjs; n++) xref += String(offsets[n] || 0).padStart(10, '0') + ' 00000 n \n';
    put(xref);
    put(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);
    const all = parts.join('');
    const u8 = new Uint8Array(all.length);
    for (let i = 0; i < all.length; i++) u8[i] = all.charCodeAt(i) & 0xff;
    return u8;
  }
  save(name) {
    const blob = new Blob([this.build()], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}

window.LkQR=QR; window.LkMiniPDF=MiniPDF;
})();
