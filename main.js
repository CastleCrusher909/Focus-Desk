const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const https = require("https");

const BLOCK_START = "# FOCUS_DESK_START";
const BLOCK_END = "# FOCUS_DESK_END";
let appBlockInterval = null;
let appBlockList = [];

function getHostsPath() {
  if (process.platform === "win32") {
    return "C:\\Windows\\System32\\drivers\\etc\\hosts";
  }
  return "/etc/hosts";
}

function normalizeDomain(input) {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return "";
  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  const withoutPath = withoutProtocol.split("/")[0];
  return withoutPath.replace(/^www\./, "");
}

function buildBlockSection(sites) {
  const domains = new Set();
  sites.forEach((site) => {
    const base = normalizeDomain(site);
    if (!base) return;
    domains.add(base);
    domains.add(`www.${base}`);
  });

  const lines = Array.from(domains)
    .sort()
    .map((domain) => `127.0.0.1 ${domain}`);

  return [BLOCK_START, ...lines, BLOCK_END].join("\n");
}

function stripExistingBlockSection(hostsText) {
  const startIndex = hostsText.indexOf(BLOCK_START);
  const endIndex = hostsText.indexOf(BLOCK_END);
  if (startIndex === -1 || endIndex === -1) return hostsText.trimEnd();
  const before = hostsText.slice(0, startIndex).trimEnd();
  const after = hostsText.slice(endIndex + BLOCK_END.length).trimStart();
  return `${before}\n${after}`.trimEnd();
}

function applyBlockList(sites) {
  const hostsPath = getHostsPath();
  const original = fs.readFileSync(hostsPath, "utf8");
  const withoutOld = stripExistingBlockSection(original);
  const section = buildBlockSection(sites);
  const updated = `${withoutOld}\n\n${section}\n`;
  fs.writeFileSync(hostsPath, updated, "utf8");
  return true;
}

function removeBlockList() {
  const hostsPath = getHostsPath();
  const original = fs.readFileSync(hostsPath, "utf8");
  const updated = `${stripExistingBlockSection(original)}\n`;
  fs.writeFileSync(hostsPath, updated, "utf8");
  return true;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 720,
    backgroundColor: "#f5f2ea",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));
}

function listRunningApps() {
  return new Promise((resolve, reject) => {
    if (process.platform !== "darwin") {
      resolve([]);
      return;
    }
    const script = 'tell application "System Events" to get name of (processes where background only is false)';
    execFile("osascript", ["-e", script], (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      const output = stdout.trim();
      if (!output) {
        resolve([]);
        return;
      }
      resolve(output.split(", ").map((name) => name.trim()));
    });
  });
}

function quitApp(appName) {
  return new Promise((resolve) => {
    if (process.platform !== "darwin") {
      resolve(false);
      return;
    }
    const script = `tell application "${appName}" to quit`;
    execFile("osascript", ["-e", script], () => resolve(true));
  });
}

async function enforceAppBlocking() {
  if (appBlockList.length === 0) return;
  try {
    const running = await listRunningApps();
    const runningSet = new Set(running.map((name) => name.toLowerCase()));
    const toQuit = appBlockList.filter((name) => runningSet.has(name.toLowerCase()));
    await Promise.all(toQuit.map((name) => quitApp(name)));
  } catch (error) {
    // Ignore failures to avoid crashing the app.
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("blocker-start", async (_event, sites) => {
  try {
    applyBlockList(sites);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message || "Unable to update hosts file." };
  }
});

ipcMain.handle("blocker-stop", async () => {
  try {
    removeBlockList();
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message || "Unable to update hosts file." };
  }
});

ipcMain.handle("blocker-help", async () => {
  const hostsPath = getHostsPath();
  const message =
    process.platform === "win32"
      ? `Run the app as Administrator or edit the hosts file manually at:\n${hostsPath}`
      : `Grant permission by running the app with elevated privileges, or update:\n${hostsPath}\n\nExample (macOS/Linux):\n sudo nano ${hostsPath}`;

  await dialog.showMessageBox({
    type: "info",
    title: "Blocking Requires Permission",
    message
  });
});

ipcMain.handle("appblocker-start", async (_event, apps) => {
  appBlockList = Array.isArray(apps) ? apps.filter(Boolean) : [];
  if (appBlockInterval) clearInterval(appBlockInterval);
  if (process.platform === "darwin" && appBlockList.length > 0) {
    await enforceAppBlocking();
    appBlockInterval = setInterval(enforceAppBlocking, 4000);
  }
  return { ok: true };
});

ipcMain.handle("appblocker-stop", async () => {
  if (appBlockInterval) {
    clearInterval(appBlockInterval);
    appBlockInterval = null;
  }
  return { ok: true };
});

ipcMain.handle("apps-list", async () => {
  if (process.platform !== "darwin") {
    return [];
  }

  const appDirs = [
    "/Applications",
    "/System/Applications",
    "/System/Applications/Utilities",
    path.join(app.getPath("home"), "Applications")
  ];
  const apps = new Set();

  appDirs.forEach((dir) => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.forEach((entry) => {
        if (entry.isDirectory() && entry.name.endsWith(".app")) {
          apps.add(entry.name.replace(/\.app$/, ""));
        }
      });
    } catch (error) {
      // ignore missing directories
    }
  });

  return Array.from(apps).sort();
});

function fetchGoogleSuggestions(query) {
  return new Promise((resolve, reject) => {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(
      query
    )}`;
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            const suggestions = Array.isArray(parsed) ? parsed[1] || [] : [];
            resolve(suggestions);
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", (error) => reject(error));
  });
}

ipcMain.handle("site-suggest", async (_event, query) => {
  if (!query || typeof query !== "string") return [];
  try {
    return await fetchGoogleSuggestions(query);
  } catch (error) {
    return [];
  }
});
