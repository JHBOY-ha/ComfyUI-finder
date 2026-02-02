import asyncio
import shlex
import shutil
from pathlib import Path

from aiohttp import web

import folder_paths
from server import PromptServer


ROOT_DIR = Path(folder_paths.base_path).resolve()
_REGISTERED = False


def _to_relative(path: Path) -> str:
    if path == ROOT_DIR:
        return ""
    return path.relative_to(ROOT_DIR).as_posix()


def _resolve_path(relative_path: str, must_exist: bool = True, must_be_dir: bool = False) -> Path:
    safe_relative = (relative_path or "").strip().lstrip("/")
    candidate = (ROOT_DIR / safe_relative).resolve()
    try:
        candidate.relative_to(ROOT_DIR)
    except ValueError as exc:
        raise web.HTTPBadRequest(text="Path is outside ComfyUI root") from exc

    if must_exist and not candidate.exists():
        raise web.HTTPNotFound(text=f"Path does not exist: {safe_relative}")
    if must_be_dir and not candidate.is_dir():
        raise web.HTTPBadRequest(text=f"Path is not a directory: {safe_relative}")
    return candidate


def _next_available_path(path: Path) -> Path:
    if not path.exists():
        return path

    stem = path.stem if path.is_file() else path.name
    suffix = path.suffix if path.is_file() else ""
    parent = path.parent

    index = 1
    while True:
        candidate_name = f"{stem}_copy{index}{suffix}"
        candidate = parent / candidate_name
        if not candidate.exists():
            return candidate
        index += 1


def _list_entries(directory: Path) -> list[dict]:
    entries = []
    for item in sorted(directory.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
        try:
            stat = item.stat()
            entries.append(
                {
                    "name": item.name,
                    "is_dir": item.is_dir(),
                    "size": stat.st_size if item.is_file() else None,
                    "mtime": int(stat.st_mtime),
                    "relative_path": _to_relative(item),
                }
            )
        except OSError:
            continue
    return entries


async def _run_command(cmd: list[str], cwd: Path) -> tuple[int, str, str]:
    process = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=str(cwd),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=1800)
    except asyncio.TimeoutError:
        process.kill()
        await process.wait()
        raise web.HTTPRequestTimeout(text="Command timed out (30m)")

    return (
        process.returncode,
        stdout.decode("utf-8", errors="replace"),
        stderr.decode("utf-8", errors="replace"),
    )


def register_routes() -> None:
    global _REGISTERED
    if _REGISTERED:
        return
    _REGISTERED = True

    routes = PromptServer.instance.routes

    @routes.get("/finder/list")
    async def finder_list(request: web.Request) -> web.Response:
        current_path = request.query.get("path", "")
        target_dir = _resolve_path(current_path, must_exist=True, must_be_dir=True)
        payload = {
            "root": str(ROOT_DIR),
            "current_path": _to_relative(target_dir),
            "entries": _list_entries(target_dir),
        }
        return web.json_response(payload)

    @routes.post("/finder/upload")
    async def finder_upload(request: web.Request) -> web.Response:
        reader = await request.multipart()
        upload_dir = ""
        upload_file = None

        while True:
            field = await reader.next()
            if field is None:
                break

            if field.name == "path":
                upload_dir = (await field.text()).strip()
            elif field.name == "file":
                upload_file = field

        if upload_file is None or not upload_file.filename:
            raise web.HTTPBadRequest(text="Missing file")

        target_dir = _resolve_path(upload_dir, must_exist=True, must_be_dir=True)
        filename = Path(upload_file.filename).name
        target_path = _next_available_path(target_dir / filename)

        with target_path.open("wb") as handle:
            while True:
                chunk = await upload_file.read_chunk(size=1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)

        return web.json_response(
            {
                "ok": True,
                "saved_to": _to_relative(target_path),
            }
        )

    @routes.post("/finder/copy")
    async def finder_copy(request: web.Request) -> web.Response:
        data = await request.json()
        src_rel = data.get("source_path", "")
        dst_dir_rel = data.get("destination_dir", "")

        source = _resolve_path(src_rel, must_exist=True)
        destination_dir = _resolve_path(dst_dir_rel, must_exist=True, must_be_dir=True)
        destination = _next_available_path(destination_dir / source.name)

        if source.is_dir():
            shutil.copytree(source, destination)
        else:
            shutil.copy2(source, destination)

        return web.json_response(
            {
                "ok": True,
                "new_path": _to_relative(destination),
            }
        )

    @routes.post("/finder/command")
    async def finder_command(request: web.Request) -> web.Response:
        data = await request.json()
        command = data.get("command")
        cwd = _resolve_path(data.get("cwd", ""), must_exist=True, must_be_dir=True)
        cmd: list[str]

        if command == "git_clone":
            repo_url = (data.get("repo_url") or "").strip()
            target_dir = (data.get("target_dir") or "").strip()
            if not repo_url:
                raise web.HTTPBadRequest(text="repo_url is required")
            cmd = ["git", "clone", repo_url]
            if target_dir:
                cmd.append(target_dir)
        elif command == "wget":
            url = (data.get("url") or "").strip()
            output_name = (data.get("output_name") or "").strip()
            if not url:
                raise web.HTTPBadRequest(text="url is required")
            cmd = ["wget", url]
            if output_name:
                cmd.extend(["-O", output_name])
        elif command == "hf_download":
            repo_id = (data.get("repo_id") or "").strip()
            file_name = (data.get("file_name") or "").strip()
            local_dir = (data.get("local_dir") or "").strip()
            if not repo_id:
                raise web.HTTPBadRequest(text="repo_id is required")
            cmd = ["hf", "download", repo_id]
            if file_name:
                cmd.append(file_name)
            if local_dir:
                cmd.extend(["--local-dir", local_dir])
        else:
            raise web.HTTPBadRequest(text="Unsupported command")

        return_code, stdout, stderr = await _run_command(cmd, cwd)
        return web.json_response(
            {
                "ok": return_code == 0,
                "return_code": return_code,
                "command": shlex.join(cmd),
                "stdout": stdout,
                "stderr": stderr,
            }
        )

