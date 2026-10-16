# Bramar Group · Sitio web y portal de copropietarios

Sitio de Bramar Group, administración integral de edificios y condominios en Santa Cruz, Bolivia. HTML, CSS y JavaScript puro, sin servidor propio: se publica con GitHub Pages.

- Sitio: https://osirissecuritybo-cpu.github.io/BRAMAR-PAGINA/
- Portal: https://osirissecuritybo-cpu.github.io/BRAMAR-PAGINA/copropietarios.html

## Estructura

```
index.html                    Sitio público (5 páginas: inicio, nosotros, servicios, edificios, contacto)
copropietarios.html           Portal de copropietarios (perfil, estado de cuenta, pago, comprobantes)
luka/                         Gestión LUKA (administración; los datos viven en el Drive de Bramar)
js/portal-crypto.js           Lectura de los perfiles cifrados antiguos (códigos del Excel)
js/luka-recibo.js, luka-docs.js  Recibos idénticos a los de LUKA (con QR y código de verificación)
data/edificios.json           Lista de edificios que aparece en el portal (solo id y nombre)
data/u/*.json                 Un archivo cifrado por departamento
herramientas/
  apps-script-comprobantes.gs     Servidor (Google Apps Script): LUKA en la nube, portal en vivo, comprobantes y reservas
img/                          Fotos, logos e íconos
img/qr/                       Imágenes de QR de pago (una por edificio)
```

## Sitio público

Cada opción del menú es una página independiente: al cambiar, la página actual se desvanece con un leve desenfoque y la nueva aparece suavemente. La dirección y el título de la pestaña cambian, y funciona el botón "atrás".

Los datos de contacto se editan en `index.html`, en el bloque `const SITE = { ... }`:

| Campo | Qué hace |
|---|---|
| `phone` | Teléfono de Contacto y del pie (enlace para llamar). |
| `email` | Correo que se muestra y al que llegan los mensajes si no hay `formEndpoint`. |
| `whatsapp` | Número con código de país, sin `+` ni espacios. Activa el botón flotante de WhatsApp. |
| `social` | URL de Instagram, Facebook y LinkedIn. Las vacías no se muestran. |
| `formEndpoint` | URL de un servicio de formularios (Formspree, Getform, Basin). Si está vacío, el formulario abre WhatsApp con el mensaje escrito. |
| `testimonials` | Testimonios reales. Si la lista está vacía, la sección no aparece. |

## Portal de copropietarios

### Qué ve cada propietario
Entra eligiendo su edificio, escribiendo su departamento y su **contraseña personal** o su **código de acceso** original (10 caracteres, ej. `K7MF2-Q9XPR`). Si marca "Mantener mi sesión iniciada", la próxima vez entra directo sin escribir nada (se cierra con el botón "Salir").

**Contraseña personal:** dentro de su perfil, el botón "Cambiar contraseña" le permite crear una contraseña propia (mínimo 6 caracteres). Desde ese momento puede entrar con su contraseña **o** con su código original. Si la olvida, entra con el código y crea otra. Requiere el script de Google instalado (ver "Recepción de comprobantes"). Para anular la contraseña de alguien, borre su fila en la pestaña "Accesos" de la hoja "Registro de comprobantes".

Ve:

- Estado: al día, con deuda o saldo a favor.
- Deuda total, expensa mensual, vencimiento y fecha de actualización.
- Datos para el pago: banco, titular, número de cuenta (con botón copiar), NIT y QR para descargar.
- Estado de cuenta con cargos, abonos y saldo.
- Envío de comprobante: foto o PDF, monto, fecha y nota.

### Cómo se protegen los datos
GitHub Pages es público, por eso cada departamento tiene un archivo **cifrado** (AES-256). El nombre del archivo y la clave se calculan con el edificio, el departamento y el código del propietario: sin el código no se puede encontrar ni leer. El código no se guarda en ningún lado del sitio.

### Datos del portal (en vivo desde LUKA)
Ya no se sube ningún Excel. El estado de cuenta, los recibos, los datos para pagar (banco, titular, cuenta y QR) y las reservas se leen de Gestión LUKA en el momento. Los códigos de acceso de cada departamento se crean en LUKA → Configuración → Departamentos → «Portal de propietarios». Los códigos antiguos del Excel siguen funcionando (sus archivos cifrados quedan en `data/u/`).

### Recepción de comprobantes
- **Recomendado:** instale el script `herramientas/apps-script-comprobantes.gs` en la cuenta de Google de Bramar (las instrucciones están al inicio del archivo) y pegue su URL en `copropietarios.html`, en `PORTAL.endpoint`. Ese mismo script también activa las contraseñas personales. Cada comprobante se guarda en Google Drive ordenado por edificio, mes y departamento (`Comprobantes Bramar / EDIFICIO / 2026-10 Octubre / Depto 2B`), y se anota en la hoja "Registro de comprobantes" con el estado "Pendiente de verificar".
- **Mientras no esté instalado:** en el celular, el portal ofrece compartir el archivo directamente a WhatsApp. En computadora, abre WhatsApp con los datos del pago y el propietario adjunta el archivo.


## Pendientes

- [ ] URL de la página de Facebook (`SITE.social.facebook` en `index.html`).
- [x] Script de Google instalado (por ahora en la cuenta de prueba osirissecurity.bo@gmail.com, proyecto "Portal Bramar").
- [ ] Pasar el script a la cuenta bramargroupsrl@gmail.com y reemplazar la URL en `PORTAL.endpoint`.
- [ ] Cargar el Excel real de cada edificio, generar los datos y subir los QR.
- [ ] Servicio de formularios (`SITE.formEndpoint`) para el formulario de contacto (opcional).
- [ ] Testimonios reales y nombres de los edificios de la galería.
- [ ] Borrar `Bramar Group2.html` (versión anterior que ya no se usa).

## Accesibilidad y rendimiento

- Respeta la opción del sistema "reducir movimiento".
- Navegación completa con teclado y foco visible; menú cerrable con Esc.
- Imágenes con tamaño declarado y carga diferida.
