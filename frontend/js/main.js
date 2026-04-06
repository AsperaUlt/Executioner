(function bootApp(global) {
  const { fetchAllData } = global.VibeApi;
  const { createState, mergeData } = global.VibeState;
  const { initAccessDeck, initMusicBrowser, initTasks, renderAccessDeck, renderFiles, renderMusic, renderMusicBrowser, renderStats, renderTasks } =
    global.VibeRenderers;

  const state = createState();
  const THEME_STORAGE_KEY = "vibe.theme";
  let themeTransitionTimeline = null;
  let initialized = false;
  let inFlight = false;
  let activeRoute = "home";

  function throttle(fn, waitMs) {
    let lastRun = 0;
    let timer = null;
    let lastArgs = null;

    return (...args) => {
      const now = Date.now();
      const remaining = waitMs - (now - lastRun);
      lastArgs = args;

      if (remaining <= 0) {
        if (timer) {
          window.clearTimeout(timer);
          timer = null;
        }
        lastRun = now;
        fn(...lastArgs);
        return;
      }

      if (timer) {
        return;
      }

      timer = window.setTimeout(() => {
        timer = null;
        lastRun = Date.now();
        fn(...lastArgs);
      }, remaining);
    };
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

  function setStatus(message) {
    const node = document.querySelector('[data-field="apiStatus"]');
    if (node) {
      node.textContent = message;
    }
  }

  function renderAll() {
    renderStats(state.summary, state.stats);
    renderAccessDeck(state.accessDeck);
    renderTasks(state);
    renderFiles(state.quickAccess);
    renderMusic(state.music);
    renderMusicBrowser(state.musicBrowser);
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function getTheme() {
    const theme = document.documentElement.dataset.theme;
    return theme === "light" ? "light" : "dark";
  }

  function updateThemeToggleUi(theme, disabled = false) {
    const icon = document.querySelector('[data-field="themeToggleIcon"]');
    const label = document.querySelector('[data-field="themeToggleLabel"]');
    const button = document.querySelector('[data-action="toggle-theme"]');
    if (icon) {
      icon.textContent = theme === "light" ? "dark_mode" : "light_mode";
    }
    if (label) {
      label.textContent = theme === "light" ? "Night Mode" : "Day Mode";
    }
    if (button) {
      button.disabled = disabled;
      button.classList.toggle("opacity-60", disabled);
      button.classList.toggle("cursor-wait", disabled);
    }
  }

  function applyTheme(theme, options = {}) {
    const { persist = true, notify = true, disabled = false } = options;
    const resolvedTheme = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    if (persist) {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
      } catch (_error) {
        // Keep the UI working even if storage is unavailable.
      }
    }
    updateThemeToggleUi(resolvedTheme, disabled);
    if (notify) {
      window.dispatchEvent(new CustomEvent("vibe:themechange", { detail: { theme: resolvedTheme } }));
    }
  }

  function animateThemeTransition(nextTheme) {
    const gsap = window.gsap;
    if (nextTheme !== "light" || !gsap || prefersReducedMotion()) {
      applyTheme(nextTheme);
      return;
    }

    const overlay = document.querySelector('[data-module="theme-transition-overlay"]');
    const wash = document.querySelector('[data-module="theme-transition-wash"]');
    const beam = document.querySelector('[data-module="theme-transition-beam"]');
    const core = document.querySelector('[data-module="theme-transition-core"]');
    const ring = document.querySelector('[data-module="theme-transition-ring"]');
    const sweep = document.querySelector('[data-module="theme-transition-sweep"]');
    if (!overlay || !wash || !beam || !core || !ring || !sweep) {
      applyTheme(nextTheme);
      return;
    }

    themeTransitionTimeline?.kill();
    overlay.style.visibility = "visible";
    overlay.dataset.transition = "to-light";
    updateThemeToggleUi(getTheme(), true);

    gsap.set(overlay, { autoAlpha: 0 });
    gsap.set(wash, { autoAlpha: 0, scaleY: 1.08, yPercent: 6, transformOrigin: "50% 50%" });
    gsap.set(beam, { autoAlpha: 0, scaleY: 0.42, scaleX: 0.34, yPercent: 4, transformOrigin: "50% 50%" });
    gsap.set(core, { autoAlpha: 0, scale: 0.46, filter: "blur(18px)", transformOrigin: "50% 50%" });
    gsap.set(ring, { autoAlpha: 0, scale: 0.82, rotation: -8, transformOrigin: "50% 50%" });
    gsap.set(sweep, { autoAlpha: 0, xPercent: -18, yPercent: 4, rotation: -10, transformOrigin: "50% 50%" });

    themeTransitionTimeline = gsap.timeline({
      defaults: { ease: "power2.out" },
      onComplete: () => {
        gsap.set(overlay, { clearProps: "opacity,visibility" });
        gsap.set([wash, beam, core, ring, sweep], { clearProps: "all" });
        themeTransitionTimeline = null;
        updateThemeToggleUi(getTheme(), false);
      },
    });

    themeTransitionTimeline
      .to(overlay, { autoAlpha: 1, duration: 0.24 }, 0)
      .to(beam, { autoAlpha: 0.32, scaleY: 0.9, scaleX: 0.46, yPercent: 0, duration: 0.58, ease: "sine.out" }, 0.02)
      .to(core, { autoAlpha: 0.34, scale: 0.92, filter: "blur(12px)", duration: 0.64, ease: "sine.out" }, 0.06)
      .to(ring, { autoAlpha: 0.24, scale: 1.04, rotation: 0, duration: 0.72, ease: "sine.out" }, 0.1)
      .to(sweep, { autoAlpha: 0.26, xPercent: 10, yPercent: 0, duration: 0.78, ease: "sine.inOut" }, 0.16)
      .addLabel("reveal", 0.38)
      .call(() => {
        applyTheme("light", { notify: true, disabled: true });
      }, null, "reveal")
      .to(wash, { autoAlpha: 0.8, scaleY: 1, yPercent: 0, duration: 0.6, ease: "sine.out" }, "reveal-=0.04")
      .to(beam, { scaleX: 0.62, autoAlpha: 0.16, duration: 0.54, ease: "sine.inOut" }, "reveal")
      .to(core, { scale: 1.08, autoAlpha: 0.16, duration: 0.56, ease: "sine.out" }, "reveal+=0.04")
      .to(ring, { scale: 1.1, autoAlpha: 0.08, duration: 0.62, ease: "sine.out" }, "reveal+=0.06")
      .to(sweep, { xPercent: 24, autoAlpha: 0.14, duration: 0.58, ease: "sine.inOut" }, "reveal+=0.08")
      .to(
        overlay,
        {
          autoAlpha: 0,
          duration: 0.48,
          ease: "sine.inOut",
        },
        "reveal+=0.5"
      );
  }

  function syncFooterOffset() {
    const root = document.documentElement;
    const footer = document.querySelector(".app-footer");
    if (!root || !footer) {
      return;
    }

    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    if (!isDesktop) {
      root.style.setProperty("--app-footer-offset", "0.75rem");
      return;
    }

    const footerHeight = Math.ceil(footer.getBoundingClientRect().height);
    const bottomGap = 16;
    root.style.setProperty("--app-footer-offset", `${footerHeight + bottomGap}px`);
  }

  function animateRoutePanel(route) {
    const panel = document.querySelector(`[data-route-panel="${route}"]`);
    const gsap = window.gsap;
    if (!panel) {
      return;
    }

    const cards = panel.querySelectorAll(route === "music" ? '[data-motion="music-card"]' : '[data-motion="glass-card"]');
    if (!cards.length || !gsap || prefersReducedMotion()) {
      cards.forEach((card) => {
        card.style.opacity = "1";
        card.style.transform = "";
      });
      return;
    }

    gsap.killTweensOf(cards);
    const isDesktop = window.matchMedia("(min-width: 1280px)").matches;
    const isMusicRoute = route === "music";

    gsap.fromTo(
      cards,
      {
        autoAlpha: 0,
        y: isMusicRoute ? (isDesktop ? 24 : 14) : isDesktop ? 34 : 18,
        x: isMusicRoute ? 0 : isDesktop ? 8 : 0,
        scale: isMusicRoute ? 0.975 : 1,
        rotate: isMusicRoute ? (isDesktop ? -0.35 : -0.15) : 0,
        filter: isMusicRoute ? "blur(10px)" : "blur(0px)",
      },
      {
        autoAlpha: 1,
        y: 0,
        x: 0,
        scale: 1,
        rotate: 0,
        filter: "blur(0px)",
        duration: isMusicRoute ? (isDesktop ? 0.9 : 0.62) : isDesktop ? 0.72 : 0.48,
        ease: isMusicRoute ? "back.out(1.05)" : "power3.out",
        stagger: isMusicRoute ? (isDesktop ? 0.07 : 0.045) : isDesktop ? 0.08 : 0.05,
        clearProps: "transform,opacity,visibility,filter",
      }
    );
  }

  async function loadAndRender() {
    if (inFlight) {
      return;
    }

    inFlight = true;
    setStatus("Loading data...");

    try {
      const payload = await fetchAllData();
      Object.assign(state, mergeData(state, payload));
      renderAll();
      setStatus("Live");
    } catch (error) {
      console.error(error);
      setStatus("Offline");
      renderAll();
    } finally {
      inFlight = false;
    }
  }

  function switchRoute(route) {
    const panels = document.querySelectorAll("[data-route-panel]");
    const navLinks = document.querySelectorAll("[data-route-link]");
    activeRoute = route;

    panels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.routePanel === route);
    });

    navLinks.forEach((link) => {
      const isActive = link.dataset.routeLink === route;
      link.classList.toggle("active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    if (window.location.hash !== `#${route}`) {
      history.replaceState(null, "", `#${route}`);
    }

    if (window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }

    animateRoutePanel(route);
  }

  function bindNavigation() {
    const validRoutes = new Set(["home", "tasks", "music", "insights"]);
    document.querySelectorAll("[data-route-link]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        switchRoute(link.dataset.routeLink);
      });
    });

    const hashRoute = window.location.hash.replace("#", "");
    const initialRoute = hashRoute === "audio" ? "music" : hashRoute;
    switchRoute(validRoutes.has(initialRoute) ? initialRoute : "home");

    window.addEventListener("hashchange", () => {
      const hashValue = window.location.hash.replace("#", "");
      const nextRoute = hashValue === "audio" ? "music" : hashValue;
      if (validRoutes.has(nextRoute) && nextRoute !== activeRoute) {
        switchRoute(nextRoute);
      }
    });
  }

  function bindUiActions() {
    const throttledRefresh = throttle(() => {
      void loadAndRender();
    }, 1000);

    document.querySelector('[data-action="refresh"]')?.addEventListener("click", throttledRefresh);
    document.querySelector('[data-action="toggle-theme"]')?.addEventListener("click", () => {
      const nextTheme = getTheme() === "dark" ? "light" : "dark";
      animateThemeTransition(nextTheme);
    });
  }

  function bindLayoutSync() {
    const footer = document.querySelector(".app-footer");
    if (!footer) {
      return;
    }

    syncFooterOffset();
    const throttledSyncFooterOffset = throttle(syncFooterOffset, 80);

    if (typeof window.ResizeObserver === "function") {
      const resizeObserver = new window.ResizeObserver(() => {
        throttledSyncFooterOffset();
      });
      resizeObserver.observe(footer);
    }

    window.addEventListener("resize", throttledSyncFooterOffset, { passive: true });
    window.addEventListener("orientationchange", throttledSyncFooterOffset, { passive: true });
  }

  function initBackgroundFx() {
    const canvas = document.getElementById("fx-canvas");
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const particles = [];
    const pointer = { x: 0.5, y: 0.5 };
    let width = 0;
    let height = 0;
    let lastFrame = 0;
    const targetFps = 30;
    const minFrameInterval = 1000 / targetFps;
    const particleCount = 18;

    function getParticleColor() {
      return getTheme() === "light" ? "rgba(13, 148, 136, 0.28)" : "rgba(151, 247, 255, 0.55)";
    }

    function resizeCanvas() {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seedParticles() {
      particles.length = 0;
      for (let index = 0; index < particleCount; index += 1) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: 1.5 + Math.random() * 2.5,
          driftX: (Math.random() - 0.5) * 0.35,
          driftY: (Math.random() - 0.5) * 0.35,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    const debouncedResize = debounce(() => {
      resizeCanvas();
      seedParticles();
    }, 120);

    const throttledPointer = throttle((event) => {
      pointer.x = event.clientX / Math.max(window.innerWidth, 1);
      pointer.y = event.clientY / Math.max(window.innerHeight, 1);

      document.querySelectorAll("[data-parallax]").forEach((node, index) => {
        const shiftX = (pointer.x - 0.5) * (18 + index * 8);
        const shiftY = (pointer.y - 0.5) * (18 + index * 8);
        node.style.transform = `translate3d(${shiftX}px, ${shiftY}px, 0)`;
      });
    }, 24);

    function drawFrame(timestamp) {
      window.requestAnimationFrame(drawFrame);
      if (timestamp - lastFrame < minFrameInterval) {
        return;
      }
      lastFrame = timestamp;

      context.clearRect(0, 0, width, height);
      context.fillStyle = getParticleColor();

      particles.forEach((particle, index) => {
        particle.phase += 0.015;
        particle.x += particle.driftX + (pointer.x - 0.5) * 0.12;
        particle.y += particle.driftY + (pointer.y - 0.5) * 0.12;

        if (particle.x < -20) particle.x = width + 20;
        if (particle.x > width + 20) particle.x = -20;
        if (particle.y < -20) particle.y = height + 20;
        if (particle.y > height + 20) particle.y = -20;

        const glow = particle.radius + Math.sin(particle.phase + index) * 0.8;
        context.beginPath();
        context.arc(particle.x, particle.y, glow, 0, Math.PI * 2);
        context.fill();
      });
    }

    resizeCanvas();
    seedParticles();

    window.addEventListener("resize", debouncedResize);
    window.addEventListener("pointermove", throttledPointer, { passive: true });
    window.requestAnimationFrame(drawFrame);
  }

  function init() {
    if (initialized) {
      return;
    }

    initialized = true;
    updateThemeToggleUi(getTheme());
    bindNavigation();
    bindUiActions();
    bindLayoutSync();
    initAccessDeck();
    initMusicBrowser(state.musicBrowser);
    initTasks(state, loadAndRender);
    initBackgroundFx();
    void loadAndRender();
  }

  window.addEventListener("DOMContentLoaded", init, { once: true });
})(window);
