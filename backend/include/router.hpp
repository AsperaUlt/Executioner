#pragma once

#include <httplib.h>

namespace vibe {

void register_routes(httplib::Server& server);

}  // namespace vibe
