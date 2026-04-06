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
  MusicServiceResult lyric_by_track_id(const std::string& trackId) const;
  MusicServiceResult create_qr_login_key() const;
  MusicServiceResult create_qr_login_image(const std::string& key) const;
  MusicServiceResult check_qr_login(const std::string& key) const;
  MusicServiceResult send_cellphone_login_code(const std::string& phone, const std::string& countryCode = "") const;
  MusicServiceResult login_with_cellphone_code(const std::string& phone,
                                               const std::string& captcha,
                                               const std::string& countryCode = "") const;
  MusicServiceResult login_status(const std::string& cookie = "") const;
  MusicServiceResult logout(const std::string& cookie = "") const;

 private:
  MusicServiceResult request_json(const std::string& vibeRoute, const std::string& upstreamPath) const;
  MusicServiceResult request_json_post_form(const std::string& vibeRoute,
                                            const std::string& upstreamPath,
                                            const Json& formData) const;
  static MusicServiceResult make_error(int httpStatus,
                                       std::string error,
                                       std::string message,
                                       std::string source = "vibe_music_service");
  static Json normalize_health_payload(const Json& upstream);
  static Json normalize_search_payload(const Json& upstream, const std::string& query);
  static Json normalize_lyric_payload(const Json& upstream, const std::string& trackId);
  static Json normalize_login_payload(const Json& upstream);
  static Json normalize_login_status_payload(const Json& upstream);

  std::string upstreamBaseUrl_;
  int timeoutMs_;
};

Json to_json(const MusicServiceResult& result);

}  // namespace vibe
