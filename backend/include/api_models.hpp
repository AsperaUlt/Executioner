#pragma once

#include <nlohmann/json.hpp>

namespace vibe {

using Json = nlohmann::json;

struct ApiPayload {
  Json summary;
  Json stats;
  Json tasks;
  Json taskStream;
  Json quickAccess;
  Json musicSnapshot;
  Json musicQueue;
};

ApiPayload build_payload();
Json make_health_payload();

}  // namespace vibe
