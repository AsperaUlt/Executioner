#include "music_service_host.hpp"

#include <iostream>

#include "audio_config.hpp"

namespace vibe {

MusicServiceHost::MusicServiceHost() {
  plan_.upstreamBaseUrl = config::kMusicUpstreamBaseUrl;
  plan_.launchCommand = "reserved_for_main_program";
}

const MusicServiceHostPlan& MusicServiceHost::plan() const {
  return plan_;
}

void MusicServiceHost::log_startup_plan() const {
  std::cout << "[music-host] upstream=" << plan_.upstreamBaseUrl << std::endl;
  std::cout << "[music-host] auto-launch-enabled=" << (plan_.autoLaunchEnabled ? "true" : "false") << std::endl;
  std::cout << "[music-host] launch-command=" << plan_.launchCommand << std::endl;
}

}  // namespace vibe
