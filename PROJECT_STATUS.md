# PROJECT_STATUS

## 项目概况

- 项目名称：VIBE
- 形态：本地桌面风格 Web 应用
- 运行方式：前端由 C++ 后端静态托管，前后端通过同源 `/api/...` 通信
- 当前主入口：`http://127.0.0.1:18080/`
- 当前前端入口文件：[frontend/index_v2.html](/F:/LLM/VIBE/frontend/index_v2.html)
- 当前后端入口文件：[backend/src/main.cpp](/F:/LLM/VIBE/backend/src/main.cpp)
- 状态更新时间：2026-04-03

## 当前阶段结论

- 项目主骨架已稳定为“后端托管前端资源 + 同源 API + 单页路由切换”的结构。
- 前端主链路已经从 `Audio` 统一迁移到 `Music`，并保留旧 `#audio` 到 `#music` 的兼容跳转。
- 本轮已完成 Music 链路收口、搜索体验后端化、歌词接口接入、Access Deck 顶栏与弹层扩展。
- 当前阶段重点已经从“纯前端重构”进入“功能补齐 + 交互验收 + 命名/结构清理”的阶段。
- 下一阶段目标不再只是打磨搜索 UI，而是开始补音乐模块基础功能，例如日推等入口能力。

## 本轮已完成

### 1. Music 链路与页面结构收口

- Music 页已删除旧 `Search Snapshot` 和 `Playback` 区块。
- 查询状态已并入 `Music Atlas` 主区，页面主叙事集中到搜索、结果、歌词和队列。
- `Daily Playlist`、`Lyrics`、`Next Queue` 的区块比例已重排，Music 页整体更紧凑。
- 底部异常留白已处理，改为由 footer 高度驱动的自适应占位。
- 所有页面共享的右侧主滚动条已隐藏，但保留滚动能力。

### 2. Music 搜索体验后端化

- 后端搜索结果已增加二次重排逻辑。
- 当前排序规则已按标题 / 歌手 / 专辑的精确命中、前缀命中、包含命中、分词命中进行评分。
- 前端本地排序逻辑已删除，直接消费后端返回顺序。
- 前端仍保留“输入阶段展示 suggestions，提交后展示完整结果”的交互规则。

### 3. 歌词接口接入

- 后端新增歌词接口：`/api/music/lyric?id=...`
- 前端 Lyrics 区已在提交搜索后，对首个结果拉取真实歌词并展示。
- 当前歌词区在接口失败或无歌词时，仍保持可读的 fallback 文案。

### 4. Access Deck 与全局入口扩展

- 后端新增 `Access Deck` 数据接口：`/api/access/deck`
- 顶栏右上角已从本地端口展示改为 `Login` / `Help` 两个入口。
- 共享头部 panel 的语义已从 `Control Surface` 调整为 `Access Deck`。
- `Login / Help` 按钮已由后端配置驱动，而不是纯前端硬编码。

### 5. Login / Help 弹层

- 已新增 [frontend/js/renderers/access.js](/F:/LLM/VIBE/frontend/js/renderers/access.js)
- Login 弹层已支持两种表单：
  - Email 登录
  - Cellphone 登录
- Login 弹层已具备：
  - 打开 / 关闭
  - Tab 切换
  - `Escape` 关闭
  - 登录反馈区
  - 登录状态展示
- Help 弹层已加入：
  - 项目仓库外链：`https://github.com/AsperaUlt/Executioner`
  - 明确标记 `DO NOT DELETE` 的个人网站占位区

### 6. Login 弹层动效

- Login 弹层已加入 GSAP 开合动画。
- 已先完成基础开合动画，再升级为 timeline 版本。
- 当前开启动画包含：
  - 遮罩淡入
  - 主卡轻微弹性落位
  - 标题、tab、表单与侧栏信息分段入场
- 已保留 `prefers-reduced-motion` 分支，减少动画模式下不强行动效。

### 7. 全站视觉语言同步

- Music 页的新设计语言已同步到 `home / tasks / insights` 页面。
- 当前全站已统一为更高对比、块状分层、圆角大卡片的视觉方向。
- 共享壳层、标题体系和局部卡片材质已统一到同一套样式命名。

## 本轮主要改动文件

- 后端：
  - [backend/include/music_service.hpp](/F:/LLM/VIBE/backend/include/music_service.hpp)
  - [backend/src/music_service.cpp](/F:/LLM/VIBE/backend/src/music_service.cpp)
  - [backend/src/router.cpp](/F:/LLM/VIBE/backend/src/router.cpp)
  - [backend/include/api_models.hpp](/F:/LLM/VIBE/backend/include/api_models.hpp)
  - [backend/src/data_provider.cpp](/F:/LLM/VIBE/backend/src/data_provider.cpp)
- 前端：
  - [frontend/index_v2.html](/F:/LLM/VIBE/frontend/index_v2.html)
  - [frontend/js/api.js](/F:/LLM/VIBE/frontend/js/api.js)
  - [frontend/js/state.js](/F:/LLM/VIBE/frontend/js/state.js)
  - [frontend/js/main.js](/F:/LLM/VIBE/frontend/js/main.js)
  - [frontend/js/renderers/music.js](/F:/LLM/VIBE/frontend/js/renderers/music.js)
  - [frontend/js/renderers/files.js](/F:/LLM/VIBE/frontend/js/renderers/files.js)
  - [frontend/js/renderers/access.js](/F:/LLM/VIBE/frontend/js/renderers/access.js)
- 其他：
  - [build_project.bat](/F:/LLM/VIBE/build_project.bat)
  - [generate_project.bat](/F:/LLM/VIBE/generate_project.bat)

