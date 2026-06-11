import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import http from "node:http";

const root = "C:\\Users\\AllanDeBrincat\\Downloads\\Codex\\packages\\client\\dist";
const port = Number(process.env.PORT ?? 4173);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

http
  .createServer((req, res) => {
    if ((req.url ?? "").startsWith("/api/")) {
      const body = JSON.stringify({
        error: "api_unavailable",
        message: "Local static preview does not run Vercel API routes. Deploy to Vercel or run an API-aware dev server."
      });
      res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
      res.end(body);
      return;
    }

    if ((req.url ?? "").startsWith("/_vercel/")) {
      res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
      res.end("");
      return;
    }

    const urlPath = req.url === "/" ? "/index.html" : req.url ?? "/index.html";
    const filePath = normalize(join(root, urlPath));
    const safePath = filePath.startsWith(root) ? filePath : join(root, "index.html");
    const target = existsSync(safePath) && statSync(safePath).isFile() ? safePath : join(root, "index.html");
    const type = mime[extname(target)] ?? "application/octet-stream";

    res.writeHead(200, { "Content-Type": type });
    createReadStream(target).pipe(res);
  })
  .listen(port, () => {
    console.log(`Clave Bathhouse client available at http://localhost:${port}`);
  });
