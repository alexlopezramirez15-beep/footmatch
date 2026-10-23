-- =====================================================================
-- FOOTMATCH · DATOS DEMOSTRATIVOS
-- Todo lo que crea este archivo lleva is_demo = true y se muestra en la
-- interfaz con la etiqueta "DEMO". Ninguna persona, club u oportunidad es real.
-- Los usuarios demo no tienen contraseña: no pueden iniciar sesión.
-- Para eliminarlos antes del lanzamiento:  select public.purge_demo_data();
-- =====================================================================
do $$
declare
  players jsonb := '[
    ["Adrià Martínez Vidal","ES","Cataluña","Barcelona",18,"ST","{CF}","u19_dh",182,"right","seeking_club","{es,ca,en}","region",true],
    ["Marc García Soler","ES","Cataluña","Sabadell",18,"RW","{LW,RM}","u19_dh",176,"left","seeking_club","{es,ca}","region",false],
    ["Pau Roca Ferrer","ES","Cataluña","Girona",19,"CB","{CDM}","u19_nacional",188,"right","open_to_offers","{es,ca}","country",true],
    ["Iker Fernández Ruiz","ES","País Vasco","Bilbao",20,"CM","{CDM,CAM}","senior_3rfef",178,"right","seeking_trial","{es,eu,en}","country",true],
    ["Hugo Navarro Gil","ES","Comunidad de Madrid","Madrid",18,"GK","{}","u19_dh",190,"right","seeking_club","{es,en}","international",true],
    ["Álvaro Sánchez Mora","ES","Andalucía","Sevilla",21,"LB","{LWB,LM}","senior_2rfef",174,"left","open_to_offers","{es}","country",false],
    ["Jakub Nowak","PL","Małopolskie","Kraków",19,"CAM","{CM,RW}","u19_dh",177,"right","seeking_club","{pl,en}","international",true],
    ["Kacper Wiśniewski","PL","Mazowieckie","Warszawa",22,"ST","{CF}","senior_3rfef",185,"right","open_to_offers","{pl,en,de}","international",true],
    ["Mateusz Kowalczyk","PL","Śląskie","Katowice",18,"RB","{RWB}","u19_nacional",179,"right","seeking_trial","{pl,en}","country",true],
    ["Lucas Moreau","FR","Occitanie","Toulouse",19,"LW","{RW,ST}","u19_dh",175,"right","seeking_club","{fr,es,en}","international",true],
    ["Théo Laurent","FR","Île-de-France","Paris",20,"CDM","{CM,CB}","senior_2rfef",183,"right","open_to_offers","{fr,en}","international",false],
    ["Nathan Dubois","FR","Auvergne-Rhône-Alpes","Lyon",18,"CF","{ST,CAM}","u19_nacional",180,"left","seeking_trial","{fr}","country",true],
    ["Tiago Ferreira","PT","Porto","Porto",19,"RW","{RM}","u19_dh",172,"right","seeking_club","{pt,es,en}","international",true],
    ["Rúben Costa","PT","Lisboa","Lisboa",21,"CB","{RB}","senior_3rfef",186,"right","open_to_offers","{pt,en}","international",true],
    ["Diogo Martins","PT","Braga","Braga",18,"CM","{CAM,CDM}","u19_preferente",176,"both","seeking_club","{pt,es}","country",true],
    ["Biel Puig Serra","ES","Islas Baleares","Palma",20,"LM","{LW,LB}","senior_regional_pref",173,"left","seeking_club","{es,ca}","region",false]
  ]';
  orgs jsonb := '[
    ["club","CE Delta del Llobregat","ES","Cataluña","Sant Boi de Llobregat","u19_dh","Club formativo con juvenil en División de Honor y primer equipo en Tercera RFEF.","Campo de césped artificial, gimnasio y sala de vídeo."],
    ["club","UD Costa Brava Nord","ES","Cataluña","Figueres","u19_nacional","Proyecto de cantera con fuerte apuesta por jugadores de la provincia.","Dos campos de fútbol 11 y residencia concertada."],
    ["club","CD Meseta Central","ES","Comunidad de Madrid","Alcalá de Henares","senior_3rfef","Club semiprofesional de la zona este de Madrid.","Estadio municipal de 3.000 localidades."],
    ["club","KS Wisła Akademicka","PL","Małopolskie","Kraków","u19_dh","Klub akademicki z silną szkółką młodzieżową.","Boisko pełnowymiarowe i centrum treningowe."],
    ["academy","Mediterranean Football Academy","ES","Comunidad Valenciana","Valencia","academy_program","Academia internacional con programas anuales y campus de verano para jugadores de 14 a 21 años.","Residencia, colegio internacional y 4 campos."],
    ["academy","Atlantic Talent Lab","PT","Lisboa","Lisboa","academy_program","Programas de tecnificación y estancias internacionales.","Centro de alto rendimiento con análisis de vídeo."]
  ]';
  p jsonb; o jsonb;
  uid uuid; oid uuid; opp uuid; staff uuid;
  i int := 0;
  org_ids uuid[] := '{}';
