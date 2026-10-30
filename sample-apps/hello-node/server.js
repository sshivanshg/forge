// Demo app for Forge. Forge sets PORT; the app must listen on it.
const http = require("http");

const port = Number(process.env.PORT || 8080);
const greeting = process.env.GREETING || "Hello from Forge";
const version = "v1";
const startedAt = new Date().toISOString();

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "UP", version }));
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><html><head><title>hello-node</title>
<style>body{font-family:system-ui;background:#0b0b10;color:#e7e7ee;display:grid;place-items:center;height:100vh;margin:0}
.card{padding:40px 56px;border:1px solid #2a2a3a;border-radius:16px;background:#12121a;text-align:center}
h1{margin:0 0 8px;font-size:40px}p{color:#9a9ab0;margin:4px}</style></head>
<body><div class="card"><h1>${greeting} 👋</h1><p>hello-node ${version}</p><p>started ${startedAt}</p></div></body></html>`);
});

server.listen(port, () => console.log(`Server listening on port ${port}`));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
