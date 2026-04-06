#include "router.hpp"

#include <algorithm>
#include <cctype>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

#include "api_models.hpp"
#include "music_service.hpp"

namespace vibe {
namespace {

constexpr const char* kMusicSessionCookieName = "vibe_music_session";

struct TaskRecord {
  std::string id;
  std::string title;
  std::string status;
  std::string eta;
};

class TaskStore {
 public:
  TaskStore()
      : tasks_({
            {"t1", "Design Sync", "done", "09:00"},
            {"t2", "Build API", "in_progress", "11:30"},
            {"t3", "Validation Pass", "todo", "15:20"},
        }),
        nextId_(4) {}

  Json list_tasks() const {
    std::lock_guard<std::mutex> lock(mutex_);

    Json items = Json::array();
    append_filtered(items, "in_progress");
    append_filtered(items, "todo");
    append_filtered(items, "done");
    return items;
  }

  Json current_task() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return find_first_by_status("in_progress");
  }

  Json next_task() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return find_first_by_status("todo");
  }

  Json completed_tasks() const {
    std::lock_guard<std::mutex> lock(mutex_);

    Json items = Json::array();
    for (auto it = tasks_.rbegin(); it != tasks_.rend(); ++it) {
      if (it->status == "done") {
        items.push_back(to_json(*it));
      }
    }

    return {{"items", items}};
  }

  Json task_stream() const {
    std::lock_guard<std::mutex> lock(mutex_);

    Json items = Json::array();
    const auto currentIt =
        std::find_if(tasks_.begin(), tasks_.end(), [](const TaskRecord& task) { return task.status == "in_progress"; });
    if (currentIt != tasks_.end()) {
      items.push_back(to_stream_json(*currentIt, "current"));
    }

    bool nextAssigned = false;
    for (const auto& task : tasks_) {
      if (task.status != "todo") {
        continue;
      }

      items.push_back(to_stream_json(task, nextAssigned ? "queued" : "next"));
      nextAssigned = true;
    }

    auto completedIt =
        std::find_if(tasks_.rbegin(), tasks_.rend(), [](const TaskRecord& task) { return task.status == "done"; });
    if (completedIt != tasks_.rend()) {
      items.push_back(to_stream_json(*completedIt, "completed"));
    }

    return {{"items", items}};
  }

  Json create_task(const Json& body, std::string& errorMessage) {
    const std::string title = body.value("title", "");
    if (title.empty()) {
      errorMessage = "Task title is required.";
      return Json();
    }

    std::lock_guard<std::mutex> lock(mutex_);

    TaskRecord task;
    task.id = "t" + std::to_string(nextId_++);
    task.title = title;
    task.status = has_current_task_unsafe() ? "todo" : "in_progress";
    task.eta = body.value("eta", default_eta_unsafe());
    tasks_.push_back(task);
    return to_json(task);
  }

  Json complete_task(const std::string& taskId, std::string& errorMessage) {
    std::lock_guard<std::mutex> lock(mutex_);

    auto it = std::find_if(tasks_.begin(), tasks_.end(), [&taskId](const TaskRecord& task) { return task.id == taskId; });
    if (it == tasks_.end()) {
      errorMessage = "Task not found.";
      return Json();
    }

    if (it->status == "done") {
      errorMessage = "Task is already completed.";
      return Json();
    }

    it->status = "done";
    if (!has_current_task_unsafe()) {
      auto nextIt =
          std::find_if(tasks_.begin(), tasks_.end(), [](const TaskRecord& task) { return task.status == "todo"; });
      if (nextIt != tasks_.end()) {
        nextIt->status = "in_progress";
      }
    }

    return to_json(*it);
  }

 private:
  static Json to_json(const TaskRecord& task) {
    return {
        {"id", task.id},
        {"title", task.title},
        {"status", task.status},
        {"eta", task.eta},
    };
  }

  static Json to_stream_json(const TaskRecord& task, const std::string& streamState) {
    return {
        {"id", task.id},
        {"title", task.title},
        {"status", task.status},
        {"streamState", streamState},
        {"eta", task.eta},
    };
  }

