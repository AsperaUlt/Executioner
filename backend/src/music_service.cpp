#include "music_service.hpp"

#include <algorithm>
#include <cctype>
#include <ctime>
#include <iostream>
#include <utility>
#include <vector>

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

std::string build_form_urlencoded(const Json& formData) {
  std::string body;

  for (auto it = formData.begin(); it != formData.end(); ++it) {
    if (it.value().is_null()) {
      continue;
    }

    std::string value;
    if (it.value().is_string()) {
      value = it.value().get<std::string>();
    } else if (it.value().is_boolean()) {
      value = it.value().get<bool>() ? "true" : "false";
    } else if (it.value().is_number_integer()) {
      value = std::to_string(it.value().get<long long>());
    } else if (it.value().is_number_unsigned()) {
      value = std::to_string(it.value().get<unsigned long long>());
    } else if (it.value().is_number_float()) {
      value = std::to_string(it.value().get<double>());
    } else {
      value = it.value().dump();
    }

    if (value.empty()) {
      continue;
    }

    if (!body.empty()) {
      body += '&';
    }

    body += url_encode_component(it.key());
    body += '=';
    body += url_encode_component(value);
  }

  return body;
}

std::string normalize_search_text(const std::string& value) {
  std::string normalized;
  normalized.reserve(value.size());

  bool previousWasSpace = true;
  for (unsigned char ch : value) {
    if (std::isspace(ch)) {
      if (!previousWasSpace) {
        normalized.push_back(' ');
      }
      previousWasSpace = true;
      continue;
    }

    normalized.push_back(static_cast<char>(std::tolower(ch)));
    previousWasSpace = false;
  }

  return trim_copy(std::move(normalized));
}

std::vector<std::string> split_terms(const std::string& value) {
  std::vector<std::string> terms;
  std::string current;

  for (char ch : value) {
    if (ch == ' ') {
      if (!current.empty()) {
        terms.push_back(current);
        current.clear();
      }
      continue;
    }

    current.push_back(ch);
  }

  if (!current.empty()) {
    terms.push_back(current);
  }

  return terms;
}

std::string artist_text_from_summary(const Json& track) {
  if (track.contains("artistText") && track["artistText"].is_string()) {
    return track.value("artistText", "Unknown Artist");
  }

  if (track.contains("artists") && track["artists"].is_array()) {
    std::string combined;
    for (const auto& artist : track["artists"]) {
      const std::string name = artist.value("name", "");
      if (name.empty()) {
        continue;
      }

      if (!combined.empty()) {
        combined += ' ';
      }
      combined += name;
    }

    if (!combined.empty()) {
      return combined;
    }
  }

  return "Unknown Artist";
}

std::string album_text_from_summary(const Json& track) {
  if (track.contains("album") && track["album"].is_object()) {
    return track["album"].value("name", "Unknown Album");
  }

  return "Unknown Album";
}

int score_text_match(const std::string& query, const std::string& value, int exactScore, int prefixScore, int includesScore) {
  if (query.empty() || value.empty()) {
    return 0;
  }

  if (value == query) {
    return exactScore;
  }

  if (value.rfind(query, 0) == 0) {
    return prefixScore;
  }

  if (value.find(query) != std::string::npos) {
    return includesScore;
  }

  return 0;
}

double score_track_for_query(const std::string& query, const std::vector<std::string>& queryTerms, const Json& track) {
  const std::string normalizedTitle = normalize_search_text(track.value("title", ""));
  const std::string normalizedArtist = normalize_search_text(artist_text_from_summary(track));
  const std::string normalizedAlbum = normalize_search_text(album_text_from_summary(track));

  double score = 0.0;
  score += score_text_match(query, normalizedTitle, 1400, 980, 620);
  score += score_text_match(query, normalizedArtist, 560, 380, 220);
  score += score_text_match(query, normalizedAlbum, 260, 180, 120);

  for (const auto& term : queryTerms) {
    score += score_text_match(term, normalizedTitle, 180, 120, 60);
    score += score_text_match(term, normalizedArtist, 90, 60, 35);
    score += score_text_match(term, normalizedAlbum, 50, 35, 20);
  }

  if (!normalizedTitle.empty() && normalizedTitle.size() < query.size()) {
    score -= 40;
  }

  if (normalizedTitle.size() > query.size()) {
    score -= std::min<double>(normalizedTitle.size() - query.size(), 48.0);
  }

  const int durationMs = track.value("durationMs", 0);
  if (durationMs > 0) {
    score -= std::min(durationMs / 12000.0, 18.0);
  }

  return score;
}

