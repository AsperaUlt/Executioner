工作栈：采用Stitch + Codex（GPT-5.4）coding

技术栈：

&#x20; \* 后端：C++17、CMake、`cpp-httplib`、`nlohmann/json`

&#x20; \* 前端：Vanilla JS SPA、HTML、Tailwind CDN、Google Fonts / Material Symbols

&#x20; \* 运行方式：本地后端监听 `http://127.0.0.1:18080`，浏览器通过同源访问页面和 API

运行方式

\## Build



cd \~\\backend\\

cmake -S . -B build

cmake --build build --config Release



\## Run

./build/Release/vibe\_backend.exe



\## Open

http://127.0.0.1:18080/

