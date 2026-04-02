#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <optional>
#include <string>

#include <httplib.h>

#include "music_service_host.hpp"
#include "router.hpp"

namespace {

namespace fs = std::filesystem;

std::optional<fs::path> find_project_root(const fs::path& start) {
  std::error_code ec;
  fs::path current = fs::weakly_canonical(start, ec);
  if (ec) {
    current = fs::absolute(start, ec);
    if (ec) {
      current = start;
    }
  }

  while (!current.empty()) {
    const fs::path frontendDir = current / "frontend";
    const fs::path frontendIndex = frontendDir / "index_v2.html";
    const fs::path apiScript = frontendDir / "js" / "api.js";

    if (fs::exists(frontendDir) && fs::exists(frontendIndex) && fs::exists(apiScript)) {
      return current;
    }

    const fs::path parent = current.parent_path();
    if (parent == current) {
      break;
    }
    current = parent;
  }

  return std::nullopt;
}

std::optional<fs::path> resolve_frontend_dir(const char* argv0) {
  const auto cwdRoot = find_project_root(fs::current_path());
  if (cwdRoot) {
    return *cwdRoot / "frontend";
  }

  if (argv0 != nullptr && std::string(argv0).size() > 0) {
    const fs::path exeProbe = fs::path(argv0).parent_path();
    const auto exeRoot = find_project_root(exeProbe);
    if (exeRoot) {
      return *exeRoot / "frontend";
    }
  }

  return std::nullopt;
}

bool serve_file(const fs::path& filePath, httplib::Response& res) {
  std::ifstream stream(filePath, std::ios::binary);
  if (!stream) {
    res.status = 404;
    res.set_content("Not Found", "text/plain; charset=utf-8");
    return false;
  }

  const std::string body((std::istreambuf_iterator<char>(stream)), std::istreambuf_iterator<char>());
  res.set_content(body, "text/html; charset=utf-8");
  return true;
}

}  // namespace

int main(int argc, char** argv) {
  std::cout << "[startup] initializing server" << std::endl;
  httplib::Server server;
  const vibe::MusicServiceHost musicServiceHost;
  musicServiceHost.log_startup_plan();
  vibe::register_routes(server);
  std::cout << "[startup] API routes registered" << std::endl;

  const auto frontendDir = resolve_frontend_dir(argc > 0 ? argv[0] : nullptr);
  std::cout << "[startup] frontend directory probe: "
            << (frontendDir ? frontendDir->string() : std::string("<not found>")) << std::endl;
  const bool mountedFrontend = frontendDir ? server.set_mount_point("/", frontendDir->string()) : false;
  std::cout << "[startup] static mount success: " << (mountedFrontend ? "true" : "false") << std::endl;

  server.Get("/", [frontendDir](const httplib::Request&, httplib::Response& res) {
    if (!frontendDir) {
      res.status = 500;
      res.set_content("frontend directory not found", "text/plain; charset=utf-8");
      return;
    }

    serve_file(*frontendDir / "index_v2.html", res);
  });

  server.Get("/index_v2.html", [frontendDir](const httplib::Request&, httplib::Response& res) {
    if (!frontendDir) {
      res.status = 500;
      res.set_content("frontend directory not found", "text/plain; charset=utf-8");
      return;
    }

    serve_file(*frontendDir / "index_v2.html", res);
  });

  constexpr int kPort = 18080;
  std::cout << "VIBE backend listening on http://127.0.0.1:" << kPort << std::endl;
  std::cout << "Static resource directory: "
            << (frontendDir ? frontendDir->string() : std::string("<not found>")) << std::endl;
  std::cout << "Static mount success: " << (mountedFrontend ? "true" : "false") << std::endl;
  std::cout << "Suggested URL: http://127.0.0.1:" << kPort << "/" << std::endl;
  const bool listening = server.listen("127.0.0.1", kPort);
  std::cout << "[startup] listen returned: " << (listening ? "true" : "false") << std::endl;
  return 0;
}
