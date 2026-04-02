# PROJECT_STATUS

## 项目概况

- 项目名称：VIBE
- 形态：本地桌面风格 Web 应用
- 运行方式：前端由 C++ 后端静态托管，前后端通过同源 `/api/...` 通信
- 当前主入口：`http://127.0.0.1:18080/`
- 当前前端入口文件：[frontend/index_v2.html](/F:/LLM/VIBE/frontend/index_v2.html)
- 当前后端入口文件：[backend/src/main.cpp](/F:/LLM/VIBE/backend/src/main.cpp)
- 状态更新时间：2026-04-02

## 当前阶段结论

- 项目主骨架已稳定为“后端托管前端资源 + 同源 API + 单页路由切换”的结构。
- Music 页已完成一轮大型前端重构，前端主链路命名已从 Audio 统一迁移到 Music。
- 本轮改动未改变现有搜索接口 `/api/music/search`，也未改动现有搜索结果数据结构。
- Music 页已完成滚动容器、搜索建议区、结果区和右侧摘要区的一轮结构性整理，当前重点进入体验细化与浏览器实操验收。
- 下一阶段重点不再是扩 API，而是继续优化 Music 页滚动体验、搜索交互稳定性、动画观感与信息层次。

## 本轮已完成

### 1. 前端主链路从 Audio 统一迁移到 Music

- 路由从 `#audio` 改为 `#music`。
- 导航、标题、`data-module`、`data-field` 已统一改成 `music-*`。
- 保留了旧 `#audio` 到 `#music` 的兼容跳转，避免历史链接直接失效。

### 2. Music 搜索渲染逻辑已合并收口

- 已删除 [frontend/js/renderers/audio.js](/F:/LLM/VIBE/frontend/js/renderers/audio.js)。
- 搜索建议、结果列表、滚动协同、状态渲染已并入 [frontend/js/renderers/music.js](/F:/LLM/VIBE/frontend/js/renderers/music.js)。
- [frontend/js/main.js](/F:/LLM/VIBE/frontend/js/main.js) 已改为使用 `initMusicBrowser` / `renderMusicBrowser`。
- [frontend/js/state.js](/F:/LLM/VIBE/frontend/js/state.js) 中 `state.audio` 已改为 `state.musicBrowser`。

### 3. Music 页滚动与视觉层已统一

- 已恢复整页滚动，`main` 不再承担唯一滚动职责。
- 已隐藏页面和 Music 结果区/建议区的可见滚动条，但保留滚动能力。
- Music 页已去掉右侧 `sticky` 栈，避免滚动时摘要区压住下方 `Playback` / `Lyrics` / `Fallback Queue`。
- 已压缩结果区高度，减少页面底部不明留白。

### 4. Music 页动画表现已做一轮柔化处理

- 路由切入时为 Music 子模块改为更柔和的 GSAP 入场动画。
- 给 Music 子模块增加了轻微“柔体漂浮”和 hover 回弹效果。
- 动画当前仅作用于 Music 页专用 `music-card`，避免影响全站其他模块。

### 5. 本轮改动范围已集中在前端 Music 链路

- 改动文件：
  - [frontend/index_v2.html](/F:/LLM/VIBE/frontend/index_v2.html)
  - [frontend/js/main.js](/F:/LLM/VIBE/frontend/js/main.js)
  - [frontend/js/state.js](/F:/LLM/VIBE/frontend/js/state.js)
  - [frontend/js/renderers/music.js](/F:/LLM/VIBE/frontend/js/renderers/music.js)
- 删除文件：
  - [frontend/js/renderers/audio.js](/F:/LLM/VIBE/frontend/js/renderers/audio.js)
- 未改动：
  - [frontend/js/api.js](/F:/LLM/VIBE/frontend/js/api.js)
  - 后端搜索接口
  - 搜索结果 JSON 结构

### 6. 补充修正与调试结果

