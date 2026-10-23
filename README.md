# FOOTMATCH

Plataforma de fútbol que conecta jugadores, clubes, academias, entrenadores y agentes: descubrimiento tipo swipe, matching deportivo determinista y explicable, oportunidades, candidaturas, pruebas y chat. Diseño **Liquid Glass** (claro/oscuro), PWA instalable y traducida a español, catalán, inglés y polaco.

> Estado: **Fase 1 (MVP)**. Informe de la fase: [`docs/fase-1.md`](docs/fase-1.md).

## Stack

- Next.js 16 (App Router, Server Actions, `proxy.ts`), React 19, TypeScript estricto
- Tailwind CSS v4 + sistema de diseño propio en `src/components/glass`
- Supabase: Postgres con RLS en todas las tablas, Auth, Storage, Realtime
- zod (validación en servidor y cliente), motion (animaciones), lucide-react
- Vitest (tests unitarios y de seguridad de base de datos)

## Puesta en marcha

1. **Crea un proyecto en Supabase** y copia la URL y la anon key.
2. `cp .env.example .env.local` y rellena las variables.
3. **Aplica las migraciones** (en orden) de `supabase/migrations/`:
   - Con la CLI: `supabase link --project-ref <ref>` y `supabase db push`
   - O pega cada archivo en el SQL Editor del panel.
4. **(Opcional) Datos demo**: ejecuta `supabase/seed.sql`. Todo lo que crea lleva `is_demo = true` y se muestra con la etiqueta *DEMO*. Para borrarlo antes del lanzamiento: `select public.purge_demo_data();` (o desde Admin → Resumen).
5. **Auth** (Authentication → URL Configuration):
   - Site URL: tu `NEXT_PUBLIC_SITE_URL`
   - Redirect URLs: `<SITE_URL>/auth/callback` y `<SITE_URL>/auth/confirm`
6. **Primer administrador**: regístrate en la app y ejecuta en SQL
   `insert into public.platform_admins(user_id) select id from auth.users where email = 'tu@email.com';`
7. **Caducidad de oportunidades** (recomendado): activa la extensión `pg_cron` y programa
   `select cron.schedule('expire-opportunities', '15 3 * * *', 'select public.expire_opportunities()');`
8. `npm install` y `npm run dev` → http://localhost:3000

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y servidor de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir |
| `npm test` | Tests unitarios (matching, completitud de perfil, i18n) |
| `npm run test:db` | Tests de RLS y lógica SQL contra un Postgres local (ver abajo) |

### Tests de base de datos

Necesitan un Postgres 15+ vacío. Aplican `supabase/tests/supabase_stub.sql` (simula `auth`, `storage` y roles de Supabase) y todas las migraciones, y comprueban que cada rol sólo ve y modifica lo que le corresponde (menores, perfiles privados, intereses, matches, mensajes, organizaciones).

```bash
TEST_DATABASE_URL="postgres://postgres@localhost:5432/postgres" npm run test:db
```

## Estructura

```
src/app/            Rutas (App Router). (app)/ = zona autenticada con barra de pestañas
src/components/     glass/ = design system; resto por dominio
src/domains/        Lógica por dominio: queries, server actions, matching, validación
src/i18n/           Configuración y mensajes (es, ca, en, pl)
supabase/           Migraciones, seed demo y stub para tests
```

## Seguridad y menores

- RLS en todas las tablas; las vistas `public_profiles` y `player_cards` enmascaran datos sensibles (nunca exponen fecha de nacimiento exacta; a menores no se les muestra ciudad ni apellidos).
- Un menor sólo es visible y contactable por organizaciones **verificadas** y tras la autorización de su madre, padre o tutor legal (flujo en `/guardian`).
- Bloqueos, reportes, moderación y registro de auditoría en el panel `/admin`.
- Exportación de datos personales (RGPD) en Ajustes → Privacidad.

Los textos legales de `src/domains/legal/texts.ts` son un **borrador** y deben revisarse por un profesional antes del lanzamiento.
