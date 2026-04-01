(function attachMusicRenderer(global) {
  function setText(field, value) {
    const nodes = document.querySelectorAll(`[data-field="${field}"]`);
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

  let queueKey = "";
  let homeQueueKey = "";
  let progressKey = null;

  function setProgress(field, value) {
    const nodes = document.querySelectorAll(`[data-field="${field}"]`);
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

    const current = music.current ?? {};
    const queue = Array.isArray(music.queue) ? music.queue.slice(0, 6) : [];

    setText("trackTitle", current.title ?? "No Track");
    setText("audioHeroTitle", current.title ?? "No Track");
    setText("footerTrackTitle", current.title ?? "No Track");
    setText("trackArtist", current.artist ?? "Offline");
    setText("audioHeroArtist", current.artist ?? "Offline");
    setText("audioCompactArtist", current.artist ?? "Offline");
    setText("footerTrackArtist", current.artist ?? "Offline");
    setText("queueCount", queue.length);
    setText("queueCountAudio", queue.length);

    if (typeof current.progress === "number" && progressKey !== current.progress) {
      progressKey = current.progress;
      setProgress("trackProgress", current.progress);
      setProgress("footerTrackProgress", current.progress);
    }

    const nextKey = JSON.stringify(queue.map((item) => [item?.id ?? "", item?.title ?? "", item?.duration ?? ""]));
    const queueHost = document.querySelector('[data-module="music-queue"]');
    const homeQueueHost = document.querySelector('[data-module="home-queue"]');

    if (queueHost && queueKey !== nextKey) {
      queueKey = nextKey;
      renderQueueCards(queueHost, queue);
    }

    if (homeQueueHost && homeQueueKey !== nextKey) {
      homeQueueKey = nextKey;
      renderCompactQueue(homeQueueHost, queue.slice(0, 4));
    }
  }

  global.VibeRenderers = global.VibeRenderers || {};
  global.VibeRenderers.renderMusic = renderMusic;
})(window);
