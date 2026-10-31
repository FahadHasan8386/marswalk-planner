const $ = (id) => document.getElementById(id);
const LABELS = {
  total_mass_kg: "Crew, suit and pack mass",
  gravity_m_s2: "Mars gravity",
  slope_limit_deg: "Steepest safe slope",
  walk_speed_m_s: "Walking speed",
  metabolic_base_w: "Energy use while walking",
  climb_efficiency: "Climbing efficiency",
  eva_duration_h: "Planned EVA length",
  reserve_h: "Suit reserve time",
  max_return_distance_m: "Furthest walk back",
  slope_penalty_k: "Safer-route steepness penalty",
};

let meta, map, chart, defaults = {};
let pts = [], drawing = false, overrides = {}, mainRes = null, timer = null;

const fmtDist = (m) => (m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(2) + " km");
const fmtTime = (h) => {
  const min = Math.round(h * 60);
  return min < 60 ? min + " min" : Math.floor(min / 60) + " h " + (min % 60 ? (min % 60) + " min" : "");
};
const fmtDeg = (d) => Math.abs(d).toFixed(1) + "°";

async function api(path, body) {
  const r = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  if (!r.ok) throw new Error("Server error " + r.status);
  return r.json();
}
const line = (coords) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });
const setData = (id, features) => map.getSource(id).setData({ type: "FeatureCollection", features });

/* ---------- setup ---------- */
async function init() {
  meta = await api("/api/meta");
  for (const [k, v] of Object.entries(meta.assumptions)) defaults[k] = v.value;

  const badge = $("databadge");
  if (meta.real_data) {
    badge.textContent = "NASA terrain data · " + meta.pixel_m + " m per pixel";
  } else {
    badge.textContent = "Demo terrain, not NASA data";
    badge.classList.add("demo");
    const b = $("demo-banner");
    b.hidden = false;
    b.innerHTML = "<b>Real Mars terrain not found.</b> This is made-up demo terrain. Put your clipped DEM at <code>" +
      meta.expected_path + "</code> and restart the server.";
  }
  renderAssumptions();

  const [w, s, e, n] = meta.bbox;
  const quad = [[w, n], [e, n], [e, s], [w, s]];
  map = new maplibregl.Map({
    container: "map",
    style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#262c33" } }] },
    bounds: [[w, s], [e, n]], fitBoundsOptions: { padding: 24 },
    attributionControl: false,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
  map.doubleClickZoom.disable();

  map.on("load", () => {
    map.addSource("relief", { type: "image", url: "/api/relief.png", coordinates: quad });
    map.addSource("slope", { type: "image", url: "/api/slope.png", coordinates: quad });
    map.addLayer({ id: "relief", type: "raster", source: "relief" });
    map.addLayer({ id: "slope", type: "raster", source: "slope" });
    for (const id of ["draft", "route", "bad", "alt", "stops"]) map.addSource(id, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "draft", type: "line", source: "draft", paint: { "line-color": "#ffffff", "line-width": 3, "line-dasharray": [2, 2] } });
    map.addLayer({ id: "alt-case", type: "line", source: "alt", paint: { "line-color": "#fff", "line-width": 8 } });
    map.addLayer({ id: "alt", type: "line", source: "alt", paint: { "line-color": "#2f6fdb", "line-width": 5 } });
    map.addLayer({ id: "route-case", type: "line", source: "route", paint: { "line-color": "#fff", "line-width": 8 } });
    map.addLayer({ id: "route", type: "line", source: "route", paint: { "line-color": "#0b7a75", "line-width": 5 } });
    map.addLayer({ id: "bad", type: "line", source: "bad", paint: { "line-color": "#d6402f", "line-width": 6 } });
    map.addLayer({ id: "stops", type: "circle", source: "stops", paint: {
      "circle-radius": ["case", ["==", ["get", "base"], 1], 9, 6],
      "circle-color": ["case", ["==", ["get", "base"], 1], "#1f8f5f", "#ffffff"],
      "circle-stroke-color": "#16202a", "circle-stroke-width": 2.5 } });
  });
  map.on("click", (ev) => { if (drawing) { pts.push([ev.lngLat.lng, ev.lngLat.lat]); drawDraft(); updateUI(); } });
  map.on("dblclick", () => { if (drawing) finish(); });

  $("draw").onclick = () => (drawing ? finish() : startDrawing());
  $("undo").onclick = undo;
  $("clear").onclick = reset;
  $("l-relief").onchange = (e) => map.setLayoutProperty("relief", "visibility", e.target.checked ? "visible" : "none");
  $("l-slope").onchange = (e) => {
    map.setLayoutProperty("slope", "visibility", e.target.checked ? "visible" : "none");
    $("legend-slope").style.display = e.target.checked ? "" : "none";
  };
  $("reset-assump").onclick = () => { overrides = {}; renderAssumptions(); if (pts.length >= 2) analyze(); };
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "Escape" && drawing) { drawing = false; pts = []; drawDraft(); updateUI(); }
    if (e.key === "Backspace" && drawing) undo();
    if (e.key === "Enter" && drawing) finish();
  });
  updateUI();
}