Json rerank_results(Json results, const std::string& query) {
  if (!results.is_array() || results.empty()) {
    return results;
  }

  const std::string normalizedQuery = normalize_search_text(query);
  if (normalizedQuery.empty()) {
    return results;
  }

  const auto queryTerms = split_terms(normalizedQuery);
  struct ScoredTrack {
    Json track;
    double score = 0.0;
    std::size_t index = 0;
  };

  std::vector<ScoredTrack> scoredTracks;
  scoredTracks.reserve(results.size());
  for (std::size_t index = 0; index < results.size(); ++index) {
    scoredTracks.push_back({results[index], score_track_for_query(normalizedQuery, queryTerms, results[index]), index});
  }

  std::stable_sort(scoredTracks.begin(), scoredTracks.end(), [](const ScoredTrack& left, const ScoredTrack& right) {
    if (left.score != right.score) {
      return left.score > right.score;
    }
    return left.index < right.index;
  });

  Json reranked = Json::array();
  for (auto& entry : scoredTracks) {
    reranked.push_back(std::move(entry.track));
  }

  return reranked;
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
  const auto upstream = request_json("/api/music/health", "/inner/version");
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
  result.data = normalize_search_payload(upstream.data, query);
  result.message = result.data["results"].empty() ? "No tracks found" : "Search completed";
  return result;
}

MusicServiceResult MusicService::lyric_by_track_id(const std::string& trackId) const {
  const auto upstream = request_json("/api/music/lyric", "/lyric?id=" + url_encode_component(trackId));
  if (!upstream.ok) {
    return upstream;
  }

  MusicServiceResult result = upstream;
  result.data = normalize_lyric_payload(upstream.data, trackId);
  result.message = result.data.value("hasLyric", false) ? "Lyric loaded" : "No lyric available";
  return result;
}

MusicServiceResult MusicService::create_qr_login_key() const {
  const auto upstream = request_json("/api/login/qr/key", "/login/qr/key?timestamp=" + url_encode_component(std::to_string(std::time(nullptr))));
  if (!upstream.ok) {
    return upstream;
  }

  MusicServiceResult result = upstream;
  const Json data = json_object_or_empty(upstream.data, "data");
  result.data = {
      {"code", upstream.data.value("code", 0)},
      {"unikey", data.value("unikey", "")},
  };
  result.message = result.data.value("unikey", "").empty() ? "QR key unavailable" : "QR key ready";
  return result;
}

MusicServiceResult MusicService::create_qr_login_image(const std::string& key) const {
  const auto upstream = request_json("/api/login/qr/create",
                                     "/login/qr/create?key=" + url_encode_component(key) + "&qrimg=true&timestamp=" +
                                         url_encode_component(std::to_string(std::time(nullptr))));
  if (!upstream.ok) {
    return upstream;
  }

  MusicServiceResult result = upstream;
  const Json data = json_object_or_empty(upstream.data, "data");
  result.data = {
      {"code", upstream.data.value("code", 0)},
      {"qrimg", data.value("qrimg", "")},
      {"qrurl", data.value("qrurl", "")},
      {"unikey", key},
  };
  result.message = result.data.value("qrimg", "").empty() ? "QR image unavailable" : "QR image ready";
  return result;
}

