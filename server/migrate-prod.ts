import pg from "pg";
import migrationData from "./migration_data.json";

export async function migrateProductionData() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const { rows: existingMembers } = await client.query("SELECT id, name FROM team_members");
    const { rows: existingGuests } = await client.query("SELECT COUNT(*) as cnt FROM guests");
    const { rows: existingEpisodes } = await client.query("SELECT COUNT(*) as cnt FROM episodes");

    const names = existingMembers.map((r: any) => r.name);
    const guestCount = parseInt(existingGuests[0].cnt);
    const episodeCount = parseInt(existingEpisodes[0].cnt);
    const devData = migrationData as Record<string, any[]>;
    const devMemberCount = devData.team_members?.length || 0;
    const devGuestCount = devData.guests?.length || 0;

    const hasRealDevData = names.includes("Nobcast") && names.includes("Omri") &&
      names.includes("Yair") && names.includes("Yuli") &&
      guestCount === devGuestCount;

    if (hasRealDevData) {
      console.log("Production already has real data, skipping migration.");
      return;
    }

    const seedNames = ["Casey Brooks", "Drew Patel", "Morgan Lee", "Jamie Ortiz", "Quinn Davis"];
    const hasSeedData = seedNames.some(n => names.includes(n));

    if (!hasSeedData && existingMembers.length > 0 && existingMembers.length !== devMemberCount) {
      console.log("Production has unknown data (not seed, not dev), skipping migration for safety.");
      return;
    }

    console.log("Migrating development data to production...");

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
        "team_members", "guests", "episodes", "tasks", "interviews",
        "interview_participants", "studio_dates", "shared_links",
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
      console.log("Production migration complete!");
    } catch (e: any) {
      await client.query("ROLLBACK");
      console.error("Migration failed, rolled back:", e.message);
      throw e;
    }
  } finally {
    client.release();
    await pool.end();
  }
}
