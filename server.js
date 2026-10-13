// Live mode on YOUR PC:  node server.js   then open http://localhost:8765/?live   (add &human for you to be Compliance)
// Serves this folder, runs the real agents against LLM Foundry, streams every event to the page as it happens.
const http = require("http"), fs = require("fs"), path = require("path");
const PORT = +process.env.PORT || 8765, BASE = process.env.FOUNDRY_BASE || "https://llmfoundry.straive.com", DIR = __dirname;
const tokFile = [".foundry-token", ".foundry-token.txt"].map(f => path.join(DIR, f)).find(f => fs.existsSync(f));
if (!tokFile) { console.error("Missing .foundry-token next to server.js"); process.exit(1); }
const TOKEN = fs.readFileSync(tokFile, "utf8").trim();
const realFetch = fetch;
global.fetch = async (url, opts) => url === "/token" ? { json: async () => ({ token: TOKEN }) } : realFetch(url.startsWith("/") ? BASE + url : url, opts);
const clients = new Set(); let events = [], running = false, pending = new Map();
const send = (res, ev) => res.write("data: " + JSON.stringify(ev) + "\n\n");
function startRun(human) {
  if (running) return false; running = true; events = [];
  delete require.cache[require.resolve("./core.js")]; delete require.cache[require.resolve("./run.js")];
  global.window = { CORE: require("./core.js") }; const C = window.CORE;
  C.AGENT_DEFS = Object.fromEntries(fs.readdirSync(path.join(DIR, "agents")).filter(f => f.endsWith(".json")).map(f => { const d = JSON.parse(fs.readFileSync(path.join(DIR, "agents", f))); return [d.id, d]; }));
  C.POLICY_TEXT = fs.readFileSync(path.join(DIR, "agents", "compliance-policy.md"), "utf8");
  C.onEvent = ev => { events.push(ev); for (const c of clients) send(c, ev); };
  C.onLog = l => console.log(l);
  if (human) C.humanReview = prop => new Promise(resolve => { pending.set(prop.id, resolve); C.onEvent({ kind: "review_request", id: prop.id, diff: prop.diff, rationale: prop.rationale }); });
  require("./run.js");
  C.run().then(s => { console.log("Live run done:", JSON.stringify(s)); fs.writeFileSync(path.join(DIR, "data.live-last.js"), "window.RUN = " + JSON.stringify(C.result) + ";\n"); })
    .catch(e => { console.error("Run failed:", e.message); C.onEvent({ kind: "error", text: e.message }); }).finally(() => { running = false; });
  return true;
}
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".md": "text/markdown; charset=utf-8", ".css": "text/css" };
http.createServer((req, res) => {
  const u = new URL(req.url, "http://localhost");
  if (u.pathname === "/events") { res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" }); events.forEach(ev => send(res, ev)); clients.add(res); req.on("close", () => clients.delete(res)); return; }
  if (u.pathname === "/start" && req.method === "POST") { const ok = startRun(u.searchParams.has("human")); res.writeHead(ok ? 200 : 409); res.end(ok ? "started" : "already running"); return; }
  if (u.pathname === "/review" && req.method === "POST") { let b = ""; req.on("data", c => b += c); req.on("end", () => { try { const j = JSON.parse(b); const r = pending.get(j.id); if (r) { pending.delete(j.id); r({ decision: j.decision === "approve" ? "approve" : "reject", reason: String(j.reason || "").slice(0, 200) || (j.decision === "approve" ? "approved by a person" : "rejected by a person") }); res.end("ok"); } else { res.writeHead(404); res.end("no such pending review"); } } catch (e) { res.writeHead(400); res.end("bad"); } }); return; }
  let p = path.normalize(decodeURIComponent(u.pathname)).replace(/^([\/\\])+/, ""); if (!p) p = "index.html";
  const f = path.join(DIR, p); if (!f.startsWith(DIR) || /foundry-token/.test(f) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(PORT, "127.0.0.1", () => console.log(`Live floor: http://localhost:${PORT}/?live   (you approve rule changes: http://localhost:${PORT}/?live&human)`));
