import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

app.get("/health", (req, res) => {
  const up = process.uptime().toFixed(1);
  const rss = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  console.log(`[health] hit at ${new Date().toISOString()} from=${req.ip} uptime=${up}s RSS=${rss}MB`);
  res.status(200).json({ status: "ok" });
});

app.get("/__version", (_req, res) => {
  res.json({ serverVersion: "2026-02-25-v3", ts: Date.now() });
});

app.get("/__admin/cleanup-orphans", async (req, res) => {
  const apply = req.query.apply === "true";
  const pg = await import("pg");
  const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const { rows: orphans } = await client.query(`
      SELECT 
        e.id, e.episode_number, e.title, e.interview_id, e.guest_id, e.status,
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

    if (!apply) {
      const { rows: allEps } = await client.query(`SELECT id, episode_number, title, status, interview_id FROM episodes ORDER BY episode_number NULLS LAST`);
      res.json({ mode: "DRY_RUN", orphans, allEpisodes: allEps, message: "Add ?apply=true to execute cleanup" });
      return;
    }

    await client.query("BEGIN");
    const results: string[] = [];
    for (const o of orphans) {
      const hasData = o.files_count > 0 || o.shorts_count > 0 || o.large_links_count > 0 || o.platform_links_count > 0;
      const allDefaultTasks = o.tasks_count <= 5;
      if (!hasData && allDefaultTasks) {
        await client.query("DELETE FROM tasks WHERE episode_id = $1", [o.id]);
        await client.query("DELETE FROM episode_platform_links WHERE episode_id = $1", [o.id]);
        await client.query("DELETE FROM episodes WHERE id = $1", [o.id]);
        results.push(`DELETED #${o.episode_number} "${o.title}" (${o.id})`);
      } else {
        await client.query("UPDATE episodes SET interview_id = NULL WHERE id = $1", [o.id]);
        results.push(`SET NULL #${o.episode_number} "${o.title}" (${o.id}) — has attached data, kept episode`);
      }
    }
    await client.query("COMMIT");

    const { rows: remaining } = await client.query(`
      SELECT id, episode_number, title, interview_id FROM episodes e
      WHERE e.interview_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM interviews i WHERE i.id = e.interview_id)
    `);

    let fkStatus = "skipped (orphans remain)";
    if (remaining.length === 0) {
      try {
        const { rows: fkExists } = await client.query(`
          SELECT 1 FROM pg_constraint WHERE conname = 'episodes_interview_id_interviews_id_fk'
        `);
        if (fkExists.length === 0) {
          await client.query(`
            ALTER TABLE episodes 
            ADD CONSTRAINT episodes_interview_id_interviews_id_fk 
            FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE SET NULL
          `);
          fkStatus = "ADDED — episodes.interview_id → interviews.id ON DELETE SET NULL";
        } else {
          fkStatus = "already exists";
        }
      } catch (fkErr: any) {
        fkStatus = `FAILED: ${fkErr.message}`;
      }
    }

    const { rows: allEps } = await client.query(`SELECT id, episode_number, title, status, interview_id FROM episodes ORDER BY episode_number NULLS LAST`);
    res.json({ mode: "APPLIED", results, remainingOrphans: remaining.length, fkConstraint: fkStatus, allEpisodes: allEps });
  } catch (err: any) {
    try { await client.query("ROLLBACK"); } catch {}
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
    await pool.end();
  }
});

const isProd = process.env.NODE_ENV === "production";

if (isProd && !process.env.PORT) {
  console.error("FATAL: PORT env var is missing in production. Exiting.");
  process.exit(1);
}

const port = isProd ? parseInt(process.env.PORT!, 10) : parseInt(process.env.PORT || "5000", 10);
console.log(`[boot] NODE_ENV=${process.env.NODE_ENV} PORT=${port}`);

function logMemory(label: string) {
  const mem = process.memoryUsage();
  const rss = (mem.rss / 1024 / 1024).toFixed(1);
  const heap = (mem.heapUsed / 1024 / 1024).toFixed(1);
  const uptime = process.uptime().toFixed(1);
  console.log(`[diag] ${label} | RSS=${rss}MB heap=${heap}MB uptime=${uptime}s pid=${process.pid}`);
}

process.on("SIGTERM", () => {
  console.log("[diag] SIGTERM received");
  logMemory("SIGTERM");
  httpServer.close(() => {
    console.log("[diag] server closed gracefully");
    process.exit(0);
  });
  setTimeout(() => {
    console.log("[diag] forced exit after SIGTERM timeout");
    process.exit(1);
  }, 5000);
});

process.on("SIGINT", () => {
  console.log("[diag] SIGINT received");
  logMemory("SIGINT");
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  console.error("[diag] uncaughtException:", err.stack || err.message);
  logMemory("uncaughtException");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[diag] unhandledRejection:", reason);
  logMemory("unhandledRejection");
});

if (isProd) {
  setInterval(() => {
    logMemory("heartbeat");
  }, 60000);
}

(async () => {
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
      logMemory("listen");
    },
  );

  if (isProd) {
    const { migrateProductionData } = await import("./migrate-prod");
    await migrateProductionData();

  } else {
    const { seedDatabase } = await import("./seed");
    await seedDatabase();
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (isProd) {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  logMemory("ready");
})();
