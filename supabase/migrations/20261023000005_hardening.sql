-- =====================================================================
-- FOOTMATCH · Endurecimiento (recomendaciones del linter de Supabase)
-- =====================================================================

-- search_path fijo en funciones sin security definer
alter function public.touch_updated_at() set search_path = '';
alter function public.guard_opportunities() set search_path = '';
alter function public.safe_uuid(text) set search_path = '';

-- La app exige sesión: ninguna función security definer debe poder llamarse de forma anónima.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.prosecdef loop
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;
end $$;

-- Las funciones de trigger no se invocan por la API (los triggers no comprueban EXECUTE).
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.prorettype = 'trigger'::regtype loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- Funciones creadas en el futuro: sin ejecución anónima por defecto.
alter default privileges in schema public revoke execute on functions from public, anon;
