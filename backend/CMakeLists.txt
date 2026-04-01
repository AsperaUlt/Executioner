cmake_minimum_required(VERSION 3.20)
project(vibe_backend LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include(FetchContent)

FetchContent_Declare(
  cpp_httplib
  GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
  GIT_TAG v0.16.3
)

FetchContent_Declare(
  nlohmann_json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG v3.11.3
)

FetchContent_MakeAvailable(cpp_httplib nlohmann_json)

add_executable(
  vibe_backend
  src/main.cpp
  src/audio_service.cpp
  src/router.cpp
  src/data_provider.cpp
)

target_include_directories(vibe_backend PRIVATE include)
target_link_libraries(vibe_backend PRIVATE httplib::httplib nlohmann_json::nlohmann_json)