  void append_filtered(Json& items, const std::string& status) const {
    for (const auto& task : tasks_) {
      if (task.status == status) {
        items.push_back(to_json(task));
      }
    }
  }

  Json find_first_by_status(const std::string& status) const {
    const auto it =
        std::find_if(tasks_.begin(), tasks_.end(), [&status](const TaskRecord& task) { return task.status == status; });
    return it == tasks_.end() ? Json(nullptr) : to_json(*it);
  }

  bool has_current_task_unsafe() const {
    return std::any_of(tasks_.begin(), tasks_.end(), [](const TaskRecord& task) { return task.status == "in_progress"; });
  }

  std::string default_eta_unsafe() const {
    static const std::vector<std::string> kEtas = {"10:15", "12:40", "14:10", "16:30", "18:00"};
    return kEtas[(nextId_ - 1) % kEtas.size()];
  }

  mutable std::mutex mutex_;
  std::vector<TaskRecord> tasks_;
  int nextId_;
};

void add_common_headers(httplib::Response& res) {
  res.set_header("Access-Control-Allow-Origin", "*");
  res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set_header("Access-Control-Allow-Headers", "Content-Type");
  res.set_header("Cache-Control", "no-store");
}

void write_json(httplib::Response& res, const Json& body, int status = 200) {
  add_common_headers(res);
  res.status = status;
  res.set_content(body.dump(), "application/json; charset=utf-8");
}

void write_api_result(httplib::Response& res, const MusicServiceResult& result) {
  add_common_headers(res);
  res.status = result.httpStatus;
  res.set_content(to_json(result).dump(), "application/json; charset=utf-8");
}

std::string trim_copy(std::string value) {
  const auto first = value.find_first_not_of(" \t\r\n");
  if (first == std::string::npos) {
    return "";
  }

  const auto last = value.find_last_not_of(" \t\r\n");
  return value.substr(first, last - first + 1);
}

std::string url_encode_component(const std::string& value) {
  std::string encoded;
  encoded.reserve(value.size());

  for (unsigned char ch : value) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '-' ||
        ch == '_' || ch == '.' || ch == '~') {
      encoded.push_back(static_cast<char>(ch));
      continue;
    }

    static constexpr char kHex[] = "0123456789ABCDEF";
    encoded.push_back('%');
    encoded.push_back(kHex[(ch >> 4) & 0x0F]);
    encoded.push_back(kHex[ch & 0x0F]);
  }

  return encoded;
}

int decode_hex_digit(char ch) {
  if (ch >= '0' && ch <= '9') {
    return ch - '0';
  }
  ch = static_cast<char>(std::tolower(static_cast<unsigned char>(ch)));
  if (ch >= 'a' && ch <= 'f') {
    return 10 + (ch - 'a');
  }
  return -1;
}

std::string url_decode_component(const std::string& value) {
  std::string decoded;
  decoded.reserve(value.size());

  for (std::size_t index = 0; index < value.size(); ++index) {
    const char ch = value[index];
    if (ch == '%' && index + 2 < value.size()) {
      const int high = decode_hex_digit(value[index + 1]);
      const int low = decode_hex_digit(value[index + 2]);
      if (high >= 0 && low >= 0) {
        decoded.push_back(static_cast<char>((high << 4) | low));
        index += 2;
        continue;
      }
    }

    if (ch == '+') {
      decoded.push_back(' ');
      continue;
    }

    decoded.push_back(ch);
  }

  return decoded;
}

std::string find_cookie_value(const httplib::Request& req, const std::string& cookieName) {
  const auto cookieHeader = req.get_header_value("Cookie");
  if (cookieHeader.empty()) {
    return "";
  }

  std::size_t offset = 0;
  while (offset < cookieHeader.size()) {
    const std::size_t separator = cookieHeader.find(';', offset);
    const std::string item =
        trim_copy(cookieHeader.substr(offset, separator == std::string::npos ? std::string::npos : separator - offset));
    if (!item.empty()) {
      const std::size_t equals = item.find('=');
      if (equals != std::string::npos) {
        const std::string name = trim_copy(item.substr(0, equals));
        if (name == cookieName) {
          return url_decode_component(item.substr(equals + 1));
        }
      }
    }

    if (separator == std::string::npos) {
      break;
    }
    offset = separator + 1;
  }

  return "";
}

