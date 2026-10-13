// Dry run of run.js with a scripted fake LLM (no network). Checks every scene lands.
global.window = { CORE: require("../core.js") }; require("../run.js");
let id = 0; const call = (name, args) => ({ role: "assistant", content: null, tool_calls: [{ id: "c" + (++id), type: "function", function: { name, arguments: JSON.stringify(args) } }] });
const say = t => ({ role: "assistant", content: t });
function fake(body) {
  const m = body.messages, sys = m[0].content, user = m[1].content, done = m.filter(x => x.role === "tool").length;
  if (body.response_format) return say(JSON.stringify({ grant: true, ttl_min: 15, reason: "Needed to explain the trader's own book; aggregate only." }));
  if (!body.tools) return say(/controls-testing/.test(sys) ? (/firm-wide/.test(sys) ? "Quick check: firm total and JGB desk exposure?" : /ALL books/.test(sys) ? "Positions for all books please." : "Show T-2207 in JGB-1 with detail full.") : "Tighten the rule.");
  const me = (sys.match(/You are the (\w+) agent/) || [])[1];
  if (me === "orchestrator") {
    const plan = /Start with the position/.test(user) ? [["position", "position for JGB-1"], ["market", "price JGB30"]] : /trade agent for today/.test(user) ? [["trade", "trades JGB-1"]]
      : /desk:CREDIT/.test(user) ? [["risk", "exposure desk:CREDIT"]]
      : /impact_read/.test(user) ? [["__req"], ["position", "impact T-2207 JGB-1"], ["__brk"]]
      : /override/.test(user) ? [["market", "set JGB30 99.40"], ["trade", "move T-2207 CR-1"]]
      : /firm/.test(user) ? [["risk", "firm and desk:JGB"]] : /all books/i.test(user) ? [["position", "all"]] : [["trade", "full T-2207"]];
    if (done >= plan.length) return say("Summary for Kenji.");
    const p = plan[done];
    if (p[0] === "__req") return call("request_access", { tool: "impact_read", scope: "JGB-1", reason: "explain T-2207 impact" });
    if (p[0] === "__brk") return call("break_raise", { trade_id: "T-2207", note: "looks mis-booked" });
    return call("ask_agent", { agent: p[0], request: p[1] });
  }
  if (done) return say(me + " done.");
  const map = { trade: /move/.test(user) ? ["trade_amend", { trade_id: "T-2207", book: "CR-1" }] : ["trade_read", { book: "JGB-1", detail: /full/.test(user) ? "full" : "summary" }],
    position: /impact/.test(user) ? ["impact_read", { book: "JGB-1", trade_id: "T-2207" }] : ["position_read", { book: /all/.test(user) ? "all" : "JGB-1" }],
    market: /set/.test(user) ? ["marketdata_set", { instrument: "JGB30", price: "99.40" }] : ["marketdata_read", { instrument: "JGB30" }],
    risk: /firm/.test(user) ? ["risk_read", { scope: "firm" }] : ["risk_read", { scope: /CREDIT/.test(user) ? "desk:CREDIT" : "desk:JGB" }] };
  return call(...map[me]);
}
global.fetch = async (url, o) => url === "/token" ? { json: async () => ({ token: "x" }) }
  : { ok: true, json: async () => ({ choices: [{ message: fake(JSON.parse(o.body)) }], usage: { prompt_tokens: 500, completion_tokens: 50 } }) };
window.CORE.run().then(s => {
  const E = window.CORE.result.events, a = E.find(e => e.kind === "answer");
  console.log(JSON.stringify(s, null, 1)); console.log("answer:", JSON.stringify(a, null, 1));
  const assert = require("assert");
  assert.ok(a.complete); assert.strictEqual(a.leaks, 0); assert.strictEqual(s.gaps_found, 3); assert.strictEqual(s.gaps_open_after_fix, 0);
  assert.strictEqual(s.writes_executed, 0); assert.strictEqual(s.isolations, 1); assert.strictEqual(s.versions, 4); assert.strictEqual(s.other_desk_data_shown_in_main_story, 0);
  console.log("DRY RUN OK - all scenes land");
}).catch(e => { console.error(e); process.exit(1); });
// write preview data (clearly labelled - replaced by the real Foundry recording)
process.on("beforeExit", () => { if (!window.CORE.result || global.__w) return; global.__w = 1;
  const r = window.CORE.result; r.summary.model = "DRY RUN (scripted fake model, not a real recording)"; r.events.find(e => e.kind === "done").summary = r.summary;
  require("fs").writeFileSync(__dirname + "/../data.preview.js", "window.RUN = " + JSON.stringify(r) + ";\n"); console.log("wrote preview data.js"); });