MusicServiceResult MusicService::check_qr_login(const std::string& key) const {
  const auto upstream = request_json("/api/login/qr/check",
                                     "/login/qr/check?key=" + url_encode_component(key) + "&timestamp=" +
                                         url_encode_component(std::to_string(std::time(nullptr))));
  if (!upstream.ok) {
    return upstream;
  }

  MusicServiceResult result = upstream;
  const int upstreamCode = upstream.data.value("code", 0);
  const std::string upstreamMessage = upstream.data.value("message", "");
  const std::string cookie = upstream.data.value("cookie", "");
  std::string statusLabel = "Waiting for scan";
  if (upstreamCode == 802) {
    statusLabel = "Waiting for confirm";
  } else if (upstreamCode == 803 || !trim_copy(cookie).empty()) {
    statusLabel = "Authorized";
  } else if (upstreamCode == 800) {
    statusLabel = "Expired";
  }

  result.data = {
      {"code", upstreamCode},
      {"message", upstreamMessage},
      {"statusLabel", statusLabel},
      {"cookie", cookie},
      {"hasCookie", !trim_copy(cookie).empty()},
      {"authorized", upstreamCode == 803 || !trim_copy(cookie).empty()},
      {"pending", upstreamCode == 801 || upstreamCode == 802},
      {"expired", upstreamCode == 800},
  };
  if (result.data.value("authorized", false)) {
    result.message = upstreamMessage.empty() ? "QR login authorized" : upstreamMessage;
  } else if (result.data.value("expired", false)) {
    result.message = upstreamMessage.empty() ? "QR code expired" : upstreamMessage;
  } else {
    result.message = upstreamMessage.empty() ? "QR login pending" : upstreamMessage;
  }
  return result;
}

MusicServiceResult MusicService::send_cellphone_login_code(const std::string& phone, const std::string& countryCode) const {
  Json formData = {
      {"phone", phone},
  };
  if (!trim_copy(countryCode).empty()) {
    formData["ctcode"] = countryCode;
  }

  const auto upstream = request_json_post_form("/api/login/cellphone/code", "/captcha/sent", formData);
  if (!upstream.ok) {
    return upstream;
  }

  MusicServiceResult result = upstream;
  result.data = {
      {"code", upstream.data.value("code", 0)},
      {"sent", upstream.data.value("code", 0) == 200},
      {"phone", phone},
  };
  result.message = result.data.value("sent", false) ? "Access code sent" : "Failed to send access code";
  return result;
}

MusicServiceResult MusicService::login_with_cellphone_code(const std::string& phone,
                                                           const std::string& captcha,
                                                           const std::string& countryCode) const {
  Json formData = {
      {"phone", phone},
      {"captcha", captcha},
  };
  if (!trim_copy(countryCode).empty()) {
    formData["countrycode"] = countryCode;
  }

  const auto upstream = request_json_post_form("/api/login/cellphone", "/login/cellphone", formData);
  if (!upstream.ok) {
    return upstream;
  }

  MusicServiceResult result = upstream;
  result.data = normalize_login_payload(upstream.data);
  result.message = result.data.value("hasCookie", false) ? "Login succeeded" : "Login completed";
  return result;
}

MusicServiceResult MusicService::login_status(const std::string& cookie) const {
  std::string path = "/login/status";
  if (!trim_copy(cookie).empty()) {
    path += "?cookie=" + url_encode_component(cookie);
  }

  const auto upstream = request_json("/api/music-account-status", path);
  if (!upstream.ok) {
    return upstream;
  }

  MusicServiceResult result = upstream;
  result.data = normalize_login_status_payload(upstream.data);
  result.message = result.data.value("loggedIn", false) ? "Login active" : "Not logged in";
  return result;
}