void set_music_session_cookie(httplib::Response& res, const std::string& upstreamCookie) {
  res.set_header("Set-Cookie",
                 std::string(kMusicSessionCookieName) + "=" + url_encode_component(upstreamCookie) +
                     "; Path=/; HttpOnly; SameSite=Lax");
}

void clear_music_session_cookie(httplib::Response& res) {
  res.set_header("Set-Cookie",
                 std::string(kMusicSessionCookieName) + "=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
}

std::string resolve_music_session_cookie(const httplib::Request& req) {
  if (req.has_param("cookie")) {
    return req.get_param_value("cookie");
  }

  return find_cookie_value(req, kMusicSessionCookieName);
}

MusicServiceResult missing_parameter(const std::string& parameterName) {
  return {
      false,
      400,
      "missing_parameter",
      "Missing required query parameter: " + parameterName,
      "vibe_music_route",
      Json::object(),
  };
}

MusicServiceResult invalid_request(const std::string& message) {
  return {
      false,
      400,
      "invalid_request",
      message,
      "vibe_music_route",
      Json::object(),
  };
}

Json parse_json_body(const httplib::Request& req) {
  if (req.body.empty()) {
    return Json::object();
  }

  return Json::parse(req.body, nullptr, false);
}

void write_error(httplib::Response& res, int status, const std::string& code, const std::string& message) {
  write_json(res,
             {
                 {"error", code},
                 {"message", message},
             },
             status);
}

Json logged_out_payload() {
  return {
      {"ok", true},
      {"message", "Not logged in"},
      {"data",
       {
           {"code", 0},
           {"loggedIn", false},
           {"accountId", 0},
           {"userId", 0},
           {"nickname", ""},
           {"avatarUrl", ""},
       }},
  };
}

}  // namespace

