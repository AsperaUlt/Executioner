(function attachAudioRenderer(global) {
  const { searchMusic } = global.VibeApi;
  const SEARCH_DEBOUNCE_MS = 300;
  const MIN_SEARCH_LENGTH = 2;
  const SUGGESTION_LIMIT = 6;

  function qs(selector) {
    return document.querySelector(selector);
  }

  function debounce(fn, waitMs) {
    let timer = null;
    return (...args) => {
      if (timer) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => fn(...args), waitMs);
    };
  }

  function formatArtists(track) {
    if (track?.artistText) {
      return track.artistText;
    }

    if (Array.isArray(track?.artists) && track.artists.length) {
      return track.artists.map((artist) => artist?.name || "Unknown Artist").join(", ");
    }

    return "Unknown Artist";
  }

  function formatAlbum(track) {
    return track?.album?.name || "Unknown Album";
  }

  function formatDuration(durationMs) {
    if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs <= 0) {
      return "--:--";
    }

    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function setText(selector, value) {
    const node = qs(selector);
    if (node) {
      node.textContent = value;
    }
  }

  function setStatusClass(status) {
    const badge = qs('[data-module="audio-status-badge"]');
    if (!badge) {
      return;
    }

    const palette = {
      idle: "border-white/10 bg-white/[0.04] text-slate-300",
      loading: "border-primary/20 bg-primary/10 text-primary",
      results: "border-tertiary/20 bg-tertiary/10 text-tertiary",
      empty: "border-white/10 bg-white/[0.04] text-slate-300",
      playing: "border-secondary/20 bg-secondary/10 text-secondary",
      error: "border-red-400/20 bg-red-400/10 text-red-200",
    };

    badge.className =
      "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] " +
      (palette[status] || palette.idle);
    badge.textContent = status;
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function scoreText(query, value, exactScore, prefixScore, includesScore) {
    const normalizedValue = normalizeText(value);
    if (!normalizedValue) {
      return 0;
    }

    if (normalizedValue === query) {
      return exactScore;
    }

    if (normalizedValue.startsWith(query)) {
      return prefixScore;
    }

    if (normalizedValue.includes(query)) {
      return includesScore;
    }

    return 0;
  }

  function scoreTrack(query, track) {
    const artist = formatArtists(track);
    const album = formatAlbum(track);
    const title = track?.title ?? "";
    let score = 0;

    score += scoreText(query, title, 1000, 700, 420);
    score += scoreText(query, artist, 300, 210, 120);
    score += scoreText(query, album, 150, 100, 60);

    if (normalizeText(title).split(/\s+/).some((token) => token === query)) {
      score += 80;
    }

    const durationPenalty = typeof track?.durationMs === "number" ? Math.min(track.durationMs / 10000, 20) : 0;
    return score - durationPenalty;
  }

  function sortByRelevance(items, query) {
    const normalizedQuery = normalizeText(query);
    return [...items]
      .map((track, index) => ({ track, index, score: scoreTrack(normalizedQuery, track) }))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return left.index - right.index;
      })
      .map((entry) => entry.track);
  }

  function renderSuggestions(state) {
    const host = qs('[data-module="audio-suggestions"]');
    if (!host) {
      return;
    }

    const items = Array.isArray(state.suggestions) ? state.suggestions.slice(0, SUGGESTION_LIMIT) : [];
    while (host.children.length > items.length) {
      host.removeChild(host.lastElementChild);
    }

    items.forEach((track, index) => {
      let row = host.children[index];
      if (!row) {
        row = document.createElement("button");
        row.type = "button";
        row.className =
          "flex w-full items-center justify-between gap-4 rounded-[1.2rem] border border-white/5 bg-white/[0.03] px-4 py-3 text-left transition hover:border-primary/20 hover:bg-white/[0.05]";

        const left = document.createElement("div");
        left.className = "min-w-0 flex-1";

        const title = document.createElement("p");
        title.className = "truncate text-sm font-semibold";

        const meta = document.createElement("p");
        meta.className = "mt-1 truncate text-xs text-slate-400";

        const hint = document.createElement("span");
        hint.className = "text-[11px] uppercase tracking-[0.18em] text-primary";
        hint.textContent = "Search";

        left.append(title, meta);
        row.append(left, hint);
        host.appendChild(row);
      }

      row.dataset.queryValue = track?.title ?? "";
      row.children[0].children[0].textContent = track?.title ?? "Untitled Track";
      row.children[0].children[1].textContent = `${formatArtists(track)} - ${formatAlbum(track)}`;
    });

    host.hidden = items.length === 0 || state.query.length < MIN_SEARCH_LENGTH;
  }

  function renderResults(state) {
    const host = qs('[data-module="audio-results"]');
    if (!host) {
      return;
    }

    const items = Array.isArray(state.results) ? state.results : [];
    while (host.children.length > items.length) {
      host.removeChild(host.lastElementChild);
    }

    items.forEach((track, index) => {
      let row = host.children[index];
      if (!row) {
        row = document.createElement("article");
        row.className =
          "grid gap-4 rounded-[1.4rem] border border-white/5 bg-white/[0.03] px-4 py-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_auto] md:items-center";

        const primary = document.createElement("div");
        primary.className = "min-w-0";

        const title = document.createElement("p");
        title.className = "truncate text-sm font-semibold";

        const artist = document.createElement("p");
        artist.className = "mt-1 truncate text-xs text-slate-400";

        const album = document.createElement("p");
        album.className = "truncate text-sm text-slate-300";

        const duration = document.createElement("p");
        duration.className = "text-xs font-semibold uppercase tracking-[0.18em] text-primary md:text-right";

        primary.append(title, artist);
        row.append(primary, album, duration);
        host.appendChild(row);
      }

      row.children[0].children[0].textContent = track?.title ?? "Untitled Track";
      row.children[0].children[1].textContent = formatArtists(track);
      row.children[1].textContent = formatAlbum(track);
      row.children[2].textContent = formatDuration(track?.durationMs);
    });

    host.hidden = items.length === 0;
  }

  function renderAudio(state) {
    setStatusClass(state.status);
    setText('[data-field="audioSearchMessage"]', state.message || "Ready");
    setText(
      '[data-field="audioCurrentTitle"]',
      state.results.length ? `${state.results.length} results` : "No search results"
    );
    setText(
      '[data-field="audioCurrentArtist"]',
      state.submittedQuery ? `Query: ${state.submittedQuery}` : "Waiting for search"
    );
    setText('[data-field="audioCurrentAlbum"]', state.results.length ? "Latest search snapshot" : "No album metadata");
    setText(
      '[data-field="audioLyrics"]',
      state.error || "This panel is reserved for later music capabilities. The current step only wires search."
    );

    const emptyMessage = state.error
      ? "Search failed. Try again when the music service is ready."
      : state.query && state.query.length < MIN_SEARCH_LENGTH
        ? `Enter at least ${MIN_SEARCH_LENGTH} characters to search tracks.`
        : state.isSuggesting
          ? "Looking for matching suggestions..."
          : state.isSearching
            ? "Searching..."
            : state.submittedQuery
              ? "No results returned by the music service."
            : "No results yet. Try a keyword when the music service is ready.";
    setText('[data-field="audioEmptyState"]', emptyMessage);

    const errorBox = qs('[data-module="audio-error"]');
    if (errorBox) {
      errorBox.hidden = !state.error;
      errorBox.textContent = state.error || "";
    }

    const loadingBox = qs('[data-module="audio-loading"]');
    if (loadingBox) {
      loadingBox.hidden = !(state.isSearching || state.isSuggesting);
      loadingBox.textContent = state.isSearching ? "Searching tracks..." : "Preparing suggestions...";
    }

    const emptyBox = qs('[data-module="audio-empty"]');
    if (emptyBox) {
      emptyBox.hidden = state.results.length > 0 || state.isSearching || state.isSuggesting;
    }

    renderSuggestions(state);
    renderResults(state);
  }

  function buildUiError(error, fallbackMessage) {
    const message = error?.payload?.message || error?.message || fallbackMessage;
    const code = error?.payload?.error || "";
    return code ? `${message} (${code})` : message;
  }

  function isAbortError(error) {
    return error?.name === "AbortError";
  }

  function initAudio(state) {
    const form = qs('[data-module="audio-search-form"]');
    const input = qs('[data-module="audio-search-input"]');
    const suggestionsHost = qs('[data-module="audio-suggestions"]');
    const resultsHost = qs('[data-module="audio-results"]');

    if (!form || !input || !resultsHost || !suggestionsHost) {
      return;
    }

    let requestToken = 0;
    let requestController = null;
    let lastSuggestQuery = "";
    let lastCommittedQuery = "";
    let lastSuggestResults = [];

    function resetTransientSearchState() {
      if (requestController) {
        requestController.abort();
        requestController = null;
      }

      state.isSearching = false;
      state.isSuggesting = false;
    }

    async function fetchRankedTracks(query, mode) {
      if (requestController) {
        requestController.abort();
      }

      const token = ++requestToken;
      const controller = new AbortController();
      requestController = controller;

      if (mode === "suggest") {
        state.isSuggesting = true;
        state.isSearching = false;
        console.debug("[music-search] suggest", query);
      } else {
        state.isSearching = true;
        state.isSuggesting = false;
        console.debug("[music-search] submit", query);
      }

      state.error = "";
      state.message = mode === "suggest" ? "Looking for matching suggestions..." : "Searching the music service...";
      renderAudio(state);

      try {
        const payload = await searchMusic(query, { signal: controller.signal });
        if (token !== requestToken) {
          console.debug("[music-search] stale", mode, query);
          return null;
        }

        const results = Array.isArray(payload?.data?.results) ? sortByRelevance(payload.data.results, query) : [];
        console.debug("[music-search] success", mode, query, results.length);
        return results;
      } catch (error) {
        if (token !== requestToken) {
          console.debug("[music-search] stale", mode, query);
          return null;
        }

        if (isAbortError(error)) {
          console.debug("[music-search] abort", mode, query);
          return null;
        }

        throw error;
      } finally {
        if (token === requestToken) {
          if (requestController === controller) {
            requestController = null;
          }

          state.isSearching = false;
          state.isSuggesting = false;
        }
      }
    }

    async function updateSuggestions(query) {
      const normalizedQuery = query.trim();
      state.query = normalizedQuery;

      if (!normalizedQuery || normalizedQuery.length < MIN_SEARCH_LENGTH) {
        resetTransientSearchState();
        state.status = state.results.length ? "results" : "idle";
        state.suggestions = [];
        state.error = "";
        lastSuggestQuery = "";
        lastSuggestResults = [];
        state.message = normalizedQuery
          ? `Enter at least ${MIN_SEARCH_LENGTH} characters to search tracks.`
          : "Type a keyword, then press Enter or click Search.";
        renderAudio(state);
        return;
      }

      if (normalizedQuery === lastSuggestQuery) {
        return;
      }

      try {
        const suggestions = await fetchRankedTracks(normalizedQuery, "suggest");
        if (!suggestions) {
          renderAudio(state);
          return;
        }

        lastSuggestQuery = normalizedQuery;
        lastSuggestResults = suggestions;
        state.suggestions = suggestions.slice(0, SUGGESTION_LIMIT);
        state.status = state.results.length ? "results" : "idle";
        state.message = state.suggestions.length
          ? "Press Enter or click Search to open full results."
          : "No matching suggestions. Press Search to try anyway.";
      } catch (error) {
        state.suggestions = [];
        state.status = "error";
        state.error = buildUiError(error, "Node music service is unavailable.");
        state.message = "Suggestion request failed.";
        lastSuggestQuery = "";
        lastSuggestResults = [];
        console.debug("[music-search] error", "suggest", normalizedQuery, state.error);
      }

      renderAudio(state);
    }

    async function submitSearch(query) {
      const normalizedQuery = query.trim();
      state.query = normalizedQuery;

      if (!normalizedQuery || normalizedQuery.length < MIN_SEARCH_LENGTH) {
        resetTransientSearchState();
        state.status = "idle";
        state.suggestions = [];
        state.results = [];
        state.submittedQuery = "";
        state.error = "";
        state.message = normalizedQuery
          ? `Enter at least ${MIN_SEARCH_LENGTH} characters to search tracks.`
          : "Type a keyword, then press Enter or click Search.";
        renderAudio(state);
        return;
      }

      if (normalizedQuery === lastCommittedQuery && state.results.length) {
        state.suggestions = [];
        state.message = `Showing ${state.results.length} tracks for "${normalizedQuery}".`;
        renderAudio(state);
        return;
      }

      try {
        let results = null;
        if (normalizedQuery === lastSuggestQuery && lastSuggestResults.length) {
          results = lastSuggestResults;
          console.debug("[music-search] reuse-suggestions", normalizedQuery, results.length);
        } else {
          results = await fetchRankedTracks(normalizedQuery, "submit");
        }

        if (!results) {
          renderAudio(state);
          return;
        }

        lastCommittedQuery = normalizedQuery;
        state.submittedQuery = normalizedQuery;
        state.suggestions = [];
        state.results = results;
        state.status = results.length ? "results" : "empty";
        state.message = results.length
          ? `Showing ${results.length} tracks for "${normalizedQuery}".`
          : `No results returned for "${normalizedQuery}".`;
      } catch (error) {
        state.suggestions = [];
        state.results = [];
        state.submittedQuery = normalizedQuery;
        state.status = "error";
        state.error = buildUiError(error, "Node music service is unavailable.");
        state.message = "Search request failed.";
        lastCommittedQuery = "";
        console.debug("[music-search] error", "submit", normalizedQuery, state.error);
      }

      renderAudio(state);
    }

    const debouncedSearch = debounce((value) => {
      void updateSuggestions(value);
    }, SEARCH_DEBOUNCE_MS);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void submitSearch(input.value);
    });

    input.addEventListener("input", (event) => {
      debouncedSearch(event.target.value);
    });

    suggestionsHost.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-query-value]");
      if (!button) {
        return;
      }

      input.value = button.dataset.queryValue || "";
      void submitSearch(input.value);
    });

    renderAudio(state);
  }

  global.VibeRenderers = global.VibeRenderers || {};
  global.VibeRenderers.initAudio = initAudio;
  global.VibeRenderers.renderAudio = renderAudio;
})(window);
