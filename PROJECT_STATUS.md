# PROJECT_STATUS

## 项目概况

- 项目名：VIBE
- 目标：本地桌面级 Web 应用，后端通过 C++ 提供 API 和静态资源，前端通过同源方式访问页面与接口
- 当前运行地址：`http://127.0.0.1:18080`
- 当前主入口：`http://127.0.0.1:18080/`
- 当前前端入口文件：[frontend/index_v2.html](/F:/LLM/VIBE/frontend/index_v2.html)
- 当前后端主入口文件：[backend/src/main.cpp](/F:/LLM/VIBE/backend/src/main.cpp)

## 当前已完成进度

### 1. 基础运行链路

- 后端可正常构建并启动，静态资源由后端挂载提供
- 已验证：
  - `GET /` 返回 `200`
  - `GET /index_v2.html` 返回 `200`
  - `GET /js/api.js` 返回 `200`
  - `GET /api/health` 返回正常 JSON
- 启动日志仍保留：
  - backend listen address
  - static resource directory
  - static mount success
  - suggested local URL

### 2. 前端搜索优化

- 已完成 Audio 搜索链路最小优化
- 涉及文件：
  - [frontend/js/api.js](/F:/LLM/VIBE/frontend/js/api.js)
  - [frontend/js/renderers/audio.js](/F:/LLM/VIBE/frontend/js/renderers/audio.js)
- 已支持：
  - `300ms debounce`
  - `AbortController` 取消上一次未完成请求
  - 仅渲染最后一次有效结果
  - 相同 query 不重复请求
  - query 为空或长度小于 2 时不请求并清空结果
  - 输入与按钮共用同一套搜索函数
  - `loading / empty / error` 基础状态展示
  - 控制台调试日志：
    - `search started`
    - `search aborted`
    - `search success`
    - `search ignored(stale)`

### 3. Home 页接口优先落地

#### Core Dashboard

- 继续沿用 `GET /api/dashboard/summary`
- 已补充稳定字段：
  - `songsPlayed`
  - `focusMinutes`
  - `tasksCompleted`
- 为兼容旧前端，暂时保留：
  - `tasksClosed`

#### Music Snapshot

- 已新增 `GET /api/home/music-snapshot`
- 返回稳定结构：
  - `currentTrack`
  - `queueDepth`
  - `upNext`
- Home 页的 `Current Track` 和 `Queue Depth` 已接入新接口
- 前端 renderer 对新旧结构做了兼容，避免影响其他页面

#### Task Stream

- 已新增 `GET /api/home/task-stream`
- 返回结构：
  - `items[]`
  - 每项包含：
    - `id`
    - `title`
    - `status`
    - `streamState`
    - `eta`
- `streamState` 当前约定：
  - `current`
  - `next`
  - `queued`
  - `completed`
- Home 页任务流已按 `streamState` 做视觉层级：
  - `current` 最突出
  - `next` 次突出
  - `completed` 灰化弱化
- Tasks 页仍保留现有 `/api/tasks` 渲染逻辑

#### Field Notes

- 已新增 `GET /api/files/quick-access`
- 当前为 mock/demo 数据，结构稳定，后续可替换为真实本地文件扫描
- 返回字段：
  - `id`
  - `title`
  - `path`
  - `type`
  - `lastAccessed`
  - `canOpen`
- Home 页 `Field Notes` 已改为 `Quick access` 卡片并接入该接口
- Insights 页原有 stats highlights 未被混用

## 当前主要接口清单

### 通用接口

- `GET /api/health`
- `GET /api/dashboard/summary`
- `GET /api/stats`
- `GET /api/tasks`
- `GET /api/music/queue`

### Home 专用接口

- `GET /api/home/music-snapshot`
- `GET /api/home/task-stream`
- `GET /api/files/quick-access`

### Audio 接口

- `GET /api/audio/search?q=...`
- `GET /api/audio/track?id=...`
- `GET /api/audio/url?id=...`
- `GET /api/audio/lyric?id=...`

## 当前状态说明

- 当前 Home 页已经从“纯静态展示”推进到“接口驱动展示”
- 当前策略是“接口优先、前端最小适配、不做大重构”
- 当前部分数据仍是 mock/demo：
  - `dashboard summary`
  - `home music snapshot`
  - `home task stream`
  - `files quick access`
- Audio 搜索接口已接入真实上游适配层，但本地联调时如果上游音乐服务未启动，仍会返回后端封装的错误结果

## 已验证结果

- 后端可重新构建通过
- 以下接口已验证可返回有效结果：
  - `/api/dashboard/summary`
  - `/api/home/music-snapshot`
  - `/api/home/task-stream`
  - `/api/files/quick-access`
- 首页资源加载正常：
  - `/`
  - `/js/renderers/files.js`

## 当前遗留问题

- `frontend/index_v2.html` 历史上存在编码污染痕迹，当前已局部修正，但仍建议后续统一整理编码
- Home 与 Tasks 页的数据来源已开始拆分，但 Tasks 页本身仍以旧接口为主
- `/api/music/queue` 仍保留为旧的 fallback/mock 数据源，后续需要明确是否保留
- 文件快速入口当前仅展示，不支持实际打开动作

## 下一阶段任务

### 目标

- 实现 Task 页的基础功能接口添加

### 建议范围

- 为 Task 页补齐更明确的后端接口，而不是继续依赖单一静态 `/api/tasks`
- 明确 Task 页基础数据模型，例如：
  - 任务列表
  - 任务状态统计
  - 当前任务
  - 待处理任务
  - 已完成任务
- 优先保持最小改动，不重构现有 UI

### 建议优先级

1. 设计 Task 页基础接口结构
2. 在后端提供 mock/demo 实现
3. 前端最小适配 Tasks 页现有 renderer
4. 保证 Home 的 task stream 与 Tasks 页基础接口职责分离

## 下一次继续开发建议

- 优先查看以下文件：
  - [backend/src/router.cpp](/F:/LLM/VIBE/backend/src/router.cpp)
  - [backend/src/data_provider.cpp](/F:/LLM/VIBE/backend/src/data_provider.cpp)
  - [frontend/js/api.js](/F:/LLM/VIBE/frontend/js/api.js)
  - [frontend/js/renderers/tasks.js](/F:/LLM/VIBE/frontend/js/renderers/tasks.js)
  - [frontend/index_v2.html](/F:/LLM/VIBE/frontend/index_v2.html)
- 下一步直接开始：Task 页基础功能接口添加
