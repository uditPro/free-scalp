"""ReachFlow's local Agent-Reach bridge.

This process intentionally exposes only a fixed search API. It never accepts a
command string from the web app and only invokes the documented, read-only
Agent-Reach tool commands listed in ALLOWED_COMMANDS. Bind it to loopback.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse

HOST = "127.0.0.1"
PORT = int(os.getenv("REACHFLOW_WORKER_PORT", "8787"))
TOKEN = os.getenv("REACHFLOW_WORKER_TOKEN", "").strip()
MAX_BODY = 32_000
ALLOWED_COMMANDS = {"gh", "yt-dlp", "bili", "opencli", "rdt", "mcporter"}


def command_available(name: str) -> bool:
    return bool(shutil.which(name))


def run_allowed(args: list[str], timeout: int = 45) -> tuple[int, str, str]:
    if not args or args[0] not in ALLOWED_COMMANDS:
        raise RuntimeError("This local worker only permits documented read-only connector commands.")
    if any(value.startswith(("--exec", "--command", "-c")) for value in args[1:]):
        raise RuntimeError("Command execution flags are not allowed.")
    completed = subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=False)
    return completed.returncode, completed.stdout[:500_000], completed.stderr[:10_000]


def row(title: str, url: str, description: str = "", source: str = "local-agent-reach", **extra: Any) -> dict[str, Any]:
    return {"id": url, "title": title[:300], "url": url, "description": description[:6000], "source": source, **extra}


def github(query: str, limit: int) -> list[dict[str, Any]]:
    if not command_available("gh"):
        return []
    code, stdout, _ = run_allowed(["gh", "search", "repos", query, "--limit", str(limit), "--json", "nameWithOwner,url,description"])
    if code != 0:
        return []
    try:
        return [row(item.get("nameWithOwner", "GitHub repository"), item.get("url", "https://github.com"), item.get("description", ""), "github.com") for item in json.loads(stdout)]
    except (ValueError, TypeError):
        return []


def youtube(query: str, limit: int) -> list[dict[str, Any]]:
    if not command_available("yt-dlp"):
        return []
    code, stdout, _ = run_allowed(["yt-dlp", "--flat-playlist", "--dump-single-json", f"ytsearch{limit}:{query}"], 60)
    if code != 0:
        return []
    try:
        data = json.loads(stdout)
        entries = data.get("entries", []) if isinstance(data, dict) else []
        return [row(item.get("title", "YouTube video"), f"https://www.youtube.com/watch?v={item.get('id', '')}", item.get("description", ""), "youtube.com") for item in entries if item.get("id")]
    except (ValueError, TypeError):
        return []


def bilibili(query: str, limit: int) -> list[dict[str, Any]]:
    if not command_available("bili"):
        return []
    code, stdout, _ = run_allowed(["bili", "search", query, "--type", "video", "-n", str(limit)], 60)
    if code != 0:
        return []
    # bili-cli output is intentionally treated as text; only URLs are promoted.
    results: list[dict[str, Any]] = []
    for line in stdout.splitlines():
        if "http" not in line:
            continue
        url = next((part for part in line.split() if part.startswith("http")), "")
        if "bilibili.com" in url:
            results.append(row(line.replace(url, "").strip() or "Bilibili video", url, line, "bilibili.com"))
    return results[:limit]


def session_source(command: str, platform: str, query: str, limit: int) -> list[dict[str, Any]]:
    if not command_available(command):
        return []
    code, stdout, _ = run_allowed([command, platform, "search", query, "-f", "json"], 60)
    if code != 0:
        return []
    try:
        payload = json.loads(stdout)
    except ValueError:
        return []
    items = payload if isinstance(payload, list) else payload.get("results", []) if isinstance(payload, dict) else []
    results: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        url = item.get("url") or item.get("link") or item.get("permalink")
        if isinstance(url, str) and url.startswith("https://"):
            results.append(row(str(item.get("title") or item.get("name") or "Public result"), url, str(item.get("text") or item.get("description") or ""), platform))
    return results[:limit]


def reddit_search(query: str, limit: int) -> list[dict[str, Any]]:
    if command_available("opencli"):
        return session_source("opencli", "reddit", query, limit)
    if not command_available("rdt"):
        return []
    code, stdout, _ = run_allowed(["rdt", "search", query, "--limit", str(limit)], 60)
    if code != 0:
        return []
    results: list[dict[str, Any]] = []
    for line in stdout.splitlines():
        url = next((part for part in line.split() if part.startswith("https://www.reddit.com/")), "")
        if url:
            results.append(row(line.replace(url, "").strip() or "Reddit post", url, line, "reddit.com"))
    return results[:limit]


def search(payload: dict[str, Any]) -> dict[str, Any]:
    query = str(payload.get("query", "")).strip()
    limit = min(max(int(payload.get("limit", 10)), 1), 100)
    sources = payload.get("sources") or []
    if not query or len(query) > 500:
        raise ValueError("query must be 1–500 characters")
    results: list[dict[str, Any]] = []
    selected = set(sources)
    if not selected:
        selected = {"github", "youtube", "bilibili"}
    if "github" in selected:
        results.extend(github(query, limit))
    if "youtube" in selected:
        results.extend(youtube(query, limit))
    if "bilibili" in selected:
        results.extend(bilibili(query, limit))
    if "reddit" in selected:
        results.extend(reddit_search(query, limit))
    if "x" in selected:
        results.extend(session_source("opencli", "twitter", query, limit))
    if "facebook" in selected:
        results.extend(session_source("opencli", "facebook", query, limit))
    if "instagram" in selected:
        results.extend(session_source("opencli", "instagram", query, limit))
    # LinkedIn is an MCP command with a platform-specific schema. It is not
    # guessed here; the public indexed path remains available in ReachFlow.
    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in results:
        if item["url"] in seen:
            continue
        seen.add(item["url"]); deduped.append(item)
        if len(deduped) >= limit:
            break
    return {"results": deduped, "worker": "agent-reach-local", "warnings": ["Local worker results come from explicitly enabled read-only tools. Login-based tools use your existing user-controlled session and may return no results when not configured."]}


class Handler(BaseHTTPRequestHandler):
    server_version = "ReachFlowAgentReachWorker/1.0"

    def send_json(self, status: int, body: dict[str, Any]) -> None:
        data = json.dumps(body).encode()
        self.send_response(status); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)

    def authorized(self) -> bool:
        return bool(TOKEN) and self.headers.get("Authorization", "") == f"Bearer {TOKEN}"

    def do_GET(self) -> None:
        if urlparse(self.path).path != "/health" or not self.authorized():
            self.send_json(401, {"error": "Unauthorized local worker request."}); return
        capabilities = [{"id": name, "installed": command_available(name)} for name in sorted(ALLOWED_COMMANDS)]
        self.send_json(200, {"ok": True, "worker": "agent-reach-local", "capabilities": capabilities})

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/v1/search" or not self.authorized():
            self.send_json(401, {"error": "Unauthorized local worker request."}); return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > MAX_BODY:
                raise ValueError("Request body is too large.")
            payload = json.loads(self.rfile.read(length))
            self.send_json(200, search(payload))
        except subprocess.TimeoutExpired:
            self.send_json(504, {"error": "A local connector timed out."})
        except (ValueError, RuntimeError, json.JSONDecodeError) as exc:
            self.send_json(400, {"error": str(exc)})
        except Exception:
            self.send_json(502, {"error": "A local connector failed."})

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[worker] {format % args}")


def main() -> None:
    if not TOKEN:
        raise SystemExit("Set REACHFLOW_WORKER_TOKEN before starting the local worker.")
    print(f"ReachFlow Agent-Reach worker listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
