# 工作栈

* 采用 **Stitch + Codex（GPT-5.4）** 进行 coding

### 技术栈

### 后端

* C++17
* CMake
* `cpp-httplib`
* `nlohmann/json`

# 前端

* Vanilla JS SPA
* HTML
* Tailwind CDN
* Google Fonts / Material Symbols

# 运行方式

* 本地后端监听：`http://127.0.0.1:18080`
* 浏览器通过同源访问页面和 API

# Build

```bash
cd \\\~/backend/
cmake -S . -B build
cmake --build build --config Release


