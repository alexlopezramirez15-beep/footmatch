/**
 * Pruebas de seguridad y lógica de negocio contra PostgreSQL real.
 * Aplica supabase/tests/supabase_stub.sql + todas las migraciones en una BD nueva.
 *
 *   TEST_DATABASE_URL=postgres://postgres@localhost:54322/postgres npm run test:db
 *
 * Si TEST_DATABASE_URL no está definida, la suite se omite.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const URL = process.env.TEST_DATABASE_URL;
const DB = "footmatch_rls_test";
const root = path.resolve(__dirname, "../..");

let admin: Client;
let db: Client;

type U = { id: string; email: string };
const users: Record<string, U> = {};

async function as<T>(u: U | null, fn: (c: Client) => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    if (u) {
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: u.id, email: u.email, role: "authenticated" })]);
    }
    const r = await fn(db);
    await db.query("commit");
    return r;
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}

async function createUser(key: string, fullName: string, birth: string | null) {
  const email = `${key}@test.footmatch`;
  const { rows } = await db.query("insert into auth.users(email, raw_user_meta_data) values ($1, $2) returning id", [email, { full_name: fullName }]);
  users[key] = { id: rows[0].id, email };
  await db.query("update public.profiles set birth_date = $2, country = 'ES', region = 'Cataluña', city = 'Barcelona' where id = $1", [rows[0].id, birth]);
  return users[key];
}

const yearsAgo = (y: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - y);
  d.setDate(d.getDate() - 10);
  return d.toISOString().slice(0, 10);
};

describe.skipIf(!URL)("RLS y reglas de negocio", () => {
  let orgId: string;
  let otherOrgId: string;
  let oppId: string;

  beforeAll(async () => {
    admin = new Client({ connectionString: URL });
    await admin.connect();
    await admin.query(`drop database if exists ${DB}`);
    await admin.query(`create database ${DB}`);
    const u = new globalThis.URL(URL!);
    u.pathname = `/${DB}`;
    db = new Client({ connectionString: u.toString() });
    await db.connect();
    await db.query(readFileSync(path.join(root, "supabase/tests/supabase_stub.sql"), "utf8"));
    const dir = path.join(root, "supabase/migrations");
    for (const f of readdirSync(dir).sort()) await db.query(readFileSync(path.join(dir, f), "utf8"));

    await createUser("player", "Marc Garcia Puig", yearsAgo(18));
    await createUser("other", "Otro Jugador", yearsAgo(20));
    await createUser("club", "Laura Club", yearsAgo(40));
    await createUser("club2", "Pere Club", yearsAgo(45));
    await createUser("minor", "Nil Ferrer Soler", yearsAgo(15));
    await createUser("guardian", "Marta Soler", yearsAgo(44));
    await createUser("root", "Admin", yearsAgo(35));
    await db.query("insert into public.platform_admins(user_id) values ($1)", [users.root.id]);

    for (const k of ["player", "other", "minor"]) {
      await as(users[k], (c) => c.query(
        `insert into public.player_profiles(user_id, position, category, availability, visibility) values ($1, 'RW', 'u19_dh', 'seeking_club', 'clubs_only')`,
        [users[k].id]));
    }
    orgId = await as(users.club, async (c) => (await c.query(
      `insert into public.organizations(type, name, country, region, city, created_by) values ('club','CF Demo Test','ES','Cataluña','Sabadell',$1) returning id`,
      [users.club.id])).rows[0].id);
    otherOrgId = await as(users.club2, async (c) => (await c.query(
      `insert into public.organizations(type, name, country, created_by) values ('club','UE Sin Verificar','ES',$1) returning id`,
      [users.club2.id])).rows[0].id);
    oppId = await as(users.club, async (c) => (await c.query(
      `insert into public.opportunities(organization_id, created_by, title, positions, age_min, age_max, category) values ($1,$2,'Buscamos extremo derecho',ARRAY['RW'],16,19,'u19_dh') returning id`,
      [orgId, users.club.id])).rows[0].id);
  });

  afterAll(async () => {
    await db?.end();
    await admin?.query(`drop database if exists ${DB}`);
    await admin?.end();
  });

  it("el creador es propietario y no puede autoverificar su club", async () => {
    const m = await as(users.club, (c) => c.query("select role from public.organization_members where organization_id = $1", [orgId]));
    expect(m.rows[0].role).toBe("owner");
    await expect(as(users.club, (c) => c.query("update public.organizations set verification_status = 'verified' where id = $1", [orgId])))
      .rejects.toThrow(/administrador/);
    await as(users.root, (c) => c.query("select public.admin_set_org_verification($1, 'verified')", [orgId]));
    const o = await as(users.club, (c) => c.query("select verification_status from public.organizations where id = $1", [orgId]));
    expect(o.rows[0].verification_status).toBe("verified");
  });

  it("un jugador no puede leer el perfil privado de otro", async () => {
    const r = await as(users.other, (c) => c.query("select * from public.profiles where id = $1", [users.player.id]));
    expect(r.rowCount).toBe(0);
    const pp = await as(users.other, (c) => c.query("select * from public.player_profiles where user_id = $1", [users.player.id]));
    expect(pp.rowCount).toBe(0);
    const card = await as(users.other, (c) => c.query("select * from public.player_cards where user_id = $1", [users.player.id]));
    expect(card.rowCount).toBe(0); // visibilidad "clubs_only"
  });

  it("un club ve tarjetas de jugadores adultos, nunca la fecha de nacimiento", async () => {
    const r = await as(users.club, (c) => c.query("select * from public.player_cards where user_id = $1", [users.player.id]));
    expect(r.rowCount).toBe(1);
    expect(r.rows[0].age).toBe(18);
    expect(r.rows[0]).not.toHaveProperty("birth_date");
  });

  it("las vistas enmascaradas no permiten escribir", async () => {
    await expect(as(users.other, (c) => c.query("update public.public_profiles set avatar_path = 'x' where id = $1", [users.player.id])))
      .rejects.toThrow(/permission denied/);
  });

  it("menores: invisibles sin autorización parental", async () => {
    const r = await as(users.club, (c) => c.query("select 1 from public.player_cards where user_id = $1", [users.minor.id]));
    expect(r.rowCount).toBe(0);
    await expect(as(users.minor, (c) => c.query("insert into public.applications(opportunity_id, applicant_id) values ($1, $2)", [oppId, users.minor.id])))
      .rejects.toThrow(/row-level security/);
    await expect(as(users.minor, (c) => c.query(
      "insert into public.interests(actor_id, target_type, target_opportunity_id, kind) values ($1,'opportunity',$2,'like')", [users.minor.id, oppId])))
      .rejects.toThrow(/row-level security/);
  });

  it("menores: el tutor autoriza y sólo organizaciones verificadas los ven, sin ciudad ni apellidos", async () => {
    const token = await as(users.minor, async (c) => (await c.query(
      "insert into public.guardian_relationships(minor_id, guardian_email, relationship) values ($1, $2, 'mother') returning token",
      [users.minor.id, users.guardian.email])).rows[0].token);
    await expect(as(users.other, (c) => c.query("select public.accept_guardian_invite($1)", [token]))).rejects.toThrow(/otra dirección/);
    await as(users.guardian, (c) => c.query("select public.accept_guardian_invite($1)", [token]));

    const verified = await as(users.club, (c) => c.query("select display_name, city from public.player_cards where user_id = $1", [users.minor.id]));
    expect(verified.rowCount).toBe(1);
    expect(verified.rows[0].display_name).toBe("Nil F.");
    expect(verified.rows[0].city).toBeNull();
    const unverified = await as(users.club2, (c) => c.query("select 1 from public.player_cards where user_id = $1", [users.minor.id]));
    expect(unverified.rowCount).toBe(0);
    const g = await as(users.guardian, (c) => c.query("select full_name from public.profiles where id = $1", [users.minor.id]));
    expect(g.rows[0].full_name).toBe("Nil Ferrer Soler");
  });

  it("interés unilateral no crea match; el recíproco sí, con conversación y notificaciones", async () => {
    await as(users.player, (c) => c.query(
      "insert into public.interests(actor_id, target_type, target_opportunity_id, kind) values ($1,'opportunity',$2,'like')", [users.player.id, oppId]));
    let m = await as(null, (c) => c.query("select count(*)::int n from public.matches"));
    expect(m.rows[0].n).toBe(0);

    // El club ve que el jugador está interesado
    const seen = await as(users.club, (c) => c.query("select 1 from public.interests where actor_id = $1", [users.player.id]));
    expect(seen.rowCount).toBe(1);

    await as(users.club, (c) => c.query(
      "insert into public.interests(actor_id, actor_org_id, target_type, target_user_id, kind) values ($1,$2,'player',$3,'like')",
      [users.club.id, orgId, users.player.id]));
    m = await as(null, (c) => c.query("select * from public.matches"));
    expect(m.rowCount).toBe(1);
    expect(m.rows[0].opportunity_id).toBe(oppId);

    const conv = await as(users.player, (c) => c.query("select id from public.conversations"));
    expect(conv.rowCount).toBe(1);
    const n = await as(users.player, (c) => c.query("select type from public.notifications where type = 'matches.new'"));
    expect(n.rowCount).toBe(1);
    const nClub = await as(users.club, (c) => c.query("select type from public.notifications where type = 'matches.new'"));
    expect(nClub.rowCount).toBe(1);
  });

  it("no se duplican intereses ni matches", async () => {
    await expect(as(users.club, (c) => c.query(
      "insert into public.interests(actor_id, actor_org_id, target_type, target_user_id, kind) values ($1,$2,'player',$3,'superlike')",
      [users.club.id, orgId, users.player.id]))).rejects.toThrow(/duplicate key/);
    const m = await as(null, (c) => c.query("select count(*)::int n from public.matches"));
    expect(m.rows[0].n).toBe(1);
  });

  it("mensajes: sólo participantes autorizados", async () => {
    const cid = (await as(users.player, (c) => c.query("select id from public.conversations"))).rows[0].id;
    await as(users.player, (c) => c.query("insert into public.messages(conversation_id, sender_id, body) values ($1,$2,'Hola!')", [cid, users.player.id]));
    const read = await as(users.club, (c) => c.query("select body from public.messages where conversation_id = $1 and kind = 'text'", [cid]));
    expect(read.rows.map((r) => r.body)).toEqual(["Hola!"]);
    const outsider = await as(users.other, (c) => c.query("select 1 from public.messages where conversation_id = $1", [cid]));
    expect(outsider.rowCount).toBe(0);
    await expect(as(users.other, (c) => c.query("insert into public.messages(conversation_id, sender_id, body) values ($1,$2,'spam')", [cid, users.other.id])))
      .rejects.toThrow(/row-level security/);
    await expect(as(users.club2, (c) => c.query("insert into public.messages(conversation_id, sender_id, body) values ($1,$2,'spam')", [cid, users.club2.id])))
      .rejects.toThrow(/row-level security/);
    // Un jugador no puede enviar propuestas de prueba (sólo la organización)
    await expect(as(users.player, (c) => c.query("insert into public.messages(conversation_id, sender_id, kind) values ($1,$2,'trial_proposal')", [cid, users.player.id])))
      .rejects.toThrow(/row-level security/);
    const notif = await as(users.club, (c) => c.query("select 1 from public.notifications where type = 'messages.new'"));
    expect(notif.rowCount).toBe(1);
  });

  it("candidaturas: historial de estados, notas internas privadas", async () => {
    const appId = await as(users.player, async (c) => (await c.query(
      "insert into public.applications(opportunity_id, applicant_id, status) values ($1,$2,'selected') returning id, status", [oppId, users.player.id])).rows[0]);
    expect(appId.status).toBe("received"); // el estado lo fija el servidor
    await expect(as(users.player, (c) => c.query("insert into public.applications(opportunity_id, applicant_id) values ($1,$2)", [oppId, users.player.id])))
      .rejects.toThrow(/duplicate key/);
    await expect(as(users.player, (c) => c.query("update public.applications set status = 'selected' where id = $1", [appId.id])))
      .rejects.toThrow(/sólo puede retirar/);

    await as(users.club, (c) => c.query("update public.applications set status = 'shortlisted', assigned_to = $2 where id = $1", [appId.id, users.club.id]));
    await as(users.club, (c) => c.query("insert into public.application_notes(application_id, organization_id, author_id, body) values ($1,$2,$3,'Muy rápido en 1v1')",
      [appId.id, orgId, users.club.id]));

    const hist = await as(users.player, (c) => c.query("select to_status from public.application_status_history where application_id = $1 order by id", [appId.id]));
    expect(hist.rows.map((r) => r.to_status)).toEqual(["received", "shortlisted"]);
    const notes = await as(users.player, (c) => c.query("select * from public.application_notes"));
    expect(notes.rowCount).toBe(0);
    const notesOther = await as(users.club2, (c) => c.query("select * from public.application_notes"));
    expect(notesOther.rowCount).toBe(0);
    const clubNotes = await as(users.club, (c) => c.query("select * from public.application_notes"));
    expect(clubNotes.rowCount).toBe(1);
    const otherClub = await as(users.club2, (c) => c.query("select * from public.applications"));
    expect(otherClub.rowCount).toBe(0);

    await as(users.player, (c) => c.query("update public.applications set status = 'withdrawn' where id = $1", [appId.id]));
  });

  it("un club sólo gestiona sus propias oportunidades", async () => {
    const r = await as(users.club2, (c) => c.query("update public.opportunities set title = 'hackeado' where id = $1 returning id", [oppId]));
    expect(r.rowCount).toBe(0);
    await expect(as(users.club2, (c) => c.query(
      "insert into public.opportunities(organization_id, created_by, title) values ($1,$2,'Falsa')", [orgId, users.club2.id])))
      .rejects.toThrow(/row-level security/);
  });

  it("estadísticas declaradas: el jugador no puede marcarlas como verificadas", async () => {
    const r = await as(users.player, async (c) => (await c.query(
      "insert into public.player_statistics(player_id, season, goals, source) values ($1,'2025/26',12,'verified') returning source", [users.player.id])).rows[0]);
    expect(r.source).toBe("declared");
  });

  it("bloquear corta la conversación", async () => {
    const cid = (await as(users.player, (c) => c.query("select id from public.conversations"))).rows[0].id;
    await as(users.player, (c) => c.query("select public.block_user($1)", [users.club.id]));
    await expect(as(users.club, (c) => c.query("insert into public.messages(conversation_id, sender_id, body) values ($1,$2,'hola')", [cid, users.club.id])))
      .rejects.toThrow(/row-level security/);
  });

  it("sólo el admin accede a auditoría y métricas", async () => {
    const a = await as(users.club, (c) => c.query("select * from public.audit_logs"));
    expect(a.rowCount).toBe(0);
    await expect(as(users.club, (c) => c.query("select public.admin_metrics()"))).rejects.toThrow(/administradores/);
    const m = await as(users.root, async (c) => (await c.query("select public.admin_metrics() m")).rows[0].m);
    expect(m.matches).toBe(1);
    const audit = await as(users.root, (c) => c.query("select action from public.audit_logs where action = 'match.created'"));
    expect(audit.rowCount).toBe(1);
  });

  it("nadie puede autoproclamarse administrador ni insertar notificaciones", async () => {
    await expect(as(users.other, (c) => c.query("insert into public.platform_admins(user_id) values ($1)", [users.other.id])))
      .rejects.toThrow(/row-level security/);
    await expect(as(users.other, (c) => c.query("insert into public.notifications(user_id, type, title) values ($1,'x','x')", [users.player.id])))
      .rejects.toThrow(/row-level security/);
    await expect(as(users.other, (c) => c.query("select public.notify($1,'x','x',null,null)", [users.player.id])))
      .rejects.toThrow(/permission denied/);
  });

  it("eliminación de cuenta anonimiza los datos", async () => {
    await as(users.other, (c) => c.query("select public.delete_my_account()"));
    const p = await as(null, (c) => c.query("select full_name, birth_date, deleted_at from public.profiles where id = $1", [users.other.id]));
    expect(p.rows[0].full_name).toBe("Usuario eliminado");
    expect(p.rows[0].birth_date).toBeNull();
    expect(p.rows[0].deleted_at).not.toBeNull();
    const pp = await as(null, (c) => c.query("select 1 from public.player_profiles where user_id = $1", [users.other.id]));
    expect(pp.rowCount).toBe(0);
  });
});
