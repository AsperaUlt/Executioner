(function attachAudioRenderer(global) {
  const { searchAudio, fetchAudioLyric, fetchAudioTrack, fetchAudioUrl } = global.VibeApi;

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
      playing: "border-secondary/20 bg-secondary/10 text-secondary",
      error: "border-red-400/20 bg-red-400/10 text-red-200",
    };

    badge.className =
      "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] " +
      (palette[status] || palette.idle);
    badge.textContent = status;
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
        row = document.createElement("button");
        row.type = "button";
        row.className =
          "flex w-full items-center justify-between gap-4 rounded-[1.4rem] border border-white/5 bg-white/[0.03] px-4 py-4 text-left transition hover:border-primary/20 hover:bg-white/[0.05]";

        const left = document.createElement("div");
        left.className = "min-w-0 flex-1";

        const title = document.createElement("p");
        title.className = "truncate text-sm font-semibold";

        const meta = document.createElement("p");
        meta.className = "mt-1 truncate text-xs text-slate-400";

        const action = document.createElement("span");
        action.className = "text-xs uppercase tracking-[0.18em] text-primary";
        action.textContent = "Play";

        left.append(title, meta);
        row.append(left, action);
        host.appendChild(row);
      }

      row.dataset.trackId = String(track?.id ?? "");
      row.children[0].children[0].textContent = track?.title ?? "Untitled Track";
      row.children[0].children[1].textContent = `${formatArtists(track)} - ${track?.album?.name ?? "Unknown Album"}`;
      row.classList.toggle("ring-1", state.currentTrack?.id === track?.id);
      row.classList.toggle("ring-primary/40", state.currentTrack?.id === track?.id);
      row.disabled = state.isResolving;
    });

    host.hidden = items.length === 0;
  }

  function renderAudio(state) {
    setStatusClass(state.status);
    setText('[data-field="audioSearchMessage"]', state.message || "Ready");
    setText('[data-field="audioCurrentTitle"]', state.currentTrack?.title ?? "No track selected");
    setText('[data-field="audioCurrentArtist"]', state.currentTrack ? formatArtists(state.currentTrack) : "Waiting for search");
    setText('[data-field="audioCurrentAlbum"]', state.currentTrack?.album?.name ?? "No album metadata");
    setText(
      '[data-field="audioLyrics"]',
      state.lyricText || "Lyrics will appear here. If the upstream service returns no lyric, this area stays readable."
    );
    setText(
      '[data-field="audioEmptyState"]',
      state.isSearching ? "Searching..." : "No results yet. Try a keyword when the music service is ready."
    );

    const errorBox = qs('[data-module="audio-error"]');
    if (errorBox) {
      errorBox.hidden = !state.error;
      errorBox.textContent = state.error || "";
    }

    const loadingBox = qs('[data-module="audio-loading"]');
    if (loadingBox) {
      loadingBox.hidden = !(state.isSearching || state.isResolving);
      loadingBox.textContent = state.isResolving ? "Loading track URL and lyric..." : "Searching tracks...";
    }

    const emptyBox = qs('[data-module="audio-empty"]');
    if (emptyBox) {
      emptyBox.hidden = state.results.length > 0 || state.isSearching;
    }

    renderResults(state);
  }

  function buildUiError(error, fallbackMessage) {
    const message = error?.payload?.message || error?.message || fallbackMessage;
    const code = error?.payload?.error || "";
    return code ? `${message} (${code})` : message;
  }

  function initAudio(state) {
    const form = qs('[data-module="audio-search-form"]');
    const input = qs('[data-module="audio-search-input"]');
    const resultsHost = qs('[data-module="audio-results"]');
    const audioNode = qs('[data-module="audio-player"]');

    if (!form || !input || !resultsHost || !audioNode) {
      return;
    }

    let searchToken = 0;
    let resolveToken = 0;

    async function runSearch(query) {
      const normalizedQuery = query.trim();
      state.query = normalizedQuery;

      if (!normalizedQuery) {
        state.status = "idle";
        state.results = [];
        state.error = "";
        state.message = "Enter a keyword to search tracks.";
        renderAudio(state);
        return;
      }

      const token = ++searchToken;
      state.status = "loading";
      state.isSearching = true;
      state.error = "";
      state.message = "Searching the music service...";
      renderAudio(state);

      try {
        const payload = await searchAudio(normalizedQuery);
        if (token !== searchToken) {
          return;
        }

        state.results = Array.isArray(payload?.data?.results) ? payload.data.results : [];
        state.status = state.results.length ? "results" : "idle";
        state.message = state.results.length
          ? `Found ${state.results.length} track candidates.`
          : "No results returned by the music service.";
      } catch (error) {
        if (token !== searchToken) {
          return;
        }

        state.results = [];
        state.status = "error";
        state.error = buildUiError(error, "音乐服务暂未启动，请稍后联调");
        state.message = "Search request failed.";
      } finally {
        if (token === searchToken) {
          state.isSearching = false;
          renderAudio(state);
        }
      }
    }

    const debouncedSearch = debounce((value) => {
      void runSearch(value);
    }, 280);

    async function resolveTrack(trackId) {
      if (!trackId) {
        return;
      }

      const token = ++resolveToken;
      state.status = "loading";
      state.isResolving = true;
      state.error = "";
      state.message = "Resolving track playback...";
      renderAudio(state);

      try {
        const [trackPayload, urlPayload, lyricPayload] = await Promise.all([
          fetchAudioTrack(trackId),
          fetchAudioUrl(trackId),
          fetchAudioLyric(trackId),
        ]);

        if (token !== resolveToken) {
          return;
        }

        const track = trackPayload?.data || state.results.find((item) => String(item?.id) === String(trackId)) || null;
        const playbackUrl = urlPayload?.data?.url || "";
        const lyricText = lyricPayload?.data?.text || "";

        if (!playbackUrl) {
          throw {
            message: "Track URL is unavailable",
            payload: { error: "track_url_unavailable", message: "Track URL is unavailable" },
          };
        }

        state.currentTrack = track;
        state.playbackUrl = playbackUrl;
        state.lyricText = lyricText;
        state.status = "playing";
        state.message = lyricText ? "Playback ready. Lyric loaded." : "Playback ready. No lyric returned.";

        audioNode.src = playbackUrl;
        audioNode.play().catch(() => {
          state.message = "Playback URL loaded. Press play in the browser if autoplay is blocked.";
          renderAudio(state);
        });
      } catch (error) {
        if (token !== resolveToken) {
          return;
        }

        state.status = "error";
        state.error = buildUiError(error, "Failed to load track playback data.");
        state.message = "Playback request failed.";
      } finally {
        if (token === resolveToken) {
          state.isResolving = false;
          renderAudio(state);
        }
      }
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void runSearch(input.value);
    });

    input.addEventListener("input", (event) => {
      debouncedSearch(event.target.value);
    });

    resultsHost.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-track-id]");
      if (!button) {
        return;
      }

      void resolveTrack(button.dataset.trackId);
    });

    renderAudio(state);
  }

  global.VibeRenderers = global.VibeRenderers || {};
  global.VibeRenderers.initAudio = initAudio;
  global.VibeRenderers.renderAudio = renderAudio;
})(window);