MusicServiceResult MusicService::logout(const std::string& cookie) const {
  std::string path = "/logout";
  if (!trim_copy(cookie).empty()) {
    path += "?cookie=" + url_encode_component(cookie);
  }

  const auto upstream = request_json("/api/logout", path);
  if (!upstream.ok) {
    return upstream;
  }

  MusicServiceResult result = upstream;
  result.data = {
      {"code", upstream.data.value("code", 0)},
      {"loggedIn", false},
  };
  result.message = "Logged out";
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

MusicServiceResult MusicService::request_json_post_form(const std::string& vibeRoute,
                                                        const std::string& upstreamPath,
                                                        const Json& formData) const {
  httplib::Client client(upstreamBaseUrl_);
  client.set_connection_timeout(timeoutMs_ / 1000, (timeoutMs_ % 1000) * 1000);
  client.set_read_timeout(timeoutMs_ / 1000, (timeoutMs_ % 1000) * 1000);
  client.set_write_timeout(timeoutMs_ / 1000, (timeoutMs_ % 1000) * 1000);

  const std::string target = upstreamBaseUrl_ + upstreamPath;
  const std::string body = build_form_urlencoded(formData);
  const auto response = client.Post(upstreamPath.c_str(),
                                    {{"Accept", "application/json"}},
                                    body,
                                    "application/x-www-form-urlencoded");
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

  const auto trimmedBody = trim_copy(response->body);
  if (trimmedBody.empty()) {
    log_music_request(vibeRoute, target, "failed", "empty_response");
    auto result = make_error(502, "music_service_empty_response", "Node music service returned an empty response", target);
    result.details = {
        {"upstreamStatus", response->status},
    };
    return result;
  }

  try {
    auto parsed = Json::parse(trimmedBody);
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
        {"upstreamBodyPreview", truncate_for_log(trimmedBody)},
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
  const Json data = json_object_or_empty(upstream, "data");
  const std::string version = data.value("version", "");

  return {
      {"status", upstream.value("status", version.empty() ? (upstream.value("ok", false) ? "ok" : "error") : "ok")},
      {"service", upstream.value("service", "node_music_service")},
      {"version", version},
      {"managedByHost", upstream.value("managedByHost", false)},
  };
}

Json MusicService::normalize_search_payload(const Json& upstream, const std::string& query) {
  if (upstream.contains("results") && upstream["results"].is_array()) {
    Json results = rerank_results(upstream["results"], query);
    return {
        {"query", upstream.value("query", query)},
        {"results", std::move(results)},
        {"total", upstream.value("total", static_cast<int>(upstream["results"].size()))},
    };
  }

  Json results = Json::array();
  const Json result = json_object_or_empty(upstream, "result");
  const Json songs = json_array_or_empty(result, "songs");
  for (const auto& song : songs) {
    results.push_back(build_track_summary(song));
  }

  results = rerank_results(std::move(results), query);
  const int total = result.value("songCount", static_cast<int>(results.size()));

  return {
      {"query", result.value("queryCorrected", query)},
      {"results", std::move(results)},
      {"total", total},
  };
}

Json MusicService::normalize_lyric_payload(const Json& upstream, const std::string& trackId) {
  const Json lrc = json_object_or_empty(upstream, "lrc");
  const Json tlyric = json_object_or_empty(upstream, "tlyric");
  const std::string lyric = lrc.value("lyric", "");
  const std::string translatedLyric = tlyric.value("lyric", "");

  return {
      {"trackId", trackId},
      {"lyric", lyric},
      {"translatedLyric", translatedLyric},
      {"hasLyric", !trim_copy(lyric).empty()},
  };
}

Json MusicService::normalize_login_payload(const Json& upstream) {
  const Json account = json_object_or_empty(upstream, "account");
  const Json profile = json_object_or_empty(upstream, "profile");
  const std::string cookie = upstream.value("cookie", "");

  return {
      {"code", upstream.value("code", 0)},
      {"accountId", account.value("id", 0)},
      {"userId", account.value("id", profile.value("userId", 0))},
      {"nickname", profile.value("nickname", "")},
      {"avatarUrl", profile.value("avatarUrl", "")},
      {"cookie", cookie},
      {"hasCookie", !trim_copy(cookie).empty()},
  };
}

Json MusicService::normalize_login_status_payload(const Json& upstream) {
  const Json data = json_object_or_empty(upstream, "data");
  const Json account = json_object_or_empty(data, "account");
  const Json profile = json_object_or_empty(data, "profile");
  const bool loggedIn = !account.empty() || !profile.empty();

  return {
      {"code", upstream.value("code", 0)},
      {"loggedIn", loggedIn},
      {"accountId", account.value("id", 0)},
      {"userId", account.value("id", profile.value("userId", 0))},
      {"nickname", profile.value("nickname", "")},
      {"avatarUrl", profile.value("avatarUrl", "")},
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
