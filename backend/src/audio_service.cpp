#include "audio_service.hpp"

#include <iostream>
#include <utility>

#include <httplib.h>

#include "audio_config.hpp"

namespace vibe {
namespace {

std::string trim_copy(std::string value) {
  const auto first = value.find_first_not_of(" \t\r\n");
  if (first == std::string::npos) {
    return "";
  }

  const auto last = value.find_last_not_of(" \t\r\n");
  return value.substr(first, last - first + 1);
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

std::string json_string(const Json& value, const char* key, const std::string& fallback = "") {
  if (!value.is_object()) {
    return fallback;
  }

  const auto it = value.find(key);
  if (it == value.end() || !it->is_string()) {
    return fallback;
  }

  return it->get<std::string>();
}

int json_int(const Json& value, const char* key, int fallback = 0) {
  if (!value.is_object()) {
    return fallback;
  }

  const auto it = value.find(key);
  if (it == value.end() || !it->is_number_integer()) {
    return fallback;
  }

  return it->get<int>();
}

Json build_track_summary(const Json& track) {
  Json artists = Json::array();
  if (track.contains("ar") && track["ar"].is_array()) {
    for (const auto& artist : track["ar"]) {
      artists.push_back({{"id", artist.value("id", 0)}, {"name", artist.value("name", "Unknown Artist")}});
    }
  } else if (track.contains("artists") && track["artists"].is_array()) {
    for (const auto& artist : track["artists"]) {
      artists.push_back({{"id", artist.value("id", 0)}, {"name", artist.value("name", "Unknown Artist")}});
    }
  }

  const Json album = track.contains("al")
                         ? Json{{"id", track["al"].value("id", 0)}, {"name", track["al"].value("name", "Unknown Album")}}
                         : (track.contains("album")
                                ? Json{{"id", track["album"].value("id", 0)},
                                       {"name", track["album"].value("name", "Unknown Album")}}
                                : Json{{"id", 0}, {"name", "Unknown Album"}});

  return {
      {"id", track.value("id", 0)},
      {"title", track.value("name", "Untitled Track")},
      {"artists", artists},
      {"artistText", artists.empty() ? "Unknown Artist" : artists[0].value("name", "Unknown Artist")},
      {"album", album},
      {"durationMs", track.value("dt", track.value("duration", 0))},
  };
}

void log_audio_request(const std::string& vibeRoute,
                       const std::string& target,
                       const std::string& outcome,
                       const std::string& detail) {
  std::cout << "[audio] route=" << vibeRoute << " target=" << target << " outcome=" << outcome;
  if (!detail.empty()) {
    std::cout << " detail=" << detail;
  }
  std::cout << std::endl;
}

}  // namespace

AudioService::AudioService()
    : upstreamBaseUrl_(config::kMusicUpstreamBaseUrl), timeoutMs_(config::kMusicUpstreamTimeoutMs) {}

AudioServiceResult AudioService::search_tracks(const std::string& query) const {
  const auto upstream = request_json("/api/audio/search", "/cloudsearch?keywords=" + url_encode_component(query) + "&limit=10");
  if (!upstream.ok) {
    return upstream;
  }

  AudioServiceResult result = upstream;
  result.data = normalize_search_payload(upstream.data);
  result.message = result.data["results"].empty() ? "No tracks found" : "Search completed";
  return result;
}

AudioServiceResult AudioService::get_track(const std::string& trackId) const {
  const auto upstream = request_json("/api/audio/track", "/song/detail?ids=" + url_encode_component(trackId));
  if (!upstream.ok) {
    return upstream;
  }

  AudioServiceResult result = upstream;
  result.data = normalize_track_payload(upstream.data);
  result.message = "Track details loaded";
  return result;
}

AudioServiceResult AudioService::get_track_url(const std::string& trackId) const {
  auto upstream = request_json("/api/audio/url", "/song/url/v1?id=" + url_encode_component(trackId) + "&level=standard");
  if (!upstream.ok && upstream.httpStatus == 502) {
    upstream = request_json("/api/audio/url", "/song/url?id=" + url_encode_component(trackId));
  }
  if (!upstream.ok) {
    return upstream;
  }

  AudioServiceResult result = upstream;
  result.data = normalize_url_payload(upstream.data);
  result.message = result.data.value("url", "").empty() ? "Track URL is unavailable" : "Track URL loaded";
  if (result.data.value("url", "").empty()) {
    result.ok = false;
    result.httpStatus = 502;
    result.error = "track_url_unavailable";
  }
  return result;
}

AudioServiceResult AudioService::get_lyric(const std::string& trackId) const {
  const auto upstream = request_json("/api/audio/lyric", "/lyric?id=" + url_encode_component(trackId));
  if (!upstream.ok) {
    return upstream;
  }

  AudioServiceResult result = upstream;
  result.data = normalize_lyric_payload(upstream.data);
  result.message = result.data.value("text", "").empty() ? "No lyric available" : "Lyric loaded";
  return result;
}

AudioServiceResult AudioService::request_json(const std::string& vibeRoute, const std::string& upstreamPath) const {
  httplib::Client client(upstreamBaseUrl_);
  client.set_connection_timeout(timeoutMs_ / 1000, (timeoutMs_ % 1000) * 1000);
  client.set_read_timeout(timeoutMs_ / 1000, (timeoutMs_ % 1000) * 1000);
  client.set_write_timeout(timeoutMs_ / 1000, (timeoutMs_ % 1000) * 1000);

  const std::string target = upstreamBaseUrl_ + upstreamPath;
  const auto response = client.Get(upstreamPath.c_str(), {{"Accept", "application/json"}});
  if (!response) {
    const auto err = response.error();
    std::string error = "music_backend_unavailable";
    std::string message = "Upstream music service is not running";
    int httpStatus = 503;

    if (err == httplib::Error::Read || err == httplib::Error::Write || err == httplib::Error::ConnectionTimeout) {
      error = "music_backend_timeout";
      message = "Upstream music service timed out";
      httpStatus = 504;
    }

    log_audio_request(vibeRoute, target, "failed", httplib::to_string(err));
    return make_error(httpStatus, error, message, target);
  }

  if (response->status != 200) {
    log_audio_request(vibeRoute, target, "failed", "upstream_status_" + std::to_string(response->status));
    return make_error(502, "music_backend_invalid_response", "Upstream music service returned a non-200 response", target);
  }

  const auto body = trim_copy(response->body);
  if (body.empty()) {
    log_audio_request(vibeRoute, target, "failed", "empty_response");
    return make_error(502, "music_backend_empty_response", "Upstream music service returned an empty response", target);
  }

  try {
    auto parsed = Json::parse(body);
    log_audio_request(vibeRoute, target, "success", "");
    return {
        true,
        200,
        "",
        "Upstream request completed",
        target,
        std::move(parsed),
    };
  } catch (const std::exception& ex) {
    log_audio_request(vibeRoute, target, "failed", "json_parse_error");
    return make_error(502, "music_backend_invalid_response", std::string("Failed to parse upstream JSON: ") + ex.what(), target);
  }
}

AudioServiceResult AudioService::make_error(int httpStatus,
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

Json AudioService::normalize_search_payload(const Json& upstream) {
  Json results = Json::array();
  if (upstream.contains("result") && upstream["result"].is_object()) {
    const auto& result = upstream["result"];
    if (result.contains("songs") && result["songs"].is_array()) {
      for (const auto& song : result["songs"]) {
        results.push_back(build_track_summary(song));
      }
    }
  }

  return {
      {"query", upstream.contains("result") ? upstream["result"].value("queryCorrected", "") : ""},
      {"results", results},
      {"total", upstream.contains("result") ? upstream["result"].value("songCount", static_cast<int>(results.size()))
                                            : static_cast<int>(results.size())},
  };
}

Json AudioService::normalize_track_payload(const Json& upstream) {
  if (upstream.contains("songs") && upstream["songs"].is_array() && !upstream["songs"].empty()) {
    return build_track_summary(upstream["songs"][0]);
  }

  return Json::object();
}

Json AudioService::normalize_url_payload(const Json& upstream) {
  if (!upstream.contains("data") || !upstream["data"].is_array() || upstream["data"].empty()) {
    return Json{{"id", 0}, {"url", ""}, {"br", 0}, {"type", ""}};
  }

  const auto& item = upstream["data"][0];
  return {
      {"id", item.value("id", 0)},
      {"url", json_string(item, "url")},
      {"br", json_int(item, "br")},
      {"type", json_string(item, "type")},
  };
}

Json AudioService::normalize_lyric_payload(const Json& upstream) {
  std::string lyricText;
  if (upstream.contains("lrc") && upstream["lrc"].is_object()) {
    lyricText = upstream["lrc"].value("lyric", "");
  }

  return {
      {"text", lyricText},
      {"hasLyric", !lyricText.empty()},
  };
}

Json to_json(const AudioServiceResult& result) {
  Json payload = {
      {"ok", result.ok},
      {"message", result.message},
      {"source", result.source},
  };

  if (result.ok) {
    payload["data"] = result.data;
  } else {
    payload["error"] = result.error;
  }

  return payload;
}

}  // namespace vibe
