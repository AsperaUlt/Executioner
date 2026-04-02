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

- 项目主壳已稳定为“后端托管前端资源 + 同源 API + 单页路由切换”的结构。
- Task 模块本轮已完成基础接口搭建并可通过后端直接访问。
- Music 模块当前已切换到“前端只请求 VIBE 后端，C++ 再代理本机 Node 服务”的代理架构。
- 音乐搜索主链路已经打通，但浏览器端交互体验仍需继续验收和优化。
- 下一阶段重心不再是继续扩 API，而是优化搜索结果逻辑与调整 HTML UI 结构。

## 本轮已完成

### 1. 音乐服务代理架构切换完成

- 前端新代码统一使用 `/api/music/*`。
- 后端当前已实现并接通：
  - `GET /api/music/health`
  - `GET /api/music/search`
  - `GET /api/music/queue`
- 当前方向已经明确为：
  - 前端只访问 VIBE 后端
  - C++ 后端负责代理本机 Node 音乐服务

### 2. 后端搜索代理路径已修正

- 当前搜索链路为：
  - 前端请求：`GET /api/music/search?q=xxx`
  - C++ 后端转发到：`http://127.0.0.1:3000/search?keywords=xxx`
- 这条映射已经验证成功。
- 搜索可以返回真实结果，不再停留在 mock 或错误路径上。

### 3. 兼容层已建立

- 后端保留了旧接口：
  - `GET /api/audio/search`
- 该旧接口内部复用 `/api/music/search` 的同一实现。
- 响应头已增加过渡标记：
  - `X-Vibe-Deprecated: true`
  - `X-Vibe-Replacement: /api/music/search`
- 当前仅为 `search` 提供兼容别名。
- 旧的 `track / url / lyric` 接口未继续扩展到新的 `music/*` 域，因为本阶段新接口只覆盖：
  - `health`
  - `search`
  - `queue`

### 4. 错误信息增强完成

- 之前前端常见错误只会看到泛化信息：
  - `Node music service returned a non-200 response`
- 当前后端错误返回已增强，能提供更明确的排障信息：
  - `upstreamStatus`
  - `upstreamBodyPreview`
  - `source`
- 该增强已经帮助定位出此前问题根因是“上游路径写错”，而不是前端搜索逻辑失效。

### 5. 前端音乐搜索 UI 已接入当前真实 Audio 面板

- 搜索框已接到 `/api/music/search`
- 当前歌曲结果区已支持展示：
  - 标题
  - 艺人
  - 专辑
  - 时长，格式为 `durationMs -> mm:ss`
- 当前前端状态已覆盖：
  - `loading`
  - `empty`
  - `error`
- 已加入简洁调试日志，便于联调定位。

### 6. 前端搜索交互完成一轮调整

- 输入时只显示联想建议，不直接刷新正式结果面板。
- 按 `Enter` 或点击 `Search` 才触发正式搜索。
- 正式结果会按前端相关度重新排序。
- 结果区已支持内部滚动，避免长列表超出可视区域。
- 已补充 suggestion 下拉容器及对应 state 字段。

### 7. 已完成的代码级验证

- 后端多次重新编译通过：
  - `cmake --build backend/build --config Debug`
  - `cmake --build backend/build --config Release`
- 前端资源通过后端可访问：
  - `GET /index_v2.html`
  - `GET /js/renderers/audio.js`
  - `GET /js/state.js`
- Node 对前端脚本解析已通过，至少当前没有明显语法错误。

## 当前验收边界

- 当前已经完成代码级验证和接口链路验证。
- 当前尚未完成完整浏览器自动化回归。
- 因此下面这些点目前仍应视为“待浏览器实操确认”，而不是最终交互体验已验收通过：
  - 联想下拉的实际视觉手感
  - 长列表滚动体验
  - 建议区与结果区切换时的动态稳定性

## 当前最需要 CLI2 验证的点

- 输入时是否只出现联想建议，而不是直接刷正式结果。
- 点击 `Search` 按钮是否真的触发正式搜索。
- 按 `Enter` 是否也能触发正式搜索。
- 正式结果是否按相关度呈现得更合理。
- 结果区是否可以滚动查看长列表。
- 建议区与结果区切换时是否有异常闪动或状态残留。

## 下一阶段计划

### 目标

- 优化搜索结果逻辑。
- 调整 HTML 的 UI 结构。
- 在不破坏当前同源代理架构的前提下，提升搜索交互的稳定性和可理解性。

### 重点方向

- 继续优化 suggestion 与正式 result 的切换逻辑，减少状态残留。
- 复查前端相关度排序是否符合用户预期，避免“结果正确但排序反直觉”。
- 调整 Audio 面板的 HTML 结构，使建议区、结果区、滚动区职责更清晰。
- 处理长列表滚动区域的尺寸、层级和可达性，避免 UI 结构限制后续体验优化。
- 保持前端仍只通过相对路径访问 `/api/music/*`，不要引入跨域或 `file://` 回退。

## 当前重点文件

- [backend/src/music_service.cpp](/F:/LLM/VIBE/backend/src/music_service.cpp)
- [backend/src/router.cpp](/F:/LLM/VIBE/backend/src/router.cpp)
- [frontend/js/api.js](/F:/LLM/VIBE/frontend/js/api.js)
- [frontend/js/renderers/audio.js](/F:/LLM/VIBE/frontend/js/renderers/audio.js)
- [frontend/js/state.js](/F:/LLM/VIBE/frontend/js/state.js)
- [frontend/index_v2.html](/F:/LLM/VIBE/frontend/index_v2.html)
