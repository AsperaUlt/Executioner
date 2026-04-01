(function attachStatsRenderer(global) {
  function qs(selector) {
    return document.querySelector(selector);
  }

  const renderCache = {
    insightsPrimaryKey: "",
    insightsSecondaryKey: "",
    linePath: "",
    areaPath: "",
    efficiency: null,
  };

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

  function toChartPoints(values) {
    const points = Array.isArray(values) ? values.slice(0, 7) : [];
    if (!points.length) {
      return "";
    }

    const maxVal = Math.max(...points, 1);
    const width = 800;
    const height = 200;
    const padding = 20;
    const stepX = width / Math.max(points.length - 1, 1);

    return points
      .map((val, idx) => {
        const x = Math.round(idx * stepX);
        const normalized = val / maxVal;
        const y = Math.round(height - padding - normalized * (height - padding * 2));
        return `${idx === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  }

  function renderDeepWorkChart(hours) {
    const linePath = toChartPoints(hours);
    if (!linePath) {
      return;
    }

    const areaPath = `${linePath} V200 H0 Z`;
    if (renderCache.linePath === linePath && renderCache.areaPath === areaPath) {
      return;
    }

    renderCache.linePath = linePath;
    renderCache.areaPath = areaPath;

    const lineNode = qs('[data-field="deepWorkLine"]');
    const areaNode = qs('[data-field="deepWorkArea"]');
    if (lineNode) {
      lineNode.setAttribute("d", linePath);
    }
    if (areaNode) {
      areaNode.setAttribute("d", areaPath);
    }
  }

  function renderTaskEfficiency(value) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return;
    }

    const clamped = Math.max(0, Math.min(100, value));
    if (renderCache.efficiency === clamped) {
      return;
    }

    renderCache.efficiency = clamped;
    setText("taskEfficiency", `${clamped}%`);
    setText("taskEfficiencyInsights", `${clamped}%`);

    const ring = qs('[data-field="taskEfficiencyRing"]');
    if (ring) {
      const circumference = 502;
      const offset = Math.round(circumference * (1 - clamped / 100));
      ring.setAttribute("stroke-dashoffset", String(offset));
    }
  }

  function renderInsightsIntoHost(host, items) {
    while (host.children.length > items.length) {
      host.removeChild(host.lastElementChild);
    }

    items.forEach((item, idx) => {
      const titleText = item.title ?? "Untitled Insight";
      const valueText = item.value ?? "";
      const deltaText = item.delta ? ` ${item.delta}` : "";
      const iconText = item.icon ?? "insights";

      let row = host.children[idx];
      if (!row) {
        row = document.createElement("article");
        row.className = "flex items-center gap-4 rounded-[1.4rem] border border-white/5 bg-white/[0.03] p-4";

        const badge = document.createElement("div");
        badge.className = "flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary";

        const content = document.createElement("div");
        content.className = "min-w-0 flex-1";

        const title = document.createElement("p");
        title.className = "truncate text-sm font-semibold";

        const desc = document.createElement("p");
        desc.className = "truncate text-xs text-slate-400";

        content.append(title, desc);
        row.append(badge, content);
        host.appendChild(row);
      }

      const badgeNode = row.children[0];
      const contentNode = row.children[1];
      const titleNode = contentNode.children[0];
      const descNode = contentNode.children[1];

      badgeNode.textContent = iconText;
      badgeNode.className = "material-symbols-outlined flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary";
      titleNode.textContent = titleText;
      descNode.textContent = `${valueText}${deltaText}`.trim() || "No insight details";
    });
  }

  function renderInsights(insights) {
    const items = Array.isArray(insights) ? insights.slice(0, 5) : [];
    const primaryHost = qs('[data-module="flow-insights"]');
    const secondaryHost = qs('[data-module="flow-insights-secondary"]');
    const key = JSON.stringify(items.map((item) => [item?.title ?? "", item?.value ?? "", item?.delta ?? "", item?.icon ?? ""]));

    if (primaryHost && renderCache.insightsPrimaryKey !== key) {
      renderCache.insightsPrimaryKey = key;
      renderInsightsIntoHost(primaryHost, items);
    }

    if (secondaryHost && renderCache.insightsSecondaryKey !== key) {
      renderCache.insightsSecondaryKey = key;
      renderInsightsIntoHost(secondaryHost, items);
    }
  }

  function renderStats(summary, stats) {
    setText("focusMinutes", summary?.focusMinutes ?? "--");
    setText("focusMinutesTasksView", summary?.focusMinutes ?? "--");
    setText("tasksClosed", summary?.tasksClosed ?? "--");
    setText("tasksClosedTasksView", summary?.tasksClosed ?? "--");
    setText("focusScore", summary?.focusScore ?? "--");
    setText("greeting", summary?.greeting ?? "Awaiting signal");
    renderTaskEfficiency(stats?.taskEfficiency);
    renderDeepWorkChart(stats?.deepWorkHours);
    renderInsights(stats?.insights ?? []);
  }

  global.VibeRenderers = global.VibeRenderers || {};
  global.VibeRenderers.renderStats = renderStats;
})(window);
