import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

app.registerExtension({
  name: "ComfyUI-finder",
  setup() {
    const state = {
      currentPath: "",
      copiedPath: "",
      selectedPath: "",
      selectedIsDir: false,
      visible: false,
      hasPositioned: false,
    };

    const panel = document.createElement("div");
    panel.id = "comfyui-finder-panel";
    panel.innerHTML = `
      <div class="finder-head">
        <div class="finder-title-wrap">
          <div class="finder-title">ComfyUI Finder</div>
          <div class="finder-subtitle">F key to toggle</div>
        </div>
        <button class="finder-close">x</button>
      </div>

      <div class="finder-main-actions">
        <button class="finder-btn primary" data-action="copy">Copy</button>
        <button class="finder-btn primary" data-action="paste">Paste</button>
        <button class="finder-btn danger" data-action="delete">Delete</button>
        <button class="finder-btn primary" data-action="upload">Upload</button>
        <button class="finder-btn primary" data-action="download">Download</button>
      </div>

      <div class="finder-nav">
        <button class="finder-btn" data-action="up">Up</button>
        <button class="finder-btn" data-action="refresh">Refresh</button>
        <div class="finder-path"></div>
      </div>

      <div class="finder-content">
        <div class="finder-list"></div>
        <div class="finder-preview">
          <div class="finder-preview-empty">Select an image or video to preview</div>
        </div>
      </div>
      <div class="finder-log-divider" title="Drag to resize log"></div>
      <pre class="finder-log"></pre>
      <input type="file" class="finder-upload" multiple />
      <div class="finder-resizer" title="Drag to resize"></div>
    `;

    const style = document.createElement("style");
    style.textContent = `
      #comfyui-finder-panel {
        --bg: #0d1624;
        --bg2: #111f31;
        --line: #2c3c53;
        --text: #e6edf9;
        --muted: #96abc8;
        --btn: #192a40;
        --btn2: #233852;
        --accent: #2d6cd4;
        --danger: #b23b4d;
        --finder-log-height: 92px;
        --finder-log-divider-height: 8px;
        position: fixed;
        top: 80px;
        right: 24px;
        width: min(880px, calc(100vw - 48px));
        height: 78vh;
        background: linear-gradient(170deg, #0f1928 0%, #0b1421 100%);
        color: var(--text);
        border: 1px solid var(--line);
        border-radius: 14px;
        box-shadow: 0 20px 54px rgba(0, 0, 0, 0.46);
        backdrop-filter: blur(7px);
        display: none;
        z-index: 99999;
        overflow: hidden;
        font-family: "JetBrains Mono", "Fira Code", monospace;
      }
      #comfyui-finder-panel .finder-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        border-bottom: 1px solid var(--line);
        background: linear-gradient(90deg, #14253a, #0f1a2a);
        cursor: move;
        user-select: none;
      }
      #comfyui-finder-panel .finder-title-wrap {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      #comfyui-finder-panel .finder-title {
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.04em;
      }
      #comfyui-finder-panel .finder-subtitle {
        font-size: 10px;
        color: var(--muted);
      }
      #comfyui-finder-panel .finder-close {
        border: 1px solid #465d7d;
        background: #2b3f5b;
        color: #f6f9ff;
        border-radius: 8px;
        width: 30px;
        height: 30px;
        cursor: pointer;
      }
      #comfyui-finder-panel .finder-main-actions {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 8px;
        padding: 12px;
        border-bottom: 1px solid var(--line);
        background: var(--bg2);
      }
      #comfyui-finder-panel .finder-btn {
        border: 1px solid #365071;
        background: var(--btn);
        color: var(--text);
        border-radius: 8px;
        padding: 8px 10px;
        cursor: pointer;
        font-size: 12px;
      }
      #comfyui-finder-panel .finder-btn:hover {
        background: var(--btn2);
      }
      #comfyui-finder-panel .finder-btn.primary {
        border-color: #5073a2;
      }
      #comfyui-finder-panel .finder-btn.accent {
        background: #2259b6;
        border-color: #3573db;
      }
      #comfyui-finder-panel .finder-btn.danger {
        background: #6f2733;
        border-color: #9a4352;
      }
      #comfyui-finder-panel .finder-nav {
        display: grid;
        grid-template-columns: auto auto 1fr;
        gap: 8px;
        align-items: center;
        padding: 10px 12px;
        border-bottom: 1px solid var(--line);
        background: #101b2a;
      }
      #comfyui-finder-panel .finder-path {
        border: 1px solid #2f4360;
        background: #0b1421;
        border-radius: 8px;
        padding: 7px 10px;
        color: var(--muted);
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #comfyui-finder-panel .finder-content {
        height: calc(100% - 180px - var(--finder-log-height) - var(--finder-log-divider-height));
        display: grid;
        grid-template-columns: minmax(0, 1fr) 320px;
        gap: 0;
      }
      #comfyui-finder-panel .finder-list {
        overflow: auto;
        padding: 8px 0;
        border-right: 1px solid var(--line);
      }
      #comfyui-finder-panel .finder-row {
        display: grid;
        grid-template-columns: 1fr 120px;
        gap: 8px;
        align-items: center;
        padding: 8px 12px;
        cursor: pointer;
      }
      #comfyui-finder-panel .finder-row:hover {
        background: #16263d;
      }
      #comfyui-finder-panel .finder-row.active {
        background: #1f4578;
      }
      #comfyui-finder-panel .finder-row .name {
        display: flex;
        align-items: center;
        gap: 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #comfyui-finder-panel .finder-tag {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 40px;
        padding: 1px 6px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.03em;
      }
      #comfyui-finder-panel .finder-tag.dir {
        color: #b8f2c8;
        background: #1f5a3a;
        border: 1px solid #2f8a57;
      }
      #comfyui-finder-panel .finder-tag.file {
        color: #bcd6ff;
        background: #204a7a;
        border: 1px solid #3970b0;
      }
      #comfyui-finder-panel .finder-fname {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #comfyui-finder-panel .finder-row .size {
        text-align: right;
        color: #9ab0cf;
      }
      #comfyui-finder-panel .finder-log {
        margin: 0;
        padding: 10px 12px;
        border-top: 1px solid var(--line);
        background: #08111b;
        color: #9ee8bf;
        font-size: 11px;
        height: var(--finder-log-height);
        overflow: auto;
      }
      #comfyui-finder-panel .finder-log-divider {
        height: var(--finder-log-divider-height);
        cursor: ns-resize;
        border-top: 1px solid #1f3248;
        border-bottom: 1px solid #1f3248;
        background: linear-gradient(180deg, #0f1d2f, #0a1626);
      }
      #comfyui-finder-panel .finder-preview {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px;
        background: #0a1422;
      }
      #comfyui-finder-panel .finder-preview-title {
        font-size: 11px;
        color: var(--muted);
        word-break: break-all;
      }
      #comfyui-finder-panel .finder-preview-box {
        flex: 1;
        border: 1px solid #2b3f5b;
        border-radius: 10px;
        background: #060d16;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      #comfyui-finder-panel .finder-preview-empty {
        color: #7f94b4;
        font-size: 12px;
        text-align: center;
        padding: 18px;
      }
      #comfyui-finder-panel .finder-preview-media {
        max-width: 100%;
        max-height: 100%;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      #comfyui-finder-panel .finder-upload {
        display: none;
      }
      #comfyui-finder-panel .finder-resizer {
        position: absolute;
        width: 16px;
        height: 16px;
        right: 2px;
        bottom: 2px;
        cursor: nwse-resize;
        border-right: 2px solid #6c87ac;
        border-bottom: 2px solid #6c87ac;
      }
      @media (max-width: 920px) {
        #comfyui-finder-panel {
          top: 56px;
          right: 10px;
          width: calc(100vw - 20px);
          height: 84vh;
        }
        #comfyui-finder-panel .finder-content {
          grid-template-columns: 1fr;
        }
        #comfyui-finder-panel .finder-list {
          border-right: none;
          border-bottom: 1px solid var(--line);
        }
        #comfyui-finder-panel .finder-preview {
          height: 220px;
        }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(panel);

    const pathEl = panel.querySelector(".finder-path");
    const listEl = panel.querySelector(".finder-list");
    const previewEl = panel.querySelector(".finder-preview");
    const logEl = panel.querySelector(".finder-log");
    const logDividerEl = panel.querySelector(".finder-log-divider");
    const uploadInput = panel.querySelector(".finder-upload");
    const headEl = panel.querySelector(".finder-head");
    const resizerEl = panel.querySelector(".finder-resizer");
    const closeBtnEl = panel.querySelector(".finder-close");

    const MIN_WIDTH = 520;
    const MIN_HEIGHT = 420;
    const MIN_LOG_HEIGHT = 64;
    const MIN_CONTENT_HEIGHT = 180;

    function appendLog(message) {
      if (!message) return;
      const text = message.endsWith("\n") ? message : `${message}\n`;
      logEl.textContent += text;
      if (logEl.textContent.length > 120000) {
        logEl.textContent = logEl.textContent.slice(-120000);
      }
      logEl.scrollTop = logEl.scrollHeight;
    }

    function setLog(message) {
      const now = new Date().toLocaleTimeString();
      appendLog(`[${now}] ${message}`);
    }

    function formatSize(size) {
      if (size === null || size === undefined) return "-";
      const units = ["B", "KB", "MB", "GB"];
      let value = size;
      let unit = 0;
      while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
      }
      return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
    }

    function isImageFile(name) {
      const ext = (name.split(".").pop() || "").toLowerCase();
      return ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg", "avif"].includes(ext);
    }

    function isVideoFile(name) {
      const ext = (name.split(".").pop() || "").toLowerCase();
      return ["mp4", "webm", "mov", "m4v", "avi", "mkv"].includes(ext);
    }

    function clearPreview(message = "Select an image or video to preview") {
      previewEl.innerHTML = `<div class="finder-preview-empty">${message}</div>`;
    }

    function renderPreview(entry) {
      if (!entry || entry.is_dir) {
        clearPreview(entry?.is_dir ? "Folder selected (no preview)" : undefined);
        return;
      }
      const src = `/finder/file?path=${encodeURIComponent(entry.relative_path)}&t=${entry.mtime || Date.now()}`;
      const title = document.createElement("div");
      title.className = "finder-preview-title";
      title.textContent = entry.name;

      const box = document.createElement("div");
      box.className = "finder-preview-box";

      if (isImageFile(entry.name)) {
        const image = document.createElement("img");
        image.className = "finder-preview-media";
        image.src = src;
        image.alt = entry.name;
        image.loading = "lazy";
        image.onerror = () => clearPreview("Image preview failed");
        box.appendChild(image);
      } else if (isVideoFile(entry.name)) {
        const video = document.createElement("video");
        video.className = "finder-preview-media";
        video.src = src;
        video.controls = true;
        video.preload = "metadata";
        video.muted = true;
        video.onloadeddata = () => {
          video.currentTime = 0;
        };
        video.onerror = () => clearPreview("Video preview failed");
        box.appendChild(video);
      } else {
        clearPreview("This file type does not support preview");
        return;
      }

      previewEl.innerHTML = "";
      previewEl.appendChild(title);
      previewEl.appendChild(box);
    }

    async function loadImageToWorkflow(entry) {
      let filePath = entry.relative_path;
      if (!filePath.startsWith("input/")) {
        const copyData = await callJson("/finder/copy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_path: filePath,
            destination_dir: "input",
          }),
        });
        filePath = copyData.new_path;
        setLog(`Copied to input: ${filePath}`);
      }

      if (!filePath.startsWith("input/")) {
        throw new Error("Failed to move image under input/");
      }

      const imageName = filePath.slice("input/".length);
      const node = LiteGraph.createNode("LoadImage");
      if (!node) {
        throw new Error("LoadImage node is not available");
      }

      const nodeCount = app.graph?._nodes?.length || 0;
      node.pos = [80 + (nodeCount % 8) * 30, 80 + (nodeCount % 8) * 30];
      app.graph.add(node);

      const imageWidget = node.widgets?.find((widget) => widget.name === "image");
      if (!imageWidget) {
        throw new Error("LoadImage.image widget not found");
      }
      imageWidget.value = imageName;
      if (typeof imageWidget.callback === "function") {
        imageWidget.callback(imageName);
      }
      app.graph.setDirtyCanvas(true, true);
      if (app.canvas?.setDirty) {
        app.canvas.setDirty(true, true);
      }
      setLog(`Loaded into workflow: ${imageName}`);
    }

    async function callJson(path, options = {}) {
      const response = await api.fetchApi(path, options);
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Request failed: ${response.status}`);
      }
      return response.json();
    }

    function clampPanelToViewport() {
      const rect = panel.getBoundingClientRect();
      const maxLeft = Math.max(0, window.innerWidth - rect.width);
      const maxTop = Math.max(0, window.innerHeight - rect.height);
      const nextLeft = Math.min(Math.max(rect.left, 0), maxLeft);
      const nextTop = Math.min(Math.max(rect.top, 0), maxTop);
      panel.style.left = `${nextLeft}px`;
      panel.style.top = `${nextTop}px`;
      panel.style.right = "auto";
    }

    function initPanelPosition() {
      const rect = panel.getBoundingClientRect();
      const left = Math.max(0, window.innerWidth - rect.width - 24);
      const top = Math.max(0, rect.top);
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.right = "auto";
    }

    function bindDragAndResize() {
      let dragStartX = 0;
      let dragStartY = 0;
      let panelStartLeft = 0;
      let panelStartTop = 0;
      let dragging = false;

      let resizeStartX = 0;
      let resizeStartY = 0;
      let resizeStartWidth = 0;
      let resizeStartHeight = 0;
      let resizing = false;

      headEl.addEventListener("mousedown", (event) => {
        if (event.button !== 0) return;
        if (event.target === closeBtnEl) return;
        dragging = true;
        const rect = panel.getBoundingClientRect();
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        panelStartLeft = rect.left;
        panelStartTop = rect.top;
        document.body.style.userSelect = "none";
        event.preventDefault();
      });

      resizerEl.addEventListener("mousedown", (event) => {
        if (event.button !== 0) return;
        resizing = true;
        const rect = panel.getBoundingClientRect();
        resizeStartX = event.clientX;
        resizeStartY = event.clientY;
        resizeStartWidth = rect.width;
        resizeStartHeight = rect.height;
        document.body.style.userSelect = "none";
        event.preventDefault();
      });

      window.addEventListener("mousemove", (event) => {
        if (dragging) {
          const dx = event.clientX - dragStartX;
          const dy = event.clientY - dragStartY;
          const width = panel.offsetWidth;
          const height = panel.offsetHeight;
          const maxLeft = Math.max(0, window.innerWidth - width);
          const maxTop = Math.max(0, window.innerHeight - height);
          const nextLeft = Math.min(Math.max(panelStartLeft + dx, 0), maxLeft);
          const nextTop = Math.min(Math.max(panelStartTop + dy, 0), maxTop);
          panel.style.left = `${nextLeft}px`;
          panel.style.top = `${nextTop}px`;
          panel.style.right = "auto";
          return;
        }

        if (resizing) {
          const dx = event.clientX - resizeStartX;
          const dy = event.clientY - resizeStartY;
          const rect = panel.getBoundingClientRect();
          const maxWidth = Math.max(MIN_WIDTH, window.innerWidth - rect.left);
          const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight - rect.top);
          const nextWidth = Math.min(Math.max(resizeStartWidth + dx, MIN_WIDTH), maxWidth);
          const nextHeight = Math.min(Math.max(resizeStartHeight + dy, MIN_HEIGHT), maxHeight);
          panel.style.width = `${nextWidth}px`;
          panel.style.height = `${nextHeight}px`;
        }
      });

      window.addEventListener("mouseup", () => {
        dragging = false;
        resizing = false;
        document.body.style.userSelect = "";
      });
    }

    function bindLogResize() {
      let resizingLog = false;
      let startY = 0;
      let startLogHeight = 0;

      logDividerEl.addEventListener("mousedown", (event) => {
        if (event.button !== 0) return;
        resizingLog = true;
        startY = event.clientY;
        startLogHeight = logEl.offsetHeight;
        document.body.style.userSelect = "none";
        event.preventDefault();
      });

      window.addEventListener("mousemove", (event) => {
        if (!resizingLog) return;
        const dy = startY - event.clientY;
        const dividerHeightRaw = parseInt(
          getComputedStyle(panel).getPropertyValue("--finder-log-divider-height"),
          10,
        );
        const dividerHeight = Number.isFinite(dividerHeightRaw) ? dividerHeightRaw : 8;
        const maxLogHeight = Math.max(
          MIN_LOG_HEIGHT,
          panel.clientHeight - 180 - dividerHeight - MIN_CONTENT_HEIGHT,
        );
        const nextLogHeight = Math.min(Math.max(startLogHeight + dy, MIN_LOG_HEIGHT), maxLogHeight);
        panel.style.setProperty("--finder-log-height", `${nextLogHeight}px`);
      });

      window.addEventListener("mouseup", () => {
        if (!resizingLog) return;
        resizingLog = false;
        document.body.style.userSelect = "";
      });
    }

    async function refreshList(path = state.currentPath) {
      const params = new URLSearchParams({ path: path || "" });
      const data = await callJson(`/finder/list?${params.toString()}`);
      state.currentPath = data.current_path || "";
      state.selectedPath = "";
      state.selectedIsDir = false;
      pathEl.textContent = `ComfyUI root / ${state.currentPath || "."}`;
      listEl.innerHTML = "";
      clearPreview();

      for (const entry of data.entries) {
        const row = document.createElement("div");
        row.className = "finder-row";
        row.dataset.path = entry.relative_path;
        row.dataset.isdir = entry.is_dir ? "1" : "0";
        row.innerHTML = `
          <div class="name">
            <span class="finder-tag ${entry.is_dir ? "dir" : "file"}">${entry.is_dir ? "DIR" : "FILE"}</span>
            <span class="finder-fname">${entry.name}</span>
          </div>
          <div class="size">${entry.is_dir ? "-" : formatSize(entry.size)}</div>
        `;
        row.addEventListener("click", () => {
          state.selectedPath = entry.relative_path;
          state.selectedIsDir = Boolean(entry.is_dir);
          listEl.querySelectorAll(".finder-row").forEach((item) => item.classList.remove("active"));
          row.classList.add("active");
          renderPreview(entry);
        });
        row.addEventListener("dblclick", () => {
          if (entry.is_dir) {
            refreshList(entry.relative_path).catch((error) => setLog(error.message));
            return;
          }
          if (isImageFile(entry.name)) {
            loadImageToWorkflow(entry)
              .then(() => refreshList(state.currentPath))
              .catch((error) => setLog(error.message));
          }
        });
        listEl.appendChild(row);
      }
    }

    function togglePanel(force) {
      state.visible = force !== undefined ? force : !state.visible;
      panel.style.display = state.visible ? "block" : "none";
      if (state.visible) {
        if (!state.hasPositioned) {
          initPanelPosition();
          state.hasPositioned = true;
        }
        refreshList().catch((error) => setLog(error.message));
      }
    }

    async function pasteCopied() {
      if (!state.copiedPath) throw new Error("Clipboard is empty");
      await callJson("/finder/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_path: state.copiedPath,
          destination_dir: state.currentPath,
        }),
      });
      await refreshList();
      setLog("Paste done");
    }

    async function deleteSelected() {
      if (!state.selectedPath) throw new Error("Select a file or directory first");
      const yes = window.confirm(`Delete "${state.selectedPath}" ?`);
      if (!yes) return;
      await callJson("/finder/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: state.selectedPath }),
      });
      setLog(`Deleted: ${state.selectedPath}`);
      await refreshList();
    }

    function downloadSelected() {
      if (!state.selectedPath) throw new Error("Select a file first");
      if (state.selectedIsDir) throw new Error("Directory download is not supported");
      const url = `/finder/file?path=${encodeURIComponent(state.selectedPath)}&download=1`;
      const link = document.createElement("a");
      link.href = url;
      link.download = "";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setLog(`Downloading: ${state.selectedPath}`);
    }

    closeBtnEl.addEventListener("click", () => togglePanel(false));
    bindDragAndResize();
    bindLogResize();
    window.addEventListener("resize", () => clampPanelToViewport());

    panel.querySelectorAll(".finder-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const action = btn.dataset.action;
        try {
          if (action === "refresh") {
            await refreshList();
          } else if (action === "up") {
            const parts = state.currentPath ? state.currentPath.split("/") : [];
            parts.pop();
            await refreshList(parts.join("/"));
          } else if (action === "upload") {
            uploadInput.click();
          } else if (action === "copy") {
            if (!state.selectedPath) throw new Error("Select a file or directory first");
            state.copiedPath = state.selectedPath;
            setLog(`Copied: ${state.copiedPath}`);
          } else if (action === "paste") {
            await pasteCopied();
          } else if (action === "delete") {
            await deleteSelected();
          } else if (action === "download") {
            downloadSelected();
          }
        } catch (error) {
          setLog(error.message);
        }
      });
    });

    uploadInput.addEventListener("change", async () => {
      const files = Array.from(uploadInput.files || []);
      uploadInput.value = "";
      if (!files.length) return;

      for (const file of files) {
        try {
          const formData = new FormData();
          formData.append("path", state.currentPath);
          formData.append("file", file);
          await callJson("/finder/upload", {
            method: "POST",
            body: formData,
          });
          setLog(`Uploaded: ${file.name}`);
        } catch (error) {
          setLog(`Upload failed: ${file.name} - ${error.message}`);
        }
      }
      await refreshList();
    });

    window.addEventListener(
      "keydown",
      (event) => {
        if (event.key.toLowerCase() !== "f" || event.altKey || event.ctrlKey || event.metaKey) {
          return;
        }
        const focused = document.activeElement;
        if (
          focused &&
          (focused.tagName === "INPUT" ||
            focused.tagName === "TEXTAREA" ||
            focused.tagName === "SELECT" ||
            focused.isContentEditable)
        ) {
          return;
        }
        event.preventDefault();
        togglePanel();
      },
      true,
    );
  },
});