begin
  -- Jugadores demo
  for p in select * from jsonb_array_elements(players) loop
    i := i + 1;
    uid := gen_random_uuid();
    insert into auth.users(id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
    values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'demo.player' || i || '@demo.footmatch.invalid', jsonb_build_object('full_name', p->>0, 'is_demo', true), now(), now(), now());
    update public.profiles set
      full_name = p->>0, country = p->>1, region = p->>2, city = p->>3,
      birth_date = (current_date - make_interval(years => (p->>4)::int, days => 30 + i * 7))::date,
      primary_role = 'player', onboarding_completed = true, is_demo = true
    where id = uid;
    insert into public.user_roles(user_id, role) values (uid, 'player');
    insert into public.player_profiles(user_id, nationality, position, secondary_positions, category, height_cm, dominant_foot,
      availability, languages, mobility, willing_to_relocate, experience_years, current_club, goals, visibility, is_demo)
    values (uid, p->>1, p->>5, (p->>6)::text[], p->>7, (p->>8)::int, (p->>9)::public.dominant_foot,
      (p->>10)::public.availability_status, (p->>11)::text[], (p->>12)::public.mobility_scope, (p->>13)::boolean,
      greatest((p->>4)::int - 8, 1), 'Club demo ' || i,
      'Perfil demostrativo: busca un proyecto para competir y seguir creciendo.', 'clubs_only', true);
    insert into public.player_careers(player_id, club_name, season, category) values
      (uid, 'Club demo ' || i, '2025/26', p->>7),
      (uid, 'Escuela demo ' || i, '2023/24', 'u16_preferente');
    insert into public.player_statistics(player_id, season, competition, matches, minutes, goals, assists, source)
    values (uid, '2025/26', 'Demo', 20 + i % 8, 1400 + i * 37, case when p->>5 in ('ST','CF','RW','LW') then 6 + i % 7 else i % 3 end, i % 6, 'declared');
  end loop;

  -- Organizaciones demo (verificadas sólo a efectos de la demostración)
  i := 0;
  for o in select * from jsonb_array_elements(orgs) loop
    i := i + 1;
    staff := gen_random_uuid();
    insert into auth.users(id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
    values (staff, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'demo.staff' || i || '@demo.footmatch.invalid', jsonb_build_object('full_name', 'Responsable demo ' || i), now(), now(), now());
    update public.profiles set full_name = 'Responsable demo ' || i, primary_role = (o->>0)::public.app_role,
      birth_date = date '1985-05-05', onboarding_completed = true, is_demo = true where id = staff;
    insert into public.organizations(type, name, country, region, city, categories, description, facilities,
      verification_status, created_by, is_demo, competition)
    values ((o->>0)::public.org_type, o->>1, o->>2, o->>3, o->>4, array[o->>5], o->>6, o->>7, 'verified', staff, true, o->>5)
    returning id into oid;
    org_ids := org_ids || oid;
    insert into public.team_profiles(organization_id, name, category, gender) values
      (oid, 'Juvenil A', 'u19_dh', 'male'), (oid, 'Primer equipo', 'senior_3rfef', 'male');
  end loop;

  -- Oportunidades demo
  insert into public.opportunities(organization_id, type, title, description, country, region, city, category, positions, age_min, age_max, languages, conditions, slots, deadline, is_demo)
  values
    (org_ids[1], 'player', 'Buscamos delantero centro', 'Juvenil A en División de Honor. Buscamos un 9 con movilidad y capacidad de presión.', 'ES', 'Cataluña', 'Sant Boi de Llobregat', 'u19_dh', '{ST,CF}', 16, 18, '{es,ca}', 'Entrenamientos 4 días/semana. Material deportivo.', 1, current_date + 40, true)
  returning id into opp;
  insert into public.opportunity_requirements(opportunity_id, criterion, mandatory, weight, value) values
    (opp, 'position', true, 35, '{}'), (opp, 'age', true, 15, '{}'), (opp, 'availability', true, 10, '{}');

  insert into public.opportunities(organization_id, type, title, description, country, region, city, category, positions, age_min, age_max, languages, slots, deadline, is_demo)
  values
    (org_ids[1], 'player', 'Extremo derecho para Juvenil A', 'Extremo con desborde y finalización. Valoramos pierna cambiada.', 'ES', 'Cataluña', 'Sant Boi de Llobregat', 'u19_dh', '{RW}', 16, 19, '{}', 1, current_date + 30, true),
    (org_ids[2], 'player', 'Central zurdo para Juvenil Nacional', 'Buscamos central con buena salida de balón.', 'ES', 'Cataluña', 'Figueres', 'u19_nacional', '{CB}', 17, 19, '{es,ca}', 1, current_date + 25, true),
    (org_ids[3], 'player', 'Portero para Tercera RFEF', 'Portero joven para competir por el puesto.', 'ES', 'Comunidad de Madrid', 'Alcalá de Henares', 'senior_3rfef', '{GK}', 18, 23, '{es}', 1, current_date + 20, true),
    (org_ids[3], 'coach', 'Entrenador/a para Cadete A', 'Se requiere licencia UEFA B o superior.', 'ES', 'Comunidad de Madrid', 'Alcalá de Henares', 'u16_preferente', '{}', null, null, '{es}', 1, current_date + 35, true),
    (org_ids[4], 'player', 'Szukamy środkowego pomocnika', 'Pomocnik do drużyny juniorów (CM/CAM).', 'PL', 'Małopolskie', 'Kraków', 'u19_dh', '{CM,CAM}', 17, 19, '{pl,en}', 2, current_date + 45, true),
    (org_ids[5], 'program', 'Programa anual internacional 2027', 'Programa de alto rendimiento con residencia y estudios.', 'ES', 'Comunidad Valenciana', 'Valencia', 'academy_program', '{}', 15, 21, '{en,es}', 30, current_date + 60, true),
    (org_ids[5], 'campus', 'Campus de verano de tecnificación', 'Dos semanas de tecnificación con análisis individual.', 'ES', 'Comunidad Valenciana', 'Valencia', 'academy_program', '{}', 12, 18, '{}', 80, current_date + 90, true),
    (org_ids[6], 'trial', 'Jornada de captación en Lisboa', 'Pruebas para jugadores sub-19 de todas las posiciones.', 'PT', 'Lisboa', 'Lisboa', 'u19_preferente', '{}', 16, 19, '{pt,en,es}', 40, current_date + 28, true),
    (org_ids[2], 'player', 'Lateral derecho ofensivo', 'Lateral con recorrido para sistema de tres centrales.', 'ES', 'Cataluña', 'Figueres', 'u19_nacional', '{RB,RWB}', 16, 19, '{}', 1, current_date + 22, true);

  -- Trials demo
  insert into public.trials(organization_id, title, description, location, city, country, starts_at, ends_at, category, positions, age_min, age_max, slots, requirements, documentation, cost_info, instructions, is_demo)
  values
    (org_ids[1], 'Prueba abierta Juvenil A', 'Sesión de evaluación con el cuerpo técnico del Juvenil A.', 'Campo Municipal demo', 'Sant Boi de Llobregat', 'ES', now() + interval '12 days', now() + interval '12 days 2 hours', 'u19_dh', '{ST,RW,LW,CAM}', 16, 19, 20, 'Ficha federativa vigente o de la temporada anterior.', 'DNI/NIE y autorización parental para menores.', 'Gratuita', 'Llegar 30 minutos antes con botas de césped artificial.', true),
    (org_ids[4], 'Testy dla juniorów', 'Dwudniowe testy dla rocznika 2008-2009.', 'Centrum treningowe demo', 'Kraków', 'PL', now() + interval '20 days', now() + interval '21 days', 'u19_dh', '{}', 17, 19, 30, null, 'Dowód osobisty.', 'Bezpłatne', null, true),
    (org_ids[5], 'Selección programa anual', 'Evaluación para el programa anual internacional.', 'Ciudad deportiva demo', 'Valencia', 'ES', now() + interval '30 days', null, 'academy_program', '{}', 15, 21, 60, null, 'Pasaporte o DNI.', 'Consultar condiciones del programa', null, true),
    (org_ids[6], 'Trial day Lisboa', 'Jornada de pruebas para todas las posiciones.', 'Centro demo', 'Lisboa', 'PT', now() + interval '28 days', null, 'u19_preferente', '{}', 16, 19, 40, null, null, 'Gratuita', null, true);
end $$;