- 已保留旧 `#audio` hash 到 `#music` 的兼容处理。
- 已完成 Music 页滚动壳层和搜索模块命名收口，便于 CLI2 按新结构做页面验收。
- 当前前端主链路已统一为 Music，但后端内部仍存在少量历史 `audio` 命名残留。

## 接口兼容性

- 保持现有 `/api/music/search` 不变。
- 未新增后端接口。
- 未改动 [frontend/js/api.js](/F:/LLM/VIBE/frontend/js/api.js)。
- 现有搜索结果数据结构未变。

## 已完成验证

- `node --check frontend/js/main.js`
- `node --check frontend/js/renderers/music.js`
- 本地启动后端后访问 `http://127.0.0.1:18080/` 返回 `200`
- 本地访问 `http://127.0.0.1:18080/js/renderers/music.js` 返回 `200`
- 本地访问 `http://127.0.0.1:18080/js/main.js` 返回 `200`

## 当前验收边界

- 当前已完成代码级与接口级验收。
- 当前尚未完成完整浏览器自动化回归。
- 因此下面这些项目目前仍应视为“待浏览器实操确认”，而不是最终交互体验已完全验收通过：
  - Music 页滚动时，右侧摘要区是否还会压住 `Playback` / `Lyrics` / `Fallback Queue`
  - 搜索建议展开时页面是否仍存在遮挡、裁切或不可达区域
  - 搜索结果较多时，结果区内部滚动与整页滚动是否协同正常
  - 页面底部是否仍存在异常留白
  - Music 页 GSAP 软体动效是否造成布局抖动或点击区域错位

## 建议 CLI2 重点验证的点

- Music 页滚动时，右侧摘要区是否还会压住 `Playback` / `Lyrics` / `Fallback Queue`
- 搜索建议展开时，页面是否仍存在遮挡、不可达区域
- 搜索结果较多时，结果区内部滚动与整页滚动是否协同正常
- 页面底部是否仍存在异常留白
- `#audio` 旧 hash 是否会正确跳转到 `#music`
- Music 页 GSAP 软体动效是否只带来视觉效果，没有造成布局抖动或点击区域错位

## 已知限制

- 建议仍然复用现有搜索接口结果做前端排序，不是独立 suggestion API。
- `Daily Playlist` 当前只是预留位，还没有接真实端口。
- 当前环境未完成浏览器自动化测试依赖配置，因此尚未进行完整 UI 自动回归。
- 后端仍有历史 `audio` 命名残留，但前端主链路已经统一为 Music。

## 下一阶段计划

### 目标

- 进一步优化 Music 页整体体验。
- 继续打磨滚动、搜索建议、结果呈现、摘要信息和动效之间的协同。
- 在不破坏当前同源结构和现有搜索接口的前提下，提高 Music 页的稳定性、可达性和观感一致性。

### 重点方向

- 确保 Music 页滚动过程中，各子模块不再发生遮挡、重叠或不可达。
- 细化建议区内部滚动与整页滚动的协同关系，减少滚动冲突并保持自然手感。
- 继续验证并稳定“输入阶段只出建议、提交后才出结果”的行为规则。
- 清理右侧摘要区与左侧结果区的重复信息，确保信息分层清晰。
- 继续观察 GSAP 软体动效在不同屏宽和连续交互下是否引发布局抖动、点击错位或性能波动。
- 为后续 `Daily Playlist` 接口接入保留清晰布局和稳定容器。

## 当前重点文件

- [frontend/index_v2.html](/F:/LLM/VIBE/frontend/index_v2.html)
- [frontend/js/renderers/music.js](/F:/LLM/VIBE/frontend/js/renderers/music.js)
- [frontend/js/state.js](/F:/LLM/VIBE/frontend/js/state.js)
- [frontend/js/main.js](/F:/LLM/VIBE/frontend/js/main.js)
- [frontend/js/api.js](/F:/LLM/VIBE/frontend/js/api.js)
- [backend/src/music_service.cpp](/F:/LLM/VIBE/backend/src/music_service.cpp)
- [backend/src/main.cpp](/F:/LLM/VIBE/backend/src/main.cpp)
