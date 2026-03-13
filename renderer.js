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
const weeklyChart = document.getElementById("weeklyChart");
const blockNotice = document.getElementById("blockNotice");
const blockedChips = document.getElementById("blockedChips");
const blockedAppChips = document.getElementById("blockedAppChips");
const unifiedSearch = document.getElementById("unifiedSearch");
const unifiedSuggestions = document.getElementById("unifiedSuggestions");

let timerId = null;
let endTime = null;
let mode = "idle";
let blockedSites = loadBlockedSites();
let blockedApps = loadBlockedApps();
let installedApps = [];
let unifiedSuggestTimer = null;
let latestUnifiedQuery = "";

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
  const normalized = normalizeSite(value);
  if (!normalized) {
    setStatus("Enter a valid website (like youtube.com).");
    return;
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

function updateStatsUI() {
  const stats = loadStats();
  const todayKey = getDateKey();
  const today = stats[todayKey] || { sessions: 0, minutes: 0 };
  sessionCount.textContent = `Sessions today: ${today.sessions}`;

  const weekly = getWeeklyData();
  const totalMinutes = weekly.reduce((sum, item) => sum + item.minutes, 0);
  weeklyTotal.textContent = `${totalMinutes} min`;
  drawWeeklyChart(weekly);
}

function drawWeeklyChart(weekly) {
  const ctx = weeklyChart.getContext("2d");
  const width = weeklyChart.width;
  const height = weeklyChart.height;
  ctx.clearRect(0, 0, width, height);

  const padding = 24;
  const chartHeight = height - padding * 2;
  const chartWidth = width - padding * 2;
  const maxMinutes = Math.max(60, ...weekly.map((day) => day.minutes));
  const barWidth = chartWidth / weekly.length - 12;

  ctx.fillStyle = "#f4efe6";
  ctx.fillRect(0, 0, width, height);

  weekly.forEach((day, index) => {
    const x = padding + index * (barWidth + 12);
    const barHeight = (day.minutes / maxMinutes) * chartHeight;
    const y = height - padding - barHeight;

    ctx.fillStyle = "#2c6f6a";
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = "#6b645a";
    ctx.font = "12px Space Grotesk";
    const label = day.date.toLocaleDateString(undefined, { weekday: "short" });
    ctx.fillText(label, x, height - padding + 14);
  });
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
  await startBlocking();
  await startAppBlocking();
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

updateStatsUI();
renderBlockedSites();
renderBlockedApps();
closeSuggestions(unifiedSuggestions);
resetUI();

window.focusApi.listInstalledApps().then((apps) => {
  installedApps = apps;
  updateUnifiedSuggestions();
});
