import pg from "pg";
import migrationData from "./migration_data.json";

export async function migrateProductionData() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows: marker } = await client.query(
      "SELECT 1 FROM app_meta WHERE key = 'prod_seed_completed'"
    );

    if (marker.length > 0) {
      console.log("[migrate-prod] Skipping — prod already initialized (marker found).");
      return;
    }

    const { rows: existingMembers } = await client.query("SELECT id, name FROM team_members");
    const names = existingMembers.map((r: any) => r.name);

    const hasRealData = names.includes("Nobcast") && names.includes("Omri") &&
      names.includes("Yair") && names.includes("Yuli");

    if (hasRealData) {
      console.log("[migrate-prod] Production has real team data — setting marker and skipping.");
      await client.query(
        "INSERT INTO app_meta (key, value) VALUES ('prod_seed_completed', 'true') ON CONFLICT (key) DO NOTHING"
      );
      return;
    }

    const seedNames = ["Casey Brooks", "Drew Patel", "Morgan Lee", "Jamie Ortiz", "Quinn Davis"];
    const hasSeedData = seedNames.some(n => names.includes(n));

    if (!hasSeedData && existingMembers.length > 0) {
      console.log("[migrate-prod] Production has unknown data (not seed, not dev), skipping for safety.");
      await client.query(
        "INSERT INTO app_meta (key, value) VALUES ('prod_seed_completed', 'true') ON CONFLICT (key) DO NOTHING"
      );
      return;
    }

    console.log("[migrate-prod] Running initial production seed...");

    const devData = migrationData as Record<string, any[]>;

    await client.query("BEGIN");

    try {
      const clearOrder = [
        "messages", "conversations",
        "interviewer_unavailability", "reminders",
        "publishing", "episode_platform_links", "episode_large_links",
        "episode_shorts", "episode_files", "shared_links",
        "interview_participants", "interviews",
        "tasks", "studio_dates", "episodes", "guests", "team_members"
      ];

      for (const table of clearOrder) {
        await client.query(`DELETE FROM "${table}"`);
        console.log(`  Cleared ${table}`);
      }

      const insertOrder = [
        "team_members", "guests",
        "interviews", "interview_participants",
        "studio_dates",
        "episodes", "tasks",
        "shared_links",
        "episode_files", "episode_shorts", "episode_large_links",
        "episode_platform_links", "publishing", "reminders",
        "interviewer_unavailability"
      ];

      for (const table of insertOrder) {
        const rows = devData[table] || [];
        if (rows.length === 0) {
          console.log(`  ${table}: 0 rows (skip)`);
          continue;
        }

        let inserted = 0;
        for (const row of rows) {
          const columns = Object.keys(row);
          const colNames = columns.map(c => `"${c}"`).join(", ");
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
          const arrayColumns: Record<string, string[]> = {
            guests: ["links"],
            tasks: ["assignee_ids"],
          };
          const tableArrayCols = arrayColumns[table] || [];

          const values = columns.map(c => {
            const v = (row as any)[c];
            if (v === null || v === undefined) return null;
            if (tableArrayCols.includes(c) && Array.isArray(v)) {
              if (v.length === 0) return "{}";
              return `{${v.map((item: string) => `"${item.replace(/"/g, '\\"')}"`).join(",")}}`;
            }
            if (typeof v === "object") return JSON.stringify(v);
            return v;
          });

          await client.query(
            `INSERT INTO "${table}" (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            values
          );
          inserted++;
        }
        console.log(`  ${table}: ${inserted}/${rows.length} rows inserted`);
      }

      await client.query("COMMIT");

      await client.query(
        "INSERT INTO app_meta (key, value) VALUES ('prod_seed_completed', 'true') ON CONFLICT (key) DO NOTHING"
      );

      console.log("[migrate-prod] Initial production seed complete! Marker set.");
    } catch (e: any) {
      await client.query("ROLLBACK");
      console.error("[migrate-prod] Seed failed, rolled back:", e.message);
      throw e;
    }
  } finally {
    try {
      const { rowCount } = await client.query(`
        UPDATE episodes SET interview_id = NULL
        WHERE interview_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM interviews i WHERE i.id = episodes.interview_id)
      `);
      if (rowCount && rowCount > 0) {
        console.log(`[schema] Unlinked ${rowCount} orphan episode(s) with deleted interviews`);
      }

      const { rows: fkCheck } = await client.query(`
        SELECT 1 FROM pg_constraint WHERE conname = 'episodes_interview_id_interviews_id_fk'
      `);
      if (fkCheck.length === 0) {
        await client.query(`
          ALTER TABLE episodes
          ADD CONSTRAINT episodes_interview_id_interviews_id_fk
          FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE SET NULL
        `);
        console.log("[schema] Added FK: episodes.interview_id -> interviews.id ON DELETE SET NULL");
      }

      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS episodes_interview_id_unique
        ON episodes (interview_id) WHERE interview_id IS NOT NULL
      `);
      console.log("[schema] Ensured partial unique index on episodes.interview_id");
    } catch (schemaErr: any) {
      console.error("[schema] Non-fatal schema fix error:", schemaErr.message);
    }

    client.release();
    await pool.end();
  }
}
