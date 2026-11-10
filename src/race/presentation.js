import { meshMaterialsFor, VARIANTS } from "../game/variants.js";

export const RACE_ENTRANTS = Object.freeze([
  Object.freeze({
    id: "codex",
    prefix: "duck01_",
    number: "01",
    label: "Codex · GPT-6 Luna",
    model: "gpt-6-luna",
    primary: "#EDF6F5",
    secondary: "#B9CBD6",
    accent: "#36D9E8",
    pattern: "vertical",
    liveryId: "codex-vertical-stripes",
    baseVariant: "blue",
  }),
  Object.freeze({
    id: "claude",
    prefix: "duck02_",
    number: "02",
    label: "Claude Code · Sonnet 5",
    model: "claude-sonnet-5",
    primary: "#E8302A",
    secondary: "#FFF0D9",
    accent: "#25272B",
    pattern: "horizontal",
    liveryId: "claude-wide-band",
    baseVariant: "classic",
  }),
  Object.freeze({
    id: "deepseek",
    prefix: "duck03_",
    number: "03",
    label: "DSH · DeepSeek Flash",
    model: "deepseek-flash",
    primary: "#2E6BFF",
    secondary: "#EAF0FF",
    accent: "#E9F36A",
    pattern: "chevron",
    liveryId: "deepseek-chevron",
    baseVariant: "charcoal",
  }),
]);

const SHELL_SLOTS = new Map([
  ["top_head_shell.stl", "head"],
  ["face_part.stl", "face"],
  ["bottom_head_shell.stl", "trim"],
  ["soft_mouth_top.stl", "mouth"],
  ["jaw.stl", "jaw"],
  ["jaw_soft.stl", "mouth"],
  ["trunk_base.stl", "body"],
  ["left_shell.stl", "side"],
  ["right_shell.stl", "side"],
  ["upper_leg_left.stl", "leg"],
  ["upper_leg_right.stl", "leg"],
  ["foot_left.stl", "foot"],
  ["foot_right.stl", "foot"],
  ["ankle_left.stl", "foot"],
  ["ankle_right.stl", "foot"],
  ["sole_left.stl", "sole"],
  ["sole_right.stl", "sole"],
]);

const PATTERN_SLOTS = new Set(["head", "body", "side", "leg"]);

function entrantFor(value) {
  if (typeof value === "string") return RACE_ENTRANTS.find((entrant) => entrant.id === value);
  return value?.id ? value : RACE_ENTRANTS[0];
}

function slotColor(entrant, slot) {
  if (entrant.id === "codex") {
    if (["head", "body", "foot"].includes(slot)) return entrant.primary;
    if (["face", "side", "leg", "sole"].includes(slot)) return entrant.secondary;
    return entrant.accent;
  }
  if (entrant.id === "claude") {
    if (["head", "body", "side", "foot"].includes(slot)) return entrant.primary;
    if (["face", "leg", "sole"].includes(slot)) return entrant.secondary;
    return entrant.accent;
  }
  if (["head", "body", "side"].includes(slot)) return entrant.primary;
  if (["face", "leg"].includes(slot)) return entrant.secondary;
  return entrant.accent;
}

function cloneMaterial(THREE, material) {
  if (material?.clone) return material.clone();
  if (THREE.MeshStandardMaterial) return new THREE.MeshStandardMaterial({ color: 0xffffff });
  return material;
}

function makeLiveryTexture(THREE, entrant) {
  if (typeof document === "undefined" || typeof document.createElement !== "function" || !THREE.CanvasTexture) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext?.("2d");
  if (!context) return null;

  context.fillStyle = entrant.primary;
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (entrant.pattern === "vertical") {
    context.fillStyle = entrant.secondary;
    context.fillRect(0, 0, 280, canvas.height);
    context.fillRect(744, 0, 280, canvas.height);
    context.fillStyle = entrant.accent;
    context.fillRect(330, 0, 84, canvas.height);
    context.fillRect(610, 0, 84, canvas.height);
  } else if (entrant.pattern === "horizontal") {
    context.fillStyle = entrant.secondary;
    context.fillRect(0, 72, canvas.width, 112);
    context.fillStyle = entrant.accent;
    context.fillRect(0, 64, canvas.width, 8);
    context.fillRect(0, 184, canvas.width, 8);
  } else {
    // Thin accent chevrons: the shell UVs sample a narrow region of this
    // canvas, so wide stripes used to swallow whole shells (the blue duck
    // rendered yellow). Keep the primary color dominant.
    context.fillStyle = entrant.accent;
    for (let x = -256; x < canvas.width + 256; x += 256) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + 30, 0);
      context.lineTo(x + 286, canvas.height);
      context.lineTo(x + 256, canvas.height);
      context.closePath();
      context.fill();
    }
    context.fillStyle = entrant.secondary;
    context.fillRect(0, 110, canvas.width, 28);
  }
  // Number box: keep it in the primary color for chevron liveries — a large
  // accent block here used to paint whole shells yellow through their UVs.
  const numberBoxBackground = entrant.pattern === "chevron" ? entrant.primary : entrant.pattern === "horizontal" ? entrant.secondary : entrant.accent;
  const numberBoxForeground = entrant.pattern === "chevron" ? entrant.accent : entrant.pattern === "horizontal" ? entrant.accent : entrant.secondary;
  context.fillStyle = numberBoxBackground;
  context.fillRect(774, 30, 190, 196);
  context.fillStyle = numberBoxForeground;
  context.font = "900 142px ui-monospace, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(entrant.number, 869, 128);

  const texture = new THREE.CanvasTexture(canvas);
  if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function applyMaterial(THREE, source, spec, color, texture) {
  const material = cloneMaterial(THREE, source);
  if (!material) return material;
  if (material.color) {
    if (color && material.color.set) material.color.set(color);
    else if (spec?.color && material.color.fromArray) material.color.fromArray(spec.color);
  }
  if (spec) {
    if (Number.isFinite(spec.roughness)) material.roughness = spec.roughness;
    if (Number.isFinite(spec.metalness)) material.metalness = spec.metalness;
  }
  if (texture) {
    material.map = texture;
    material.color?.set(0xffffff);
    material.needsUpdate = true;
  }
  return material;
}

