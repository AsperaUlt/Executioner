#include "music_service.hpp"

#include <iostream>
#include <utility>

#include <httplib.h>

#include "audio_config.hpp"

namespace vibe {
namespace {

constexpr std::size_t kUpstreamBodyPreviewLimit = 240;

std::string trim_copy(std::string value) {
  const auto first = value.find_first_not_of(" \t\r\n");
  if (first == std::string::npos) {
    return "";
  }

  const auto last = value.find_last_not_of(" \t\r\n");
  return value.substr(first, last - first + 1);
}

std::string truncate_for_log(std::string value) {
  value = trim_copy(std::move(value));
  if (value.size() <= kUpstreamBodyPreviewLimit) {
    return value;
  }

  return value.substr(0, kUpstreamBodyPreviewLimit) + "...";
}

std::string url_encode_component(const std::string& value) {
  std::string encoded;
  encoded.reserve(value.size());

  for (unsigned char ch : value) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '-' ||
        ch == '_' || ch == '.' || ch == '~') {
      encoded.push_back(static_cast<char>(ch));
      continue;
    }

    static constexpr char kHex[] = "0123456789ABCDEF";
    encoded.push_back('%');
    encoded.push_back(kHex[(ch >> 4) & 0x0F]);
    encoded.push_back(kHex[ch & 0x0F]);
  }

  return encoded;
}

Json json_object_or_empty(const Json& value, const char* key) {
  if (!value.is_object()) {
    return Json::object();
  }

  const auto it = value.find(key);
  if (it == value.end() || !it->is_object()) {
    return Json::object();
  }

  return *it;
}

Json json_array_or_empty(const Json& value, const char* key) {
  if (!value.is_object()) {
    return Json::array();
  }

  const auto it = value.find(key);
  if (it == value.end() || !it->is_array()) {
    return Json::array();
  }

  return *it;
}

Json build_track_summary(const Json& track) {
  Json artists = Json::array();
  if (track.contains("artists") && track["artists"].is_array()) {
    for (const auto& artist : track["artists"]) {
      artists.push_back({{"id", artist.value("id", 0)}, {"name", artist.value("name", "Unknown Artist")}});
    }
  } else if (track.contains("ar") && track["ar"].is_array()) {
    for (const auto& artist : track["ar"]) {
      artists.push_back({{"id", artist.value("id", 0)}, {"name", artist.value("name", "Unknown Artist")}});
    }
  }

  Json album = Json{{"id", 0}, {"name", "Unknown Album"}};
  if (track.contains("album") && track["album"].is_object()) {
    album = {{"id", track["album"].value("id", 0)}, {"name", track["album"].value("name", "Unknown Album")}};
  } else if (track.contains("al") && track["al"].is_object()) {
    album = {{"id", track["al"].value("id", 0)}, {"name", track["al"].value("name", "Unknown Album")}};
  }

  std::string artistText = "Unknown Artist";
  if (!artists.empty()) {
    artistText = artists[0].value("name", "Unknown Artist");
  } else if (track.contains("artist") && track["artist"].is_string()) {
    artistText = track.value("artist", "Unknown Artist");
  }

  return {
      {"id", track.value("id", 0)},
      {"title", track.value("title", track.value("name", "Untitled Track"))},
      {"artists", artists},
      {"artistText", artistText},
      {"album", album},
      {"durationMs", track.value("durationMs", track.value("dt", track.value("duration", 0)))},
  };
}

void log_music_request(const std::string& vibeRoute,
                       const std::string& target,
                       const std::string& outcome,
                       const std::string& detail) {
  std::cout << "[music] route=" << vibeRoute << " target=" << target << " outcome=" << outcome;
  if (!detail.empty()) {
    std::cout << " detail=" << detail;
  }
  std::cout << std::endl;
}

}  // namespace

MusicService::MusicService()
    : upstreamBaseUrl_(config::kMusicUpstreamBaseUrl), timeoutMs_(config::kMusicUpstreamTimeoutMs) {}

MusicServiceResult MusicService::health() const {
  const auto upstream = request_json("/api/music/health", "/api/music/health");
  if (!upstream.ok) {
    return upstream;
  }

  MusicServiceResult result = upstream;
  result.data = normalize_health_payload(upstream.data);
  result.message = "Music service reachable";
  return result;
}

MusicServiceResult MusicService::search_tracks(const std::string& query) const {
  const auto upstream = request_json("/api/music/search", "/search?keywords=" + url_encode_component(query));
  if (!upstream.ok) {
    return upstream;
  }

  MusicServiceResult result = upstream;
  result.data = normalize_search_payload(upstream.data);
  result.message = result.data["results"].empty() ? "No tracks found" : "Search completed";
  return result;
}

