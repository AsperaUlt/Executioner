(function attachTaskRenderer(global) {
  function statusMeta(status) {
    switch (status) {
      case "done":
        return {
          label: "Done",
          badgeClass: "bg-tertiary/10 text-tertiary border border-tertiary/20",
          icon: "check_circle",
        };
      case "in_progress":
        return {
          label: "In Progress",
          badgeClass: "bg-primary/10 text-primary border border-primary/20",
          icon: "autorenew",
        };
      default:
        return {
          label: "Todo",
          badgeClass: "bg-white/[0.05] text-slate-300 border border-white/10",
          icon: "schedule",
        };
    }
  }

  let timelineKey = "";
  let boardKey = "";

  function renderTimeline(host, items) {
    while (host.children.length > items.length) {
      host.removeChild(host.lastElementChild);
    }

    items.forEach((task, idx) => {
      const meta = statusMeta(task?.status);
      let row = host.children[idx];
      if (!row) {
        row = document.createElement("article");
        row.className = "flex items-center justify-between gap-4 rounded-[1.4rem] border border-white/5 bg-white/[0.03] p-4";

        const left = document.createElement("div");
        left.className = "min-w-0 flex-1";

        const title = document.createElement("p");
        title.className = "truncate text-sm font-semibold";

        const eta = document.createElement("p");
        eta.className = "mt-1 text-xs text-slate-400";

        const status = document.createElement("span");
        status.className = "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]";

        left.append(title, eta);
        row.append(left, status);
        host.appendChild(row);
      }

      const left = row.children[0];
      const status = row.children[1];
      left.children[0].textContent = task?.title ?? "Untitled Task";
      left.children[1].textContent = `ETA ${task?.eta ?? "--:--"}`;
      status.textContent = meta.label;
      status.className = `rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${meta.badgeClass}`;
    });
  }

  function renderBoard(host, items) {
    while (host.children.length > items.length) {
      host.removeChild(host.lastElementChild);
    }

    items.forEach((task, idx) => {
      const meta = statusMeta(task?.status);
      let card = host.children[idx];
      if (!card) {
        card = document.createElement("article");
        card.className = "rounded-[1.6rem] border border-white/5 bg-white/[0.03] p-5";

        const head = document.createElement("div");
        head.className = "flex items-start justify-between gap-4";

        const iconWrap = document.createElement("div");
        iconWrap.className = "flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] text-primary";

        const badge = document.createElement("span");
        badge.className = "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]";

        const title = document.createElement("h4");
        title.className = "mt-5 font-headline text-xl font-bold";

        const eta = document.createElement("p");
        eta.className = "mt-2 text-sm text-slate-400";

        head.append(iconWrap, badge);
        card.append(head, title, eta);
        host.appendChild(card);
      }

      const head = card.children[0];
      const iconWrap = head.children[0];
      const badge = head.children[1];
      const title = card.children[1];
      const eta = card.children[2];

      iconWrap.textContent = meta.icon;
      iconWrap.className = "material-symbols-outlined flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] text-primary";
      badge.textContent = meta.label;
      badge.className = `rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${meta.badgeClass}`;
      title.textContent = task?.title ?? "Untitled Task";
      eta.textContent = `ETA ${task?.eta ?? "--:--"} · ID ${task?.id ?? "n/a"}`;
    });
  }

  function renderTasks(tasks) {
    if (!Array.isArray(tasks)) {
      return;
    }

    const items = tasks.slice(0, 6);
    const nextKey = JSON.stringify(items.map((task) => [task?.id ?? "", task?.title ?? "", task?.eta ?? "", task?.status ?? ""]));
    const timelineHost = document.querySelector('[data-module="task-timeline"]');
    const boardHost = document.querySelector('[data-module="task-board"]');

    if (timelineHost && timelineKey !== nextKey) {
      timelineKey = nextKey;
      renderTimeline(timelineHost, items);
    }

    if (boardHost && boardKey !== nextKey) {
      boardKey = nextKey;
      renderBoard(boardHost, items);
    }
  }

  global.VibeRenderers = global.VibeRenderers || {};
  global.VibeRenderers.renderTasks = renderTasks;
})(window);
