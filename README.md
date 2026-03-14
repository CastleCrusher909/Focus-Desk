# Focus Desk

Focus Desk is a macOS focus timer with website/app blocking, presets, and study stats.

## Option A: Run from the repo (dev mode)
1. Clone this repo.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the app:
   ```bash
   npm start
   ```

### Blocking permissions (required)
Blocking edits `/etc/hosts`, which needs admin privileges. To run with blocking:
```bash
sudo "/Applications/Focus Desk.app/Contents/MacOS/Focus Desk"
```

## Option B: Download the built app (recommended)
1. Go to the **Releases** page for this repo.
2. Download the latest `.dmg` or `.zip`.
3. Drag **Focus Desk.app** into **Applications**.

### Create a release (for maintainers)
1. Build:
   ```bash
   npm run dist
   ```
2. Upload `dist/Focus Desk-*.dmg` or `.zip` to a new GitHub Release.

## One-time helper install (optional, for no-sudo blocking)
This installs a small helper to allow blocking without running `sudo` each time:
```bash
sudo /Users/jameswepsic/Desktop/ProgramsHome/focus-desk/scripts/install-helper.sh
```

## Notes
- macOS system apps may require Accessibility permissions to be blocked.
- If a site still opens, flush DNS:
  ```bash
  sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
  ```
