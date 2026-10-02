# TITAN v0.1 — Plan de implementación

**Objetivo:** app personal de hábitos basados en identidad, que privilegia pocos compromisos y una versión mínima para días difíciles. 30 días de uso personal, sin backend.

**Arquitectura:** SPA React + TypeScript, empaquetada con Vite. Estado global via `React.useReducer` + Context, persistido en `localStorage`. Sin router externo: navegación por estado. Sin dependencias de UI. Fuentes vía Google Fonts. Preparada para GitHub Pages con `base: './'`.

**Stack:** React 18, TypeScript 5, Vite 5, CSS moderno (variables, `color-mix`, grid). Ningún backend, API externa ni IA.

---

## Modelo de datos (localStorage `titan.v1`)

```ts
type CommitmentStatus = 'normal' | 'minimum' | 'missed' | null;

type Commitment = {
  id: string;          // uuid
  name: string;        // "Escribir"
  normal: string;      // "30 min sin distracciones"
  minimum: string;     // "3 frases en el cuaderno"
  reason: string;      // "porque escribo, luego soy escritor"
};

type WeeklyContract = {
  weekKey: string;     // "2026-W36"
  startDate: string;   // "YYYY-MM-DD" (lunes)
  commitments: Commitment[];
  createdAt: string;   // ISO
};

type DayEntry = {
  date: string;        // "YYYY-MM-DD"
  weekKey: string;
  marks: {
    commitmentId: string;
    status: CommitmentStatus;
    note?: string;
  }[];
};

type WeeklyReview = {
  weekKey: string;
  worked: string;
  hindered: string;
  changeNext: string;
  createdAt: string;
};

type Profile = { name: string; identity: string; onboardedAt: string };

type AppState = {
  profile: Profile | null;
  contracts: WeeklyContract[];
  days: DayEntry[];
  reviews: WeeklyReview[];
};
```

## Estructura de archivos

```
titan-app/
├── PLAN.md
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── index.html
├── public/
│   └── favicon.svg
└── src/
    ├── main.tsx                 # entrada React
    ├── App.tsx                  # shell + router basado en estado
    ├── index.css                # tokens + reset + tipografía
    ├── types.ts                 # tipos compartidos
    ├── state/
    │   ├── store.tsx            # Context + reducer + persistencia
    │   ├── date.ts              # utilidades ISO week / hoy
    │   └── coach.ts             # mensajes coach locales
    ├── components/
    │   ├── Layout.tsx           # cabecera TITAN + navegación inferior
    │   ├── CommitmentCard.tsx   # tarjeta compromiso del día
    │   ├── ProgressRing.tsx     # anillo dorado
    │   ├── Button.tsx           # botones sobrios
    │   └── Field.tsx            # inputs consistentes
    └── screens/
        ├── Onboarding.tsx
        ├── Contract.tsx
        ├── Arranque.tsx
        ├── Progress.tsx
        └── Review.tsx
```

## Diseño visual

- Fondo carbón `#0B0B0D`, panel `#131317`, elevado `#1A1B21`.
- Acento oro `#D4A64A`, brillante `#EFC66A`, tinte `rgba(212,166,74,0.14)`.
- Texto pergamino `#F5F1E8` con jerarquías apagadas.
- Tipografía: display serif **Fraunces** (peso variable), cuerpo **Manrope**, etiquetas en mayúsculas con `letter-spacing` amplio.
- Superficie con degradado sutil y borde 1px `rgba(255,255,255,0.06)`.
- Wordmark **TITAN** con tracking amplio y filete dorado.
- Frase de identidad en cursiva serif, con comillas tipográficas.
- Sin iconografía mitológica ni gaming.

## Reglas de negocio

- **Semana** = ISO week (lunes = día 1). `weekKey = "YYYY-Www"`.
- **Contrato semanal**: 1–3 compromisos; se puede regenerar en cualquier momento (crea otro contrato con el weekKey actual, sustituye).
- **Marcado**: cada compromiso del día tiene tres estados exclusivos: normal / mínimo / no realizado. Se puede cambiar durante el día. Nota opcional.
- **Progreso**:
  - Días cumplidos: días de la semana en curso donde TODOS los compromisos están en `normal` o `minimum`.
  - % cumplimiento: `(normal * 1 + minimum * 0.5) / (compromisos * díasElapsed)`.
  - Racha: días consecutivos hacia atrás con todos los compromisos ≥ mínimo (excluye días futuros y días previos al inicio del contrato).
- **Revisión semanal**: siempre disponible; permite crear el siguiente contrato (nueva semana o duplicar).
- **Coach** (local): elige mensaje según estado del día (sin marcar / todo normal / algún mínimo / algún fallo / racha ≥ 7). Tono firme y breve.

## Tareas

1. **Scaffold Vite** (`package.json`, tsconfig, vite.config, index.html, main.tsx, App.tsx placeholder). Instalar dependencias.
2. **Tokens y tipografía** en `index.css` (variables CSS, reset, cargar fuentes).
3. **Types + store** con Context/reducer y persistencia `titan.v1`.
4. **Utilidades**: `date.ts` (ISO week + hoy), `coach.ts` (selección de mensaje).
5. **Layout** (cabecera TITAN + nav inferior) y componentes básicos (Button, Field, ProgressRing, CommitmentCard).
6. **Onboarding**: nombre + frase de identidad.
7. **Contrato**: crear/editar 1–3 compromisos.
8. **Arranque**: saludo, identidad, coach, tarjetas del día, notas.
9. **Progreso**: días cumplidos, %, racha, desglose por compromiso.
10. **Revisión**: qué funcionó / qué dificultó / qué cambiar + botón "crear contrato próxima semana".
11. **Accesibilidad**: focos visibles, roles/labels, contraste ≥ AA en texto principal.
12. **Responsive**: mobile-first, contenedor 560px máx, nav inferior con teclado.
13. **Datos de ejemplo opcionales**: función "cargar demo" en Onboarding para probar (sin activarse automáticamente).
14. **Build y correcciones**: `npm run build`, arreglar errores TS/ESLint.

## Restricciones honradas

- Sin backend / API externa / IA.
- Sin librerías UI, calendario, red social ni gamificación.
- Datos exclusivamente locales.
- Publicable en GitHub Pages sin cambios (usa `base: './'`).
