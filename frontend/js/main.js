(function bootApp(global) {
  const { fetchAllData } = global.VibeApi;
  const { createState, mergeData } = global.VibeState;
  const { initMusicBrowser, initTasks, renderFiles, renderMusic, renderMusicBrowser, renderStats, renderTasks } = global.VibeRenderers;

  const state = createState();
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
    renderTasks(state);
    renderFiles(state.quickAccess);
    renderMusic(state.music);
    renderMusicBrowser(state.musicBrowser);
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    setStatus("Loading live data...");

    try {
      const payload = await fetchAllData();
      Object.assign(state, mergeData(state, payload));
      renderAll();
      setStatus("Live data connected");
    } catch (error) {
      console.error(error);
      setStatus("Backend offline, showing fallback values");
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
      context.fillStyle = "rgba(151, 247, 255, 0.55)";

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
    bindNavigation();
    bindUiActions();
    initMusicBrowser(state.musicBrowser);
    initTasks(state, loadAndRender);
    initBackgroundFx();
    void loadAndRender();
  }

  window.addEventListener("DOMContentLoaded", init, { once: true });
})(window);