/* ---------- drawing ---------- */
function startDrawing() {
  reset(true);
  drawing = true;
  updateUI();
}
function undo() { pts.pop(); drawDraft(); updateUI(); }
function reset(keepDrawing) {
  pts = []; mainRes = null;
  if (!keepDrawing) drawing = false;
  if (map.loaded()) for (const id of ["draft", "route", "bad", "alt", "stops"]) setData(id, []);
  $("result").hidden = true; $("result2").hidden = true;
  $("pempty").style.display = ""; $("pnote").textContent = "";
  if (chart) { chart.destroy(); chart = null; }
  updateUI();
}
function drawDraft() {
  setData("draft", pts.length > 1 ? [line(pts)] : []);
  setData("stops", pts.map((p, i) => ({ type: "Feature", properties: { base: i === 0 ? 1 : 0 }, geometry: { type: "Point", coordinates: p } })));
}
function updateUI() {
  const hint = $("hint"), btn = $("draw");
  map && (map.getCanvas().style.cursor = drawing ? "crosshair" : "");
  if (drawing) {
    btn.textContent = "Finish route";
    btn.disabled = pts.length < 2;
    hint.hidden = false;
    hint.textContent = pts.length === 0 ? "Click the map to place your base or lander"
      : pts.length === 1 ? "Click to add the next waypoint"
      : "Keep clicking to add waypoints, then double-click or press Finish route";
  } else {
    btn.textContent = pts.length ? "Draw a new route" : "Draw a route";
    btn.disabled = false;
    hint.hidden = true;
  }
  $("undo").disabled = !drawing || pts.length === 0;
  $("clear").disabled = pts.length === 0;
}
function finish() {
  pts = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
  if (pts.length < 2) return;
  drawing = false;
  updateUI();
  analyze();
}

/* ---------- analysis ---------- */
async function analyze() {
  const res = await api("/api/analyze", { polyline: pts, overrides, base: pts[0] });
  mainRes = res;
  setData("draft", []);
  setData("route", [line(res.path_lonlat)]);
  setData("alt", []);
  setData("bad", res.failing_segments.map((f) => line(res.path_lonlat.slice(f.index, f.index + 2))));
  $("result2").hidden = true;
  drawChart(res, false);
  renderResult($("result"), res, "Your route", true);
  updateUI();
}

async function contingency() {
  const btn = $("fix");
  if (btn) { btn.disabled = true; btn.textContent = "Searching…"; }
  const res = await api("/api/contingency", { start: pts[0], end: pts[pts.length - 1], overrides, base: pts[0] });
  const box = $("result2");
  box.hidden = false;
  if (!res.found) {
    box.innerHTML = `<h2>Safer route</h2><div class="verdict fail"><b>No safe path found</b><span>${res.reason} Try a different end point or a higher slope limit.</span></div>`;
    if (btn) { btn.disabled = false; btn.textContent = "Find a safer route"; }
    return;
  }
  setData("alt", [line(res.path_lonlat)]);
  drawChart(res, true);
  renderResult(box, res, "Safer route", false);
  if (btn) { btn.disabled = false; btn.textContent = "Find a safer route"; }
}

