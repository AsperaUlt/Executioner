# PROJECT_STATUS

## 项目概况

- 项目名称：VIBE
- 形态：本地桌面风格 Web 应用
- 运行方式：C++ 后端托管前端静态资源，前后端通过同源 `/api/...` 通信
- 当前主入口：`http://127.0.0.1:18080/`
- 当前前端入口文件：[frontend/index_v2.html](/F:/LLM/VIBE/frontend/index_v2.html)
- 当前后端入口文件：[backend/src/main.cpp](/F:/LLM/VIBE/backend/src/main.cpp)
- 状态更新时间：2026-04-04

## 当前阶段结论

- 项目仍保持“后端托管前端 + 同源 API + 单页切换”的主架构。
- Access Deck 登录链路已从“占位式前端登录”推进到“后端托管、同源会话驱动”的真实接入阶段。
- 登录状态、登出、二维码登录、手机号验证码登录的核心后端接口已接通，并完成多轮状态一致性修复。
- 当前下一阶段目标已明确收敛为两项：
  - 完成登录状态搭建与浏览器端稳定回归
  - 完成日推歌曲显示

## 今日完成

### 1. 登录体系从前端占位切换为后端会话托管

- 登录成功后统一由后端写入 `HttpOnly` 的 `vibe_music_session`
- 前端不再自行保存上游 cookie
- 登录状态判定从“前端假定”切换为“本地 session 优先”的后端判断逻辑

### 2. 已完成的后端能力

- 本地会话型登录状态查询与登出：
  - `/api/login/status`
  - `/api/logstatus`
  - `/api/logout`
- 手机号验证码登录链路：
  - 发码：`/api/captcha/sent`
  - 验证码登录：`/api/login/cellphone`
- 二维码登录链路：
  - `/api/login/qr/key`
  - `/api/login/qr/create`
  - `/api/login/qr/check`
  - `/api/login/qr/commit`
- 邮箱登录已从主流程移除，不再作为当前主入口

### 3. 已完成的前端行为

- Login 弹层已切换为两种真实登录方式：
  - `QR Code`
  - `Cellphone`
- 手机登录已改成“发送验证码 + 输入验证码登录”
- 会话操作按钮已保留并可见：
  - `Check Status`
  - `Logout`
- 二维码区域已支持：
  - 自动生成二维码
  - 手动刷新二维码
  - 轮询扫码状态
  - 状态文本实时展示

### 4. 今天重点修掉的问题

- `logout` 后再查 `status` 仍显示 `Session is active`
  - 原因：没有本地 cookie 时仍继续查上游状态
  - 结果：已改为“本地 session 优先”，没有本地 cookie 直接返回 `loggedIn: false`
- 刷新二维码或登出后，旧轮询请求仍可能把 session 写回来
  - 结果：已拆分为：
    - `qr/check` 只查状态，不写 cookie
    - `qr/commit` 才真正提交登录并写入本地 session
  - 前端已增加二维码代际控制，旧二维码轮询结果不会污染当前状态
- 二维码状态提示不够真实
  - 结果：当前已直接透传上游 `message/code`
  - 用户可见状态更接近真实流程，例如等待扫码、待确认、已过期、已授权

## 当前验证结果

- 前端相关 JS `node --check` 通过
- Debug 后端构建通过
- 新增登录 / 状态 / 登出 / 二维码相关路由已在新编译后的后端上验证存在
- `logout -> status` 链路已验证返回 `loggedIn: false`

## 今日涉及的核心文件

- 后端：
  - [backend/src/router.cpp](/F:/LLM/VIBE/backend/src/router.cpp)
  - [backend/src/music_service.cpp](/F:/LLM/VIBE/backend/src/music_service.cpp)
  - [backend/include/music_service.hpp](/F:/LLM/VIBE/backend/include/music_service.hpp)
- 前端：
  - [frontend/js/api.js](/F:/LLM/VIBE/frontend/js/api.js)
  - [frontend/js/renderers/access.js](/F:/LLM/VIBE/frontend/js/renderers/access.js)
  - [frontend/index_v2.html](/F:/LLM/VIBE/frontend/index_v2.html)

## 当前重点风险 / 遗留

### 1. 浏览器端仍需完整回归登录链路

- 需要在真实浏览器里完整走一遍：
  - QR 登录
  - 手机验证码登录
  - Logout 后立刻查 Status
  - 刷新二维码后旧二维码是否彻底失效
- 需要继续观察二维码状态卡是否准确反映上游 `message`

### 2. 运行中的后端版本仍有混淆风险

- 之前多次出现旧进程仍占用 `18080`
- 这会造成“路由看起来没生效，但实际是旧进程还在跑”的假象
- 仍需继续确认当前运行的始终是最新的 `backend/build/Debug/vibe_backend.exe`

### 3. 登录语义日志仍可继续整理

- 当前 `outcome=success` 一类日志语义仍可能混淆“传输成功”和“鉴权成功”
- 如需后续排障更清晰，可继续把日志拆成“传输成功 / 鉴权状态分离”的语义

### 4. 二维码登录文档仍为空

- [api/QRcode_login .md](/F:/LLM/VIBE/api/QRcode_login%20.md) 当前仍为空文件
- 现阶段二维码登录实现是按上游既有 QR 登录接口做的回退接入
- 不是基于该文件的细化规范实现

## 当前验收边界

- 已完成：
  - Access Deck 登录链路真实接入
  - 本地 session 驱动的登录状态查询
  - 登出链路
  - 手机验证码登录
  - 二维码登录基础链路
  - 登录状态一致性修复
- 尚未完成：
  - 浏览器端完整回归验收
  - 登录状态搭建的最终收口
  - 日推歌曲显示

## 下一步目标

### 主目标

- 完成登录状态的搭建和整体验收
- 完成日推歌曲的显示

### 下一步执行重点

- 在浏览器内完整回归登录状态链路，确认：
  - 登录成功后状态立即可见
  - 登出后状态立即归零
  - 二维码刷新后旧二维码彻底失效
- 继续清理前后端 Access Deck 登录文案与状态提示，使其与真实链路完全一致
- 开始接入或展示日推歌曲数据，优先打通：
  - 后端日推接口能力
  - 前端 Music 页面中的日推区域显示

## CLI2 建议继续重点验证

- 浏览器里完整回归：
  - QR 登录
  - 手机验证码登录
  - Logout 后立刻查 Status
  - 刷新二维码后旧二维码是否彻底失效
- 再确认当前运行进程确实是最新的 `backend/build/Debug/vibe_backend.exe`
- 观察二维码状态卡、登录状态卡、Logout 后的 UI 是否仍存在旧状态回流
- 如后续继续接入日推歌曲，优先验证：
  - API 是否稳定返回
  - 前端是否正确显示
  - 无数据时 fallback 是否清晰
