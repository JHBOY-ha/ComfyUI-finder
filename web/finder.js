import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

app.registerExtension({
  name: "ComfyUI-finder",
  setup() {
    const state = {
      currentPath: "",
      copiedPath: "",
      selectedPath: "",
      visible: false,
    };

    const panel = document.createElement("div");
    panel.id = "comfyui-finder-panel";
    panel.innerHTML = `
      <div class="finder-head">
        <div class="finder-title">ComfyUI-finder</div>
        <button class="finder-close">x</button>
      </div>
      <div class="finder-toolbar">
        <button class="finder-btn" data-action="up">Up</button>
        <button class="finder-btn" data-action="refresh">Refresh</button>
        <button class="finder-btn" data-action="upload">Upload</button>
        <button class="finder-btn" data-action="copy">Copy</button>
        <button class="finder-btn" data-action="paste">Paste</button>
        <button class="finder-btn" data-action="git">git clone</button>
        <button class="finder-btn" data-action="wget">wget</button>
        <button class="finder-btn" data-action="hf">hf download</button>
      </div>
      <div class="finder-path"></div>
      <div class="finder-list"></div>
      <pre class="finder-log"></pre>
      <input type="file" class="finder-upload" multiple />
    `;

    const style = document.createElement("style");
    style.textContent = `
      #comfyui-finder-panel {
        position: fixed;
        top: 80px;
        right: 24px;
        width: min(760px, calc(100vw - 48px));
        height: 72vh;
        background: #0f1722;
        color: #e3edf8;
        border: 1px solid #2d3b4f;
        border-radius: 14px;
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(5px);
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
        border-bottom: 1px solid #2d3b4f;
        background: linear-gradient(90deg, #142236, #1e2d45);
      }
      #comfyui-finder-panel .finder-title {
        font-weight: 700;
        letter-spacing: 0.04em;
      }
      #comfyui-finder-panel .finder-close {
        border: none;
        background: #2f405a;
        color: #f5f7fb;
        border-radius: 7px;
        width: 28px;
        height: 28px;
        cursor: pointer;
      }
      #comfyui-finder-panel .finder-toolbar {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
        padding: 12px;
        border-bottom: 1px solid #2d3b4f;
        background: #111c2b;
      }
      #comfyui-finder-panel .finder-btn {
        border: 1px solid #385070;
        background: #1a2a3f;
        color: #dce8f7;
        border-radius: 8px;
        padding: 7px 8px;
        cursor: pointer;
        font-size: 12px;
      }
      #comfyui-finder-panel .finder-btn:hover {
        background: #223755;
      }
      #comfyui-finder-panel .finder-path {
        padding: 8px 12px;
        font-size: 12px;
        border-bottom: 1px solid #2d3b4f;
        color: #a7bddc;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #comfyui-finder-panel .finder-list {
        height: calc(100% - 245px);
        overflow: auto;
        padding: 8px 0;
      }
      #comfyui-finder-panel .finder-row {
        display: grid;
        grid-template-columns: 1fr 110px;
        gap: 8px;
        padding: 8px 12px;
        cursor: pointer;
      }
      #comfyui-finder-panel .finder-row:hover {
        background: #18263a;
      }
      #comfyui-finder-panel .finder-row.active {
        background: #234064;
      }
      #comfyui-finder-panel .finder-row .size {
        text-align: right;
        color: #98accc;
      }
      #comfyui-finder-panel .finder-log {
        margin: 0;
        padding: 10px 12px;
        border-top: 1px solid #2d3b4f;
        background: #0b131e;
        color: #a4f4c8;
        font-size: 11px;
        height: 88px;
        overflow: auto;
      }
      @media (max-width: 900px) {
        #comfyui-finder-panel {
          top: 56px;
          right: 10px;
          width: calc(100vw - 20px);
          height: 80vh;
        }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(panel);

    const pathEl = panel.querySelector(".finder-path");
    const listEl = panel.querySelector(".finder-list");
    const logEl = panel.querySelector(".finder-log");
    const uploadInput = panel.querySelector(".finder-upload");

    function setLog(message) {
      const now = new Date().toLocaleTimeString();
      logEl.textContent = `[${now}] ${message}\n` + logEl.textContent.slice(0, 8000);
    }

    function formatSize(size) {
      if (size === null || size === undefined) return "";
      const units = ["B", "KB", "MB", "GB"];
      let value = size;
      let unit = 0;
      while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
      }
      return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
    }

    async function callJson(path, options = {}) {
      const response = await api.fetchApi(path, options);
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Request failed: ${response.status}`);
      }
      return response.json();
    }

    async function refreshList(path = state.currentPath) {
      const params = new URLSearchParams({ path: path || "" });
      const data = await callJson(`/finder/list?${params.toString()}`);
      state.currentPath = data.current_path || "";
      state.selectedPath = "";
      pathEl.textContent = `ComfyUI root / ${state.currentPath || "."}`;
      listEl.innerHTML = "";

      for (const entry of data.entries) {
        const row = document.createElement("div");
        row.className = "finder-row";
        row.dataset.path = entry.relative_path;
        row.dataset.isdir = entry.is_dir ? "1" : "0";
        row.innerHTML = `
          <div>${entry.is_dir ? "DIR  " : "FILE "} ${entry.name}</div>
          <div class="size">${entry.is_dir ? "-" : formatSize(entry.size)}</div>
        `;
        row.addEventListener("click", () => {
          state.selectedPath = entry.relative_path;
          listEl.querySelectorAll(".finder-row").forEach((item) => item.classList.remove("active"));
          row.classList.add("active");
        });
        row.addEventListener("dblclick", () => {
          if (entry.is_dir) refreshList(entry.relative_path).catch((error) => setLog(error.message));
        });
        listEl.appendChild(row);
      }
    }

    function togglePanel(force) {
      state.visible = force !== undefined ? force : !state.visible;
      panel.style.display = state.visible ? "block" : "none";
      if (state.visible) {
        refreshList().catch((error) => setLog(error.message));
      }
    }

    async function runCommand(payload) {
      const data = await callJson("/finder/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, cwd: state.currentPath }),
      });
      setLog(`${data.command}\nexit=${data.return_code}\n${data.stdout || ""}${data.stderr || ""}`);
      await refreshList();
    }

    panel.querySelector(".finder-close").addEventListener("click", () => togglePanel(false));

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
          } else if (action === "git") {
            const repoUrl = window.prompt("git clone repo URL:");
            if (!repoUrl) return;
            const targetDir = window.prompt("Target folder name (optional):", "") || "";
            await runCommand({ command: "git_clone", repo_url: repoUrl, target_dir: targetDir });
          } else if (action === "wget") {
            const url = window.prompt("wget URL:");
            if (!url) return;
            const outputName = window.prompt("Save as (optional):", "") || "";
            await runCommand({ command: "wget", url, output_name: outputName });
          } else if (action === "hf") {
            const repoId = window.prompt("hf repo id (e.g. org/model):");
            if (!repoId) return;
            const fileName = window.prompt("file name (optional):", "") || "";
            await runCommand({ command: "hf_download", repo_id: repoId, file_name: fileName });
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
      true
    );
  },
});

