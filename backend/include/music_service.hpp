#pragma once

#include <string>

#include <nlohmann/json.hpp>

namespace vibe {

using Json = nlohmann::json;

struct MusicServiceResult {
  bool ok = false;
  int httpStatus = 500;
  std::string error;
  std::string message;
  std::string source = "vibe_music_service";
  Json data = Json::object();
  Json details = Json::object();
};

class MusicService {
 public:
  MusicService();

  MusicServiceResult health() const;
  MusicServiceResult search_tracks(const std::string& query) const;

 private:
  MusicServiceResult request_json(const std::string& vibeRoute, const std::string& upstreamPath) const;
  static MusicServiceResult make_error(int httpStatus,
                                       std::string error,
                                       std::string message,
                                       std::string source = "vibe_music_service");
  static Json normalize_health_payload(const Json& upstream);
  static Json normalize_search_payload(const Json& upstream);

  std::string upstreamBaseUrl_;
  int timeoutMs_;
};

Json to_json(const MusicServiceResult& result);

}  // namespace vibe
