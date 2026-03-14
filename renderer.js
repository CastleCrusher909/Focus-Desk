const DEFAULT_SITES = ["youtube.com", "reddit.com", "instagram.com", "tiktok.com"];
const DEFAULT_APPS = ["Safari", "Discord"];
const BREAK_SECONDS = 5 * 60;

const durationInput = document.getElementById("durationInput");
const startButton = document.getElementById("startButton");
const endButton = document.getElementById("endButton");
const timerDisplay = document.getElementById("timerDisplay");
const timerLabel = document.getElementById("timerLabel");
const statusText = document.getElementById("statusText");
const blockStatus = document.getElementById("blockStatus");
const sessionCount = document.getElementById("sessionCount");
const weeklyTotal = document.getElementById("weeklyTotal");
const historyTotal = document.getElementById("historyTotal");
const weeklyChart = document.getElementById("weeklyChart");
const blockNotice = document.getElementById("blockNotice");
const blockedChips = document.getElementById("blockedChips");
const blockedAppChips = document.getElementById("blockedAppChips");
const unifiedSearch = document.getElementById("unifiedSearch");
const unifiedSuggestions = document.getElementById("unifiedSuggestions");
const presetSelect = document.getElementById("presetSelect");
const applyPresetButton = document.getElementById("applyPresetButton");
const openPresetModalButton = document.getElementById("openPresetModalButton");
const deletePresetButton = document.getElementById("deletePresetButton");
const presetMeta = document.getElementById("presetMeta");
const chartTitle = document.getElementById("chartTitle");
const chartSubtitle = document.getElementById("chartSubtitle");
const dailyViewButton = document.getElementById("dailyViewButton");
const weeklyViewButton = document.getElementById("weeklyViewButton");
const yearlyViewButton = document.getElementById("yearlyViewButton");
const presetModal = document.getElementById("presetModal");
const closePresetModalButton = document.getElementById("closePresetModalButton");
const cancelPresetButton = document.getElementById("cancelPresetButton");
const createPresetButton = document.getElementById("createPresetButton");
const presetNameInput = document.getElementById("presetNameInput");
const presetSiteList = document.getElementById("presetSiteList");
const presetAppList = document.getElementById("presetAppList");
const presetSiteSearch = document.getElementById("presetSiteSearch");
const presetSiteSuggestions = document.getElementById("presetSiteSuggestions");
const presetAppSearch = document.getElementById("presetAppSearch");
const presetAppSuggestions = document.getElementById("presetAppSuggestions");

let timerId = null;
let endTime = null;
let mode = "idle";
let blockedSites = loadBlockedSites();
let blockedApps = loadBlockedApps();
let installedApps = [];
let unifiedSuggestTimer = null;
let latestUnifiedQuery = "";
let chartView = "daily";
let presetSiteDraft = [];
let presetAppDraft = [];
let presetSiteTimer = null;
let presetAppTimer = null;

const PRESET_STORAGE_KEY = "focusCustomPresets";
let customPresets = loadCustomPresets();

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function normalizeSite(input) {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return "";
  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  const withoutPath = withoutProtocol.split("/")[0];
  if (withoutPath.includes(" ")) return "";
  return withoutPath.replace(/^www\./, "");
}

function loadBlockedSites() {
  const raw = localStorage.getItem("blockedSites");
  if (!raw) return [...DEFAULT_SITES];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(normalizeSite).filter(Boolean);
    }
  } catch (error) {
    return [...DEFAULT_SITES];
  }
  return [...DEFAULT_SITES];
}

function loadBlockedApps() {
  const raw = localStorage.getItem("blockedApps");
  if (!raw) return [...DEFAULT_APPS];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item) => item.trim()).filter(Boolean);
    }
  } catch (error) {
    return [...DEFAULT_APPS];
  }
  return [...DEFAULT_APPS];
}

