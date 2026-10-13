// node core.test.js  - checks the $2M story and every Gate decision the scenes rely on.
const C = require("./core.js"), assert = require("assert");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("  ok  " + name); };
const setup = () => { const s = C.freshState(), r = C.baselineRules(), g = [], e = []; return { s, r, g, e, gw: C.makeGateway(s, r, g, e) }; };
const K = (agent) => ["kenji", "orchestrator", agent];

t("discrepancy is exactly -$2.0M (stale price -1.2M, mis-booked trade -0.8M)", () => {
  const { gw } = setup(); const p = JSON.parse(gw.call(K("position"), "position_read", { book: "JGB-1" }))[0];
  assert.strictEqual(p.discrepancy, -2000000);
  const jgb30 = p.lines.find(l => l.instrument === "JGB30"); assert.strictEqual(Math.round(jgb30.notional * (C.VENDOR_CLOSE.JGB30 - 98.20) / 100), 1200000);
  assert.strictEqual(p.lines.find(l => l.instrument === "HKE27").mv, -800000);
});
t("scene 2: market data read allowed, shows stale price", () => {
  const { gw, e } = setup(); const m = JSON.parse(gw.call(K("market"), "marketdata_read", { instrument: "JGB30" }));
  assert.strictEqual(e[0].decision, "allow"); assert.strictEqual(m.price, 98.20); assert.strictEqual(m.vendor_close_today, 99.40);
});
t("scene 3: trade read on own book is FILTERED - other desk's row masked", () => {
  const { gw, e } = setup(); const rows = JSON.parse(gw.call(K("trade"), "trade_read", { book: "JGB-1" }));
  assert.strictEqual(e[0].decision, "filtered"); const r = rows.find(x => x.trade_id === "T-2207");
  assert.strictEqual(r.client, C.W); assert.strictEqual(r.notional, C.W); assert.strictEqual(r.owner_desk, C.W);
});
t("v1 weakness (c): free-text note still leaks client on masked row", () => {
  const { gw } = setup(); const r = JSON.parse(gw.call(K("trade"), "trade_read", { book: "JGB-1", detail: "full" })).find(x => x.trade_id === "T-2207");
  assert.ok(/Hokkaido/.test(r.note));
});
t("leak flag set on v1, cleared after fix", () => { { const { gw, e } = setup(); gw.call(K("trade"), "trade_read", { book: "JGB-1", detail: "full" }); assert.strictEqual(e[0].leaked, true); } { const { gw, e, r } = setup(); r.data.free_text = "drop"; gw.call(K("trade"), "trade_read", { book: "JGB-1", detail: "full" }); assert.ok(!e[0].leaked); } });
t("fix (c): free_text=drop closes the leak", () => {
  const { gw, r: R } = setup(); R.data.free_text = "drop"; const r = JSON.parse(gw.call(K("trade"), "trade_read", { book: "JGB-1", detail: "full" })).find(x => x.trade_id === "T-2207");
  assert.ok(!/Hokkaido/.test(JSON.stringify(r)));
});
t("scene 4: risk agent asking desk:CREDIT for Kenji is DENIED (principal ∩ agent)", () => {
  const { gw, e } = setup(); gw.call(K("risk"), "risk_read", { scope: "desk:CREDIT" }); assert.strictEqual(e[0].decision, "deny"); assert.ok(/not entitled to desk CREDIT/.test(e[0].reason));
});
t("scene 4: other desk's book also denied for trades and positions", () => {
  const { gw, e } = setup(); gw.call(K("trade"), "trade_read", { book: "CR-1" }); gw.call(K("position"), "position_read", { book: "CR-1" });
  assert.deepStrictEqual(e.map(x => x.decision), ["deny", "deny"]);
});
t("scene 5: impact_read denied without a grant; allowed with Governance grant, aggregate only", () => {
  const { gw, e, g } = setup(); gw.call(K("position"), "impact_read", { book: "JGB-1", trade_id: "T-2207" }); assert.strictEqual(e[0].decision, "deny");
  g.push({ agent: "position", tool: "impact_read", principal: "kenji", ttl_min: 15, aggregate: true });
  const out = JSON.parse(gw.call(K("position"), "impact_read", { book: "JGB-1", trade_id: "T-2207" }));
  assert.strictEqual(e[1].decision, "allow"); assert.strictEqual(out.net_mv_impact, -800000); assert.ok(!/Hokkaido|CREDIT/.test(JSON.stringify(out)));
});
t("scene 5: break to Middle Office allowed for orchestrator", () => {
  const { gw, s } = setup(); gw.call(["kenji", "orchestrator"], "break_raise", { trade_id: "T-2207", note: "mis-booked" }); assert.strictEqual(s.breaks.length, 1);
});
t("scene 7: rogue writes denied (price overwrite, trade move); isolation blocks everything", () => {
  const { gw, e, g, s } = setup();
  gw.call(K("market"), "marketdata_set", { instrument: "JGB30", price: "99.40" }); gw.call(K("trade"), "trade_amend", { trade_id: "T-2207", book: "CR-1" });
  assert.deepStrictEqual(e.map(x => x.decision), ["deny", "deny"]); assert.strictEqual(s.amended + s.feed_changed, 0);
  g.push({ agent: "orchestrator", quarantine: true }); gw.call(K("market"), "marketdata_read", { instrument: "JGB10" }); assert.strictEqual(e[2].decision, "deny"); assert.ok(/isolated/.test(e[2].reason));
});
t("no human principal on the call -> deny", () => {
  const { gw, e } = setup(); gw.call(["orchestrator", "risk"], "risk_read", { scope: "book:JGB-1" }); assert.strictEqual(e[0].decision, "deny");
});
t("v1 weakness (a): firm aggregate allowed -> firm minus own desk reveals Credit desk", () => {
  const { gw } = setup(); const firm = JSON.parse(gw.call(K("risk"), "risk_read", { scope: "firm" })).gross_mv, mine = JSON.parse(gw.call(K("risk"), "risk_read", { scope: "desk:JGB" })).gross_mv;
  const cr = C.holdings(C.freshState(), "CR-1").HKE27 * 1.0; assert.strictEqual(firm - mine, cr);
});
t("fix (a): firm=approval holds the aggregate for a human", () => {
  const { gw, e, r } = setup(); r.data.firm = "approval"; gw.call(K("risk"), "risk_read", { scope: "firm" }); assert.strictEqual(e[0].decision, "approval");
});
t("v1 weakness (b): book 'all' passes through and returns CR-1", () => {
  const { gw } = setup(); assert.ok(/CR-1/.test(gw.call(K("position"), "position_read", { book: "all" })));
});
t("fix (b): wildcard=expand denies 'all'", () => {
  const { gw, e, r } = setup(); r.data.wildcard = "expand"; gw.call(K("position"), "position_read", { book: "all" }); assert.strictEqual(e[0].decision, "deny");
});
t("agent outside mandate denied (market agent reading risk)", () => {
  const { gw, e } = setup(); gw.call(K("market"), "risk_read", { scope: "book:JGB-1" }); assert.strictEqual(e[0].decision, "deny");
});
t("main story (default detail): no client name anywhere in the filtered read", () => {
  const { gw, e } = setup(); const out = gw.call(K("trade"), "trade_read", { book: "JGB-1" }); assert.ok(!/Hokkaido/.test(out)); assert.ok(!e[0].leaked);
});
console.log(n + " tests passed");
// ---- v3 additions
{ const C = require("./core.js"), assert = require("assert");
  const s = C.freshState(), r = C.baselineRules(), e = [], gw = C.makeGateway(s, r, [], e);
  gw.call(["kenji","orchestrator","risk"], "risk_read", { scope: "desk:CREDIT" }); assert.strictEqual(e[0].rule_id, "E:kenji.desks");
  gw.call(["kenji","orchestrator","risk"], "risk_read", { scope: "firm" }); assert.ok(e[1].other_desk);
  gw.call(["kenji","orchestrator","position"], "position_read", { book: "all" }); assert.ok(e[2].other_desk);
  gw.call(["kenji","orchestrator","trade"], "trade_read", { book: "JGB-1" }); assert.ok(!e[3].other_desk); assert.ok(/D:foreign_rows/.test(e[3].rule_id));
  const c = C.applyChange(r, [{ op: "set_data_policy", key: "firm", value: "approval" }, { op: "set_agent_rule", agent: "position", tool: "impact_read", effect: "allow" }]);
  assert.ok(c.ok); assert.strictEqual(c.diff.length, 2); assert.strictEqual(c.rules.data.firm, "approval"); assert.strictEqual(r.data.firm, "allow");
  assert.ok(!C.applyChange(r, [{ op: "set_data_policy", key: "firm", value: "yes" }]).ok);
  assert.ok(!C.applyChange(r, [{ op: "set_data_policy", key: "firm", value: "allow" }]).ok, "no-op change must be rejected");
  assert.ok(!C.applyChange(r, [{ op: "set_agent_rule", agent: "x", tool: "trade_read", effect: "allow" }]).ok);
  const em = C.emptyRules(); const s2 = C.freshState(), e2 = []; C.makeGateway(s2, em, [], e2).call(["kenji","orchestrator","trade"], "trade_read", { book: "JGB-1" }); assert.strictEqual(e2[0].decision, "deny");
  console.log("  ok  v3: rule ids, other-desk detector, applyChange validation, empty mandates deny"); }
