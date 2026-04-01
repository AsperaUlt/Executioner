#include "api_models.hpp"

namespace vibe {

ApiPayload build_payload() {
  ApiPayload payload{};

  payload.summary = {
      {"greeting", "Good Evening, Elias"},
      {"focusScore", 88},
      {"focusMinutes", 42},
      {"tasksClosed", 248},
  };

  payload.stats = {
      {"taskEfficiency", 76},
      {"deepWorkHours", Json::array({1.2, 2.8, 1.9, 3.4, 2.6, 2.1, 3.0})},
      {"insights",
       Json::array({
           {{"title", "Morning Momentum"},
            {"value", "08:00-10:30"},
            {"delta", "+12%"},
            {"icon", "insights"}},
           {{"title", "Audio Influence"},
            {"value", "Lo-Fi Focus boosts speed"},
            {"delta", "+14%"},
            {"icon", "music_note"}},
           {{"title", "Friday Slump"},
            {"value", "Efficiency dips at end week"},
            {"delta", "-20%"},
            {"icon", "trending_down"}},
       })},
  };

  payload.tasks = Json::array({
      {{"id", "t1"}, {"title", "Design Sync"}, {"status", "done"}, {"eta", "09:00"}},
      {{"id", "t2"}, {"title", "Build API"}, {"status", "in_progress"}, {"eta", "11:30"}},
      {{"id", "t3"}, {"title", "Validation Pass"}, {"status", "todo"}, {"eta", "15:20"}},
  });

  payload.musicQueue = {
      {"current", {{"title", "Deep Focus Radio"}, {"artist", "Luminous Soundscapes"}, {"progress", 0.65}}},
      {"queue",
       Json::array({
           {{"id", "m1"}, {"title", "Lo-fi Dreams"}, {"duration", "03:26"}},
           {{"id", "m2"}, {"title", "Midnight Pulse"}, {"duration", "04:08"}},
           {{"id", "m3"}, {"title", "Northern Lights"}, {"duration", "03:42"}},
       })},
  };

  return payload;
}

Json make_health_payload() {
  return {
      {"status", "ok"},
      {"service", "vibe_backend"},
  };
}

}  // namespace vibe