function loadCustomPresets() {
  const raw = localStorage.getItem(PRESET_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((preset) => preset && typeof preset === "object")
        .map((preset) => ({
          id: String(preset.id || ""),
          name: String(preset.name || "Custom Preset"),
          sites: Array.isArray(preset.sites) ? preset.sites : [],
          apps: Array.isArray(preset.apps) ? preset.apps : [],
          builtIn: false
        }))
        .filter((preset) => preset.id && preset.name);
    }
  } catch (error) {
    return [];
  }
  return [];
}

function saveCustomPresets(next) {
  customPresets = next;
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(next));
  renderPresets();
}

function saveBlockedSites(sites) {
  blockedSites = sites;
  localStorage.setItem("blockedSites", JSON.stringify(sites));
  renderBlockedSites();
  updateUnifiedSuggestions();
}

function saveBlockedApps(apps) {
  blockedApps = apps;
  localStorage.setItem("blockedApps", JSON.stringify(apps));
  renderBlockedApps();
  updateUnifiedSuggestions();
}

function renderBlockedSites() {
  blockedChips.innerHTML = "";

  if (blockedSites.length === 0) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = "No sites yet";
    blockedChips.appendChild(chip);
    return;
  }

  blockedSites.forEach((site, index) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = site;

    const remove = document.createElement("button");
    remove.className = "chip-remove";
    remove.textContent = "X";
    remove.setAttribute("aria-label", `Remove ${site}`);
    remove.addEventListener("click", () => removeSite(index));

    chip.appendChild(remove);
    blockedChips.appendChild(chip);
  });
}

function renderBlockedApps() {
  blockedAppChips.innerHTML = "";

  if (blockedApps.length === 0) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = "No apps yet";
    blockedAppChips.appendChild(chip);
    return;
  }

  blockedApps.forEach((appName, index) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = appName;

    const remove = document.createElement("button");
    remove.className = "chip-remove";
    remove.textContent = "X";
    remove.setAttribute("aria-label", `Remove ${appName}`);
    remove.addEventListener("click", () => removeApp(index));

    chip.appendChild(remove);
    blockedAppChips.appendChild(chip);
  });
}

function getAllPresets() {
  return [...customPresets];
}

function getSelectedPreset() {
  const all = getAllPresets();
  return all.find((preset) => preset.id === presetSelect.value) || all[0] || null;
}

function renderPresets() {
  const all = getAllPresets();
  presetSelect.innerHTML = "";

  all.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.name;
    presetSelect.appendChild(option);
  });

  if (!presetSelect.value && all.length > 0) {
    presetSelect.value = all[0].id;
  }

  updatePresetMeta();
}

function updatePresetMeta() {
  const preset = getSelectedPreset();
  if (!preset) {
    presetMeta.textContent = "No presets yet.";
    deletePresetButton.disabled = true;
    applyPresetButton.disabled = true;
    return;
  }

  const sitesCount = Array.isArray(preset.sites) ? preset.sites.length : 0;
  const appsCount = Array.isArray(preset.apps) ? preset.apps.length : 0;
  presetMeta.textContent = `${sitesCount} sites · ${appsCount} apps`;

  deletePresetButton.disabled = false;
  applyPresetButton.disabled = false;
}

function mergeApps(existing, incoming) {
  const seen = new Set(existing.map((app) => app.toLowerCase()));
  const merged = [...existing];
  incoming.forEach((app) => {
    const normalized = String(app || "").trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(normalized);
  });
  return merged;
}

function applyPreset(preset, modeName) {
  const presetSites = (preset.sites || []).map(normalizeSite).filter(Boolean);
  const presetApps = (preset.apps || []).map((app) => String(app || "").trim()).filter(Boolean);

  const nextSites =
    modeName === "replace"
      ? Array.from(new Set(presetSites))
      : Array.from(new Set([...blockedSites, ...presetSites]));

  const nextApps =
    modeName === "replace"
      ? mergeApps([], presetApps)
      : mergeApps(blockedApps, presetApps);

  saveBlockedSites(nextSites);
  saveBlockedApps(nextApps);

  if (mode === "focus") {
    startBlocking();
    startAppBlocking();
  }
}

