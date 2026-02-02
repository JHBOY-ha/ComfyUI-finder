import shutil
from pathlib import Path
from urllib.parse import quote

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
        saved_to = None

        while True:
            field = await reader.next()
            if field is None:
                break

            if field.name == "path":
                upload_dir = (await field.text()).strip()
            elif field.name == "file":
                if not field.filename:
                    continue
                target_dir = _resolve_path(upload_dir, must_exist=True, must_be_dir=True)
                filename = Path(field.filename).name
                target_path = _next_available_path(target_dir / filename)

                with target_path.open("wb") as handle:
                    while True:
                        chunk = await field.read_chunk(size=1024 * 1024)
                        if not chunk:
                            break
                        handle.write(chunk)
                saved_to = _to_relative(target_path)

        if saved_to is None:
            raise web.HTTPBadRequest(text="Missing file")

        return web.json_response({"ok": True, "saved_to": saved_to})

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

        return web.json_response({"ok": True, "new_path": _to_relative(destination)})

    @routes.post("/finder/delete")
    async def finder_delete(request: web.Request) -> web.Response:
        data = await request.json()
        path_rel = data.get("path", "")
        target = _resolve_path(path_rel, must_exist=True)
        if target == ROOT_DIR:
            raise web.HTTPBadRequest(text="Cannot delete ComfyUI root")

        if target.is_dir():
            shutil.rmtree(target)
        else:
            target.unlink()

        return web.json_response({"ok": True})

    @routes.get("/finder/file")
    async def finder_file(request: web.Request) -> web.StreamResponse:
        path_rel = request.query.get("path", "")
        target = _resolve_path(path_rel, must_exist=True)
        if target.is_dir():
            raise web.HTTPBadRequest(text="Path is a directory")
        if request.query.get("download") == "1":
            filename = target.name
            headers = {
                "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
            }
            return web.FileResponse(path=target, headers=headers)
        return web.FileResponse(path=target)
