import pg from "pg";

const APPLY = process.argv.includes("--apply");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("ERROR: DATABASE_URL not set");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();

  try {
    console.log(`\n=== ORPHAN EPISODE CLEANUP (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

    const { rows: orphans } = await client.query(`
      SELECT 
        e.id,
        e.episode_number,
        e.title,
        e.interview_id,
        e.guest_id,
        e.status,
        (SELECT count(*)::int FROM tasks t WHERE t.episode_id = e.id) as tasks_count,
        (SELECT count(*)::int FROM episode_files f WHERE f.episode_id = e.id) as files_count,
        (SELECT count(*)::int FROM episode_shorts s WHERE s.episode_id = e.id) as shorts_count,
        (SELECT count(*)::int FROM episode_large_links l WHERE l.episode_id = e.id) as large_links_count,
        (SELECT count(*)::int FROM episode_platform_links p WHERE p.episode_id = e.id) as platform_links_count
      FROM episodes e
      WHERE e.interview_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM interviews i WHERE i.id = e.interview_id)
      ORDER BY e.episode_number
    `);

    if (orphans.length === 0) {
      console.log("No orphan episodes found. Database is clean.\n");
      await printAllEpisodes(client);
      return;
    }

    console.log(`Found ${orphans.length} orphan episode(s):\n`);
    console.log("| id | # | title | interview_id | status | tasks | files | shorts | large_links | platform_links |");
    console.log("|" + "-".repeat(140) + "|");
    for (const o of orphans) {
      const hasData = o.files_count > 0 || o.shorts_count > 0 || o.large_links_count > 0 || o.platform_links_count > 0;
      const allDefaultTasks = o.tasks_count <= 5;
      const action = (!hasData && allDefaultTasks) ? "DELETE" : "SET NULL";
      console.log(
        `| ${o.id} | ${o.episode_number ?? "N/A"} | ${o.title} | ${o.interview_id} | ${o.status} | ${o.tasks_count} | ${o.files_count} | ${o.shorts_count} | ${o.large_links_count} | ${o.platform_links_count} | → ${action}`
      );
    }

    if (!APPLY) {
      console.log("\n--- DRY RUN: No changes made. Run with --apply to execute. ---\n");
      await printAllEpisodes(client);
      return;
    }

    console.log("\n--- APPLYING CHANGES ---\n");
    await client.query("BEGIN");

    let deleted = 0;
    let nulled = 0;

    for (const o of orphans) {
      const hasData = o.files_count > 0 || o.shorts_count > 0 || o.large_links_count > 0 || o.platform_links_count > 0;
      const allDefaultTasks = o.tasks_count <= 5;

      if (!hasData && allDefaultTasks) {
        const { rowCount: tasksDel } = await client.query("DELETE FROM tasks WHERE episode_id = $1", [o.id]);
        const { rowCount: platDel } = await client.query("DELETE FROM episode_platform_links WHERE episode_id = $1", [o.id]);
        const { rowCount: epDel } = await client.query("DELETE FROM episodes WHERE id = $1", [o.id]);
        console.log(`  DELETED episode ${o.id} (#${o.episode_number}) "${o.title}" (${tasksDel} tasks, ${platDel} platform_links removed)`);
        deleted++;
      } else {
        await client.query("UPDATE episodes SET interview_id = NULL WHERE id = $1", [o.id]);
        console.log(`  SET NULL interview_id on episode ${o.id} (#${o.episode_number}) "${o.title}" (has ${o.files_count} files, ${o.shorts_count} shorts, ${o.large_links_count} large_links — keeping episode)`);
        nulled++;
      }
    }

    await client.query("COMMIT");
    console.log(`\n--- DONE: ${deleted} deleted, ${nulled} nulled ---\n`);

    const { rows: remaining } = await client.query(`
      SELECT e.id, e.episode_number, e.title, e.interview_id
      FROM episodes e
      WHERE e.interview_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM interviews i WHERE i.id = e.interview_id)
    `);
    console.log(`Remaining orphans: ${remaining.length}`);
    if (remaining.length > 0) {
      for (const r of remaining) {
        console.log(`  STILL ORPHAN: ${r.id} #${r.episode_number} "${r.title}"`);
      }
    }

    console.log("");
    await printAllEpisodes(client);

  } catch (err: any) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("ERROR:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

async function printAllEpisodes(client: pg.PoolClient) {
  const { rows } = await client.query(`
    SELECT e.id, e.episode_number, e.title, e.status, e.interview_id,
      EXISTS(SELECT 1 FROM interviews i WHERE i.id = e.interview_id) as interview_valid,
      (SELECT count(*)::int FROM tasks t WHERE t.episode_id = e.id) as tasks_count
    FROM episodes e
    ORDER BY e.episode_number NULLS LAST
  `);
  console.log("=== ALL EPISODES ===");
  console.log("| # | title | status | interview_id | valid | tasks |");
  console.log("|" + "-".repeat(100) + "|");
  for (const r of rows) {
    console.log(`| ${r.episode_number ?? "N/A"} | ${r.title} | ${r.status} | ${r.interview_id ?? "NULL"} | ${r.interview_id ? r.interview_valid : "N/A"} | ${r.tasks_count} |`);
  }
  console.log(`\nTotal: ${rows.length} episodes\n`);
}

main();