MusicServiceResult MusicService::request_json(const std::string& vibeRoute, const std::string& upstreamPath) const {
  httplib::Client client(upstreamBaseUrl_);
  client.set_connection_timeout(timeoutMs_ / 1000, (timeoutMs_ % 1000) * 1000);
  client.set_read_timeout(timeoutMs_ / 1000, (timeoutMs_ % 1000) * 1000);
  client.set_write_timeout(timeoutMs_ / 1000, (timeoutMs_ % 1000) * 1000);

  const std::string target = upstreamBaseUrl_ + upstreamPath;
  const auto response = client.Get(upstreamPath.c_str(), {{"Accept", "application/json"}});
  if (!response) {
    const auto err = response.error();
    std::string error = "music_service_unavailable";
    std::string message = "Node music service is not running";
    int httpStatus = 503;

    if (err == httplib::Error::Read || err == httplib::Error::Write || err == httplib::Error::ConnectionTimeout) {
      error = "music_service_timeout";
      message = "Node music service timed out";
      httpStatus = 504;
    }

    log_music_request(vibeRoute, target, "failed", httplib::to_string(err));
    auto result = make_error(httpStatus, error, message, target);
    result.details = {
        {"upstreamError", httplib::to_string(err)},
    };
    return result;
  }

  if (response->status != 200) {
    const std::string bodyPreview = truncate_for_log(response->body);
    log_music_request(vibeRoute,
                      target,
                      "failed",
                      "upstream_status_" + std::to_string(response->status) + " body=" + bodyPreview);
    auto result = make_error(502,
                             "music_service_invalid_response",
                             "Node music service returned HTTP " + std::to_string(response->status),
                             target);
    result.details = {
        {"upstreamStatus", response->status},
        {"upstreamBodyPreview", bodyPreview},
    };
    return result;
  }

  const auto body = trim_copy(response->body);
  if (body.empty()) {
    log_music_request(vibeRoute, target, "failed", "empty_response");
    auto result = make_error(502, "music_service_empty_response", "Node music service returned an empty response", target);
    result.details = {
        {"upstreamStatus", response->status},
    };
    return result;
  }

  try {
    auto parsed = Json::parse(body);
    log_music_request(vibeRoute, target, "success", "");
    return {
        true,
        200,
        "",
        "Upstream request completed",
        target,
        std::move(parsed),
    };
  } catch (const std::exception& ex) {
    log_music_request(vibeRoute, target, "failed", "json_parse_error");
    auto result = make_error(502,
                             "music_service_invalid_response",
                             std::string("Failed to parse upstream JSON: ") + ex.what(),
                             target);
    result.details = {
        {"upstreamStatus", response->status},
        {"upstreamBodyPreview", truncate_for_log(body)},
    };
    return result;
  }
}

MusicServiceResult MusicService::make_error(int httpStatus,
                                            std::string error,
                                            std::string message,
                                            std::string source) {
  return {
      false,
      httpStatus,
      std::move(error),
      std::move(message),
      std::move(source),
      Json::object(),
  };
}

Json MusicService::normalize_health_payload(const Json& upstream) {
  return {
      {"status", upstream.value("status", upstream.value("ok", false) ? "ok" : "error")},
      {"service", upstream.value("service", "node_music_service")},
      {"managedByHost", upstream.value("managedByHost", false)},
  };
}

Json MusicService::normalize_search_payload(const Json& upstream) {
  if (upstream.contains("results") && upstream["results"].is_array()) {
    return {
        {"query", upstream.value("query", "")},
        {"results", upstream["results"]},
        {"total", upstream.value("total", static_cast<int>(upstream["results"].size()))},
    };
  }

  Json results = Json::array();
  const Json result = json_object_or_empty(upstream, "result");
  const Json songs = json_array_or_empty(result, "songs");
  for (const auto& song : songs) {
    results.push_back(build_track_summary(song));
  }

  return {
      {"query", result.value("queryCorrected", "")},
      {"results", results},
      {"total", result.value("songCount", static_cast<int>(results.size()))},
  };
}

Json to_json(const MusicServiceResult& result) {
  Json payload = {
      {"ok", result.ok},
      {"message", result.message},
      {"source", result.source},
  };

  if (result.ok) {
    payload["data"] = result.data;
  } else {
    payload["error"] = result.error;
    if (!result.details.empty()) {
      payload["details"] = result.details;
    }
  }

  return payload;
}

}  // namespace vibe
