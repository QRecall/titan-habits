# TITAN

Aplicación de hábitos basada en identidad. Pocos compromisos, siempre honrados.

TITAN te permite firmar un **contrato semanal** con entre uno y tres compromisos,
cada uno con una **versión normal** y una **versión mínima** para los días
difíciles. La mínima también mantiene vivo el hábito y cuenta plenamente para
tu progreso.

## Privacidad

- **Sin backend.** No hay servidor, cuenta ni API externa.
- **Sin telemetría.** No se envían datos personales a ningún sitio.
- Toda tu información (perfil, contratos, marcas diarias y revisiones) se
  guarda exclusivamente en el **`localStorage` del navegador**, bajo la clave
  `titan.v1`. Puedes borrarla en cualquier momento desde la consola del
  navegador: `localStorage.removeItem('titan.v1')`.
- **Copias de seguridad.** En la sección **Mis datos** (botón de la cabecera)
  puedes descargar un archivo JSON con todo (`titan-copia-AAAA-MM-DD.json`,
  formato 1) y restaurarlo más tarde en cualquier navegador o dispositivo. La
  restauración valida el archivo, muestra un resumen y pide confirmación antes
  de reemplazar los datos actuales.
- **Protección de lectura.** Si lo guardado no se puede leer al arrancar, no se
  sobrescribe: se conserva intacto bajo una clave `titan.v1.ilegible-…` y la
  app avisa en **Mis datos**, desde donde puede descargarse.

## En el móvil

TITAN es una **app instalable** (PWA): desde **Mis datos** se explica cómo
añadirla a la pantalla de inicio. Instalada se abre a pantalla completa,
funciona sin conexión y el icono muestra cuántos compromisos quedan hoy.
La pantalla de Arranque muestra la racha continua entre semanas y a Titán,
la mascota, que cambia de cara según cómo va el día.

No hay recordatorios automáticos: sin servidor no es posible enviar
notificaciones cuando la app está cerrada. Una alarma del móvil a la hora
de marcar es el sustituto honesto.

## Semanas

- Cada lunes el formulario de contrato viene relleno con el de la semana
  anterior; se puede ajustar o empezar de cero.
- Desde **Revisión** se puede preparar el contrato de la próxima semana sin
  tocar el actual, y revisar tanto esta semana como la pasada.
- La racha cuenta días consecutivos con todos los compromisos en normal o
  mínimo, también a través del cambio de semana.

## Stack

React · TypeScript · Vite · CSS moderno.

## Desarrollo local

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas unitarias
npm run build      # genera dist/
npm run preview    # sirve el build
```

## Despliegue

El despliegue a GitHub Pages es automático desde la rama `main` mediante
GitHub Actions (`.github/workflows/deploy.yml`). URL pública:
`https://<usuario>.github.io/titan-habits/`.