function deleteSelectedPreset() {
  const preset = getSelectedPreset();
  if (!preset) return;
  const confirmed = window.confirm(`Delete preset "${preset.name}"?`);
  if (!confirmed) return;
  saveCustomPresets(customPresets.filter((item) => item.id !== preset.id));
}

function renderPresetSelection() {
  presetSiteList.innerHTML = "";
  presetAppList.innerHTML = "";

  if (presetSiteDraft.length === 0) {
    const empty = document.createElement("div");
    empty.className = "modal-item";
    empty.textContent = "No sites selected yet.";
    presetSiteList.appendChild(empty);
  } else {
    presetSiteDraft.forEach((site) => {
      const row = document.createElement("div");
      row.className = "modal-item";
      row.textContent = site;
      const remove = document.createElement("button");
      remove.className = "chip-remove";
      remove.textContent = "X";
      remove.addEventListener("click", () => {
        presetSiteDraft = presetSiteDraft.filter((item) => item !== site);
        renderPresetSelection();
      });
      row.appendChild(remove);
      presetSiteList.appendChild(row);
    });
  }

  if (presetAppDraft.length === 0) {
    const empty = document.createElement("div");
    empty.className = "modal-item";
    empty.textContent = "No apps selected yet.";
    presetAppList.appendChild(empty);
  } else {
    presetAppDraft.forEach((app) => {
      const row = document.createElement("div");
      row.className = "modal-item";
      row.textContent = app;
      const remove = document.createElement("button");
      remove.className = "chip-remove";
      remove.textContent = "X";
      remove.addEventListener("click", () => {
        presetAppDraft = presetAppDraft.filter((item) => item !== app);
        renderPresetSelection();
      });
      row.appendChild(remove);
      presetAppList.appendChild(row);
    });
  }
}

function openPresetModal() {
  presetNameInput.value = "";
  presetSiteDraft = [];
  presetAppDraft = [];
  presetSiteSearch.value = "";
  presetAppSearch.value = "";
  closeSuggestions(presetSiteSuggestions);
  closeSuggestions(presetAppSuggestions);
  renderPresetSelection();
  presetModal.classList.remove("hidden");
}

function closePresetModal() {
  presetModal.classList.add("hidden");
}

function createPresetFromModal() {
  const name = presetNameInput.value.trim();
  if (!name) {
    setStatus("Enter a preset name.");
    return;
  }
  const selectedSites = [...presetSiteDraft];
  const selectedApps = [...presetAppDraft];

  const id = `custom-${Date.now()}`;
  const preset = {
    id,
    name,
    sites: selectedSites,
    apps: selectedApps
  };

  saveCustomPresets([...customPresets, preset]);
  presetSelect.value = id;
  updatePresetMeta();
  closePresetModal();
}

function renderSimpleSuggestions(container, items, onPick) {
  container.innerHTML = "";
  container.classList.toggle("is-open", items.length > 0);
  if (items.length === 0) return;
  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion";
    button.textContent = item;
    button.addEventListener("click", () => onPick(item));
    container.appendChild(button);
  });
}

function addPresetSite(value) {
  let normalized = normalizeSite(value);
  if (!normalized) return;
  if (!normalized.includes(".")) {
    normalized = `${normalized}.com`;
  }
  if (presetSiteDraft.includes(normalized)) return;
  presetSiteDraft = [...presetSiteDraft, normalized];
  renderPresetSelection();
}

function addPresetApp(value) {
  const trimmed = value.trim();
  if (!trimmed) return;
  const exists = presetAppDraft.some((app) => app.toLowerCase() === trimmed.toLowerCase());
  if (exists) return;
  presetAppDraft = [...presetAppDraft, trimmed];
  renderPresetSelection();
}

async function updatePresetSiteSuggestions() {
  const query = presetSiteSearch.value.trim();
  if (!query) {
    closeSuggestions(presetSiteSuggestions);
    return;
  }
  let results = [];
  try {
    results = await window.focusApi.siteSuggest(query);
  } catch (error) {
    results = [];
  }
  const normalized = results
    .map((item) => normalizeSuggestionToSite(item))
    .filter(Boolean);
  const unique = Array.from(new Set(normalized)).slice(0, 6);
  renderSimpleSuggestions(presetSiteSuggestions, unique, (site) => {
    addPresetSite(site);
    presetSiteSearch.value = "";
    closeSuggestions(presetSiteSuggestions);
  });
}