export function applyRaceLivery(THREE, rig, entrantInput) {
  const entrant = entrantFor(entrantInput);
  if (!entrant || !rig) return rig;
  const root = rig.placer ?? rig.root ?? rig;
  if (typeof root.traverse !== "function") return rig;
  const variant = VARIANTS[entrant.baseVariant] ?? VARIANTS.classic;
  const variantMap = meshMaterialsFor(variant);
  const texture = makeLiveryTexture(THREE, entrant);

  root.traverse((object) => {
    if (!object.isMesh) return;
    const meshName = object.userData?.meshName;
    const slot = SHELL_SLOTS.get(meshName);
    const baseSpec = variantMap[meshName] ?? variant.mechGray;
    const color = slot ? slotColor(entrant, slot) : null;
    // STL shells carry no UVs, so a texture map would sample one corner texel
    // and paint the whole shell that single color. Only map the pattern onto
    // meshes that actually have UVs; everything else takes the solid slot color.
    const paintTexture = texture && slot && PATTERN_SLOTS.has(slot) && object.geometry?.attributes?.uv ? texture : null;
    // Race identity paint should stay saturated under the bright daylight rig.
    // A matte, non-metallic shell avoids white specular highlights washing the
    // red and green liveries into pink and mint at spectator-camera distance.
    const paintSpec = slot ? { ...baseSpec, roughness: Math.max(baseSpec.roughness ?? .5, .76), metalness: 0 } : baseSpec;
    if (Array.isArray(object.material)) {
      object.material = object.material.map((material) => applyMaterial(THREE, material, paintSpec, color, paintTexture));
    } else {
      object.material = applyMaterial(THREE, object.material, paintSpec, color, paintTexture);
    }
    object.userData.raceLiveryId = entrant.liveryId;
    object.userData.raceEntrantId = entrant.id;
  });

  return rig;
}

export function spectatorIdentityLabel(entrant) {
  return `${entrant.number} · ${entrant.model ?? entrant.label ?? entrant.id}`;
}

export function raceViewButtons(entrants = RACE_ENTRANTS) {
  return [
    ["overview", "OVERVIEW"],
    ["start", "START"],
    ...entrants.map((entrant) => [`chase:${entrant.id}`, `CHASE · ${entrant.id.toUpperCase()}`]),
    ...entrants.map((entrant) => [`fpv:${entrant.id}`, `FPV · ${entrant.id.toUpperCase()}`]),
  ];
}

