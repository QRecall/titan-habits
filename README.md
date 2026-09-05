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