function updatePresetAppSuggestions() {
  const query = presetAppSearch.value.trim().toLowerCase();
  if (!query) {
    closeSuggestions(presetAppSuggestions);
    return;
  }
  const matches = installedApps
    .filter((app) => app.toLowerCase().includes(query))
    .slice(0, 6);
  renderSimpleSuggestions(presetAppSuggestions, matches, (app) => {
    addPresetApp(app);
    presetAppSearch.value = "";
    closeSuggestions(presetAppSuggestions);
  });
}

function normalizeSuggestionToSite(value) {
  const normalized = normalizeSite(value);
  if (normalized && normalized.includes(".")) return normalized;
  const compact = value.trim().toLowerCase();
  if (!compact || compact.includes(" ")) return "";
  return `${compact}.com`;
}

function closeSuggestions(container) {
  container.classList.remove("is-open");
  container.innerHTML = "";
}

function isBlockedSite(domain) {
  return blockedSites.includes(domain);
}

function isBlockedApp(name) {
  return blockedApps.some((app) => app.toLowerCase() === name.toLowerCase());
}

function renderUnifiedSuggestions(siteItems, appItems, isOpen) {
  unifiedSuggestions.innerHTML = "";
  unifiedSuggestions.classList.toggle("is-open", isOpen);
  if (!isOpen) return;

  if (siteItems.length === 0 && appItems.length === 0) {
    const empty = document.createElement("div");
    empty.className = "suggestion";
    empty.textContent = "No matches";
    unifiedSuggestions.appendChild(empty);
    return;
  }

  const renderSection = (title, items, onPick) => {
    if (items.length === 0) return;
    const header = document.createElement("div");
    header.className = "suggestion-header";
    header.textContent = title;
    unifiedSuggestions.appendChild(header);

    items.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suggestion";
      button.textContent = item.label;

      if (item.blocked) {
        button.classList.add("is-blocked");
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = "Blocked";
        button.appendChild(badge);
      } else {
        button.addEventListener("click", () => {
          onPick(item.label);
          unifiedSearch.value = "";
          closeSuggestions(unifiedSuggestions);
        });
      }

      unifiedSuggestions.appendChild(button);
    });
  };

  renderSection("Websites", siteItems, (site) => addSite(site));
  renderSection("Apps", appItems, (app) => addApp(app));
}

async function updateUnifiedSuggestions() {
  const query = unifiedSearch.value.trim();
  if (!query) {
    closeSuggestions(unifiedSuggestions);
    return;
  }

  latestUnifiedQuery = query;
  let results = [];
  try {
    results = await window.focusApi.siteSuggest(query);
  } catch (error) {
    results = [];
  }
  if (latestUnifiedQuery !== query) return;

  const normalizedSites = results
    .map((item) => normalizeSuggestionToSite(item))
    .filter((site) => site);
  const uniqueSites = Array.from(new Set(normalizedSites))
    .slice(0, 8)
    .map((site) => ({ label: site, blocked: isBlockedSite(site) }));

  const appItems = installedApps
    .filter((app) => app.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8)
    .map((app) => ({ label: app, blocked: isBlockedApp(app) }));

  renderUnifiedSuggestions(uniqueSites, appItems, true);
}

function addSite(value) {
  let normalized = normalizeSite(value);
  if (!normalized) {
    setStatus("Enter a valid website (like youtube.com).");
    return;
  }
  if (!normalized.includes(".")) {
    normalized = `${normalized}.com`;
  }
  if (blockedSites.includes(normalized)) {
    setStatus("That site is already in the list.");
    return;
  }
  saveBlockedSites([...blockedSites, normalized]);
  if (mode === "focus") {
    startBlocking();
  }
}

function removeSite(index) {
  const next = blockedSites.filter((_, i) => i !== index);
  saveBlockedSites(next);
  if (mode === "focus") {
    startBlocking();
  }
}

