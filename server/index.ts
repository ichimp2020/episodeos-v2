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
  }, 5000);
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
