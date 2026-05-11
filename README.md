# CT50 Thermostat Dashboard

A sleek, full-featured web dashboard for the **RadioThermostat CT50** WiFi thermostat. Control your HVAC system from any browser on your local network — no cloud, no app, no account required.

![Dashboard](https://img.shields.io/badge/status-working-brightgreen) ![Node.js](https://img.shields.io/badge/node.js-%3E%3D12-blue)

## Features

| Feature | Description |
|---|---|
| **Live Temperature** | Real-time current temp with animated ring display, polls every 10s |
| **Setpoint Control** | Adjust target temperature with ▲/▼ buttons, sets permanent hold |
| **Mode Switching** | Off / Heat / Cool / Auto — one-click mode changes |
| **Fan Control** | Auto / On / Circulate fan modes |
| **Hold Management** | Visual hold indicator with one-click release |
| **Weekly Schedule** | Full 7-day program editor for both heating and cooling (4 periods per day) |
| **Copy Schedule** | Copy Monday's schedule to all days with one click |
| **Runtime Log** | Today's and yesterday's heating/cooling runtime with progress bars |
| **System Info** | Model, firmware version, UUID, WLAN firmware, API version |

## Requirements

- **Node.js** (v12 or later) — no other dependencies, no `npm install` needed
- A **RadioThermostat CT50** on your local network
- The thermostat's IP address (default in code: `192.168.6.174`)

### Installing Node.js

**Windows (PowerShell)**
```powershell
# Option 1: Download installer from https://nodejs.org (recommended)
# Option 2: Using winget
winget install OpenJS.NodeJS.LTS

# Option 3: Using Chocolatey
choco install nodejs-lts
```

**macOS (Terminal)**
```bash
# Option 1: Download installer from https://nodejs.org
# Option 2: Using Homebrew
brew install node
```

**Linux (Bash)**
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install nodejs

# Fedora
sudo dnf install nodejs

# Or use Node Version Manager (any distro)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install --lts
```

Verify installation on any platform:
```bash
node --version
```

## Quick Start

```bash
# Clone the repo
git clone git@github.com:chromedot/ct50-thermo.git
cd ct50-thermo

# Start the server
node server.js
```

Open **http://localhost:3000** in your browser. That's it.

## Configuration

Edit the top of `server.js` to change:

```js
const TSTAT_HOST = '192.168.6.174';  // your thermostat's IP
const PORT = 3000;                    // local server port
```

### Finding Your Thermostat IP

Your CT50 should have a static IP or DHCP reservation on your router. You can also check your router's connected devices list — look for a device named similar to your thermostat.

## How It Works

The CT50 exposes a local REST API with no authentication. However, browsers block direct cross-origin requests from a webpage to the thermostat. This project runs a tiny Node.js proxy server that:

1. **Serves the dashboard** (HTML, CSS, JS) on `localhost:3000`
2. **Proxies API calls** from the browser to the thermostat at its local IP

```
Browser  →  localhost:3000/api/tstat  →  192.168.6.174/tstat
```

### Important: CT50 Limitations

The CT50 has a **single-threaded HTTP server** that can only handle one connection at a time. The dashboard serializes all requests and uses a busy-lock to prevent polling from overlapping with user actions. If you see occasional timeouts, that's normal — the thermostat is just slow.

## Project Structure

```
ct50-thermo/
├── server.js    # Node.js proxy server (serves files + proxies API)
├── index.html   # Dashboard HTML shell with 4 tab panels
├── style.css    # Dark glassmorphism theme
├── app.js       # All dashboard logic (polling, controls, schedule editor)
└── README.md
```

## API Endpoints Used

| Endpoint | Method | Purpose |
|---|---|---|
| `/tstat` | GET | Current temp, mode, fan, setpoints, hold, state |
| `/tstat` | POST | Change mode, fan, setpoint, hold |
| `/tstat/program/cool` | GET/POST | Read/write 7-day cooling schedule |
| `/tstat/program/heat` | GET/POST | Read/write 7-day heating schedule |
| `/tstat/datalog` | GET | Today's and yesterday's runtime |
| `/tstat/model` | GET | Thermostat model info |
| `/sys` | GET | System info (firmware, UUID) |
| `/sys/name` | GET | Thermostat name |

## License

MIT