function addApp(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    setStatus("Enter an app name (like Safari).");
    return;
  }
  if (blockedApps.some((app) => app.toLowerCase() === trimmed.toLowerCase())) {
    setStatus("That app is already in the list.");
    return;
  }
  saveBlockedApps([...blockedApps, trimmed]);
  if (mode === "focus") {
    startAppBlocking();
  }
}

function removeApp(index) {
  const next = blockedApps.filter((_, i) => i !== index);
  saveBlockedApps(next);
  if (mode === "focus") {
    startAppBlocking();
  }
}

function getDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function loadStats() {
  const raw = localStorage.getItem("focusStats");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

function saveStats(stats) {
  localStorage.setItem("focusStats", JSON.stringify(stats));
}

function updateTodayStats(minutes) {
  const stats = loadStats();
  const key = getDateKey();
  const today = stats[key] || { sessions: 0, minutes: 0 };
  today.sessions += 1;
  today.minutes += minutes;
  stats[key] = today;
  saveStats(stats);
  updateStatsUI();
}

function getWeeklyData() {
  const stats = loadStats();
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = getDateKey(date);
    const entry = stats[key] || { sessions: 0, minutes: 0 };
    days.push({ date, minutes: entry.minutes, sessions: entry.sessions });
  }
  return days;
}

function getDailySeries(days = 7) {
  const stats = loadStats();
  const points = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = getDateKey(date);
    const entry = stats[key] || { sessions: 0, minutes: 0 };
    points.push({ label: date.toLocaleDateString(undefined, { weekday: "short" }), minutes: entry.minutes });
  }
  return points;
}

function getWeeklySeries(weeks = 12) {
  const stats = loadStats();
  const points = [];
  const today = new Date();
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = new Date(today);
    start.setDate(start.getDate() - i * 7);
    const label = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    let total = 0;
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() - start.getDay() + d);
      const key = getDateKey(date);
      const entry = stats[key] || { minutes: 0 };
      total += entry.minutes || 0;
    }
    points.push({ label, minutes: total });
  }
  return points;
}

function getYearlySeries(months = 12) {
  const stats = loadStats();
  const points = [];
  const today = new Date();
  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const label = date.toLocaleDateString(undefined, { month: "short" });
    let total = 0;
    const month = date.getMonth();
    const year = date.getFullYear();
    Object.keys(stats).forEach((key) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
      const [y, m] = key.split("-").map(Number);
      if (y === year && m - 1 === month) {
        total += stats[key].minutes || 0;
      }
    });
    points.push({ label, minutes: total });
  }
  return points;
}

function getHistoryTotal() {
  const stats = loadStats();
  return Object.values(stats).reduce((sum, item) => sum + (item.minutes || 0), 0);
}

function updateStatsUI() {
  const stats = loadStats();
  const todayKey = getDateKey();
  const today = stats[todayKey] || { sessions: 0, minutes: 0 };
  sessionCount.textContent = `Sessions today: ${today.sessions}`;

  const weekly = getWeeklyData();
  const totalMinutes = weekly.reduce((sum, item) => sum + item.minutes, 0);
  weeklyTotal.textContent = `${totalMinutes} min`;
  historyTotal.textContent = `${getHistoryTotal()} min`;
  updateChartView();
}

