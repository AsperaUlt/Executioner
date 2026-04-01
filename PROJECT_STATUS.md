# 项目状态文档

## 1\. 项目概览

* 项目名称：VIBE
* 项目目标：构建一个本地桌面级 Web 应用，通过本地 C++ 后端提供 API 和静态页面托管，前端以单页应用方式承载任务、统计和音频模块
* 技术栈：

  * 后端：C++17、CMake、`cpp-httplib`、`nlohmann/json`
  * 前端：Vanilla JS SPA、HTML、Tailwind CDN、Google Fonts / Material Symbols
  * 运行方式：本地后端监听 `http://127.0.0.1:18080`，浏览器通过同源访问页面和 API
* 当前开发阶段：基础主流程已跑通，Audio 处于 MVP 骨架阶段，重点是“离线优先”和后续真实联调准备
* 当前仓库状态：

  * 已存在项目级工程文档：`AGENTS.md`、`.agents/skills/\\\*`、`.codex/config.toml`
  * 已存在 Debug/Release 构建产物
  * 当前目录下未看到 `.git`，Git 分支、提交状态、工作树是否干净需人工确认

## 2\. 当前已实现内容

### 页面

* 已实现单页结构页面：`Home / Tasks / Audio / Insights`
* 当前前端主入口为 `frontend/index\\\_v2.html`
* 页面已由后端静态托管，可通过：

  * `http://127.0.0.1:18080/`
  * `http://127.0.0.1:18080/index\\\_v2.html`

### 组件结构

* 当前未使用组件框架，页面逻辑按模块拆分为 renderer：

  * `frontend/js/renderers/stats.js`
  * `frontend/js/renderers/tasks.js`
  * `frontend/js/renderers/music.js`
  * `frontend/js/renderers/audio.js`
* 页面切换通过 hash 路由实现，主流程由 `frontend/js/main.js` 管理

### 状态管理

* 使用轻量级全局状态对象，定义在 `frontend/js/state.js`
* 当前已存在的状态分区：

  * `summary`
  * `stats`
  * `tasks`
  * `music`
  * `audio`
* `audio` 状态已包含：

  * `status`
  * `query`
  * `results`
  * `currentTrack`
  * `playbackUrl`
  * `lyricText`
  * `error`
  * `message`
  * `isSearching`
  * `isResolving`

### API 封装

* 前端 API 封装集中在 `frontend/js/api.js`
* 已有基础数据聚合方法：

  * `fetchAllData()`
* 已有 Audio 相关方法：

  * `searchAudio(query)`
  * `fetchAudioTrack(id)`
  * `fetchAudioUrl(id)`
  * `fetchAudioLyric(id)`
* 前端默认使用同源请求；`file://` 仅保留本地调试回退基址

### 后端主流程

* `backend/src/main.cpp` 已实现静态资源托管
* 后端启动时会打印：

  * 监听地址
  * 静态资源目录
  * mount 成功状态
  * 建议访问地址
* 后端会显式处理：

  * `GET /`
  * `GET /index\\\_v2.html`

### 已有 API

* 基础接口：

  * `/api/health`
  * `/api/dashboard/summary`
  * `/api/stats`
  * `/api/tasks`
  * `/api/music/queue`
* Audio 适配接口：

  * `/api/audio/search?q=`
  * `/api/audio/track?id=`
  * `/api/audio/url?id=`
  * `/api/audio/lyric?id=`

### 音乐相关功能

* 后端已新增独立的 `AudioService`
* 音乐上游配置已集中到 `backend/include/audio\\\_config.hpp`

  * 默认上游地址：`http://127.0.0.1:3000`
  * 已设置请求超时常量
* `AudioService` 已负责：

  * 构造上游请求
  * 统一处理连接失败、超时、空响应、非 200、JSON 解析失败
  * 返回统一结果结构
* 当前错误返回已具备统一 envelope：

  * `ok`
  * `data` 或 `error`
  * `message`
  * `source`
* 前端 Audio 页面已具备：

  * 搜索输入框
  * 搜索按钮
  * 搜索结果列表
  * 当前播放区
  * 歌词区
  * 错误提示区
  * 加载状态区
  * 基于 `HTMLAudioElement` 的播放入口
  * 搜索防抖
  * 多次搜索和点击时的 token 级并发保护

### 基础工程配置

* 后端使用 `backend/CMakeLists.txt` 构建
* 第三方依赖通过 `FetchContent` 获取
* 已存在项目级 Codex 配置和协作文档

### 其他已完成能力

* Home / Tasks / Insights 主流程未被移除，仍可继续使用
* 保留了 `/api/music/queue` 的本地静态示例数据，用于 Home 和 Audio 页面中的 fallback queue 展示
* 后端保留了临时 CORS / OPTIONS 支持，便于调试

## 3\. 当前缺失内容

### 尚未实现的核心功能

* 未完成真实音乐服务联调
* 未实现登录、歌单同步、收藏、评论、下载等用户态能力
* 未实现完整播放器能力：

  * 暂停 / 续播
  * 上一首 / 下一首
  * 播放进度同步
  * 播放状态持久化

### 已有但不完整的功能

* Audio 模块虽已形成前后端骨架，但当前主要是“可稳定失败、可继续联调”的状态
* `musicQueue` 仍是本地示例数据，与新的 Audio 搜索/播放链路并未统一
* 当前前端样式依赖外部 CDN，离线或受限网络下是否稳定需人工确认
* 后端配置仍以常量为主，尚未形成统一配置系统

### 当前明显缺口

* 缺少 README 或面向外部开发者的运行说明
* 缺少自动化测试
* 缺少部署脚本或打包说明
* 缺少针对崩溃、日志、联调问题的正式运维文档
* 根目录遗留旧入口文件是否需要清理，需人工确认

