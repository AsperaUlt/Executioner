(function attachAccessRenderer(global) {
  const { checkQrLogin, commitQrLogin, createQrLoginImage, createQrLoginKey, fetchLogStatus, loginWithCellphone, logout, sendCellphoneLoginCode } = global.VibeApi;
  let activeModalTimeline = null;
  let sessionLoggedIn = false;
  let sendCodeCooldownTimer = null;
  let sendCodeSecondsRemaining = 0;
  let qrPollTimer = null;
  let activeQrKey = "";
  let qrGeneration = 0;

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

  function setQrState({ image = "", status = "Ready to generate", meta = "No QR session yet." } = {}) {
    const imageNode = qs('[data-module="qr-login-image"]');
    const emptyNode = qs('[data-module="qr-login-empty"]');
    const statusNode = qs('[data-field="qrLoginState"]');
    const metaNode = qs('[data-field="qrLoginMeta"]');
    const refreshButton = qs('[data-action="refresh-qr-login"]');

    if (imageNode) {
      imageNode.src = image || "";
      imageNode.hidden = !image;
    }
    if (emptyNode) {
      emptyNode.hidden = Boolean(image);
    }
    if (statusNode) {
      statusNode.textContent = status;
    }
    if (metaNode) {
      metaNode.textContent = meta;
    }
    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.classList.remove("opacity-60", "cursor-not-allowed");
    }
  }

  function stopQrPolling() {
    if (qrPollTimer) {
      window.clearInterval(qrPollTimer);
      qrPollTimer = null;
    }
    activeQrKey = "";
  }

  async function pollQrLoginStatus(expectedKey, generation) {
    if (!expectedKey || generation !== qrGeneration || expectedKey !== activeQrKey) {
      return;
    }

    try {
      const payload = await checkQrLogin(expectedKey);
      const data = payload?.data || {};
      if (generation !== qrGeneration || expectedKey !== activeQrKey) {
        return;
      }

      if (data.authorized) {
        setQrState({
          image: qs('[data-module="qr-login-image"]')?.src || "",
          status: data.statusLabel || "Authorized",
          meta: data.message || "Scan confirmed. Session is being activated.",
        });
        stopQrPolling();
        await commitQrLogin(expectedKey);
        setFeedback("QR login authorized.");
        await refreshLoginStatus();
        return;
      }

      if (data.expired) {
        setQrState({
          image: "",
          status: data.statusLabel || "Expired",
          meta: data.message || "QR code expired. Generate a new one.",
        });
        stopQrPolling();
        setFeedback("QR code expired. Refresh to generate a new one.", true);
        return;
      }

      setQrState({
        image: qs('[data-module="qr-login-image"]')?.src || "",
        status: data.statusLabel || (data.code === 802 ? "Waiting for confirm" : "Waiting for scan"),
        meta: data.message || "Open the music app and scan this code.",
      });
    } catch (_error) {
      stopQrPolling();
      setFeedback("Unable to poll QR login status.", true);
    }
  }

  async function loadQrLogin() {
    stopQrPolling();
    qrGeneration += 1;
    const generation = qrGeneration;
    const refreshButton = qs('[data-action="refresh-qr-login"]');
    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.classList.add("opacity-60", "cursor-not-allowed");
    }

    setQrState({
      image: "",
      status: "Generating",
      meta: "Requesting a fresh QR login session.",
    });

    try {
      const keyPayload = await createQrLoginKey();
      const key = keyPayload?.data?.unikey || "";
      if (!key) {
        throw new Error("QR login key missing.");
      }

      activeQrKey = key;
      const imagePayload = await createQrLoginImage(key);
      if (generation !== qrGeneration || key !== activeQrKey) {
        return;
      }
      const qrimg = imagePayload?.data?.qrimg || "";
      setQrState({
        image: qrimg,
        status: "Waiting for scan",
        meta: "Open the music app and scan this QR code.",
      });
      qrPollTimer = window.setInterval(() => {
        void pollQrLoginStatus(key, generation);
      }, 2500);
      void pollQrLoginStatus(key, generation);
      setFeedback("QR login ready. Scan the code with your music app.");
    } catch (error) {
      setQrState({
        image: "",
        status: "Unavailable",
        meta: "Could not prepare QR login.",
      });
      setFeedback(error?.message || "QR login setup failed.", true);
    } finally {
      if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.classList.remove("opacity-60", "cursor-not-allowed");
      }
    }
  }

  function setSessionActionsDisabled(isBusy) {
    qsa("[data-session-action]").forEach((button) => {
      button.disabled = isBusy;
      button.classList.toggle("opacity-60", isBusy);
      button.classList.toggle("cursor-not-allowed", isBusy);
    });
  }

  function syncSessionActionState() {
    const logoutButton = qs('[data-session-action="logout"]');
    if (logoutButton) {
      logoutButton.disabled = !sessionLoggedIn;
      logoutButton.classList.toggle("opacity-60", !sessionLoggedIn);
      logoutButton.classList.toggle("cursor-not-allowed", !sessionLoggedIn);
    }
  }

  function syncSendCodeState() {
    const button = qs('[data-action="send-phone-code"]');
    if (!button) {
      return;
    }

    const disabled = sendCodeSecondsRemaining > 0;
    button.disabled = disabled;
    button.classList.toggle("opacity-60", disabled);
    button.classList.toggle("cursor-not-allowed", disabled);
    button.textContent = disabled ? `Resend in ${sendCodeSecondsRemaining}s` : "Send Code";
  }

  function startSendCodeCooldown(seconds = 60) {
    if (sendCodeCooldownTimer) {
      window.clearInterval(sendCodeCooldownTimer);
    }

    sendCodeSecondsRemaining = seconds;
    syncSendCodeState();
    sendCodeCooldownTimer = window.setInterval(() => {
      sendCodeSecondsRemaining = Math.max(0, sendCodeSecondsRemaining - 1);
      syncSendCodeState();
      if (sendCodeSecondsRemaining === 0 && sendCodeCooldownTimer) {
        window.clearInterval(sendCodeCooldownTimer);
        sendCodeCooldownTimer = null;
      }
    }, 1000);
  }

  async function refreshLoginStatus() {
    setSessionActionsDisabled(true);
    try {
      const payload = await fetchLogStatus();
      const data = payload?.data || {};
      sessionLoggedIn = Boolean(data.loggedIn);
      if (sessionLoggedIn) {
        setText("loginSessionState", data.nickname || "Session active");
        setText("loginSessionMeta", `Session active for user ${data.userId || data.accountId || "--"}`);
      } else {
        setText("loginSessionState", "Signed out");
        setText("loginSessionMeta", "No active session cookie");
      }
    } catch (_error) {
      sessionLoggedIn = false;
      setText("loginSessionState", "Status unavailable");
      setText("loginSessionMeta", "Could not verify login status");
    } finally {
      setSessionActionsDisabled(false);
      syncSessionActionState();
    }
  }

  function setActiveTab(tab) {
    const isQr = tab !== "cellphone";
    qsa("[data-login-tab]").forEach((button) => {
      const isActive = button.dataset.loginTab === (isQr ? "qr" : "cellphone");
      button.classList.toggle("border-primary/30", isActive);
      button.classList.toggle("bg-primary/12", isActive);
      button.classList.toggle("text-primary", isActive);
      button.classList.toggle("border-white/10", !isActive);
      button.classList.toggle("bg-white/[0.04]", !isActive);
      button.classList.toggle("text-slate-300", !isActive);
    });

    qs('[data-module="login-form-qr"]')?.classList.toggle("hidden", !isQr);
    qs('[data-module="login-form-cellphone"]')?.classList.toggle("hidden", isQr);
    if (isQr) {
      void loadQrLogin();
    } else {
      stopQrPolling();
      qrGeneration += 1;
    }
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
    setActiveTab("qr");
    setFeedback("Use QR login or request an access code for phone login.");
    syncSendCodeState();
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
      stopQrPolling();
      qrGeneration += 1;
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

  async function handleCellphoneLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const phone = form.elements.phone?.value?.trim() || "";
    const captcha = form.elements.captcha?.value?.trim() || "";
    const countrycode = form.elements.countrycode?.value?.trim() || "";
    if (!phone || !captcha) {
      setFeedback("Phone and access code are required.", true);
      return;
    }

    setFeedback("Signing in with access code...");
    try {
      const payload = await loginWithCellphone({ phone, captcha, countrycode });
      const data = payload?.data || {};
      setFeedback(`Signed in as ${data.nickname || phone}.`);
      await refreshLoginStatus();
      form.reset();
      if (form.elements.countrycode) {
        form.elements.countrycode.value = countrycode || "86";
      }
    } catch (error) {
      setFeedback(error?.message || "Phone login failed.", true);
    }
  }

  async function handleSendPhoneCode() {
    const form = qs('[data-module="login-form-cellphone"]');
    if (!form) {
      return;
    }

    const phone = form.elements.phone?.value?.trim() || "";
    const countrycode = form.elements.countrycode?.value?.trim() || "";
    if (!phone) {
      setFeedback("Enter your phone number before requesting an access code.", true);
      return;
    }

    const button = qs('[data-action="send-phone-code"]');
    button?.classList.add("opacity-60");
    button && (button.disabled = true);
    setFeedback("Sending access code...");
    try {
      await sendCellphoneLoginCode({ phone, countrycode });
      setFeedback(`Access code sent to ${phone}.`);
      startSendCodeCooldown(60);
    } catch (error) {
      setFeedback(error?.message || "Failed to send access code.", true);
      button && (button.disabled = false);
      button?.classList.remove("opacity-60");
      syncSendCodeState();
    }
  }

  async function handleStatusInquiry() {
    setFeedback("Checking login status...");
    await refreshLoginStatus();
    if (sessionLoggedIn) {
      setFeedback("Session is active.");
    } else {
      setFeedback("No active session found.");
    }
  }

  async function handleLogout() {
    if (!sessionLoggedIn) {
      setFeedback("No active session to log out.");
      return;
    }

    setSessionActionsDisabled(true);
    setFeedback("Logging out...");
    try {
      await logout();
      stopQrPolling();
      qrGeneration += 1;
      sessionLoggedIn = false;
      setText("loginSessionState", "Signed out");
      setText("loginSessionMeta", "No active session cookie");
      setFeedback("Logged out.");
    } catch (error) {
      setFeedback(error?.message || "Logout failed.", true);
    } finally {
      setSessionActionsDisabled(false);
      syncSessionActionState();
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
        setActiveTab(button.dataset.loginTab || "qr");
      });
    });

    qs('[data-module="login-form-cellphone"]')?.addEventListener("submit", handleCellphoneLogin);
    qs('[data-action="refresh-qr-login"]')?.addEventListener("click", () => {
      void loadQrLogin();
    });
    qs('[data-action="send-phone-code"]')?.addEventListener("click", () => {
      void handleSendPhoneCode();
    });
    qs('[data-session-action="status"]')?.addEventListener("click", () => {
      void handleStatusInquiry();
    });
    qs('[data-session-action="logout"]')?.addEventListener("click", () => {
      void handleLogout();
    });

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
      syncSendCodeState();
      void refreshLoginStatus();
    }
  }

  global.VibeRenderers = global.VibeRenderers || {};
  global.VibeRenderers.initAccessDeck = initAccessDeck;
})(window);
