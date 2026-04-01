(function attachApi(global) {
  const FILE_ORIGIN_BASE = "http://127.0.0.1:18080";
  const API_BASE = window.location.protocol === "file:" ? FILE_ORIGIN_BASE : "";

  function getApiBase() {
    return API_BASE;
  }

  async function fetchJson(path, options = {}) {
    const response = await fetch(`${getApiBase()}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API ${path} failed: ${response.status}`);
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
    const [summary, stats, music, taskStream, quickAccess, tasks] = await Promise.all([
      fetchJson("/api/dashboard/summary"),
      fetchJson("/api/stats"),
      fetchJson("/api/home/music-snapshot"),
      fetchJson("/api/home/task-stream"),
      fetchJson("/api/files/quick-access"),
      fetchJson("/api/tasks"),
    ]);

    return { summary, stats, taskStream, quickAccess, tasks, music };
  }

  function searchAudio(query, options = {}) {
    return fetchApiEnvelope(`/api/audio/search?${buildQuery({ q: query })}`, options);
  }

  function fetchAudioTrack(id) {
    return fetchApiEnvelope(`/api/audio/track?${buildQuery({ id })}`);
  }

  function fetchAudioUrl(id) {
    return fetchApiEnvelope(`/api/audio/url?${buildQuery({ id })}`);
  }

  function fetchAudioLyric(id) {
    return fetchApiEnvelope(`/api/audio/lyric?${buildQuery({ id })}`);
  }

  global.VibeApi = {
    fetchAllData,
    fetchApiEnvelope,
    fetchAudioLyric,
    fetchAudioTrack,
    fetchAudioUrl,
    fetchJson,
    getApiBase,
    searchAudio,
  };
})(window);
