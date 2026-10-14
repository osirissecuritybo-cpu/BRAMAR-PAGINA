/* ================================================================
   BRAMAR · Cifrado de los datos del portal de copropietarios
   ----------------------------------------------------------------
   Cada departamento tiene un archivo propio en data/u/. El nombre
   del archivo y la clave de cifrado se calculan a partir del
   edificio, el departamento y el código de acceso del propietario.
   Sin el código correcto el archivo no se encuentra ni se puede leer.
   Lo usan copropietarios.html (para leer) y generador.html (para crear).
   ================================================================ */
(function (global) {
  "use strict";
  const ITERATIONS = 150000;              // PBKDF2: hace lento probar códigos al azar
  const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // sin 0/O/1/I/L para evitar confusiones
  const enc = new TextEncoder(), dec = new TextDecoder();

  const normCode = s => String(s || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  const normDepto = s => String(s ?? "").toUpperCase().replace(/\s+/g, "").replace(/^DEPTO\.?|^DPTO\.?/, "");
  const normId = s => String(s || "").trim().toLowerCase();
  const formatCode = s => { const c = normCode(s); return c.length > 5 ? c.slice(0, 5) + "-" + c.slice(5) : c; };

  function newCode(len = 10) {
    const out = [], rnd = crypto.getRandomValues(new Uint32Array(len));
    for (let i = 0; i < len; i++) out.push(ALPHABET[rnd[i] % ALPHABET.length]);
    return out.join("");
  }

  const b64 = buf => { const a = new Uint8Array(buf); let s = "";
    for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode.apply(null, a.subarray(i, i + 8192));
    return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");

  async function fileId(edificio, depto, code) {
    const h = await crypto.subtle.digest("SHA-256", enc.encode(`${normId(edificio)}|${normDepto(depto)}|${normCode(code)}`));
    return hex(h).slice(0, 40);
  }

  // raw=true: contraseña personal tal cual (distingue mayúsculas); raw=false: código de acceso normalizado
  async function deriveKey(code, salt, raw) {
    const base = await crypto.subtle.importKey("raw", enc.encode(raw ? String(code) : normCode(code)), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  async function encrypt(obj, code, raw) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(code, salt, raw);
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj)));
    return { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
  }

  async function decrypt(file, code, raw) {
    const key = await deriveKey(code, unb64(file.salt), raw);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(file.iv) }, key, unb64(file.ct));
    return JSON.parse(dec.decode(pt));
  }

  /* Contraseña personal: se guarda en el servidor de Bramar (Apps Script) solo un
     identificador y el código original cifrado con la contraseña. El servidor nunca
     ve ni la contraseña ni el código. */
  async function aliasId(edificio, depto, password) {
    const h = await crypto.subtle.digest("SHA-256", enc.encode(`alias|${normId(edificio)}|${normDepto(depto)}|${String(password)}`));
    return hex(h).slice(0, 48);
  }
  /* Clave para consultar el estado de los comprobantes de un departamento.
     Solo la puede calcular quien conoce el código de acceso. */
  async function receiptKey(edificio, depto, code) {
    const h = await crypto.subtle.digest("SHA-256", enc.encode(`recibos|${normId(edificio)}|${normDepto(depto)}|${normCode(code)}`));
    return hex(h).slice(0, 48);
  }
  const wrapCode = (code, password) => encrypt({ code: normCode(code) }, password, true);
  const unwrapCode = async (blob, password) => (await decrypt(blob, password, true)).code;

  global.BramarCrypto = { normCode, normDepto, normId, formatCode, newCode, fileId, encrypt, decrypt, aliasId, receiptKey, wrapCode, unwrapCode };
})(window);
