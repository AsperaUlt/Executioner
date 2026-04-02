#include "router.hpp"

#include <algorithm>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

#include "api_models.hpp"
#include "music_service.hpp"

namespace vibe {
namespace {

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

void add_legacy_alias_headers(httplib::Response& res, const char* replacement) {
  res.set_header("X-Vibe-Deprecated", "true");
  res.set_header("X-Vibe-Replacement", replacement);
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

  server.Get("/api/music/search", handle_music_search);

  server.Get("/api/audio/search", [handle_music_search](const httplib::Request& req, httplib::Response& res) {
    add_legacy_alias_headers(res, "/api/music/search");
    handle_music_search(req, res);
  });
}

}  // namespace vibe
