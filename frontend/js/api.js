(function attachApi(global) {
  const FILE_ORIGIN_BASE = "http://127.0.0.1:18080";
  const API_BASE = window.location.protocol === "file:" ? FILE_ORIGIN_BASE : "";

  function getApiBase() {
    return API_BASE;
  }

  async function fetchJson(path, options = {}) {
    const { body, headers, method = "GET", ...restOptions } = options;
    const response = await fetch(`${getApiBase()}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(headers || {}),
      },
      ...(body !== undefined ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
      ...restOptions,
    });

    if (!response.ok) {
      const rawBody = await response.text();
      let message = `API ${path} failed: ${response.status}`;

      try {
        const payload = rawBody ? JSON.parse(rawBody) : null;
        if (payload?.message) {
          message = payload.message;
        }
      } catch (_error) {
        // Keep the default status-based message when the response is not JSON.
      }

      throw new Error(message);
    }

    return response.json();
  }

  async function fetchApiEnvelope(path, options = {}) {
    const response = await fetch(`${getApiBase()}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      ...options,
    });

    const rawBody = await response.text();
    let payload = null;

    try {
      payload = rawBody ? JSON.parse(rawBody) : null;
    } catch (error) {
      const parseError = new Error(`API ${path} returned invalid JSON`);
      parseError.status = response.status;
      parseError.payload = rawBody;
      throw parseError;
    }

    if (!response.ok) {
      const apiError = new Error(payload?.message || `API ${path} failed: ${response.status}`);
      apiError.status = response.status;
      apiError.payload = payload;
      throw apiError;
    }

    return payload;
  }

  function buildQuery(params) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        search.set(key, value);
      }
    });
    return search.toString();
  }

  async function fetchAllData() {
    const [summary, stats, music, taskStream, quickAccess, tasks, taskCurrent, taskNext, taskCompleted] = await Promise.all([
      fetchJson("/api/dashboard/summary"),
      fetchJson("/api/stats"),
      fetchMusicQueue(),
      fetchJson("/api/home/task-stream"),
      fetchJson("/api/files/quick-access"),
      fetchJson("/api/tasks"),
      fetchJson("/api/tasks/current"),
      fetchJson("/api/tasks/next"),
      fetchJson("/api/tasks/completed"),
    ]);

    return { summary, stats, taskStream, quickAccess, tasks, taskCurrent, taskNext, taskCompleted, music };
  }

  function createTask(task) {
    return fetchJson("/api/tasks", {
      method: "POST",
      body: task,
    });
  }

  function completeTask(id) {
    return fetchJson(`/api/tasks/${encodeURIComponent(id)}/complete`, {
      method: "POST",
    });
  }

  function fetchMusicHealth(options = {}) {
    return fetchApiEnvelope("/api/music/health", options);
  }

  function searchMusic(query, options = {}) {
    return fetchApiEnvelope(`/api/music/search?${buildQuery({ q: query })}`, options);
  }

  function fetchMusicQueue(options = {}) {
    return fetchJson("/api/music/queue", options);
  }

  global.VibeApi = {
    completeTask,
    createTask,
    fetchAllData,
    fetchApiEnvelope,
    fetchJson,
    fetchMusicHealth,
    fetchMusicQueue,
    getApiBase,
    searchMusic,
  };
})(window);