## 已完成验证

- 语法检查通过：
  - `node --check frontend/js/api.js`
  - `node --check frontend/js/main.js`
  - `node --check frontend/js/state.js`
  - `node --check frontend/js/renderers/music.js`
  - `node --check frontend/js/renderers/files.js`
  - `node --check frontend/js/renderers/access.js`
- 构建验证：
  - `cmake --build backend/build --config Debug` 通过
- 接口验证：
  - `/api/music/search?q=test` 正常
  - `/api/music/lyric?id=123` 正常
  - `/api/access/deck` 正常
- 页面级静态确认：
  - Login 弹层 DOM、Help 弹层 DOM、Access Deck 顶栏入口均已接入页面
  - Login 弹层 GSAP timeline 动画脚本已通过语法检查

## 当前阻塞 / 遗留

### 1. 登录新路由运行时仍有 404 风险

- 当前状态需要区分“代码已写好”和“运行时已完全打通”：
  - Login 弹层 UI 已完成
  - 基础登录 API 调用层已完成
  - 但根据本轮反馈，新增登录路由在运行时仍返回 `404`
- 已知现象：
  - `/api/music/...` 相关路由正常
  - `/api/access/deck` 正常
  - 登录相关新路由运行时未完全跑通
- 这说明后续需要优先验证路由注册 / 匹配 / 实际运行版本，而不是继续改前端表单本身。

### 2. 命名债务仍未完全清理

- 后端仍残留 `audio` 相关命名与配置引用。
- 前端 router 中仍保留 `#audio -> #music` 的兼容逻辑。
- 文档和代码中的品牌/命名仍存在一定不一致，例如：
  - `Executioner`
  - `Unified Mission Console`
  - `Access Deck`
- 这些不会立即阻塞功能，但会影响后续可读性和指令部署。

### 3. 浏览器级完整验收尚未完成

- 当前已完成代码级、接口级、局部交互级确认。
- 尚未完成完整浏览器自动化回归。
- 仍需人工或自动化继续确认：
  - Music 页底部留白是否已完全消失
  - `Daily Playlist / Lyrics / Next Queue` 新比例是否自然
  - 后端二次重排后的搜索建议是否符合预期
  - 首条结果歌词是否稳定显示
  - Login / Help 弹层的开关与动画在实际浏览器中是否符合预期

## 当前验收边界

- 已完成：
  - Music 主链路收口
  - 歌词接口接入
  - 搜索排序后端化
  - Access Deck 顶栏与弹层框架
  - 登录 / 帮助弹层基础交互
  - Login GSAP timeline 动画
  - 全站视觉同步
- 尚未完成：
  - 登录请求运行时全链路打通
  - 日推等音乐基础功能
  - 完整浏览器自动化回归
  - 历史命名与文档完全清理

## 建议 CLI2 重点验证的点

- Music 页底部留白是否已消失
- `Daily Playlist / Lyrics / Next Queue` 新比例是否自然
- 后端二次重排后的搜索建议是否符合预期
- Lyrics 是否能随首条结果正确显示
- Help 弹层的开关、外链和占位区
- 登录相关新路由为什么在运行时 `404`
- Login 弹层的 timeline 动画是否存在抖动、遮挡、点击错位或 reduced-motion 分支问题
- 全站隐藏右侧滚动条后，是否仍保持正常滚动和可达性

## 已知限制

- `Daily Playlist` 当前仍是预留位，还没有接真实端口。
- 登录状态当前依赖前端本地存储 cookie，并通过基础 API 查询状态，安全策略仍需后续收紧。
- 当前环境未完成完整 UI 自动化测试依赖配置，因此尚未做完整回归。
- 后端仍存在历史 `audio` 命名残留。

## 下一阶段计划

### 目标

- 进入音乐模块基础功能补齐阶段。
- 在保持当前同源架构和已完成 Music/Access Deck UI 的前提下，继续补充日推等音乐基础能力。
- 同时完成登录链路运行时问题定位，并继续清理命名债务。

### 重点方向

- 接入音乐模块基础功能：
  - `Daily Playlist`
  - 后续推荐 / 日推类基础入口
- 跑通登录相关运行时链路，解决新增登录路由 `404` 问题。
- 继续验收 Music 页的新结构、新比例、新歌词链路。
- 清理后端与文档中的历史 `audio` 命名，提升可读性。
- 视情况补全 Help 弹层和 Access Deck 的后续行为定义。

## 当前重点文件

- [frontend/index_v2.html](/F:/LLM/VIBE/frontend/index_v2.html)
- [frontend/js/api.js](/F:/LLM/VIBE/frontend/js/api.js)
- [frontend/js/state.js](/F:/LLM/VIBE/frontend/js/state.js)
- [frontend/js/main.js](/F:/LLM/VIBE/frontend/js/main.js)
- [frontend/js/renderers/music.js](/F:/LLM/VIBE/frontend/js/renderers/music.js)
- [frontend/js/renderers/files.js](/F:/LLM/VIBE/frontend/js/renderers/files.js)
- [frontend/js/renderers/access.js](/F:/LLM/VIBE/frontend/js/renderers/access.js)
- [backend/include/music_service.hpp](/F:/LLM/VIBE/backend/include/music_service.hpp)
- [backend/src/music_service.cpp](/F:/LLM/VIBE/backend/src/music_service.cpp)
- [backend/src/router.cpp](/F:/LLM/VIBE/backend/src/router.cpp)
- [backend/src/data_provider.cpp](/F:/LLM/VIBE/backend/src/data_provider.cpp)