function drawChart(series) {
  const ctx = weeklyChart.getContext("2d");
  const width = weeklyChart.width;
  const height = weeklyChart.height;
  ctx.clearRect(0, 0, width, height);

  const padding = 24;
  const chartHeight = height - padding * 2;
  const chartWidth = width - padding * 2;
  const maxMinutes = Math.max(60, ...series.map((point) => point.minutes));
  const barWidth = chartWidth / series.length - 12;

  ctx.fillStyle = "#f4efe6";
  ctx.fillRect(0, 0, width, height);

  const ticks = 4;
  const useHours = maxMinutes >= 300;
  ctx.fillStyle = "#6b645a";
  ctx.font = "11px Space Grotesk";
  for (let i = 0; i <= ticks; i += 1) {
    const rawValue = (maxMinutes / ticks) * i;
    const displayValue = useHours ? rawValue / 60 : rawValue;
    const rounded = useHours
      ? Math.round(displayValue * 10) / 10
      : Math.round(displayValue);
    const unit = useHours ? "hr" : "min";
    const y = height - padding - (chartHeight / ticks) * i;
    ctx.fillText(`${rounded} ${unit}`, 6, y + 4);
    ctx.strokeStyle = "rgba(29, 27, 22, 0.08)";
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  series.forEach((point, index) => {
    const x = padding + index * (barWidth + 12);
    const barHeight = (point.minutes / maxMinutes) * chartHeight;
    const y = height - padding - barHeight;

    ctx.fillStyle = "#2c6f6a";
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = "#6b645a";
    ctx.font = "12px Space Grotesk";
    ctx.fillText(point.label, x, height - padding + 14);
  });
}

function updateChartView() {
  dailyViewButton.classList.toggle("active", chartView === "daily");
  weeklyViewButton.classList.toggle("active", chartView === "weekly");
  yearlyViewButton.classList.toggle("active", chartView === "yearly");

  if (chartView === "daily") {
    chartTitle.textContent = "Daily study time";
    chartSubtitle.textContent = "Minutes focused over the last 7 days";
    drawChart(getDailySeries(7));
    return;
  }
  if (chartView === "weekly") {
    chartTitle.textContent = "Weekly study time";
    chartSubtitle.textContent = "Minutes focused over the last 12 weeks";
    drawChart(getWeeklySeries(12));
    return;
  }
  chartTitle.textContent = "Yearly study time";
  chartSubtitle.textContent = "Minutes focused over the last 12 months";
  drawChart(getYearlySeries(12));
}

function setStatus(text, meta) {
  statusText.textContent = text;
  if (meta) {
    blockStatus.textContent = meta;
  }
}

async function startBlocking() {
  const response = await window.focusApi.startBlocking(blockedSites);
  if (response.ok) {
    blockStatus.textContent = "Blocking: active";
    blockNotice.style.display = "none";
    return true;
  }
  blockStatus.textContent = "Blocking: needs permission";
  blockNotice.style.display = "block";
  await window.focusApi.showBlockingHelp();
  return false;
}

async function startAppBlocking() {
  await window.focusApi.startAppBlocking(blockedApps);
}

async function stopBlocking() {
  const response = await window.focusApi.stopBlocking();
  if (response.ok) {
    blockStatus.textContent = "Blocking: inactive";
  } else {
    blockStatus.textContent = "Blocking: unable to clear";
  }
}

async function stopAppBlocking() {
  await window.focusApi.stopAppBlocking();
}

function startTimer(seconds, label) {
  if (timerId) clearInterval(timerId);
  endTime = Date.now() + seconds * 1000;
  timerLabel.textContent = label;

  const tick = () => {
    const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
    timerDisplay.textContent = formatTime(remaining);
    if (remaining <= 0) {
      clearInterval(timerId);
      timerId = null;
      handleTimerComplete();
    }
  };

  tick();
  timerId = setInterval(tick, 1000);
}

function resetUI() {
  mode = "idle";
  endTime = null;
  timerDisplay.textContent = formatTime(Number(durationInput.value || 25) * 60);
  timerLabel.textContent = "Focus Time";
  startButton.disabled = false;
  endButton.disabled = true;
  setStatus("Ready to focus", "Blocking: inactive");
}

function handleTimerComplete() {
  if (mode === "focus") {
    const minutes = Number(durationInput.value || 25);
    updateTodayStats(minutes);
    mode = "break";
    setStatus("Break time", "Blocking: inactive");
    stopBlocking();
    stopAppBlocking();
    startTimer(BREAK_SECONDS, "Break Time");
  } else if (mode === "break") {
    resetUI();
  }
}

startButton.addEventListener("click", async () => {
  const minutes = Number(durationInput.value);
  if (!minutes || minutes < 5 || minutes > 180) {
    setStatus("Enter a study length between 5 and 180 minutes.");
    return;
  }

  mode = "focus";
  startButton.disabled = true;
  endButton.disabled = false;
  setStatus("Focus session running", "Blocking: starting");
  try {
    await startBlocking();
    await startAppBlocking();
  } catch (error) {
    setStatus("Focus session running", "Blocking: unavailable");
  }
  startTimer(minutes * 60, "Focus Time");
});

endButton.addEventListener("click", () => {
  if (timerId) clearInterval(timerId);
  timerId = null;
  stopBlocking();
  stopAppBlocking();
  resetUI();
});

durationInput.addEventListener("change", () => {
  if (mode === "idle") {
    timerDisplay.textContent = formatTime(Number(durationInput.value || 25) * 60);
  }
});

unifiedSearch.addEventListener("input", () => {
  if (unifiedSuggestTimer) clearTimeout(unifiedSuggestTimer);
  unifiedSuggestTimer = setTimeout(updateUnifiedSuggestions, 250);
});

unifiedSearch.addEventListener("blur", () => {
  setTimeout(() => closeSuggestions(unifiedSuggestions), 120);
});

unifiedSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    const raw = unifiedSearch.value.trim();
    if (!raw) return;
    const matchedApp = installedApps.find(
      (app) => app.toLowerCase() === raw.toLowerCase()
    );
    if (matchedApp) {
      addApp(matchedApp);
    } else {
      addSite(raw);
    }
    unifiedSearch.value = "";
    closeSuggestions(unifiedSuggestions);
  }
  if (event.key === "Escape") {
    closeSuggestions(unifiedSuggestions);
    unifiedSearch.blur();
  }
});

