#pragma once

#include <string>

#include <nlohmann/json.hpp>

namespace vibe {

using Json = nlohmann::json;

struct AudioServiceResult {
  bool ok = false;
  int httpStatus = 500;
  std::string error;
  std::string message;
  std::string source = "vibe_audio_service";
  Json data = Json::object();
};

class AudioService {
 public:
  AudioService();

  AudioServiceResult search_tracks(const std::string& query) const;
  AudioServiceResult get_track(const std::string& trackId) const;
  AudioServiceResult get_track_url(const std::string& trackId) const;
  AudioServiceResult get_lyric(const std::string& trackId) const;

 private:
  AudioServiceResult request_json(const std::string& vibeRoute, const std::string& upstreamPath) const;
  static AudioServiceResult make_error(int httpStatus,
                                       std::string error,
                                       std::string message,
                                       std::string source = "vibe_audio_service");
  static Json normalize_search_payload(const Json& upstream);
  static Json normalize_track_payload(const Json& upstream);
  static Json normalize_url_payload(const Json& upstream);
  static Json normalize_lyric_payload(const Json& upstream);

  std::string upstreamBaseUrl_;
  int timeoutMs_;
};

Json to_json(const AudioServiceResult& result);

}  // namespace vibe
