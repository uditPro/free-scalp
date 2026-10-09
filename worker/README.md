# ReachFlow local Agent-Reach worker

This worker keeps Agent-Reach tools and user-authorized browser sessions on the
Windows machine. It is intentionally loopback-only and accepts only a fixed
read-only `/v1/search` request; it never accepts shell commands from ReachFlow.

## Start

From `C:\Users\uditk\omnirush.ai\reachflow`:

```powershell
.\worker\setup-worker.ps1
.\worker\start-worker.ps1
```

`setup-worker.ps1` installs the upstream Agent-Reach package into
`worker\.venv`, creates an ignored pairing token, and adds the worker URL/token
to the ignored root `.env.local`. Restart ReachFlow after setup.

## What is installed by default

Agent-Reach's Python package includes its routing/doctor logic and yt-dlp
dependencies. It does not silently install every optional platform tool or read
browser sessions. Add optional tools only when you explicitly want them:

```powershell
& ".\worker\.venv\Scripts\python.exe" -m pip install "bilibili-cli"
```

GitHub CLI, OpenCLI, rdt-cli, mcporter, uv/uvx and their platform sessions are
separate. Use the upstream `agent-reach doctor --json` from the worker venv to
see exact readiness. OpenCLI requires a user-controlled Chrome session; Twitter,
Reddit, XHS and other session tools require explicit user setup. Never paste
cookies, passwords, or one-time codes into ReachFlow.

The worker listens only at `http://127.0.0.1:8787`. Do not expose port 8787 to
the LAN or public internet. Close the worker when it is not needed.