presetSelect.addEventListener("change", () => {
  updatePresetMeta();
});

presetSelect.addEventListener("change", () => {
  updatePresetMeta();
});

dailyViewButton.addEventListener("click", () => {
  chartView = "daily";
  updateChartView();
});

weeklyViewButton.addEventListener("click", () => {
  chartView = "weekly";
  updateChartView();
});

yearlyViewButton.addEventListener("click", () => {
  chartView = "yearly";
  updateChartView();
});

applyPresetButton.addEventListener("click", () => {
  const preset = getSelectedPreset();
  if (!preset) return;
  applyPreset(preset, "merge");
});


deletePresetButton.addEventListener("click", () => {
  deleteSelectedPreset();
});

openPresetModalButton.addEventListener("click", () => {
  openPresetModal();
});

closePresetModalButton.addEventListener("click", () => {
  closePresetModal();
});

cancelPresetButton.addEventListener("click", () => {
  closePresetModal();
});

createPresetButton.addEventListener("click", () => {
  createPresetFromModal();
});

presetSiteSearch.addEventListener("input", () => {
  if (presetSiteTimer) clearTimeout(presetSiteTimer);
  presetSiteTimer = setTimeout(updatePresetSiteSuggestions, 250);
});

presetSiteSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addPresetSite(presetSiteSearch.value);
    presetSiteSearch.value = "";
    closeSuggestions(presetSiteSuggestions);
  }
});

presetSiteSearch.addEventListener("blur", () => {
  setTimeout(() => closeSuggestions(presetSiteSuggestions), 120);
});

presetAppSearch.addEventListener("input", () => {
  if (presetAppTimer) clearTimeout(presetAppTimer);
  presetAppTimer = setTimeout(updatePresetAppSuggestions, 250);
});

presetAppSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addPresetApp(presetAppSearch.value);
    presetAppSearch.value = "";
    closeSuggestions(presetAppSuggestions);
  }
});

presetAppSearch.addEventListener("blur", () => {
  setTimeout(() => closeSuggestions(presetAppSuggestions), 120);
});

updateStatsUI();
renderBlockedSites();
renderBlockedApps();
renderPresets();
closeSuggestions(unifiedSuggestions);
resetUI();

if (window.focusApi && typeof window.focusApi.listInstalledApps === "function") {
  window.focusApi.listInstalledApps().then((apps) => {
    installedApps = apps;
    updateUnifiedSuggestions();
  });
} else {
  installedApps = [];
}
