(function attachMusicRenderer(global) {
  const { fetchMusicLyric, searchMusic } = global.VibeApi;
  const SEARCH_DEBOUNCE_MS = 300;
  const MIN_SEARCH_LENGTH = 2;
  const SUGGESTION_LIMIT = 6;
  const KEYBOARD_NAV_KEYS = new Set(["ArrowDown", "ArrowUp", "Enter", "Escape"]);
  const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

  function qs(selector) {
    return document.querySelector(selector);
  }

  function qsa(selector) {
    return document.querySelectorAll(selector);
  }

  function setText(field, value) {
    const nodes = qsa(`[data-field="${field}"]`);
    if (!nodes.length || value === undefined || value === null) {
      return;
    }

    const nextValue = String(value);
    nodes.forEach((node) => {
      if (node.textContent !== nextValue) {
        node.textContent = nextValue;
      }
    });
  }

  function debounce(fn, waitMs) {
    let timer = null;
    const debounced = (...args) => {
      if (timer) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => fn(...args), waitMs);
    };

    debounced.cancel = () => {
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    return debounced;
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function getScrollViewport() {
    return document.querySelector("[data-scroll-viewport]") || document.scrollingElement || document.documentElement;
  }

  function getViewportMetrics(container) {
    if (container === document.body || container === document.documentElement || container === document.scrollingElement) {
      return { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
    }

    return container.getBoundingClientRect();
  }

  function scrollContainerBy(container, offset) {
    if (!container || !Number.isFinite(offset) || Math.abs(offset) < 1) {
      return;
    }

    if (container === document.body || container === document.documentElement || container === document.scrollingElement) {
      window.scrollBy({ top: offset, behavior: "smooth" });
      return;
    }

    container.scrollBy({ top: offset, behavior: "smooth" });
  }

  function bridgeInnerScroll(node) {
    if (!node || node.dataset.scrollBridgeBound === "true") {
      return;
    }

    node.dataset.scrollBridgeBound = "true";
    node.addEventListener(
      "wheel",
      (event) => {
        const viewport = getScrollViewport();
        const delta = event.deltaY;
        const hasScrollableSpace = node.scrollHeight > node.clientHeight + 1;
        if (!hasScrollableSpace || !delta) {
          return;
        }

        const atTop = node.scrollTop <= 0;
        const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
        const shouldBubbleUp = (delta < 0 && atTop) || (delta > 0 && atBottom);
        if (!shouldBubbleUp) {
          return;
        }

        event.preventDefault();
        scrollContainerBy(viewport, delta);
      },
      { passive: false }
    );
  }

  function ensureVisibleWithinViewport(target, options = {}) {
    if (!target) {
      return;
    }

    const viewport = getScrollViewport();
    const viewportRect = getViewportMetrics(viewport);
    const targetRect = target.getBoundingClientRect();
    const paddingTop = options.paddingTop ?? 24;
    const paddingBottom = options.paddingBottom ?? 24;
    let delta = 0;

    if (targetRect.top < viewportRect.top + paddingTop) {
      delta = targetRect.top - viewportRect.top - paddingTop;
    } else if (targetRect.bottom > viewportRect.bottom - paddingBottom) {
      delta = targetRect.bottom - viewportRect.bottom + paddingBottom;
    }

    scrollContainerBy(viewport, delta);
  }

  function syncSuggestionPanelVisibility(panel, input, shouldShow) {
    if (!panel) {
      return;
    }

    const gsap = window.gsap;
    const currentState = panel.dataset.motionState || (panel.hidden ? "closed" : "open");
    if (!gsap || prefersReducedMotion()) {
      panel.hidden = !shouldShow;
      panel.dataset.motionState = shouldShow ? "open" : "closed";
      if (input) {
        input.setAttribute("aria-expanded", shouldShow ? "true" : "false");
      }
      return;
    }

    gsap.killTweensOf(panel);

    if (shouldShow) {
      if (currentState === "open") {
        if (input) {
          input.setAttribute("aria-expanded", "true");
        }
        panel.hidden = false;
        return;
      }

      panel.hidden = false;
      panel.dataset.motionState = "open";
      if (input) {
        input.setAttribute("aria-expanded", "true");
      }

      const isDesktop = window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
      gsap.fromTo(
        panel,
        { autoAlpha: 0, y: isDesktop ? -18 : -10, scaleY: 0.94 },
        {
          autoAlpha: 1,
          y: 0,
          scaleY: 1,
          duration: isDesktop ? 0.34 : 0.24,
          ease: "power2.out",
          clearProps: "transform,opacity,visibility",
        }
      );
      return;
    }

    if (currentState === "closed") {
      panel.hidden = true;
      if (input) {
        input.setAttribute("aria-expanded", "false");
      }
      return;
    }

    panel.dataset.motionState = "closed";
    if (input) {
      input.setAttribute("aria-expanded", "false");
    }
    gsap.to(panel, {
      autoAlpha: 0,
      y: -8,
      scaleY: 0.97,
      duration: 0.18,
      ease: "power2.in",
      onComplete: () => {
        panel.hidden = true;
        gsap.set(panel, { clearProps: "all" });
      },
    });
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

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  let queueKey = "";
  let homeQueueKey = "";
  let progressKey = null;
  let resultsFingerprint = "";

  function setProgress(field, value) {
    const nodes = qsa(`[data-field="${field}"]`);
    if (!nodes.length || typeof value !== "number") {
      return;
    }

    const clamped = Math.max(0, Math.min(1, value));
    const width = `${Math.round(clamped * 100)}%`;
    nodes.forEach((node) => {
      if (node.style.width !== width) {
        node.style.width = width;
      }
    });
  }

  function renderQueueCards(host, items) {
    while (host.children.length > items.length) {
      host.removeChild(host.lastElementChild);
    }

    items.forEach((item, idx) => {
      let card = host.children[idx];
      if (!card) {
        card = document.createElement("article");
        card.className = "rounded-[1.6rem] border border-white/5 bg-white/[0.03] p-5";

        const order = document.createElement("p");
        order.className = "text-[11px] uppercase tracking-[0.22em] text-primary/80";

        const title = document.createElement("h4");
        title.className = "mt-3 font-headline text-xl font-bold";

        const duration = document.createElement("p");
        duration.className = "mt-2 text-sm text-slate-400";

        card.append(order, title, duration);
        host.appendChild(card);
      }

      card.children[0].textContent = `Queue ${idx + 1}`;
      card.children[1].textContent = item?.title ?? "Unknown";
      card.children[2].textContent = item?.duration ?? "--:--";
    });
  }

  function renderCompactQueue(host, items) {
    while (host.children.length > items.length) {
      host.removeChild(host.lastElementChild);
    }

    items.forEach((item, idx) => {
      let row = host.children[idx];
      if (!row) {
        row = document.createElement("div");
        row.className = "flex items-center justify-between rounded-[1.2rem] border border-white/5 bg-white/[0.03] px-4 py-3";

        const left = document.createElement("div");
        left.className = "min-w-0 flex-1";

        const title = document.createElement("p");
        title.className = "truncate text-sm font-semibold";

        const meta = document.createElement("p");
        meta.className = "mt-1 text-xs text-slate-400";

        const right = document.createElement("span");
        right.className = "text-xs text-primary";

        left.append(title, meta);
        row.append(left, right);
        host.appendChild(row);
      }

      const left = row.children[0];
      left.children[0].textContent = item?.title ?? "Unknown";
      left.children[1].textContent = `Track ${idx + 1}`;
      row.children[1].textContent = item?.duration ?? "--:--";
    });
  }

  function renderMusic(music) {
    if (!music || typeof music !== "object") {
      return;
    }

    const current = music.currentTrack ?? music.current ?? {};
    const queueSource = Array.isArray(music.upNext) ? music.upNext : Array.isArray(music.queue) ? music.queue : [];
    const queue = queueSource.slice(0, 6);
    const queueDepth = typeof music.queueDepth === "number" ? music.queueDepth : queueSource.length;

    setText("trackTitle", current.title ?? "No Track");
    setText("footerTrackTitle", current.title ?? "No Track");
    setText("trackArtist", current.artist ?? "Offline");
    setText("footerTrackArtist", current.artist ?? "Offline");
    setText("queueCount", queueDepth);

    if (typeof current.progress === "number" && progressKey !== current.progress) {
      progressKey = current.progress;
      setProgress("trackProgress", current.progress);
      setProgress("footerTrackProgress", current.progress);
    }

    const nextKey = JSON.stringify(queue.map((item) => [item?.id ?? "", item?.title ?? "", item?.duration ?? ""]));
    const queueHost = qs('[data-module="music-queue"]');
    const homeQueueHost = qs('[data-module="home-queue"]');

    if (queueHost && queueKey !== nextKey) {
      queueKey = nextKey;
      renderQueueCards(queueHost, queue);
    }

    if (homeQueueHost && homeQueueKey !== nextKey) {
      homeQueueKey = nextKey;
      renderCompactQueue(homeQueueHost, queue.slice(0, 4));
    }
  }

  function renderSuggestions(state) {
    const host = qs('[data-module="music-suggestions"]');
    const panel = qs('[data-module="music-suggestions-panel"]');
    const input = qs('[data-module="music-search-input"]');
    const label = qs('[data-field="musicSuggestionLabel"]');
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
          "flex w-full cursor-pointer items-center justify-between gap-4 rounded-[1.4rem] border border-white/5 bg-white/[0.03] px-4 py-3 text-left transition hover:border-primary/20 hover:bg-white/[0.05] focus:border-primary/30 focus:bg-white/[0.06] focus:outline-none";

        const left = document.createElement("div");
        left.className = "min-w-0 flex-1";

        const title = document.createElement("p");
        title.className = "truncate text-sm font-semibold";

        const meta = document.createElement("p");
        meta.className = "mt-1 truncate text-xs text-slate-400";

        const hint = document.createElement("span");
        hint.className = "rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-primary";
        hint.textContent = "Open";

        left.append(title, meta);
        row.append(left, hint);
        host.appendChild(row);
      }

      row.dataset.queryValue = track?.title ?? "";
      row.dataset.suggestionIndex = String(index);
      row.setAttribute("aria-selected", state.activeSuggestionIndex === index ? "true" : "false");
      row.classList.toggle("border-primary/30", state.activeSuggestionIndex === index);
      row.classList.toggle("bg-white/[0.06]", state.activeSuggestionIndex === index);
      row.children[0].children[0].textContent = track?.title ?? "Untitled Track";
      row.children[0].children[1].textContent = `${formatArtists(track)} · ${formatAlbum(track)}`;
    });

    if (label) {
      label.textContent = state.isSuggesting ? "Signal refresh" : items.length ? "Top matches" : "No matches";
    }

    const shouldShow = state.showSuggestions && items.length > 0 && state.query.length >= MIN_SEARCH_LENGTH;
    syncSuggestionPanelVisibility(panel, input, shouldShow);

    if (shouldShow && panel) {
      window.requestAnimationFrame(() => {
        ensureVisibleWithinViewport(panel, {
          paddingTop: window.matchMedia(DESKTOP_MEDIA_QUERY).matches ? 32 : 16,
          paddingBottom: window.matchMedia(DESKTOP_MEDIA_QUERY).matches ? 48 : 20,
        });
      });
    }
  }

  function renderResults(state) {
    const host = qs('[data-module="music-results"]');
    if (!host) {
      return;
    }

    const items = Array.isArray(state.results) ? state.results : [];
    const shouldShowResults =
      items.length > 0 &&
      state.submittedQuery &&
      normalizeText(state.submittedQuery) === normalizeText(state.query) &&
      !state.showSuggestions;

    while (host.children.length > items.length) {
      host.removeChild(host.lastElementChild);
    }

    items.forEach((track, index) => {
      let row = host.children[index];
      if (!row) {
        row = document.createElement("article");
        row.className =
          "music-result-card grid gap-4 rounded-[1.8rem] px-4 py-4 md:grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1fr)_auto] md:items-center";

        const rank = document.createElement("div");
        rank.className =
          "font-music-display flex h-11 w-11 items-center justify-center rounded-[1rem] border border-white/10 bg-slate-950/70 text-lg text-primary";

        const primary = document.createElement("div");
        primary.className = "min-w-0";

        const title = document.createElement("p");
        title.className = "font-music-display truncate text-2xl leading-none text-white";

        const artist = document.createElement("p");
        artist.className = "font-music-body mt-2 truncate text-sm text-slate-300";

        const albumWrap = document.createElement("div");
        albumWrap.className = "min-w-0";

        const albumLabel = document.createElement("p");
        albumLabel.className = "font-music-body text-[11px] uppercase tracking-[0.2em] text-slate-500";
        albumLabel.textContent = "Album";

        const album = document.createElement("p");
        album.className = "font-music-body mt-2 truncate text-sm text-slate-200";

        const durationWrap = document.createElement("div");
        durationWrap.className = "justify-self-start md:justify-self-end";

        const durationLabel = document.createElement("p");
        durationLabel.className = "font-music-body text-[11px] uppercase tracking-[0.2em] text-slate-500";
        durationLabel.textContent = "Length";

        const duration = document.createElement("p");
        duration.className = "font-music-display mt-2 text-2xl text-emerald-300 md:text-right";

        primary.append(title, artist);
        albumWrap.append(albumLabel, album);
        durationWrap.append(durationLabel, duration);
        row.append(rank, primary, albumWrap, durationWrap);
        host.appendChild(row);
      }

      row.children[0].textContent = String(index + 1).padStart(2, "0");
      row.children[1].children[0].textContent = track?.title ?? "Untitled Track";
      row.children[1].children[1].textContent = formatArtists(track);
      row.children[2].children[1].textContent = formatAlbum(track);
      row.children[3].children[1].textContent = formatDuration(track?.durationMs);
    });

    host.hidden = !shouldShowResults;

    const nextFingerprint = shouldShowResults
      ? JSON.stringify(items.map((track) => [track?.id ?? "", track?.title ?? "", track?.durationMs ?? 0]))
      : "";
    if (nextFingerprint && nextFingerprint !== resultsFingerprint && window.gsap && !prefersReducedMotion()) {
      resultsFingerprint = nextFingerprint;
      const timeline = window.gsap.timeline({
        defaults: { duration: 0.34, ease: "power2.out" },
      });

      timeline.fromTo(
        host.children,
        { autoAlpha: 0, y: 18, scale: 0.98 },
        { autoAlpha: 1, y: 0, scale: 1, stagger: 0.045, clearProps: "transform,opacity,visibility" }
      );
    } else if (!nextFingerprint) {
      resultsFingerprint = "";
    }
  }

  function setStatusClass(status) {
    const badge = qs('[data-module="music-status-badge"]');
    if (!badge) {
      return;
    }

    const palette = {
      idle: "border-white/10 bg-white/[0.04] text-slate-300",
      loading: "border-primary/20 bg-primary/10 text-primary",
      results: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
      empty: "border-white/10 bg-white/[0.04] text-slate-300",
      playing: "border-secondary/20 bg-secondary/10 text-secondary",
      error: "border-red-400/20 bg-red-400/10 text-red-200",
    };

    badge.className =
      "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] " +
      (palette[status] || palette.idle);
    badge.textContent = status;
  }

  function renderMusicBrowser(state) {
    if (!state) {
      return;
    }

    const leadTrack = state.currentTrack || state.results[0] || null;
    const resultCount = state.results.length;
    const hint = qs('[data-module="music-search-hint"]');

    setStatusClass(state.status);
    setText("musicSearchMessage", state.message || "Ready");
    setText("musicCurrentTitle", resultCount ? `${resultCount} tracks ready` : "No results yet");
    setText("musicCurrentArtist", state.submittedQuery ? state.submittedQuery : "Waiting for search");
    setText(
      "musicCurrentAlbum",
      state.submittedQuery ? (resultCount ? "Library snapshot ready" : "Search completed with no results") : "No active search"
    );
    setText("musicResultCount", String(resultCount).padStart(2, "0"));
    setText(
      "musicResultMeta",
      state.submittedQuery ? (resultCount ? "Committed and ranked" : "Committed but empty") : "No committed request"
    );
    setText("musicLeadTitle", leadTrack?.title ?? "No lead track yet.");
    setText(
      "musicLeadMeta",
      leadTrack
        ? "Top-ranked result promoted into the spotlight summary."
        : "Commit a query to promote the strongest result into this spotlight card."
    );
    setText("musicLeadArtist", leadTrack ? formatArtists(leadTrack) : "Standby");
    setText("musicLeadAlbum", leadTrack ? formatAlbum(leadTrack) : "No album");
    setText("musicLeadDuration", leadTrack ? formatDuration(leadTrack?.durationMs) : "--:--");
    setText(
      "musicLyrics",
      state.error ||
        state.lyricText ||
        "Lyrics will appear here after a track is resolved. If the upstream service returns no lyric, this area stays readable."
    );

    if (hint) {
      hint.textContent = state.isSearching ? "Loading" : state.showSuggestions ? "Preview" : "Discover";
    }

    const emptyMessage = state.error
      ? "Search failed. Try again when the music service is ready."
      : state.query && state.query.length < MIN_SEARCH_LENGTH
        ? `Enter at least ${MIN_SEARCH_LENGTH} characters to search tracks.`
        : state.isSuggesting
          ? "Collecting ranked suggestions..."
          : state.showSuggestions
            ? "Choose a suggestion or press Enter to load the full list."
            : state.isSearching
              ? "Searching the music service..."
              : state.submittedQuery
                ? "No results returned by the music service."
                : "Search songs, artists, or albums to open the Music workspace.";
    setText("musicEmptyState", emptyMessage);

    const errorBox = qs('[data-module="music-error"]');
    if (errorBox) {
      errorBox.hidden = !state.error;
      errorBox.textContent = state.error || "";
    }

    const loadingBox = qs('[data-module="music-loading"]');
    if (loadingBox) {
      loadingBox.hidden = !(state.isSearching || state.isSuggesting);
      loadingBox.textContent = state.isSearching ? "Loading full results..." : "Refreshing suggestions...";
    }

    const emptyBox = qs('[data-module="music-empty"]');
    if (emptyBox) {
      const hasVisibleResults =
        state.results.length > 0 &&
        state.submittedQuery &&
        normalizeText(state.submittedQuery) === normalizeText(state.query) &&
        !state.showSuggestions;
      emptyBox.hidden = hasVisibleResults || state.isSearching || state.isSuggesting;
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

  async function resolveLyricForTrack(state, trackId, options = {}) {
    if (!trackId) {
      state.lyricText = "";
      return;
    }

    try {
      const payload = await fetchMusicLyric(trackId, options);
      const data = payload?.data || {};
      const lyric = typeof data.lyric === "string" ? data.lyric.trim() : "";
      const translatedLyric = typeof data.translatedLyric === "string" ? data.translatedLyric.trim() : "";
      state.lyricText = lyric || translatedLyric || "";
    } catch (error) {
      if (!isAbortError(error)) {
        state.lyricText = "";
      }
    }
  }

  function initMusicBrowser(state) {
    const form = qs('[data-module="music-search-form"]');
    const input = qs('[data-module="music-search-input"]');
    const suggestionsHost = qs('[data-module="music-suggestions"]');
    const suggestionsPanel = qs('[data-module="music-suggestions-panel"]');
    const resultsHost = qs('[data-module="music-results"]');
    const searchShell = qs('[data-module="music-search-shell"]');

    if (!form || !input || !resultsHost || !suggestionsHost) {
      return;
    }

    bridgeInnerScroll(suggestionsHost);
    bridgeInnerScroll(resultsHost);

    let requestToken = 0;
    let requestController = null;
    let lyricRequestController = null;
    let lastSuggestQuery = "";
    let lastCommittedQuery = "";
    let lastSuggestResults = [];
    let motionBound = false;

    function clearSuggestions() {
      state.suggestions = [];
      state.showSuggestions = false;
      state.activeSuggestionIndex = -1;
    }

    function bindMusicCardMotion() {
      if (motionBound || !window.gsap || prefersReducedMotion()) {
        return;
      }

      motionBound = true;
      qsa('[data-route-panel="music"] [data-motion="music-card"]').forEach((card, index) => {
        card.addEventListener("pointerenter", () => {
          window.gsap.to(card, {
            y: -6,
            rotate: index % 2 === 0 ? -0.35 : 0.35,
            duration: 0.28,
            ease: "power2.out",
            overwrite: "auto",
          });
        });

        card.addEventListener("pointerleave", () => {
          window.gsap.to(card, {
            y: 0,
            rotate: 0,
            duration: 0.24,
            ease: "power2.out",
            overwrite: "auto",
          });
        });
      });
    }

    function selectSuggestion(index) {
      if (!Array.isArray(state.suggestions) || !state.suggestions.length) {
        state.activeSuggestionIndex = -1;
        renderMusicBrowser(state);
        return;
      }

      const safeIndex = Math.max(0, Math.min(index, state.suggestions.length - 1));
      state.activeSuggestionIndex = safeIndex;
      renderMusicBrowser(state);
      const activeNode = suggestionsHost.querySelector(`[data-suggestion-index="${safeIndex}"]`);
      activeNode?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    function resetTransientSearchState() {
      if (requestController) {
        requestController.abort();
        requestController = null;
      }

      if (lyricRequestController) {
        lyricRequestController.abort();
        lyricRequestController = null;
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
      } else {
        state.isSearching = true;
        state.isSuggesting = false;
      }

      state.error = "";
      state.message = mode === "suggest" ? "Collecting ranked suggestions..." : "Searching the music service...";
      renderMusicBrowser(state);

      try {
        const payload = await searchMusic(query, { signal: controller.signal });
        if (token !== requestToken) {
          return null;
        }

        return Array.isArray(payload?.data?.results) ? payload.data.results : [];
      } catch (error) {
        if (token !== requestToken || isAbortError(error)) {
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
        clearSuggestions();
        state.error = "";
        lastSuggestQuery = "";
        lastSuggestResults = [];
        state.message = normalizedQuery
          ? `Enter at least ${MIN_SEARCH_LENGTH} characters to search tracks.`
          : "Type a keyword, then press Enter or click Search.";
        renderMusicBrowser(state);
        return;
      }

      if (normalizedQuery === lastSuggestQuery) {
        return;
      }

      try {
        const suggestions = await fetchRankedTracks(normalizedQuery, "suggest");
        if (!suggestions) {
          renderMusicBrowser(state);
          return;
        }

        lastSuggestQuery = normalizedQuery;
        lastSuggestResults = suggestions;
        state.suggestions = suggestions.slice(0, SUGGESTION_LIMIT);
        state.showSuggestions = true;
        state.activeSuggestionIndex = state.suggestions.length ? 0 : -1;
        state.status = state.results.length ? "results" : "idle";
        state.message = state.suggestions.length
          ? "Choose a suggestion or press Enter to load the full list."
          : "No close matches. Press Search to try a broader query.";
      } catch (error) {
        clearSuggestions();
        state.status = "error";
        state.error = buildUiError(error, "Node music service is unavailable.");
        state.message = "Suggestion request failed.";
        lastSuggestQuery = "";
        lastSuggestResults = [];
      }

      renderMusicBrowser(state);
    }

    async function submitSearch(query) {
      const normalizedQuery = query.trim();
      debouncedSearch.cancel();
      state.query = normalizedQuery;
      let shouldFocusResults = false;

      if (!normalizedQuery || normalizedQuery.length < MIN_SEARCH_LENGTH) {
        resetTransientSearchState();
        state.status = "idle";
        clearSuggestions();
        state.results = [];
        state.currentTrack = null;
        state.lyricText = "";
        state.submittedQuery = "";
        state.error = "";
        state.message = normalizedQuery
          ? `Enter at least ${MIN_SEARCH_LENGTH} characters to search tracks.`
          : "Type a keyword, then press Enter or click Search.";
        renderMusicBrowser(state);
        return;
      }

      clearSuggestions();

      if (normalizedQuery === lastCommittedQuery && state.results.length) {
        state.message = `Showing ${state.results.length} tracks for "${normalizedQuery}".`;
        renderMusicBrowser(state);
        return;
      }

      try {
        let results = null;
        if (normalizedQuery === lastSuggestQuery && lastSuggestResults.length) {
          results = lastSuggestResults;
        } else {
          results = await fetchRankedTracks(normalizedQuery, "submit");
        }

        if (!results) {
          renderMusicBrowser(state);
          return;
        }

        lastCommittedQuery = normalizedQuery;
        state.submittedQuery = normalizedQuery;
        clearSuggestions();
        state.results = results;
        state.currentTrack = results[0] || null;
        state.lyricText = "";
        shouldFocusResults = results.length > 0;
        state.status = results.length ? "results" : "empty";
        state.message = results.length
          ? `Showing ${results.length} tracks for "${normalizedQuery}".`
          : `No results returned for "${normalizedQuery}".`;
      } catch (error) {
        clearSuggestions();
        state.results = [];
        state.currentTrack = null;
        state.lyricText = "";
        state.submittedQuery = normalizedQuery;
        state.status = "error";
        state.error = buildUiError(error, "Node music service is unavailable.");
        state.message = "Search request failed.";
        lastCommittedQuery = "";
      }

      renderMusicBrowser(state);
      if (state.currentTrack?.id) {
        if (lyricRequestController) {
          lyricRequestController.abort();
        }

        lyricRequestController = new AbortController();
        await resolveLyricForTrack(state, String(state.currentTrack.id), { signal: lyricRequestController.signal });
        lyricRequestController = null;
        renderMusicBrowser(state);
      }

      window.requestAnimationFrame(() => {
        ensureVisibleWithinViewport(shouldFocusResults ? resultsHost : searchShell || form, {
          paddingTop: window.matchMedia(DESKTOP_MEDIA_QUERY).matches ? 28 : 12,
          paddingBottom: window.matchMedia(DESKTOP_MEDIA_QUERY).matches ? 28 : 20,
        });
      });
    }

    const debouncedSearch = debounce((value) => {
      void updateSuggestions(value);
    }, SEARCH_DEBOUNCE_MS);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void submitSearch(input.value);
    });

    input.addEventListener("input", (event) => {
      state.query = event.target.value.trim();
      state.showSuggestions = state.query.length >= MIN_SEARCH_LENGTH;
      state.activeSuggestionIndex = -1;
      renderMusicBrowser(state);
      debouncedSearch(event.target.value);
    });

    input.addEventListener("focus", () => {
      if (state.suggestions.length && state.query.length >= MIN_SEARCH_LENGTH) {
        state.showSuggestions = true;
        renderMusicBrowser(state);
      }
    });

    input.addEventListener("keydown", (event) => {
      if (!KEYBOARD_NAV_KEYS.has(event.key)) {
        return;
      }

      if (event.key === "Escape") {
        if (state.showSuggestions) {
          clearSuggestions();
          renderMusicBrowser(state);
        }
        return;
      }

      if (!state.showSuggestions || !state.suggestions.length) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        selectSuggestion(state.activeSuggestionIndex + 1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        selectSuggestion(state.activeSuggestionIndex - 1);
        return;
      }

      if (event.key === "Enter" && state.activeSuggestionIndex >= 0) {
        event.preventDefault();
        const track = state.suggestions[state.activeSuggestionIndex];
        input.value = track?.title ?? input.value;
        void submitSearch(input.value);
      }
    });

    suggestionsHost.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-query-value]");
      if (!button) {
        return;
      }

      input.value = button.dataset.queryValue || "";
      void submitSearch(input.value);
    });

    document.addEventListener("click", (event) => {
      if (!form.contains(event.target)) {
        state.showSuggestions = false;
        state.activeSuggestionIndex = -1;
        renderMusicBrowser(state);
      }
    });

    if (suggestionsPanel) {
      suggestionsPanel.dataset.motionState = suggestionsPanel.hidden ? "closed" : "open";
    }

    bindMusicCardMotion();
    renderMusicBrowser(state);
  }

  global.VibeRenderers = global.VibeRenderers || {};
  global.VibeRenderers.initMusicBrowser = initMusicBrowser;
  global.VibeRenderers.renderMusic = renderMusic;
  global.VibeRenderers.renderMusicBrowser = renderMusicBrowser;
})(window);
