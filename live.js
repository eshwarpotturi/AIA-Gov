// Live mode: only when the page is opened with ?live from server.js on your PC.
(() => {
  const F = window.__FLOOR; if (!F || !F.isLive) return;
  const human = /[?&]human\b/.test(location.search);
  const badge = document.getElementById("livebadge"); badge.textContent = "LIVE · connecting…";
  const bar = document.querySelector(".bar"), start = document.createElement("button");
  start.className = "btn"; start.textContent = human ? "▶ Start live run (you are Compliance)" : "▶ Start live run"; bar.insertBefore(start, bar.firstChild);
  start.onclick = async () => { const r = await fetch("/start" + (human ? "?human" : ""), { method: "POST" }); badge.textContent = r.ok ? "LIVE · agents running" : "LIVE · a run is already going"; start.disabled = true; start.style.opacity = .5; };
  const dlg = document.createElement("dialog"); document.body.appendChild(dlg);
  function review(ev) {
    dlg.innerHTML = `<h3>You are Compliance: review ${ev.id}</h3><p class="row" style="margin:8px 0">Governance proposes:</p><pre>${ev.diff.map(d => d.id + ": " + d.from + " → " + d.to).join("\n")}</pre><p class="row">Rationale: ${String(ev.rationale || "").replace(/</g, "&lt;")}</p>
      <p style="margin:6px 0"><input id="rv" placeholder="reason (optional)" style="width:100%;padding:6px;background:#0d131e;color:#eee;border:1px solid #2a3749;border-radius:6px"></p>
      <p style="display:flex;gap:8px"><button class="btn" id="ap">Approve</button><button class="btn g" id="rj">Reject</button></p>`;
    const go = d => { fetch("/review", { method: "POST", body: JSON.stringify({ id: ev.id, decision: d, reason: dlg.querySelector("#rv").value }) }); dlg.close(); };
    dlg.querySelector("#ap").onclick = () => go("approve"); dlg.querySelector("#rj").onclick = () => go("reject"); dlg.showModal();
  }
  const es = new EventSource("/events");
  es.onopen = () => { if (/connecting/.test(badge.textContent)) badge.textContent = "LIVE · ready"; };
  es.onmessage = m => { const ev = JSON.parse(m.data);
    if (ev.kind === "review_request") { review(ev); return; }
    if (ev.kind === "error") { badge.textContent = "LIVE · run failed: " + ev.text; return; }
    F.E.push(ev);
    if (ev.kind === "setup") { F.reset(); F.play(); } if (ev.kind === "scene") F.chapters(); if (ev.kind === "done") { badge.textContent = "LIVE · run complete"; F.footer(); } };
})();
