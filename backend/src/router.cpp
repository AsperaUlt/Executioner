#include "router.hpp"

#include "api_models.hpp"
#include "audio_service.hpp"

namespace vibe {
namespace {

void add_common_headers(httplib::Response& res) {
  res.set_header("Access-Control-Allow-Origin", "*");
  res.set_header("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set_header("Access-Control-Allow-Headers", "Content-Type");
  res.set_header("Cache-Control", "no-store");
}

void write_json(httplib::Response& res, const Json& body) {
  add_common_headers(res);
  res.set_content(body.dump(), "application/json; charset=utf-8");
}

void write_api_result(httplib::Response& res, const AudioServiceResult& result) {
  add_common_headers(res);
  res.status = result.httpStatus;
  res.set_content(to_json(result).dump(), "application/json; charset=utf-8");
}

AudioServiceResult missing_parameter(const std::string& parameterName) {
  return {
      false,
      400,
      "missing_parameter",
      "Missing required query parameter: " + parameterName,
      "vibe_audio_route",
      Json::object(),
  };
}

}  // namespace

void register_routes(httplib::Server& server) {
  server.Options(R"(.*)", [](const httplib::Request&, httplib::Response& res) {
    add_common_headers(res);
    res.status = 204;
  });

  const ApiPayload payload = build_payload();
  const AudioService audioService;

  server.Get("/api/health", [](const httplib::Request&, httplib::Response& res) {
    write_json(res, make_health_payload());
  });

  server.Get("/api/dashboard/summary", [payload](const httplib::Request&, httplib::Response& res) {
    write_json(res, payload.summary);
  });

  server.Get("/api/stats", [payload](const httplib::Request&, httplib::Response& res) {
    write_json(res, payload.stats);
  });

  server.Get("/api/tasks", [payload](const httplib::Request&, httplib::Response& res) {
    write_json(res, payload.tasks);
  });

  server.Get("/api/music/queue", [payload](const httplib::Request&, httplib::Response& res) {
    write_json(res, payload.musicQueue);
  });

  server.Get("/api/audio/search", [audioService](const httplib::Request& req, httplib::Response& res) {
    if (!req.has_param("q")) {
      write_api_result(res, missing_parameter("q"));
      return;
    }

    const auto query = req.get_param_value("q");
    if (query.empty()) {
      write_api_result(res, missing_parameter("q"));
      return;
    }

    write_api_result(res, audioService.search_tracks(query));
  });

  server.Get("/api/audio/track", [audioService](const httplib::Request& req, httplib::Response& res) {
    if (!req.has_param("id") || req.get_param_value("id").empty()) {
      write_api_result(res, missing_parameter("id"));
      return;
    }

    write_api_result(res, audioService.get_track(req.get_param_value("id")));
  });

  server.Get("/api/audio/url", [audioService](const httplib::Request& req, httplib::Response& res) {
    if (!req.has_param("id") || req.get_param_value("id").empty()) {
      write_api_result(res, missing_parameter("id"));
      return;
    }

    write_api_result(res, audioService.get_track_url(req.get_param_value("id")));
  });

  server.Get("/api/audio/lyric", [audioService](const httplib::Request& req, httplib::Response& res) {
    if (!req.has_param("id") || req.get_param_value("id").empty()) {
      write_api_result(res, missing_parameter("id"));
      return;
    }

    write_api_result(res, audioService.get_lyric(req.get_param_value("id")));
  });
}

}  // namespace vibe
