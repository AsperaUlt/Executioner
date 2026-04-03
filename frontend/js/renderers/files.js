(function attachFileRenderer(global) {
  let quickAccessKey = "";
  let accessDeckKey = "";

  function formatAccessTime(value) {
    if (!value) {
      return "Unknown access time";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function renderQuickAccess(host, items) {
    while (host.children.length > items.length) {
      host.removeChild(host.lastElementChild);
    }

    items.forEach((item, index) => {
      let row = host.children[index];
      if (!row) {
        row = document.createElement("article");
        row.className = "rounded-[1.4rem] border border-white/5 bg-white/[0.03] p-4";

        const title = document.createElement("p");
        title.className = "truncate text-sm font-semibold";

        const path = document.createElement("p");
        path.className = "mt-2 truncate text-xs text-slate-400";

        const meta = document.createElement("div");
        meta.className = "mt-3 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em]";

        const type = document.createElement("span");
        type.className = "rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-slate-300";

        const status = document.createElement("span");
        status.className = "text-slate-500";

        meta.append(type, status);
        row.append(title, path, meta);
        host.appendChild(row);
      }

      const canOpen = item?.canOpen === true;
      row.children[0].textContent = item?.title ?? "Untitled";
      row.children[1].textContent = item?.path ?? "No path";
      row.children[2].children[0].textContent = item?.type ?? "unknown";
      row.children[2].children[1].textContent = `${formatAccessTime(item?.lastAccessed)} · ${canOpen ? "openable" : "preview only"}`;
      row.classList.toggle("opacity-70", !canOpen);
    });
  }

  function renderFiles(quickAccess) {
    const items = Array.isArray(quickAccess?.items) ? quickAccess.items.slice(0, 4) : [];
    const host = document.querySelector('[data-module="file-quick-access"]');
    if (!host) {
      return;
    }

    const nextKey = JSON.stringify(
      items.map((item) => [item?.id ?? "", item?.title ?? "", item?.path ?? "", item?.type ?? "", item?.lastAccessed ?? "", item?.canOpen ?? false])
    );

    if (quickAccessKey === nextKey) {
      return;
    }

    quickAccessKey = nextKey;
    renderQuickAccess(host, items);
  }

  function renderAccessDeck(accessDeck) {
    const items = Array.isArray(accessDeck?.items) ? accessDeck.items : [];
    const buttons = document.querySelectorAll("[data-action$='-entry']");
    if (!buttons.length) {
      return;
    }

    const nextKey = JSON.stringify(
      items.map((item) => [item?.id ?? "", item?.label ?? "", item?.href ?? "", item?.icon ?? "", item?.variant ?? "", item?.enabled ?? false])
    );
    if (accessDeckKey === nextKey) {
      return;
    }

    accessDeckKey = nextKey;
    const itemMap = new Map(items.map((item) => [item?.id, item]));

    buttons.forEach((button) => {
      const action = button.getAttribute("data-action") || "";
      const id = action.replace("-entry", "");
      const item = itemMap.get(id);
      if (!item) {
        return;
      }

      button.href = item.href || "#";
      button.title = item.description || item.title || "";
      button.setAttribute("aria-label", item.title || item.label || id);
      button.toggleAttribute("aria-disabled", item.enabled === false);
      button.classList.toggle("opacity-50", item.enabled === false);

      const iconNode = button.querySelector(".material-symbols-outlined");
      const labelNode = button.querySelector("span:last-child");
      if (iconNode && item.icon) {
        iconNode.textContent = item.icon;
      }
      if (labelNode && item.label) {
        labelNode.textContent = item.label;
      }
    });
  }

  global.VibeRenderers = global.VibeRenderers || {};
  global.VibeRenderers.renderAccessDeck = renderAccessDeck;
  global.VibeRenderers.renderFiles = renderFiles;
})(window);
