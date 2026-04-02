(function attachTaskRenderer(global) {
  const { completeTask, createTask } = global.VibeApi;

  function streamMeta(state) {
    switch (state) {
      case "current":
        return {
          label: "Current",
          rowClass: "border-primary/20 bg-primary/10 shadow-neon",
          titleClass: "truncate text-sm font-semibold text-white",
          etaClass: "mt-1 text-xs text-primary/80",
          badgeClass: "bg-primary text-slate-950 border border-primary",
        };
      case "next":
        return {
          label: "Next",
          rowClass: "border-secondary/20 bg-secondary/10",
          titleClass: "truncate text-sm font-semibold text-white",
          etaClass: "mt-1 text-xs text-secondary/80",
          badgeClass: "bg-secondary/20 text-secondary border border-secondary/20",
        };
      case "completed":
        return {
          label: "Completed",
          rowClass: "border-white/5 bg-white/[0.02] opacity-60",
          titleClass: "truncate text-sm font-semibold text-slate-300",
          etaClass: "mt-1 text-xs text-slate-500",
          badgeClass: "bg-white/[0.05] text-slate-400 border border-white/10",
        };
      default:
        return {
          label: "Queued",
          rowClass: "border-white/5 bg-white/[0.03]",
          titleClass: "truncate text-sm font-semibold text-white",
          etaClass: "mt-1 text-xs text-slate-400",
          badgeClass: "bg-white/[0.05] text-slate-300 border border-white/10",
        };
    }
  }

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

  function qs(selector) {
    return document.querySelector(selector);
  }

  function setText(selector, value) {
    const node = qs(selector);
    if (node) {
      node.textContent = value;
    }
  }

  let timelineKey = "";
  let boardKey = "";
  let completedKey = "";
  let currentKey = "";
  let nextKey = "";
  let taskFormBound = false;
  let taskActionBound = false;
  let taskPending = false;

  function renderTimeline(host, items) {
    while (host.children.length > items.length) {
      host.removeChild(host.lastElementChild);
    }

    items.forEach((task, idx) => {
      const meta = streamMeta(task?.streamState);
      let row = host.children[idx];
      if (!row) {
        row = document.createElement("article");
        row.className = "flex items-center justify-between gap-4 rounded-[1.4rem] border p-4 transition";

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
      row.className = `flex items-center justify-between gap-4 rounded-[1.4rem] border p-4 transition ${meta.rowClass}`;
      left.children[0].className = meta.titleClass;
      left.children[1].className = meta.etaClass;
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
      eta.textContent = `ETA ${task?.eta ?? "--:--"} | ID ${task?.id ?? "n/a"}`;
    });
  }

  function renderFocusCard(host, task, options = {}) {
    if (!host) {
      return;
    }

    const {
      accentClass = "border-primary/10 bg-primary/5",
      emptyMessage = "No task assigned.",
      heading = "Task",
      actionLabel = "",
      actionName = "",
      muted = false,
    } = options;

    if (!host.dataset.ready) {
      host.className = `rounded-[1.8rem] border p-5 ${accentClass}`;

      const label = document.createElement("p");
      label.className = "text-[11px] uppercase tracking-[0.22em] text-slate-400";

      const title = document.createElement("h4");
      title.className = "mt-3 font-headline text-2xl font-bold";

      const meta = document.createElement("p");
      meta.className = "mt-2 text-sm text-slate-300";

      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "mt-5 rounded-2xl bg-primary px-4 py-3 font-headline text-sm font-bold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";
      button.hidden = true;

      host.append(label, title, meta, button);
      host.dataset.ready = "true";
    }

    host.className = `rounded-[1.8rem] border p-5 ${accentClass} ${muted ? "opacity-70" : ""}`;
    host.children[0].textContent = heading;
    host.children[1].textContent = task?.title ?? emptyMessage;
    host.children[2].textContent = task ? `ETA ${task?.eta ?? "--:--"} | ${task?.id ?? "n/a"}` : "Waiting for task updates.";

    const button = host.children[3];
    if (task && actionLabel && actionName) {
      button.hidden = false;
      button.textContent = actionLabel;
      button.dataset.action = actionName;
      button.dataset.taskId = task.id ?? "";
      button.disabled = taskPending;
    } else {
      button.hidden = true;
      button.textContent = "";
      button.dataset.action = "";
      button.dataset.taskId = "";
    }
  }

  function renderCompleted(host, items) {
    if (!host) {
      return;
    }

    while (host.children.length > items.length) {
      host.removeChild(host.lastElementChild);
    }

    items.forEach((task, idx) => {
      let row = host.children[idx];
      if (!row) {
        row = document.createElement("article");
        row.className = "rounded-[1.4rem] border border-white/5 bg-white/[0.02] p-4 opacity-60";

        const title = document.createElement("p");
        title.className = "text-sm font-semibold text-slate-300";

        const meta = document.createElement("p");
        meta.className = "mt-2 text-xs text-slate-500";

        row.append(title, meta);
        host.appendChild(row);
      }

      row.children[0].textContent = task?.title ?? "Completed Task";
      row.children[1].textContent = `ETA ${task?.eta ?? "--:--"} | ${task?.id ?? "n/a"}`;
    });
  }

  function renderTaskFeedback(taskUi) {
    const node = qs('[data-module="task-feedback"]');
    if (!node) {
      return;
    }

    const hasError = Boolean(taskUi?.error);
    const message = hasError ? taskUi.error : taskUi?.message || "Create a task to update the execution queue.";

    node.className =
      "mt-4 rounded-[1.4rem] border px-4 py-3 text-sm " +
      (hasError
        ? "border-red-400/20 bg-red-400/10 text-red-100"
        : taskUi?.status === "success"
          ? "border-tertiary/20 bg-tertiary/10 text-tertiary"
          : "border-white/10 bg-white/[0.03] text-slate-300");
    node.textContent = message;
  }

  function renderTasks(state) {
    if (!state || typeof state !== "object") {
      return;
    }

    const boardItems = Array.isArray(state.tasks) ? state.tasks.filter((task) => task?.status !== "done").slice(0, 6) : [];
    const timelineItems = Array.isArray(state.taskStream?.items) ? state.taskStream.items.slice(0, 6) : boardItems;
    const completedItems = Array.isArray(state.taskCompleted?.items) ? state.taskCompleted.items.slice(0, 6) : [];
    const timelineNextKey = JSON.stringify(
      timelineItems.map((task) => [task?.id ?? "", task?.title ?? "", task?.eta ?? "", task?.status ?? "", task?.streamState ?? ""])
    );
    const boardNextKey = JSON.stringify(boardItems.map((task) => [task?.id ?? "", task?.title ?? "", task?.eta ?? "", task?.status ?? ""]));
    const completedNextKey = JSON.stringify(completedItems.map((task) => [task?.id ?? "", task?.title ?? "", task?.eta ?? ""]));
    const currentNextKey = JSON.stringify(state.taskCurrent ?? null);
    const nextTaskKey = JSON.stringify(state.taskNext ?? null);
    const timelineHost = qs('[data-module="task-timeline"]');
    const boardHost = qs('[data-module="task-board"]');
    const currentHost = qs('[data-module="task-current"]');
    const nextHost = qs('[data-module="task-next"]');
    const completedHost = qs('[data-module="task-completed"]');

    if (timelineHost && timelineKey !== timelineNextKey) {
      timelineKey = timelineNextKey;
      renderTimeline(timelineHost, timelineItems);
    }

    if (boardHost && boardKey !== boardNextKey) {
      boardKey = boardNextKey;
      renderBoard(boardHost, boardItems);
    }

    if (completedHost && completedKey !== completedNextKey) {
      completedKey = completedNextKey;
      renderCompleted(completedHost, completedItems);
    }

    if (currentHost) {
      currentKey = currentNextKey;
      renderFocusCard(currentHost, state.taskCurrent, {
        heading: "Current Task",
        emptyMessage: "No current task",
        accentClass: "border-primary/10 bg-primary/5",
        actionLabel: "Mark Complete",
        actionName: "complete-current-task",
      });
    }

    if (nextHost) {
      nextKey = nextTaskKey;
      renderFocusCard(nextHost, state.taskNext, {
        heading: "Next Task",
        emptyMessage: "No next task",
        accentClass: "border-secondary/20 bg-secondary/10",
      });
    }

    setText('[data-field="taskActiveCount"]', String(boardItems.length));
    setText('[data-field="taskCompletedCount"]', String(completedItems.length));
    renderTaskFeedback(state.taskUi);
  }

  function initTasks(state, reload) {
    const form = qs('[data-module="task-create-form"]');
    const input = qs('[data-module="task-create-input"]');
    const currentHost = qs('[data-module="task-current"]');

    if (!form || !input || !currentHost) {
      return;
    }

    if (!taskFormBound) {
      taskFormBound = true;
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const title = input.value.trim();

        if (!title || taskPending) {
          state.taskUi.status = "error";
          state.taskUi.error = title ? "Task action is still running." : "Task title is required.";
          state.taskUi.message = "";
          renderTasks(state);
          return;
        }

        taskPending = true;
        state.taskUi.status = "saving";
        state.taskUi.error = "";
        state.taskUi.message = "Creating task...";
        renderTasks(state);

        try {
          await createTask({ title });
          input.value = "";
          await reload();
          state.taskUi.status = "success";
          state.taskUi.error = "";
          state.taskUi.message = "Task created and queued.";
        } catch (error) {
          state.taskUi.status = "error";
          state.taskUi.error = error?.message || "Failed to create task.";
          state.taskUi.message = "";
        } finally {
          taskPending = false;
          renderTasks(state);
        }
      });
    }

    if (!taskActionBound) {
      taskActionBound = true;
      currentHost.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action='complete-current-task']");
        if (!button || taskPending) {
          return;
        }

        const taskId = button.dataset.taskId;
        if (!taskId) {
          return;
        }

        taskPending = true;
        state.taskUi.status = "saving";
        state.taskUi.error = "";
        state.taskUi.message = "Completing current task...";
        renderTasks(state);

        try {
          await completeTask(taskId);
          await reload();
          state.taskUi.status = "success";
          state.taskUi.error = "";
          state.taskUi.message = "Current task completed.";
        } catch (error) {
          state.taskUi.status = "error";
          state.taskUi.error = error?.message || "Failed to complete current task.";
          state.taskUi.message = "";
        } finally {
          taskPending = false;
          renderTasks(state);
        }
      });
    }

    renderTasks(state);
  }

  global.VibeRenderers = global.VibeRenderers || {};
  global.VibeRenderers.initTasks = initTasks;
  global.VibeRenderers.renderTasks = renderTasks;
})(window);
