#pragma once

#include <string>

namespace vibe {

struct MusicServiceHostPlan {
  bool autoLaunchEnabled = false;
  std::string serviceName = "vibe_music_node";
  std::string upstreamBaseUrl;
  std::string launchCommand;
};

class MusicServiceHost {
 public:
  MusicServiceHost();

  const MusicServiceHostPlan& plan() const;
  void log_startup_plan() const;

 private:
  MusicServiceHostPlan plan_;
};

}  // namespace vibe