function formatClock(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function formatMetric(value, suffix = "") {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}${suffix}` : "—";
}

function normalizeEntrants(entries, roster = RACE_ENTRANTS) {
  const byId = new Map((Array.isArray(entries) ? entries : []).map((entry) => [entry.id, entry]));
  return roster.map((entrant) => ({ ...entrant, ...(byId.get(entrant.id) ?? {}) }));
}

function rankEntrants(entries, raceStatus) {
  const ordered = entries.map((entry, index) => ({ entry, index })).sort((left, right) => {
    const leftFinish = Number.isFinite(Number(left.entry.finishTime)) ? Number(left.entry.finishTime) : Infinity;
    const rightFinish = Number.isFinite(Number(right.entry.finishTime)) ? Number(right.entry.finishTime) : Infinity;
    if (leftFinish !== rightFinish) return leftFinish - rightFinish;
    const progress = Number(right.entry.progress || 0) - Number(left.entry.progress || 0);
    if (progress) return progress;
    const checkpoints = Number(right.entry.checkpointIndex || 0) - Number(left.entry.checkpointIndex || 0);
    return checkpoints || left.index - right.index;
  });
  const active = raceStatus === "running" || raceStatus === "finished";
  return ordered.map((item, index) => {
    const previous = ordered[index - 1]?.entry;
    const sameFinish = previous && ((Number.isFinite(Number(previous.finishTime)) && Number.isFinite(Number(item.entry.finishTime))
      && Number(previous.finishTime) === Number(item.entry.finishTime))
      || (!Number.isFinite(Number(previous.finishTime)) && !Number.isFinite(Number(item.entry.finishTime))));
    const tied = previous && sameFinish && Number(previous.progress || 0) === Number(item.entry.progress || 0) &&
      Number(previous.checkpointIndex || 0) === Number(item.entry.checkpointIndex || 0);
    const next = ordered[index + 1]?.entry;
    const nextSameFinish = next && ((Number.isFinite(Number(next.finishTime)) && Number.isFinite(Number(item.entry.finishTime))
      && Number(next.finishTime) === Number(item.entry.finishTime))
      || (!Number.isFinite(Number(next.finishTime)) && !Number.isFinite(Number(item.entry.finishTime))));
    const tiedForward = next && nextSameFinish && Number(next.progress || 0) === Number(item.entry.progress || 0) &&
      Number(next.checkpointIndex || 0) === Number(item.entry.checkpointIndex || 0);
    const rank = active && item.entry.status !== "error" && item.entry.valid_for_ranking !== false ? (tied || tiedForward ? "TIE" : String(index + 1).padStart(2, "0")) : "—";
    return { ...item.entry, rank };
  });
}

function noHud() {
  return { update() {}, dispose() {} };
}

export function mountRaceHud(root, options = {}) {
  if (!root || typeof root.appendChild !== "function") return noHud();
  const documentRef = root.ownerDocument ?? (typeof document !== "undefined" ? document : null);
  if (!documentRef?.createElement) return noHud();
  const roster = options.entrants ?? RACE_ENTRANTS;
  const listeners = [];
  const element = (tag, className, text) => {
    const node = documentRef.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const hud = element("section", `race-hud${roster.length > 3 ? ' race-hud--multiplayer' : ''}`);
  hud.setAttribute?.("aria-label", "Microduck Contact Race");
  const header = element("header", "race-hud__header");
  const identity = element("div", "race-hud__identity");
  identity.append(element("span", "race-hud__brand", "MICRODUCK"), element("span", "race-hud__meet", "CONTACT RACE"));
  const live = element("span", "race-hud__live", `${roster.length} LIVE`);
  header.append(identity, live);
  hud.append(header);

  const timing = element("div", "race-hud__timing");
  const status = element("span", "race-hud__status", "READY");
  const countdown = element("strong", "race-hud__countdown", "10:00");
  const timingMeta = element("span", "race-hud__timing-meta", "RTF — · CONTACTS 0");
  timing.append(status, countdown, timingMeta);
  hud.append(timing);

  const actions = element("div", "race-hud__actions");
  const start = element("button", "race-hud__start", options.startLabel ?? "START RACE");
  start.type = "button";
  let started = false;
  const startListener = () => {
    if (started || options.preview) return;
    started = true;
    start.disabled = true;
    options.onStart?.();
  };
  start.addEventListener?.("click", startListener);
  listeners.push(() => start.removeEventListener?.("click", startListener));
  actions.append(start);
  const pause = options.onPause ? element("button", "race-hud__pause", "PAUSE · DEV ONLY") : null;
  if (pause) {
    pause.type = "button";
    const pauseListener = () => options.onPause({ invalidForMainRace: true });
    pause.addEventListener?.("click", pauseListener);
    listeners.push(() => pause.removeEventListener?.("click", pauseListener));
    actions.append(pause);
  }
  hud.append(actions);

  const views = element("nav", "race-hud__views");
  views.setAttribute?.("aria-label", "Race cameras");
  if (roster.length > 3) {
    const select = element('select', 'race-hud__camera-select');
    select.setAttribute?.('aria-label', 'Race camera · duck number and model');
    for (const [view, label] of raceViewButtons(roster)) {
      const entrant = roster.find((entry) => entry.id === view.split(':')[1]);
      const option = element('option', '', entrant ? `${view.startsWith('fpv:') ? 'FPV' : 'CHASE'} · ${spectatorIdentityLabel(entrant)}` : label);
      option.value = view;
      select.append(option);
    }
    const listener = () => options.onView?.(select.value);
    select.addEventListener?.('change', listener);
    listeners.push(() => select.removeEventListener?.('change', listener));
    views.append(select);
  } else {
    for (const [view, label] of raceViewButtons(roster)) {
      const button = element("button", "race-hud__view", label);
      button.type = "button";
      button.dataset.view = view;
      const viewListener = () => options.onView?.(view);
      button.addEventListener?.("click", viewListener);
      listeners.push(() => button.removeEventListener?.("click", viewListener));
      views.append(button);
    }
  }
  hud.append(views);

  const board = element("div", "race-hud__board");
  const rows = new Map();
  for (const entrant of roster) {
    const row = element("article", "race-hud__entrant");
    row.dataset.entrant = entrant.id;
    const marker = element("span", "race-hud__marker", entrant.number);
    marker.style?.setProperty("--entrant-accent", entrant.accent);
    const info = element("div", "race-hud__entrant-info");
    const name = element("strong", "race-hud__entrant-name", `${entrant.colorName ? `${entrant.colorName} · ` : ''}${entrant.label}`);
    name.title = `${entrant.number} · ${entrant.label} · ${entrant.model}`;
    const detail = element("span", "race-hud__entrant-detail", `${entrant.model} · READY`);
    detail.title = entrant.model;
    const telemetry = element("span", "race-hud__entrant-telemetry", "MODE — · GAIT — · CP — · C0 · F0");
    const progress = element("span", "race-hud__progress");
    const progressBar = element("i", "race-hud__progress-bar");
    progress.append(progressBar);
    info.append(name, detail, telemetry, progress);
    const result = element("div", "race-hud__result");
    const rank = element("strong", "race-hud__rank", "—");
    const time = element("span", "race-hud__finish", "—");
    result.append(rank, time);
    row.append(marker, info, result);
    board.append(row);
    rows.set(entrant.id, { row, detail, telemetry, progressBar, rank, time });
  }
  hud.append(board);
  if (pause) hud.append(element("p", "race-hud__notice", "DEVELOPMENT INTERVENTION · INVALID FOR MAIN RACE"));
  root.appendChild(hud);

  const update = (snapshot = {}) => {
    start.disabled = !!options.preview || started || (snapshot.status ?? 'ready') !== 'ready';
    const entrants = rankEntrants(normalizeEntrants(snapshot.entrants, roster), snapshot.valid_for_ranking === false ? 'invalid' : snapshot.status);
    const liveCount = entrants.filter((entrant) => entrant.status !== "error").length;
    live.textContent = `${liveCount} LIVE`;
    status.textContent = String(snapshot.status ?? "ready").toUpperCase();
    countdown.textContent = formatClock((snapshot.timeLimitSeconds ?? 3600) - (snapshot.simSeconds ?? 0));
    const contactCount = Number.isFinite(Number(snapshot.contacts))
      ? Number(snapshot.contacts)
      : entrants.reduce((total, entrant) => total + (Number(entrant.contacts) || 0), 0);
    timingMeta.textContent = `RTF ${formatMetric(snapshot.realTimeFactor)} · CONTACTS ${contactCount}`;
    for (const entrant of entrants) {
      const view = rows.get(entrant.id);
      if (!view) continue;
      const progress = Math.max(0, Math.min(1, Number(entrant.progress) || 0));
      const recoveryDetail = entrant.recovery_phase ? `AUTO RECOVERY #${entrant.recovery_attempt} · ${entrant.recovery_phase} · ${entrant.recovery_policy}` : null;
      view.detail.textContent = `${entrant.model} · ${String(recoveryDetail ?? entrant.actionStatus ?? entrant.status ?? "READY").toUpperCase()}`;
      view.telemetry.textContent = `MODE ${String(entrant.mode ?? "—").toUpperCase()} · GAIT ${String(entrant.gait ?? "—").toUpperCase()} · CP ${entrant.checkpointIndex ?? 0}/${entrant.checkpointCount ?? 0} · C${entrant.contacts ?? 0} · F${entrant.falls ?? 0} · REC ${(entrant.recovery_total_s ?? 0).toFixed(1)}s / ${entrant.recovery_retry_count ?? 0} retries · ACT ${(entrant.effective_action_s ?? 0).toFixed(1)}s`;
      view.progressBar.style.width = `${progress * 100}%`;
      view.progressBar.setAttribute?.("aria-valuenow", String(Math.round(progress * 100)));
      view.rank.textContent = entrant.rank;
      view.time.textContent = Number.isFinite(Number(entrant.finishTime)) ? `${Number(entrant.finishTime).toFixed(2)}s` : "—";
      view.row.dataset.status = entrant.status ?? "ready";
      view.row.dataset.checkpoint = `${entrant.checkpointIndex ?? 0}/${entrant.checkpointCount ?? 0}`;
    }
    return snapshot;
  };

  update(options.getSnapshot?.() ?? { status: "ready", timeLimitSeconds: 3600 });
  return {
    update,
    dispose() {
      for (const remove of listeners) remove();
      hud.remove?.();
    },
  };
}
