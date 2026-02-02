# ComfyUI-finder

ComfyUI-finder is a floating file manager plugin for ComfyUI.

## Features

- Toggle panel with `F`
- Browse files under the ComfyUI install directory
- Upload local files to current directory
- Copy + paste files/directories inside ComfyUI root
- Run:
  - `git clone`
  - `wget`
  - `hf download`

## Install

1. Put this folder in `ComfyUI/custom_nodes/ComfyUI-finder`
2. Restart ComfyUI
3. Press `F` in the UI to open/close the floating finder panel

## Notes

- Commands run with current finder directory as working directory.
- `hf download` requires `hf` CLI available in the runtime environment.
- All file actions are limited to the ComfyUI root path.

