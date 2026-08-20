"""Festify dev panel -- a local control surface for the moving pieces.

Running Festify locally means keeping a backend, a frontend dev server
and an ngrok tunnel alive in three separate terminals, and remembering
which port each one wants. This serves one page that starts and stops
them, shows whether each is actually listening, tails their logs, and
reports the deployed backend's health.

It binds to 127.0.0.1 only and can run exactly the commands defined in
SERVICES below -- it never executes anything the browser sends. That
matters, because a process launcher reachable from the network would be
a remote shell.
"""
import os
import socket
import subprocess
import sys
from datetime import datetime
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse

ROOT = Path(__file__).resolve().parent.parent
PANEL_DIR = Path(__file__).resolve().parent
LOG_DIR = PANEL_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)

BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"
VENV_PY = BACKEND_DIR / "venv" / "Scripts" / "python.exe"

NGROK = Path(
    os.environ.get("NGROK_PATH")
    or r"C:\Users\TestAri\AppData\Local\Microsoft\WinGet\Packages"
      r"\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe"
)
TUNNEL_URL = os.environ.get("NGROK_URL", "https://envy-twilight-happiest.ngrok-free.dev")

PROD_BACKEND = "https://festify-9z0h.onrender.com"

SERVICES = {
    "backend": {
        "label": "Backend API",
        "detail": "FastAPI + uvicorn, auto-reloads on save",
        "cmd": [str(VENV_PY), "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"],
        "cwd": BACKEND_DIR,
        "port": 8000,
        "open": "http://127.0.0.1:8000/docs",
    },
    "frontend": {
        "label": "Frontend",
        "detail": "Vite dev server with hot reload",
        "cmd": ["npm.cmd", "run", "dev"],
        "cwd": FRONTEND_DIR,
        "port": 5173,
        "open": "http://127.0.0.1:5173",
    },
    "tunnel": {
        "label": "ngrok tunnel",
        "detail": f"Public HTTPS -> localhost:8000",
        "cmd": [str(NGROK), "http", "8000", "--url", TUNNEL_URL, "--log=stdout"],
        "cwd": ROOT,
        "port": 4040,
        "open": "http://127.0.0.1:4040",
    },
}

# PIDs of processes this panel started. A service can also be running
# because the user started it in their own terminal, which is why status
# is decided by the port rather than by this dict.
_started: dict[str, subprocess.Popen] = {}

app = FastAPI(title="Festify dev panel")


def _port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex(("127.0.0.1", port)) == 0


def _log_path(key: str) -> Path:
    return LOG_DIR / f"{key}.log"


@app.get("/api/status")
def status():
    out = []
    for key, svc in SERVICES.items():
        listening = _port_open(svc["port"])
        proc = _started.get(key)
        out.append(
            {
                "key": key,
                "label": svc["label"],
                "detail": svc["detail"],
                "port": svc["port"],
                "open": svc["open"],
                # "listening" is the truth; "ours" only says whether this
                # panel is the thing that launched it, which decides
                # whether Stop can work.
                "running": listening,
                "ours": bool(proc and proc.poll() is None),
                "cwd_exists": Path(svc["cwd"]).exists(),
            }
        )

    frontend_ready = (FRONTEND_DIR / "node_modules").exists()
    return {
        "services": out,
        "warnings": (
            []
            if frontend_ready
            else ["frontend-app/node_modules is missing -- run Install deps before starting the frontend."]
        ),
        "tunnel_url": TUNNEL_URL,
        "checked_at": datetime.now().strftime("%H:%M:%S"),
    }


@app.post("/api/start/{key}")
def start(key: str):
    svc = SERVICES.get(key)
    if not svc:
        raise HTTPException(404, "Unknown service")
    if _port_open(svc["port"]):
        raise HTTPException(409, f"Something is already listening on port {svc['port']}")
    if not Path(svc["cwd"]).exists():
        raise HTTPException(400, f"Directory not found: {svc['cwd']}")

    log = open(_log_path(key), "ab", buffering=0)
    log.write(f"\n--- started {datetime.now():%Y-%m-%d %H:%M:%S} ---\n".encode())
    try:
        proc = subprocess.Popen(
            svc["cmd"],
            cwd=str(svc["cwd"]),
            stdout=log,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            # New process group so the whole tree can be killed later;
            # uvicorn --reload and npm both spawn children that would
            # otherwise survive and keep the port bound.
            creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
        )
    except FileNotFoundError as e:
        raise HTTPException(400, f"Could not run it: {e}")

    _started[key] = proc
    return {"started": key, "pid": proc.pid}


@app.post("/api/stop/{key}")
def stop(key: str):
    svc = SERVICES.get(key)
    if not svc:
        raise HTTPException(404, "Unknown service")

    proc = _started.get(key)
    if not proc or proc.poll() is not None:
        raise HTTPException(
            409,
            "This panel did not start that process, so it cannot stop it. "
            "Close the terminal you started it in.",
        )

    # /T kills the child tree as well -- killing only the parent leaves
    # the reloader's worker holding the port.
    subprocess.run(
        ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
        capture_output=True,
    )
    _started.pop(key, None)
    return {"stopped": key}


@app.post("/api/install-frontend")
def install_frontend():
    if not FRONTEND_DIR.exists():
        raise HTTPException(400, "frontend/ not found")
    log = open(_log_path("frontend"), "ab", buffering=0)
    log.write(f"\n--- npm install {datetime.now():%H:%M:%S} ---\n".encode())
    proc = subprocess.Popen(
        ["npm.cmd", "install"],
        cwd=str(FRONTEND_DIR),
        stdout=log,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
    )
    _started["frontend-install"] = proc
    return {"installing": True, "pid": proc.pid}


@app.get("/api/logs/{key}")
def logs(key: str, lines: int = 120):
    if key not in SERVICES:
        raise HTTPException(404, "Unknown service")
    path = _log_path(key)
    if not path.exists():
        return {"lines": ["No output yet."]}
    content = path.read_text(encoding="utf-8", errors="replace").splitlines()
    return {"lines": content[-lines:]}


@app.get("/api/tunnel")
def tunnel():
    """The public URL ngrok actually assigned, read from its local API."""
    try:
        r = httpx.get("http://127.0.0.1:4040/api/tunnels", timeout=3)
        items = r.json().get("tunnels", [])
        return {"urls": [t.get("public_url") for t in items if t.get("public_url")]}
    except Exception:
        return {"urls": []}


@app.get("/api/prod-health")
def prod_health():
    """Deployed backend's own report, so config drift is visible here."""
    try:
        r = httpx.get(f"{PROD_BACKEND}/health/config", timeout=25)
        return {"ok": r.status_code == 200, "data": r.json()}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}


@app.get("/")
def index():
    return FileResponse(PANEL_DIR / "index.html")


@app.exception_handler(Exception)
async def on_error(request, exc):
    return JSONResponse(status_code=500, content={"detail": f"{type(exc).__name__}: {exc}"})


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PANEL_PORT", "7777"))
    print(f"\n  Festify dev panel -> http://127.0.0.1:{port}\n")
    # host is fixed to loopback deliberately: this endpoint starts
    # processes, so it must not be reachable from the network.
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