function renderResult(el, r, title, offerFix) {
  const A = r.assumptions;
  const slopeOk = r.passes_slope_limit, timeOk = r.within_eva_time, wb = r.walk_back, wbOk = !wb || wb.ok;
  const worst = r.failing_segments.length ? r.failing_segments.reduce((a, b) => (b.excess_deg > a.excess_deg ? b : a)) : null;

  let headline, sub;
  if (r.passes) { headline = "This route is safe"; sub = "It stays under the slope limit, fits the EVA and the walk back is within reach."; }
  else if (!slopeOk) { headline = "Route rejected: too steep"; sub = `${r.failing_segments.length} section${r.failing_segments.length > 1 ? "s are" : " is"} steeper than ${A.slope_limit_deg}°.`; }
  else if (!timeOk) { headline = "Route rejected: too long"; sub = `It takes ${fmtTime(r.time_hours)} and the planned EVA is ${A.eva_duration_h} h.`; }
  else { headline = "Route rejected: too far from base"; sub = `It reaches ${fmtDist(wb.max_distance_m)} from base, but the walk-back limit is ${fmtDist(wb.limit_m)}.`; }

  const check = (ok, text) => `<li><span class="ic ${ok ? "ok" : "no"}">${ok ? "✓" : "✕"}</span><span>${text}</span></li>`;
  let checks = check(slopeOk, `Steepest slope ${fmtDeg(r.max_slope_deg)} (limit ${A.slope_limit_deg}°)`);
  checks += check(timeOk, `Time ${fmtTime(r.time_hours)} of a ${A.eva_duration_h} h EVA`);
  if (wb) checks += check(wbOk, `Furthest point ${fmtDist(wb.max_distance_m)} from base (limit ${fmtDist(wb.limit_m)})`);

  const why = worst ? `<div class="why">Worst section: ${fmtDist(worst.start_m)} to ${fmtDist(worst.end_m)} along the route, at ${fmtDeg(worst.slope_deg)}.
    That is <b>${fmtDeg(worst.excess_deg)} over</b> the limit.</div>` : "";
  let fix = "";
  if (!r.passes && offerFix) {
    fix = !slopeOk
      ? `<div class="fix"><button id="fix" class="alt">Find a safer route</button></div>`
      : `<div class="why" style="background:#eef1f4">A safer path cannot fix this. ${!timeOk ? "Choose a shorter route." : "Move your end point closer to the base, or raise the walk-back limit in the assumptions."}</div>`;
  }

  el.hidden = false;
  el.innerHTML = `<h2>${title}</h2>
    <div class="verdict ${r.passes ? "pass" : "fail"}"><b>${headline}</b><span>${sub}</span></div>
    <div class="tiles num">
      <div class="tile"><small>Distance walked</small><strong>${fmtDist(r.distance_m)}</strong></div>
      <div class="tile"><small>Walking time</small><strong>${fmtTime(r.time_hours)}</strong></div>
      <div class="tile"><small>Energy used</small><strong>${Math.round(r.energy_wh)}<em>Wh</em></strong></div>
      <div class="tile"><small>Total climb</small><strong>${Math.round(r.total_climb_m)}<em>m</em></strong></div>
    </div>
    <ul class="checks">${checks}</ul>${why}${fix}`;
  if ($("fix")) $("fix").onclick = contingency;
}

function drawChart(res, isAlt) {
  const lim = res.assumptions.slope_limit_deg;
  $("pempty").style.display = "none";
  $("pnote").textContent = (isAlt ? "· safer route" : "· red means steeper than " + lim + "°");
  if (chart) chart.destroy();
  const over = (c) => Math.abs(res.profile[c.p1DataIndex].slope_deg) > lim;
  chart = new Chart($("chart"), {
    type: "line",
    data: { labels: res.profile.map((p) => Math.round(p.dist_m)),
      datasets: [{ data: res.profile.map((p) => p.elev_m), borderWidth: 3, pointRadius: 0, tension: 0, fill: false,
        segment: { borderColor: (c) => (over(c) ? "#d6402f" : isAlt ? "#2f6fdb" : "#0b7a75") } }] },
    options: { animation: false, maintainAspectRatio: false, interaction: { intersect: false, mode: "index" },
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        title: (i) => "Distance " + fmtDist(+i[0].label),
        label: (c) => "Elevation " + c.parsed.y.toFixed(1) + " m",
        afterLabel: (c) => "Slope " + fmtDeg(res.profile[c.dataIndex].slope_deg) } } },
      scales: { x: { ticks: { maxTicksLimit: 8, callback: (v, i, t) => fmtDist(+res.profile[v]?.dist_m || 0) }, grid: { display: false } },
                y: { title: { display: true, text: "Elevation (m)" } } } },
  });
}

/* ---------- assumptions ---------- */
function renderAssumptions() {
  $("assump").innerHTML = Object.entries(meta.assumptions).map(([k, v]) => `
    <div class="field">
      <label for="a-${k}">${LABELS[k] || k}</label>
      <div class="inp"><input id="a-${k}" type="number" step="any" data-k="${k}" value="${overrides[k] ?? v.value}"><span class="u">${v.unit === "-" ? "" : v.unit}</span></div>
      <small>${v.why}</small>
    </div>`).join("");
  $("assump").querySelectorAll("input").forEach((i) => (i.oninput = () => {
    const val = parseFloat(i.value);
    if (Number.isNaN(val)) return;
    overrides[i.dataset.k] = val;
    clearTimeout(timer);
    timer = setTimeout(() => { if (pts.length >= 2 && !drawing) analyze(); }, 350);
  }));
}

init().catch((e) => { $("databadge").textContent = "Cannot reach the server"; console.error(e); });
