(() => {
  const { stages, domains, projects, experience, stats } = window.PORTFOLIO;
  const state = { domain: null, stage: null, skill: null };
  const $ = (sel) => document.querySelector(sel);
  const el = (tag, attrs = {}, ...kids) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null) node.append(kid);
    return node;
  };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- Stats with a count-up when they scroll into view ---
  const statsBox = $("#stats");
  stats.forEach((s) => {
    const num = el("div", { class: "num" }, "0" + s.suffix);
    num.dataset.target = s.value;
    num.dataset.suffix = s.suffix;
    statsBox.append(el("div", { class: "stat" }, num, el("div", { class: "lbl" }, s.label)));
  });
  const countUp = (node) => {
    const target = Number(node.dataset.target);
    const fmt = (n) => n.toLocaleString("en-US") + node.dataset.suffix;
    if (reduceMotion) { node.textContent = fmt(target); return; }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / 1200, 1);
      node.textContent = fmt(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  new IntersectionObserver((entries, obs) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      statsBox.querySelectorAll(".num").forEach(countUp);
      obs.disconnect();
    });
  }).observe(statsBox);

  // --- Filtering shared by the map, pipeline and project grid ---
  const matches = (p) =>
    (!state.domain || p.domains.includes(state.domain)) &&
    (!state.stage || p.stages.includes(state.stage)) &&
    (!state.skill || p.skills.includes(state.skill));

  const describeFilter = () => {
    const parts = [];
    if (state.domain) parts.push(`domain “${state.domain}”`);
    if (state.stage) parts.push(`stage “${stages.find((s) => s.id === state.stage).label}”`);
    if (state.skill) parts.push(`skill “${state.skill}”`);
    const n = projects.filter(matches).length;
    return parts.length ? `Highlighting ${n} project${n === 1 ? "" : "s"} for ${parts.join(" + ")}.` : "Showing all projects.";
  };

  // --- Demo videos: embedded when hosted, a link when external, a placeholder until recorded ---
  function videoFor(p) {
    const v = p.video;
    if (!v) return el("div", { class: "video placeholder" }, "▶ Demo video coming soon");
    if (v.youtube) {
      return el("div", { class: "video" }, el("iframe", {
        src: `https://www.youtube-nocookie.com/embed/${v.youtube}`, title: `${p.title} demo`, loading: "lazy",
        allow: "encrypted-media; picture-in-picture", allowfullscreen: "",
      }));
    }
    if (v.src) {
      return el("div", { class: "video" }, el("video", { src: v.src, poster: v.poster || "", controls: "", preload: "metadata", playsinline: "" }));
    }
    return el("a", { class: "video placeholder link", href: v.link, target: "_blank", rel: "noopener" }, "▶ Watch the demo on LinkedIn");
  }

  // --- Project grid ---
  const grid = $("#project-grid");
  const cards = new Map();
  projects.forEach((p) => {
    const skills = el("ul", { class: "tags" },
      p.skills.map((s) => el("li", { class: "skill" },
        el("button", { type: "button", title: `Highlight projects using ${s}`, onclick: () => toggle("skill", s) }, s))));
    const card = el("article", { class: "card", id: `p-${p.id}` },
      videoFor(p),
      el("h3", {}, p.title),
      el("div", { class: "metric" }, p.metric),
      el("p", {}, el("span", { class: "label" }, "Challenge"), p.problem),
      el("p", {}, el("span", { class: "label" }, "Outcome"), p.outcome),
      p.location ? el("div", { class: "loc" }, "📍 " + p.location.name) : null,
      skills,
      p.link ? el("a", { href: p.link.url, target: "_blank", rel: "noopener" }, p.link.label + " →") : null);
    cards.set(p.id, card);
    grid.append(card);
  });

  // --- Domain chips ---
  const chipBox = $("#domain-chips");
  const chipFor = (label, value) => el("button", {
    class: "chip", type: "button", "aria-pressed": String(state.domain === value),
    onclick: () => { state.domain = value; render(); },
  }, label);
  const renderChips = () => {
    chipBox.replaceChildren(chipFor("All", null), ...domains.map((d) => chipFor(d, d)));
  };

  // --- Pipeline ---
  const stageList = $("#pipeline-stages");
  stages.forEach((s, i) => {
    stageList.append(el("li", {}, el("button", {
      type: "button", "data-stage": s.id, "aria-pressed": "false",
      onclick: () => toggle("stage", s.id),
    }, el("span", { class: "step" }, `0${i + 1}`), s.label)));
  });
  const renderStage = () => {
    stageList.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.stage === state.stage)));
    const box = $("#stage-detail");
    const s = stages.find((x) => x.id === state.stage);
    if (!s) { box.replaceChildren(el("span", { class: "map-note" }, "Pick a stage above.")); return; }
    const used = projects.filter((p) => p.stages.includes(s.id));
    box.replaceChildren(
      el("strong", {}, `${s.label}: tools I use`),
      el("ul", { class: "tags" }, s.tools.map((t) => el("li", {}, t))),
      el("p", { class: "map-note" }, `${used.length} projects use this stage. They're highlighted below.`));
  };

  const toggle = (key, value) => {
    state[key] = state[key] === value ? null : value;
    render();
    if (key === "skill") $("#projects").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  };

  // --- Map ---
  const map = new maplibregl.Map({
    container: "mapview",
    style: "https://tiles.openfreemap.org/styles/positron",
    center: [40, 25],
    zoom: 1.6,
    attributionControl: { compact: true },
    cooperativeGestures: true,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

  const geojson = () => ({
    type: "FeatureCollection",
    features: projects.filter((p) => p.location && matches(p)).map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: p.location.coords },
      properties: { id: p.id },
    })),
  });

  map.on("load", () => {
    map.addSource("projects", { type: "geojson", data: geojson() });
    map.addLayer({ id: "halo", type: "circle", source: "projects",
      paint: { "circle-radius": 16, "circle-color": "#f28c38", "circle-opacity": 0.25 } });
    map.addLayer({ id: "dots", type: "circle", source: "projects",
      paint: { "circle-radius": 7, "circle-color": "#f28c38", "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" } });
    map.on("click", "dots", (e) => openCard(e.features[0].properties.id));
    map.on("mouseenter", "dots", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "dots", () => (map.getCanvas().style.cursor = ""));
  });

  const mapCard = $("#map-card");
  const openCard = (id) => {
    const p = projects.find((x) => x.id === id);
    mapCard.hidden = false;
    mapCard.replaceChildren(
      el("button", { class: "close", type: "button", "aria-label": "Close", onclick: () => (mapCard.hidden = true) }, "×"),
      el("h3", {}, p.title),
      el("div", { class: "metric", style: "color:var(--accent);font-weight:700;font-size:14px" }, p.metric),
      el("p", { class: "map-note" }, p.location.name),
      el("a", { href: `#p-${p.id}`, onclick: () => flash(p.id) }, "View project →"));
    map.flyTo({ center: p.location.coords, zoom: 5, duration: reduceMotion ? 0 : 1200 });
  };
  const flash = (id) => {
    const c = cards.get(id);
    c.classList.add("focus");
    setTimeout(() => c.classList.remove("focus"), 1600);
  };

  // --- Experience ---
  $("#timeline").append(...experience.map((x) => el("li", {},
    el("div", { class: "dates" }, x.dates),
    el("h3", {}, `${x.role} · ${x.org}`),
    el("p", {}, x.note))));

  function render() {
    renderChips();
    renderStage();
    projects.forEach((p) => cards.get(p.id).classList.toggle("dim", !matches(p)));
    $("#project-filter-note").replaceChildren(describeFilter(), " ",
      (state.domain || state.stage || state.skill)
        ? el("a", { href: "#projects", onclick: (e) => { e.preventDefault(); Object.assign(state, { domain: null, stage: null, skill: null }); render(); } }, "Clear filters")
        : "");
    const src = map.getSource && map.getSource("projects");
    if (src) src.setData(geojson());
  }
  render();
})();
