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

const BUILD_ID =
  process.env.REPL_DEPLOYMENT_ID ||
  process.env.REPL_ID ||
  process.env.REPL_SLUG ||
  process.env.GIT_SHA ||
  `manual-${Date.now()}`;

console.log("[BOOT] buildId:", BUILD_ID);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/api/version", (_req, res) => {
  res.json({ ok: true, buildId: BUILD_ID, ts: new Date().toISOString() });
});

app.get("/__version", (_req, res) => {
  res.json({ serverVersion: "2026-02-25-v4", buildId: BUILD_ID, ts: Date.now() });
});

const isProd = process.env.NODE_ENV === "production";
const port = parseInt(process.env.PORT || "5000", 10);

process.on("SIGTERM", () => {
  log("SIGTERM received, shutting down gracefully");
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
});

process.on("uncaughtException", (err) => {
  console.error("uncaughtException:", err.stack || err.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection:", reason);
});

(async () => {
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );

  if (isProd) {
    try {
      const { migrateProductionData } = await import("./migrate-prod");
      await migrateProductionData();
    } catch (migrationErr: any) {
      console.error("[CRITICAL] migrate-prod failed — app will continue without migration:", migrationErr.message);
    }
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
})();
