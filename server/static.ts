import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  app.use("/{*path}", (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    let html = fs.readFileSync(indexPath, "utf-8");
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["host"] || "";
    const baseUrl = `${protocol}://${host}`;
    html = html.replace(/content="\/og-image\.png"/g, `content="${baseUrl}/og-image.png"`);
    html = html.replace('content="/"', `content="${baseUrl}/"`);
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  });
}