void register_routes(httplib::Server& server) {
  server.Options(R"(.*)", [](const httplib::Request&, httplib::Response& res) {
    add_common_headers(res);
    res.status = 204;
  });

  const ApiPayload payload = build_payload();
  const MusicService musicService;
  const auto taskStore = std::make_shared<TaskStore>();

  server.Get("/api/health", [](const httplib::Request&, httplib::Response& res) {
    write_json(res, make_health_payload());
  });

  server.Get("/api/dashboard/summary", [payload](const httplib::Request&, httplib::Response& res) {
    write_json(res, payload.summary);
  });

  server.Get("/api/stats", [payload](const httplib::Request&, httplib::Response& res) {
    write_json(res, payload.stats);
  });

  server.Get("/api/access/deck", [payload](const httplib::Request&, httplib::Response& res) {
    write_json(res, payload.accessDeck);
  });

  server.Get("/api/home/music-snapshot", [payload](const httplib::Request&, httplib::Response& res) {
    write_json(res, payload.musicSnapshot);
  });

  server.Get("/api/home/task-stream", [taskStore](const httplib::Request&, httplib::Response& res) {
    write_json(res, taskStore->task_stream());
  });

  server.Get("/api/files/quick-access", [payload](const httplib::Request&, httplib::Response& res) {
    write_json(res, payload.quickAccess);
  });

  server.Get("/api/tasks", [taskStore](const httplib::Request&, httplib::Response& res) {
    write_json(res, taskStore->list_tasks());
  });

  server.Get("/api/tasks/current", [taskStore](const httplib::Request&, httplib::Response& res) {
    write_json(res, taskStore->current_task());
  });

  server.Get("/api/tasks/next", [taskStore](const httplib::Request&, httplib::Response& res) {
    write_json(res, taskStore->next_task());
  });

  server.Get("/api/tasks/completed", [taskStore](const httplib::Request&, httplib::Response& res) {
    write_json(res, taskStore->completed_tasks());
  });

  server.Post("/api/tasks", [taskStore](const httplib::Request& req, httplib::Response& res) {
    const Json body = parse_json_body(req);
    if (body.is_discarded() || !body.is_object()) {
      write_error(res, 400, "invalid_json", "Request body must be valid JSON.");
      return;
    }

    std::string errorMessage;
    const Json created = taskStore->create_task(body, errorMessage);
    if (!errorMessage.empty()) {
      write_error(res, 400, "invalid_task", errorMessage);
      return;
    }

    write_json(res, created, 201);
  });

  server.Post(R"(/api/tasks/([^/]+)/complete)", [taskStore](const httplib::Request& req, httplib::Response& res) {
    const std::string taskId = req.matches[1];
    std::string errorMessage;
    const Json completed = taskStore->complete_task(taskId, errorMessage);
    if (!errorMessage.empty()) {
      const int status = errorMessage == "Task not found." ? 404 : 409;
      const std::string code = status == 404 ? "task_not_found" : "task_conflict";
      write_error(res, status, code, errorMessage);
      return;
    }

    write_json(res, completed);
  });

  server.Get("/api/music/queue", [payload](const httplib::Request&, httplib::Response& res) {
    write_json(res, payload.musicQueue);
  });

  server.Get("/api/music/health", [musicService](const httplib::Request&, httplib::Response& res) {
    write_api_result(res, musicService.health());
  });

  const auto handle_music_search = [musicService](const httplib::Request& req, httplib::Response& res) {
    if (!req.has_param("q")) {
      write_api_result(res, missing_parameter("q"));
      return;
    }

    const auto query = req.get_param_value("q");
    if (query.empty()) {
      write_api_result(res, missing_parameter("q"));
      return;
    }

    write_api_result(res, musicService.search_tracks(query));
  };

  const auto handle_music_lyric = [musicService](const httplib::Request& req, httplib::Response& res) {
    if (!req.has_param("id")) {
      write_api_result(res, missing_parameter("id"));
      return;
    }

    const auto trackId = req.get_param_value("id");
    if (trackId.empty()) {
      write_api_result(res, missing_parameter("id"));
      return;
    }

    write_api_result(res, musicService.lyric_by_track_id(trackId));
  };

  server.Get("/api/music/search", handle_music_search);
  server.Get("/api/music/lyric", handle_music_lyric);

  const auto handle_login_status = [musicService](const httplib::Request& req, httplib::Response& res) {
    const std::string cookie = resolve_music_session_cookie(req);
    if (trim_copy(cookie).empty()) {
      write_json(res, logged_out_payload());
      return;
    }

    write_api_result(res, musicService.login_status(cookie));
  };

  const auto handle_qr_key = [musicService](const httplib::Request&, httplib::Response& res) {
    write_api_result(res, musicService.create_qr_login_key());
  };

  const auto handle_qr_create = [musicService](const httplib::Request& req, httplib::Response& res) {
    const std::string key = trim_copy(req.has_param("key") ? req.get_param_value("key") : "");
    if (key.empty()) {
      write_api_result(res, missing_parameter("key"));
      return;
    }

    write_api_result(res, musicService.create_qr_login_image(key));
  };

  const auto handle_qr_check = [musicService](const httplib::Request& req, httplib::Response& res) {
    const std::string key = trim_copy(req.has_param("key") ? req.get_param_value("key") : "");
    if (key.empty()) {
      write_api_result(res, missing_parameter("key"));
      return;
    }

    const MusicServiceResult result = musicService.check_qr_login(key);
    write_api_result(res, result);
  };

  const auto handle_qr_commit = [musicService](const httplib::Request& req, httplib::Response& res) {
    const Json body = parse_json_body(req);
    if (body.is_discarded() || !body.is_object()) {
      write_api_result(res, invalid_request("Request body must be valid JSON."));
      return;
    }

    const std::string key = trim_copy(body.value("key", ""));
    if (key.empty()) {
      write_api_result(res, missing_parameter("key"));
      return;
    }

    const MusicServiceResult result = musicService.check_qr_login(key);
    if (result.ok) {
      const std::string cookie = trim_copy(result.data.value("cookie", ""));
      if (!cookie.empty()) {
        set_music_session_cookie(res, cookie);
      }
    }

    write_api_result(res, result);
  };

  const auto handle_cellphone_login = [musicService](const httplib::Request& req, httplib::Response& res) {
    const Json body = parse_json_body(req);
    if (body.is_discarded() || !body.is_object()) {
      write_api_result(res, invalid_request("Request body must be valid JSON."));
      return;
    }

    const std::string phone = trim_copy(body.value("phone", ""));
    const std::string captcha = trim_copy(body.value("captcha", ""));
    const std::string countryCode = trim_copy(body.value("countrycode", ""));
    if (phone.empty()) {
      write_api_result(res, missing_parameter("phone"));
      return;
    }
    if (captcha.empty()) {
      write_api_result(res, missing_parameter("captcha"));
      return;
    }

    const MusicServiceResult result = musicService.login_with_cellphone_code(phone, captcha, countryCode);
    if (result.ok) {
      const std::string cookie = trim_copy(result.data.value("cookie", ""));
      if (!cookie.empty()) {
        set_music_session_cookie(res, cookie);
      }
    }

    write_api_result(res, result);
  };

  const auto handle_cellphone_code_send = [musicService](const httplib::Request& req, httplib::Response& res) {
    const Json body = parse_json_body(req);
    if (body.is_discarded() || !body.is_object()) {
      write_api_result(res, invalid_request("Request body must be valid JSON."));
      return;
    }

    const std::string phone = trim_copy(body.value("phone", ""));
    const std::string countryCode = trim_copy(body.value("countrycode", ""));
    if (phone.empty()) {
      write_api_result(res, missing_parameter("phone"));
      return;
    }

    const MusicServiceResult result = musicService.send_cellphone_login_code(phone, countryCode);
    if (result.ok) {
      const std::string cookie = trim_copy(result.data.value("cookie", ""));
      if (!cookie.empty()) {
        set_music_session_cookie(res, cookie);
      }
    }

    write_api_result(res, result);
  };

  const auto handle_logout = [musicService](const httplib::Request& req, httplib::Response& res) {
    const std::string cookie = resolve_music_session_cookie(req);
    if (!cookie.empty()) {
      const MusicServiceResult result = musicService.logout(cookie);
      clear_music_session_cookie(res);
      write_api_result(res, result);
      return;
    }

    clear_music_session_cookie(res);
    write_json(res, logged_out_payload());
  };

  server.Get("/api/login/status", handle_login_status);
  server.Get("/api/logstatus", handle_login_status);
  server.Get("/api/login/qr/key", handle_qr_key);
  server.Get("/api/login/qr/create", handle_qr_create);
  server.Get("/api/login/qr/check", handle_qr_check);
  server.Post("/api/login/qr/commit", handle_qr_commit);
  server.Post("/api/captcha/sent", handle_cellphone_code_send);
  server.Post("/api/login/cellphone/code", handle_cellphone_code_send);
  server.Post("/api/login/cellphone", handle_cellphone_login);
  server.Post("/api/logout", handle_logout);
  server.Get("/api/logout", handle_logout);

  server.Get("/api/music-account-status", handle_login_status);
  server.Get("/api/music-account-qr-key", handle_qr_key);
  server.Get("/api/music-account-qr-create", handle_qr_create);
  server.Get("/api/music-account-qr-check", handle_qr_check);
  server.Post("/api/music-account-qr-commit", handle_qr_commit);
  server.Post("/api/music-captcha-sent", handle_cellphone_code_send);
  server.Post("/api/music-account-cellphone", handle_cellphone_login);
  server.Post("/api/music-account-cellphone/code", handle_cellphone_code_send);
}

}  // namespace vibe
