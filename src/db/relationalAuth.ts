import fs from "node:fs";
import path from "node:path";
import { pool } from "./index.ts";

export const RELATIONAL_AUTH_MIGRATION_KEY = "documents-auth-directory-relational-v1";

type QueryClient = Awaited<ReturnType<typeof pool.connect>>;

const optionalString = (value: unknown) => {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value);
  return normalized.length > 0 ? normalized : undefined;
};

const booleanValue = (value: unknown) => value === true || value === 1 || value === "1" || value === "true";

export async function ensureRelationalAuthSchema() {
  const schemaPath = path.join(process.cwd(), "database", "schema", "edupanel-relational-auth-schema.sql");
  if (!fs.existsSync(schemaPath)) throw new Error(`İlişkisel kullanıcı şeması bulunamadı: ${schemaPath}`);
  const statements = fs.readFileSync(schemaPath, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
  for (const statement of statements) await pool.query(statement);
}

export async function isRelationalAuthReady() {
  const result = await pool.query(
    "SELECT migration_key FROM edupanel_migrations WHERE migration_key=?",
    [RELATIONAL_AUTH_MIGRATION_KEY],
  );
  return result.rowCount > 0;
}

export async function loadRelationalAuthState(): Promise<any | null> {
  const [settings, schools, schoolModules, users, permissions] = await Promise.all([
    pool.query("SELECT * FROM panel_yetkilendirme_ayarlari WHERE ayar_id=1 LIMIT 1"),
    pool.query("SELECT * FROM panel_okullari ORDER BY uygulama_okul_id"),
    pool.query("SELECT * FROM panel_okul_modulleri ORDER BY uygulama_okul_id, modul_id"),
    pool.query("SELECT * FROM kullanicilar ORDER BY kullanici_id"),
    pool.query("SELECT * FROM kullanici_modul_izinleri ORDER BY kullanici_id, modul_id"),
  ]);
  if (!settings.rowCount || !schools.rowCount || !users.rowCount) return null;

  const modulesBySchool = new Map<string, string[]>();
  for (const row of schoolModules.rows) {
    const schoolId = String(row.uygulama_okul_id);
    modulesBySchool.set(schoolId, [...(modulesBySchool.get(schoolId) || []), String(row.modul_id)]);
  }
  const permissionsByUser = new Map<string, Record<string, any>>();
  for (const row of permissions.rows) {
    const userId = String(row.kullanici_id);
    const current = permissionsByUser.get(userId) || {};
    current[String(row.modul_id)] = {
      view: booleanValue(row.goruntuleme),
      create: booleanValue(row.olusturma),
      update: booleanValue(row.guncelleme),
    };
    permissionsByUser.set(userId, current);
  }

  const setting = settings.rows[0];
  return {
    schemaVersion: Number(setting.sema_surumu || 2),
    schools: schools.rows.map((row: any) => {
      const school: any = {
        id: String(row.uygulama_okul_id),
        code: String(row.okul_kodu),
        name: String(row.okul_adi),
        city: String(row.sehir || ""),
        status: String(row.durum || "active"),
      };
      const slogan = optionalString(row.slogan);
      const licenseNote = optionalString(row.lisans_notu);
      if (slogan !== undefined) school.slogan = slogan;
      if (licenseNote !== undefined) school.licenseNote = licenseNote;
      if (booleanValue(row.moduller_tanimli)) school.enabledModules = modulesBySchool.get(school.id) || [];
      return school;
    }),
    users: users.rows.map((row: any) => {
      const user: any = {
        id: String(row.kullanici_id),
        schoolId: row.uygulama_okul_id === null ? null : String(row.uygulama_okul_id),
        fullName: String(row.ad_soyad),
        email: String(row.e_posta || ""),
        username: String(row.kullanici_adi),
        role: String(row.rol),
        status: String(row.durum || "active"),
        permissions: permissionsByUser.get(String(row.kullanici_id)) || {},
      };
      const passwordHash = optionalString(row.sifre_ozeti);
      const passwordSalt = optionalString(row.sifre_tuzu);
      if (passwordHash !== undefined) user.passwordHash = passwordHash;
      if (passwordSalt !== undefined) user.passwordSalt = passwordSalt;
      return user;
    }),
    currentUserId: String(setting.etkin_kullanici_id),
    ...(setting.etkin_okul_id === null ? {} : { activeSchoolId: String(setting.etkin_okul_id) }),
  };
}

const insert = (client: QueryClient, table: string, columns: string[], values: unknown[]) =>
  client.query(
    `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
    values,
  );

export async function saveRelationalAuthState(state: any) {
  if (!Array.isArray(state?.schools) || !Array.isArray(state?.users)) {
    throw new Error("Kullanıcı dizini geçersiz: schools ve users dizileri zorunludur.");
  }
  const client = await pool.connect();
  try {
    await client.query("START TRANSACTION");
    await client.query("DELETE FROM panel_yetkilendirme_ayarlari");
    await client.query("DELETE FROM kullanici_modul_izinleri");
    await client.query("DELETE FROM kullanicilar");
    await client.query("DELETE FROM panel_okul_modulleri");
    await client.query("DELETE FROM panel_okullari");

    for (const school of state.schools) {
      await insert(client, "panel_okullari", [
        "uygulama_okul_id", "okul_kodu", "okul_adi", "sehir", "slogan", "durum",
        "moduller_tanimli", "lisans_notu",
      ], [
        String(school.id), String(school.code || ""), String(school.name || ""), String(school.city || ""),
        school.slogan ?? null, String(school.status || "active"), Array.isArray(school.enabledModules) ? 1 : 0,
        school.licenseNote ?? null,
      ]);
      if (Array.isArray(school.enabledModules)) {
        for (const moduleId of school.enabledModules) {
          await insert(client, "panel_okul_modulleri", ["uygulama_okul_id", "modul_id"], [String(school.id), String(moduleId)]);
        }
      }
    }

    for (const user of state.users) {
      await insert(client, "kullanicilar", [
        "kullanici_id", "uygulama_okul_id", "ad_soyad", "e_posta", "kullanici_adi", "rol", "durum",
        "sifre_ozeti", "sifre_tuzu",
      ], [
        String(user.id), user.schoolId === null || user.schoolId === undefined ? null : String(user.schoolId),
        String(user.fullName || ""), String(user.email || ""), String(user.username || ""), String(user.role || "teacher"),
        String(user.status || "active"), user.passwordHash ?? null, user.passwordSalt ?? null,
      ]);
      for (const [moduleId, permission] of Object.entries(user.permissions || {})) {
        const item = permission as any;
        await insert(client, "kullanici_modul_izinleri", [
          "kullanici_id", "modul_id", "goruntuleme", "olusturma", "guncelleme",
        ], [String(user.id), moduleId, item?.view ? 1 : 0, item?.create ? 1 : 0, item?.update ? 1 : 0]);
      }
    }

    await insert(client, "panel_yetkilendirme_ayarlari", [
      "ayar_id", "sema_surumu", "etkin_kullanici_id", "etkin_okul_id",
    ], [1, Number(state.schemaVersion || 2), String(state.currentUserId || state.users[0]?.id || ""), state.activeSchoolId ?? null]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