## 4\. 工程状态分类

### 已完成

* 后端基础服务可构建、可启动
* 前端静态资源已交由后端托管
* 前端已切换为同源 API 请求模式
* Home / Tasks / Insights 已有基础展示能力
* AudioService 适配层已加入后端
* Audio 页面基础交互骨架已加入前端
* 基础错误返回和参数校验已接入 `/api/audio/\\\*`

### 进行中

* Audio 模块从“静态展示”向“真实音乐服务联调”过渡
* 前后端围绕离线优先、失败态优雅处理的链路正在成型

### 待完成

* 联调本地音乐上游服务并验证字段映射
* 完善播放器体验与交互细节
* 建立正式文档、运行说明、部署说明
* 增加最小测试和验证流程

### 技术风险

* Audio 上游接口字段和当前归一化逻辑尚未在真实环境全面验证
* 当前前端依赖 CDN，目标运行环境可能受网络影响
* Windows 下本地构建依赖 CMake + MSBuild + Visual Studio 工具链
* 当前保留宽松 CORS，仅适合开发调试，不代表正式策略

### 外部依赖

* 本地后端服务 `vibe\\\_backend.exe`
* 本地 C++ 构建环境
* 未来接入的 `NeteaseCloudMusicApiEnhanced`
* 浏览器运行环境

### 需人工确认项

* 当前仓库是否已初始化 Git
* 当前分支、远端仓库、GitHub 同步策略
* 根目录旧的 `index.html` / `index\\\_v2.html` 是否仍需保留
* 最终部署模式是本地开发使用、桌面打包，还是独立内网部署
* 目标环境是否允许继续依赖外部 CDN

## 5\. 下一阶段开发计划表

|序号|模块|当前状态|下一步任务|优先级|依赖项|验收标准|
|-|-|-|-|-|-|-|
|1|Audio 上游联调|已有后端适配层和前端骨架|启动并联调本地音乐服务，验证 `/api/audio/\\\*` 的真实返回字段|高|本地音乐服务、后端可运行|搜索、歌曲详情、播放 URL、歌词接口均能返回真实数据|
|2|Audio 错误链路|已支持基础错误返回|验证未启动、超时、空歌词、URL 为空、多次搜索、多次点击播放的行为|高|Audio API、浏览器手工验证|页面不白屏，错误显示在 UI，控制台无致命错误|
|3|Audio 播放体验|已有基础播放入口|增加更完整的播放状态反馈和交互控制|中|Audio URL 接口真实可用|用户能明确区分“加载中 / 可播放 / 播放失败”|
|4|Music 数据一致性|Home 使用静态 queue，Audio 使用新链路|明确 `musicQueue` 与 Audio 模块的关系，决定是否统一数据来源|中|产品决策、后端数据结构|Home 和 Audio 的音乐信息来源策略清晰一致|
|5|配置管理|上游地址与超时为常量|抽出统一配置入口，管理端口、上游地址、超时等参数|中|后端结构调整|关键运行参数可集中管理，不散落在业务实现中|
|6|文档与运行说明|仅有协作型文档|补 README、联调说明、故障排查和部署说明|高|当前代码状态|新开发者可按文档完成构建、启动、访问和联调|
|7|测试与验证|主要依赖手工验证|增加最小接口验证和关键页面验证流程|中|构建环境、接口稳定性|核心接口和 Audio 关键场景可重复验证|

## 6\. 里程碑规划

### M1：基础流程跑通

* 后端可稳定启动
* 前端通过后端静态托管访问
* Home / Tasks / Insights 正常切换
* Audio 页面在上游未启动时可稳定失败，不导致白屏或崩溃

### M2：音乐主功能可用

* 本地音乐服务可启动并可访问
* `/api/audio/search`、`/api/audio/track`、`/api/audio/url`、`/api/audio/lyric` 联调成功
* Audio 页面可搜索并实际播放音频

### M3：播放器体验完善

* 播放状态反馈更完整
* 播放控制和进度体验完善
* 歌词、错误、空态展示更加稳定
* Home 与 Audio 的音乐信息体验更一致

### M4：稳定性、文档和部署完善

* README、联调文档、状态文档完整
* 最小测试和验证流程可重复执行
* 构建、运行、部署要求明确

## 7\. 建议优先执行的 3 个任务

### 1\. 联调真实音乐服务

原因：

* 当前 Audio 的最大不确定性不在前端页面，而在上游 API 的真实字段和行为
* 只有先跑通真实联调，才能判断后端归一化逻辑是否足够稳定

### 2\. 完善 Audio 失败场景验证

原因：

* 当前阶段目标是“能稳定失败”
* 上游未启动、超时、空歌词、URL 为空等场景是当前架构是否可靠的关键

### 3\. 补齐面向开发与部署的文档

原因：

* 当前项目已具备前后端协同、构建依赖和本地服务要求
* 没有运行和联调文档，会显著增加后续协作和部署成本

## 8\. 下次继续开发可直接使用的提示词

```text
你现在维护 VIBE 项目的 Audio 模块。请先阅读 PROJECT\\\_STATUS.md、backend/src/router.cpp、backend/src/audio\\\_service.cpp、frontend/js/api.js、frontend/js/renderers/audio.js 和 frontend/index\\\_v2.html。当前目标不是新增大功能，而是优先完成 Audio 与本地音乐上游服务的真实联调验证，并补齐失败场景处理。请先检查 /api/audio/search、/api/audio/track、/api/audio/url、/api/audio/lyric 的实际返回字段与当前归一化逻辑是否一致，再提出最小改动方案，确保上游未启动、请求超时、空歌词、URL 为空、重复搜索、重复点击播放都能稳定处理，不影响 Home / Tasks / Insights。先汇报现状和差异，再实施。
```

