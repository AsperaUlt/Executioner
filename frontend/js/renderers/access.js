(function attachAccessRenderer(global) {
  const { fetchLoginStatus, loginWithCellphone, loginWithEmail } = global.VibeApi;
  const COOKIE_STORAGE_KEY = "vibe.music.cookie";
  let activeModalTimeline = null;

  function qs(selector) {
    return document.querySelector(selector);
  }

  function qsa(selector) {
    return document.querySelectorAll(selector);
  }

  function setText(field, value) {
    qsa(`[data-field="${field}"]`).forEach((node) => {
      node.textContent = String(value ?? "");
    });
  }

  function setFeedback(message, isError = false) {
    const node = qs('[data-module="login-feedback"]');
    if (!node) {
      return;
    }

    node.textContent = message;
    node.classList.toggle("border-red-400/20", isError);
    node.classList.toggle("bg-red-400/10", isError);
    node.classList.toggle("text-red-100", isError);
    node.classList.toggle("border-white/8", !isError);
    node.classList.toggle("bg-white/[0.04]", !isError);
    node.classList.toggle("text-slate-300", !isError);
  }

  function readStoredCookie() {
    try {
      return window.localStorage.getItem(COOKIE_STORAGE_KEY) || "";
    } catch (_error) {
      return "";
    }
  }

  function writeStoredCookie(cookie) {
    try {
      if (cookie) {
        window.localStorage.setItem(COOKIE_STORAGE_KEY, cookie);
      } else {
        window.localStorage.removeItem(COOKIE_STORAGE_KEY);
      }
    } catch (_error) {
      // Ignore storage failures and keep UI usable.
    }
  }

  async function refreshLoginStatus() {
    const cookie = readStoredCookie();
    if (!cookie) {
      setText("loginSessionState", "Not signed in");
      setText("loginSessionMeta", "No saved cookie loaded");
      return;
    }

    try {
      const payload = await fetchLoginStatus(cookie);
      const data = payload?.data || {};
      if (data.loggedIn) {
        setText("loginSessionState", data.nickname || "Session active");
        setText("loginSessionMeta", `User ${data.userId || data.accountId || "--"} is logged in`);
      } else {
        setText("loginSessionState", "Cookie loaded");
        setText("loginSessionMeta", "Stored cookie exists, but upstream status is not active");
      }
    } catch (_error) {
      setText("loginSessionState", "Cookie loaded");
      setText("loginSessionMeta", "Unable to verify upstream login status");
    }
  }

  function setActiveTab(tab) {
    const isEmail = tab !== "cellphone";
    qsa("[data-login-tab]").forEach((button) => {
      const isActive = button.dataset.loginTab === (isEmail ? "email" : "cellphone");
      button.classList.toggle("border-primary/30", isActive);
      button.classList.toggle("bg-primary/12", isActive);
      button.classList.toggle("text-primary", isActive);
      button.classList.toggle("border-white/10", !isActive);
      button.classList.toggle("bg-white/[0.04]", !isActive);
      button.classList.toggle("text-slate-300", !isActive);
    });

    qs('[data-module="login-form-email"]')?.classList.toggle("hidden", !isEmail);
    qs('[data-module="login-form-cellphone"]')?.classList.toggle("hidden", isEmail);
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function animateModalOpen(modal) {
    const gsap = window.gsap;
    const panel = modal?.querySelector('[role="dialog"]');
    if (!modal || !panel || !gsap || prefersReducedMotion()) {
      return;
    }

    const title = panel.querySelector(".vibe-title");
    const kicker = panel.querySelector(".vibe-kicker");
    const actions = panel.querySelectorAll("[data-login-tab], [data-action='close-login-modal'], [data-action='close-help-modal']");
    const sections = panel.querySelectorAll("form, aside > div, [data-module='login-feedback']");

    activeModalTimeline?.kill();
    gsap.killTweensOf([modal, panel, title, kicker, actions, sections]);
    gsap.set(modal, { autoAlpha: 0 });
    gsap.set(panel, { autoAlpha: 0, y: 30, scale: 0.94, transformOrigin: "50% 50%" });
    gsap.set([title, kicker], { autoAlpha: 0, y: 10 });
    gsap.set(actions, { autoAlpha: 0, y: 8 });
    gsap.set(sections, { autoAlpha: 0, y: 16 });

    activeModalTimeline = gsap.timeline({
      defaults: { ease: "power2.out" },
    });

    activeModalTimeline
      .to(modal, { autoAlpha: 1, duration: 0.2 }, 0)
      .to(
        panel,
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.52,
          ease: "back.out(1.2)",
        },
        0
      )
      .to([kicker, title], { autoAlpha: 1, y: 0, duration: 0.24, stagger: 0.04 }, 0.1)
      .to(actions, { autoAlpha: 1, y: 0, duration: 0.2, stagger: 0.03 }, 0.16)
      .to(sections, { autoAlpha: 1, y: 0, duration: 0.26, stagger: 0.05 }, 0.2)
      .set([modal, panel, title, kicker, actions, sections], { clearProps: "transform,opacity,visibility" });
  }

  function animateModalClose(modal, onComplete) {
    const gsap = window.gsap;
    const panel = modal?.querySelector('[role="dialog"]');
    if (!modal || !panel || !gsap || prefersReducedMotion()) {
      onComplete?.();
      return;
    }

    activeModalTimeline?.kill();
    gsap.killTweensOf([modal, panel]);
    activeModalTimeline = gsap.timeline({
      defaults: { ease: "power2.in" },
      onComplete: () => {
        gsap.set([modal, panel], { clearProps: "all" });
        onComplete?.();
      },
    });

    activeModalTimeline
      .to(panel, { autoAlpha: 0, y: 18, scale: 0.97, duration: 0.2 }, 0)
      .to(modal, { autoAlpha: 0, duration: 0.18 }, 0.02);
  }

  function openModal() {
    const modal = qs('[data-module="login-modal"]');
    if (!modal) {
      return;
    }

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    setActiveTab("email");
    setFeedback("Use your Netease account. The returned cookie will be stored in this browser for later authenticated requests.");
    animateModalOpen(modal);
    void refreshLoginStatus();
  }

  function openHelpModal() {
    const modal = qs('[data-module="help-modal"]');
    if (!modal) {
      return;
    }

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    animateModalOpen(modal);
  }

  function closeModal() {
    const modal = qs('[data-module="login-modal"]');
    if (!modal) {
      return;
    }

    animateModalClose(modal, () => {
      modal.hidden = true;
      document.body.style.overflow = "";
    });
  }

  function closeHelpModal() {
    const modal = qs('[data-module="help-modal"]');
    if (!modal) {
      return;
    }

    animateModalClose(modal, () => {
      modal.hidden = true;
      document.body.style.overflow = "";
    });
  }

  async function handleEmailLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = form.elements.email?.value?.trim() || "";
    const password = form.elements.password?.value || "";
    if (!email || !password) {
      setFeedback("Email and password are required.", true);
      return;
    }

    setFeedback("Signing in with email...");
    try {
      const payload = await loginWithEmail({ email, password });
      const data = payload?.data || {};
      if (data.cookie) {
        writeStoredCookie(data.cookie);
      }
      setFeedback(`Signed in as ${data.nickname || email}.`);
      await refreshLoginStatus();
      form.reset();
    } catch (error) {
      setFeedback(error?.message || "Email login failed.", true);
    }
  }

  async function handleCellphoneLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const phone = form.elements.phone?.value?.trim() || "";
    const password = form.elements.password?.value || "";
    const countrycode = form.elements.countrycode?.value?.trim() || "";
    if (!phone || !password) {
      setFeedback("Phone and password are required.", true);
      return;
    }

    setFeedback("Signing in with cellphone...");
    try {
      const payload = await loginWithCellphone({ phone, password, countrycode });
      const data = payload?.data || {};
      if (data.cookie) {
        writeStoredCookie(data.cookie);
      }
      setFeedback(`Signed in as ${data.nickname || phone}.`);
      await refreshLoginStatus();
      form.reset();
      if (form.elements.countrycode) {
        form.elements.countrycode.value = countrycode || "86";
      }
    } catch (error) {
      setFeedback(error?.message || "Cellphone login failed.", true);
    }
  }

  function initAccessDeck() {
    qsa('[data-action="login-entry"]').forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        openModal();
      });
    });

    qsa('[data-action="help-entry"]').forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        openHelpModal();
      });
    });

    qsa('[data-action="close-login-modal"]').forEach((button) => {
      button.addEventListener("click", () => {
        closeModal();
      });
    });

    qsa('[data-action="close-help-modal"]').forEach((button) => {
      button.addEventListener("click", () => {
        closeHelpModal();
      });
    });

    qsa("[data-login-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        setActiveTab(button.dataset.loginTab || "email");
      });
    });

    qs('[data-module="login-form-email"]')?.addEventListener("submit", handleEmailLogin);
    qs('[data-module="login-form-cellphone"]')?.addEventListener("submit", handleCellphoneLogin);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !qs('[data-module="login-modal"]')?.hidden) {
        closeModal();
      }
      if (event.key === "Escape" && !qs('[data-module="help-modal"]')?.hidden) {
        closeHelpModal();
      }
    });

    if (window.location.hash === "#login") {
      openModal();
    } else if (window.location.hash === "#help") {
      openHelpModal();
    } else {
      void refreshLoginStatus();
    }
  }

  global.VibeRenderers = global.VibeRenderers || {};
  global.VibeRenderers.initAccessDeck = initAccessDeck;
})(window);
