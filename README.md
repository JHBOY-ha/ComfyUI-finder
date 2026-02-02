# ComfyUI-finder

ComfyUI-finder 是一个 ComfyUI 悬浮式文件管理插件。

## 功能

- 快捷键 `F` 开关悬浮窗
- 浏览 ComfyUI 安装目录内文件
- 基础文件操作：`Copy`、`Paste`、`Delete`、`Upload`
- 选中文件时右侧预览
  - 图片：显示缩略图
  - 视频：显示可播放预览
- 双击图片可直接加载到工作流
  - 自动创建 `LoadImage` 节点
  - 若图片不在 `input/`，会先复制到 `input/` 再加载
- 支持按 `日期` / `大小` 排序，并可切换升序或降序
- 窗口支持拖动与缩放
- 日志栏支持上下拖拽调整高度
- 文件类型前缀高亮（`DIR` / `FILE` 不同颜色）

## 安装

### 方式一：在 `custom_nodes` 中使用 Git 克隆

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/JHBOY-ha/ComfyUI-finder.git
```

然后重启 ComfyUI  

### 方式二：通过 ComfyUI Manager 安装

1. 打开 **ComfyUI Manager**  
2. 选择 **Install via Git URL**  
3. 粘贴仓库地址：`https://github.com/JHBOY-ha/ComfyUI-finder.git`  
4. 安装完成后重启 ComfyUI  

## 使用说明

- 单击：选中文件并预览
- 双击目录：进入目录
- 双击图片：加载到工作流 `LoadImage`

## 注意事项

- 所有文件操作都限制在 ComfyUI 根目录内
- 删除为永久删除，请谨慎操作
