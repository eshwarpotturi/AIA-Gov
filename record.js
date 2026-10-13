// Records the real run on LLM Foundry from YOUR terminal:   node record.js
// Reads the token from .foundry-token (git-ignored). Writes data.js for the replay.
const fs = require("fs"), path = require("path");
const BASE = process.env.FOUNDRY_BASE || "https://llmfoundry.straive.com";
if (typeof fetch !== "function") { console.error("Needs Node 18+ (built-in fetch)."); process.exit(1); }
const tokFile = [".foundry-token", ".foundry-token.txt"].map(f => path.join(__dirname, f)).find(f => fs.existsSync(f)) || path.join(__dirname, ".foundry-token");
if (!fs.existsSync(tokFile)) { console.error("Missing .foundry-token next to record.js"); process.exit(1); }
const TOKEN = fs.readFileSync(tokFile, "utf8").trim();
const realFetch = fetch;
global.fetch = async (url, opts) => {
  if (url === "/token") return { json: async () => ({ token: TOKEN }) };
  return realFetch(url.startsWith("/") ? BASE + url : url, opts);
};
global.window = { CORE: require("./core.js") };
require("./run.js");
const tick = setInterval(() => { const s = window.CORE.status(1); process.stdout.write(`\r  calls ${s.calls}  events ${s.events}  ~Rs ${s.cost_inr}   `); }, 1500);
window.CORE.run().then(sum => {
  clearInterval(tick); console.log("\n");
  const r = window.CORE.result, a = r.events.find(e => e.kind === "answer");
  fs.writeFileSync(path.join(__dirname, "data.js"), "window.RUN = " + JSON.stringify(r) + ";\n");
  fs.writeFileSync(path.join(__dirname, "run-log.txt"), window.CORE._ST.log.join("\n") + "\n");
  console.log(JSON.stringify(sum, null, 1));
  const checks = { "answer complete": a && a.complete, "no other-desk data in main story": sum.other_desk_data_shown_in_main_story === 0,
    "no writes executed": sum.writes_executed === 0, "3 gaps found": sum.gaps_found === 3, "0 gaps open after fix": sum.gaps_open_after_fix === 0,
    "1 isolation": sum.isolations === 1, "4 rule versions": sum.versions === 4, "break raised": sum.breaks_raised >= 1 };
  console.log("\nChecks:"); let ok = true; for (const [k, v] of Object.entries(checks)) { console.log((v ? "  PASS " : "  FAIL ") + k); ok = ok && !!v; }
  console.log(ok ? "\nAll scenes landed. data.js written." : "\nSome scenes did not land - data.js written anyway; tell Claude which failed.");
}).catch(e => { clearInterval(tick); console.error("\nRun failed:", e.message); process.exit(1); });
