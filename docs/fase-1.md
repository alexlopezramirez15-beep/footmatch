# FOOTMATCH · Informe de la Fase 1 (MVP)

Fecha: 23/10/2026

## Qué se ha verificado y qué no

**Verificado en este entorno**
- `npm run build` (Next.js 16, 44 rutas) compila sin errores.
- `npm run lint` y `npm run typecheck` sin errores ni avisos.
- 32 tests en verde:
  - 13 unitarios: motor de matching y completitud del perfil.
  - 2 de i18n: los 4 idiomas tienen las mismas claves, y toda clave usada en el código existe.
  - 17 de base de datos: RLS, menores, matches, mensajes y organizaciones, ejecutados contra un Postgres 16 local con las 4 migraciones aplicadas.
- Landing y registro revisados en navegador (Chromium, móvil y escritorio, claro y oscuro), sin errores de consola ni scroll horizontal. Se detectó y corrigió un fallo del material de vidrio, que anulaba el `position` absoluto, fijo o sticky de los componentes.

**No verificado**
- No hay credenciales de Supabase en este entorno, así que ningún flujo autenticado se ha probado de extremo a extremo con Auth, Storage y Realtime reales: registro con email, subida de fotos, chat en vivo, etc.
- Las pantallas autenticadas no se han visto en navegador.
- No se ha desplegado en ningún sitio.
- La lógica SQL de esos flujos sí está cubierta por los tests de base de datos, pero el siguiente paso imprescindible es probarlo todo con un proyecto Supabase real.

## Funcionalidades

- **Design system Liquid Glass** (`src/components/glass`)
  - Materiales thin, regular, elevated y tinted, con reflejo y borde iluminado.
  - Botones, inputs, segmented control, chips, badges, avatares y anillo de progreso.
  - Bottom sheet arrastrable, modal, toasts, navbar y tab bar.
  - Modo claro, oscuro y sistema sin parpadeo; respeta `prefers-reduced-motion`; háptica en móvil.
- **Landing, legal, PWA**
  - Landing pública con selector de idioma.
  - Términos y privacidad como borrador en es y en.
  - Manifest, iconos, service worker con página offline, y páginas 404 y de error.
- **Autenticación**
  - Registro, login, recuperación y cambio de contraseña.
  - Confirmación por email, logout y protección de rutas en `proxy.ts`.
- **Onboarding por rol**
  - Jugador: asistente de 8 pasos con fotos y vídeo.
  - Club o academia: asistente de 6 pasos con escudo.
  - Profesional (entrenador o agente).
  - Tutor legal: invitación, aceptación y panel `/guardian` para autorizar o revocar.
- **Perfiles**
  - Jugador, con anillo de completitud y edición por secciones.
  - Club, con panel de KPIs, miembros, equipos, verificación y cambio de organización.
  - Vista pública de jugador y de club.
- **Home** por rol: actividad, matches recientes, oportunidades recomendadas y accesos rápidos.
- **Discover**
  - Swipe con gestos, botones y teclado; deshacer el último descarte; favoritos.
  - Filtros guardados por usuario.
  - El club elige para qué oportunidad busca.
- **Matching determinista y explicable** (`src/domains/matching`)
  - Puntuación ponderada por posición, edad, categoría, ubicación, disponibilidad, idiomas, pierna y altura.
  - Motivos visibles en cada tarjeta.
  - Pesos editables por el admin. Sin aleatoriedad.
- **Intereses y match**
  - Like, superlike y pass.
  - El interés recíproco crea un match, la conversación y notificaciones, con overlay animado.
- **Oportunidades**
  - Crear, editar y cambiar estado (borrador, abierta, pausada, cerrada).
  - Listados por tipo y detalle con encaje.
- **Candidaturas**
  - El jugador aplica y retira, y sigue su progreso con una línea temporal.
  - El club gestiona un pipeline Kanban (arrastrar y soltar en escritorio, pestañas en móvil), con responsable, notas, historial y contacto.
- **Pruebas (trials)**
  - Crear y proponer en el chat.
  - El jugador se inscribe.
  - El club acepta o rechaza y evalúa con 5 criterios.
- **Chat en tiempo real**
  - Mensajes, leído, escribiendo y adjuntos (imágenes en WebP y PDF).
  - Silenciar, archivar, bloquear y reportar.
  - Los menores sólo pueden recibir mensajes con autorización del tutor.
- **Notificaciones en vivo**, favoritos y búsqueda global.
- **Ajustes**
  - Idioma, tema y notificaciones.
  - Privacidad: visibilidad del perfil y exportación RGPD en JSON.
  - Gestión del tutor legal.
- **Admin** (`/admin`)
  - Resumen y verificación de clubes y agentes.
  - Reportes, suspensión de usuarios y organizaciones.
  - Pesos del matching, auditoría y purga de datos demo.
- **i18n completo**: es, ca, en y pl en todas las pantallas.

## Migraciones (`supabase/migrations`)

1. `20261023000001_core_schema.sql`: tablas, enums e índices.
2. `20261023000002_security.sql`: RLS de todas las tablas, vistas enmascaradas y funciones de permisos.
3. `20261023000003_business_logic.sql`: RPCs e interés → match, conversaciones, candidaturas, pruebas, tutor legal, bloqueos, `expire_opportunities` y `purge_demo_data`.
4. `20261023000004_storage_realtime.sql`: buckets y políticas de Storage, y publicación de Realtime.

`supabase/seed.sql` contiene datos demo, todos con `is_demo = true` y la etiqueta DEMO. Los usuarios demo no pueden iniciar sesión.

## Configuración pendiente (necesito que lo hagas tú)

1. Crear el proyecto Supabase y rellenar `.env.local` (ver `.env.example`).
2. Aplicar las migraciones y, si quieres, el seed.
3. Configurar en Supabase Auth la Site URL y las Redirect URLs (`/auth/callback`, `/auth/confirm`).
4. Insertar tu usuario en `platform_admins`.
5. Programar `expire_opportunities` con pg_cron.
6. Hacer revisar los textos legales por un abogado y traducirlos a ca y pl (hoy sólo hay es y en, con aviso).
7. Opcional: SMTP propio en Supabase para los emails, y desplegar en Vercel u otro proveedor.

Los pasos exactos están en el `README.md`.

## Problemas conocidos y limitaciones

- No hay tests end-to-end de navegador sobre flujos autenticados, porque requieren Supabase real.
- Los profesionales (entrenadores y agentes) tienen perfil y onboarding, pero Discover para ellos queda para la Fase 2.
- Los clubes no pueden inscribir jugadores en una prueba directamente: lo envían como propuesta en el chat y el jugador se inscribe. Es una decisión de seguridad.
- Las notificaciones push del navegador y los emails transaccionales propios no están implementados. Sólo hay notificaciones dentro de la app y los emails de Auth de Supabase.

## Siguiente fase propuesta (Fase 2)

1. Probar todo contra Supabase real y añadir tests E2E con Playwright.
2. Discover y herramientas para agentes y entrenadores (representados, mandatos).
3. Estadísticas y trayectoria verificadas (estilo Transfermarkt), y vídeos destacados con recorte.
4. Notificaciones push (Web Push) y emails transaccionales.
5. Planes de pago para clubes y analítica del pipeline.
