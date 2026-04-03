#include "api_models.hpp"

namespace vibe {

ApiPayload build_payload() {
  ApiPayload payload{};

  payload.summary = {
      {"greeting", "Good Evening, Elias"},
      {"focusScore", 88},
      {"songsPlayed", 128},
      {"focusMinutes", 42},
      {"tasksCompleted", 248},
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
           {{"title", "Music Influence"},
            {"value", "Lo-Fi Focus boosts speed"},
            {"delta", "+14%"},
            {"icon", "music_note"}},
           {{"title", "Friday Slump"},
            {"value", "Efficiency dips at end week"},
            {"delta", "-20%"},
            {"icon", "trending_down"}},
       })},
  };

  payload.accessDeck = {
      {"items",
       Json::array({
           {{"id", "login"},
            {"title", "Login"},
            {"label", "Login"},
            {"href", "#login"},
            {"description", "Open the login entry point"},
            {"icon", "account_circle"},
            {"variant", "primary"},
            {"enabled", true}},
           {{"id", "help"},
            {"title", "Help"},
            {"label", "Help"},
            {"href", "#help"},
            {"description", "Open the help entry point"},
            {"icon", "help"},
            {"variant", "secondary"},
            {"enabled", true}},
       })},
  };

  payload.tasks = Json::array({
      {{"id", "t1"}, {"title", "Design Sync"}, {"status", "done"}, {"eta", "09:00"}},
      {{"id", "t2"}, {"title", "Build API"}, {"status", "in_progress"}, {"eta", "11:30"}},
      {{"id", "t3"}, {"title", "Validation Pass"}, {"status", "todo"}, {"eta", "15:20"}},
  });

  payload.taskStream = {
      {"items",
       Json::array({
           {{"id", "t2"},
            {"title", "Build API"},
            {"status", "in_progress"},
            {"streamState", "current"},
            {"eta", "11:30"}},
           {{"id", "t3"},
            {"title", "Validation Pass"},
            {"status", "todo"},
            {"streamState", "next"},
            {"eta", "15:20"}},
           {{"id", "t4"},
            {"title", "Release Notes"},
            {"status", "todo"},
            {"streamState", "queued"},
            {"eta", "16:40"}},
           {{"id", "t1"},
            {"title", "Design Sync"},
            {"status", "done"},
            {"streamState", "completed"},
            {"eta", "09:00"}},
       })},
  };

  payload.quickAccess = {
      {"items",
       Json::array({
           {{"id", "f1"},
            {"title", "Sprint Notes"},
            {"path", "E:/LLM/VIBE/notes/sprint-notes.md"},
            {"type", "markdown"},
            {"lastAccessed", "2026-04-01T21:30:00"},
            {"canOpen", true}},
           {{"id", "f2"},
            {"title", "Roadmap"},
            {"path", "E:/LLM/VIBE/docs/roadmap.pdf"},
            {"type", "pdf"},
            {"lastAccessed", "2026-04-01T20:10:00"},
            {"canOpen", true}},
           {{"id", "f3"},
            {"title", "Music Checklist"},
            {"path", "E:/LLM/VIBE/checklists/audio-checklist.txt"},
            {"type", "text"},
            {"lastAccessed", "2026-04-01T18:45:00"},
            {"canOpen", false}},
       })},
  };

  payload.musicSnapshot = {
      {"currentTrack",
       {{"id", "m0"},
        {"title", "Deep Focus Radio"},
        {"artist", "Luminous Soundscapes"},
        {"album", "Night Shift"},
        {"progress", 0.65},
        {"status", "playing"}}},
      {"queueDepth", 3},
      {"upNext",
       Json::array({
           {{"id", "m1"}, {"title", "Lo-fi Dreams"}, {"artist", "Astra Vale"}, {"duration", "03:26"}},
           {{"id", "m2"}, {"title", "Midnight Pulse"}, {"artist", "Kite Echo"}, {"duration", "04:08"}},
           {{"id", "m3"}, {"title", "Northern Lights"}, {"artist", "Polar Static"}, {"duration", "03:42"}},
       })},
  };

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
