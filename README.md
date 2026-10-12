# Bramar Group · Sitio web

Sitio de una sola página (HTML, CSS y JavaScript puro, sin dependencias) para Bramar Group, administración integral de edificios y condominios en Santa Cruz, Bolivia.

Publicado con GitHub Pages: https://osirissecuritybo-cpu.github.io/BRAMAR-PAGINA/

## Estructura

```
index.html                  Todo el sitio (estilos, contenido y scripts)
img/
  torre-zafiro.jpg          Foto principal (portada de Inicio)
  torre-zafiro-mini.jpg     Miniatura para la tarjeta flotante
  oficina.jpg               Oficinas (portada de Nosotros)
  edificio-*.jpg            Edificios gestionados
  isotipo-azul.png          Logo del menú
  isotipo-blanco.png
  logo-blanco.png           Logo del pie de página
  favicon.png               Ícono de la pestaña
  apple-touch-icon.png      Ícono al guardar en el celular
```

El sitio tiene 5 páginas independientes dentro de `index.html`: `#inicio`, `#nosotros`, `#servicios`, `#edificios` y `#contacto`. Cada enlace del menú cambia de página con una transición, actualiza la dirección y el título de la pestaña, y funciona con el botón "atrás" del navegador.

## Cómo editar los datos de contacto

Abra `index.html` y busque el bloque `const SITE = { ... }` (al inicio del script, cerca del final del archivo):

| Campo | Qué hace |
|---|---|
| `phone` | Teléfono que se muestra en Contacto y en el pie (enlace para llamar). |
| `email` | Correo que se muestra y al que llegan los mensajes si no hay `formEndpoint`. |
| `address` | Dirección de la oficina. |
| `whatsapp` | Número con código de país, sin `+` ni espacios (ej. `59170000000`). Activa el botón flotante de WhatsApp y el ícono en Contacto. Vacío = no se muestran. |
| `social` | URL de Instagram, Facebook y LinkedIn. Las vacías no se muestran. |
| `formEndpoint` | URL de un servicio de formularios (ver abajo). |
| `testimonials` | Lista de testimonios reales. Vacía = la sección no aparece. |

## Formulario de contacto

El formulario valida los campos y envía el mensaje de una de estas tres formas, según lo configurado:

1. **`formEndpoint` con valor**: envía los datos por internet a ese servicio y muestra "Enviando…", luego éxito o error. Recomendado. Opciones gratuitas: [Formspree](https://formspree.io), [Getform](https://getform.io) o [Basin](https://usebasin.com). Cree un formulario allí, copie su URL y péguela en `formEndpoint`.
2. **Sin `formEndpoint` pero con `whatsapp`**: abre WhatsApp con el mensaje ya escrito.
3. **Sin ninguno de los dos**: abre la aplicación de correo del visitante con el mensaje listo para enviar a `email`.

Incluye un campo oculto anti-spam.

## Pendientes

- [ ] Teléfono real (`phone`). El actual `+591 7000 0000` es provisional.
- [ ] Confirmar el correo (`email`).
- [ ] Número de WhatsApp (`whatsapp`).
- [ ] Enlaces de redes sociales (`social`).
- [ ] Servicio de formularios (`formEndpoint`) para recibir mensajes sin depender del correo del visitante.
- [ ] Testimonios reales con permiso de sus autores (`testimonials`).
- [ ] Nombres de los edificios de la galería (hoy dicen "Edificio gestionado").
- [ ] Portal de copropietarios: el botón "Copropietarios" muestra un aviso de "Portal en preparación" hasta que exista el portal.
- [ ] El archivo `Bramar Group2.html` es una versión anterior y ya no se usa; puede borrarse del repositorio.

## Accesibilidad y rendimiento

- Respeta la preferencia del sistema "reducir movimiento" (desactiva animaciones).
- Navegación completa con teclado: enlace "Saltar al contenido", foco visible, menú y ventana modal cerrables con Esc, pestañas y galería manejables con flechas.
- Las imágenes declaran su tamaño (evita saltos de diseño) y las que no se ven al inicio se cargan después.
