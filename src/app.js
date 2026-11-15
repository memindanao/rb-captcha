(function () {
  const totalRounds = 3;
  const games = window.CaptchaGames.list();
  const host = document.querySelector("#game-host");
  const challengeDialog = document.querySelector("#challenge-dialog");
  const gameSelector = document.querySelector("#game-selector");
  const captchaToggle = document.querySelector("#captcha-toggle");
  const checkboxLabel = document.querySelector(".checkbox-label");
  const verificationStatus = document.querySelector("#verification-status");
  const dialog = document.querySelector("#offer-dialog");
  const toast = document.querySelector("#toast");
  let round = 0;
  let mistakes = 0;
  let activeGame = null;
  let selectedGameId = "";
  let cleanupGame = null;
  let toastTimer;
  let nagTimer;
  let dismissedPaymentOffer = false;
  let activeOfferIsPayment = false;

  const roundLabel = document.querySelector("#round-label");
  const progress = document.querySelector(".progress-track");
  const progressFill = document.querySelector("#progress-fill");
  const title = document.querySelector("#game-title");
  const description = document.querySelector("#game-description");
  const gameKind = document.querySelector("#game-kind");
  const challengeNumber = document.querySelector("#challenge-number");
  const challengeStep = document.querySelector("#challenge-step");
  const failureCount = document.querySelector("#failure-count");
  const counter = document.querySelector("#game-counter");

  function announce(text) {
    toast.textContent = text;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2800);
  }

  function updateProgress() {
    const percent = Math.round((round / totalRounds) * 100);
    progress.setAttribute("aria-valuenow", String(round));
    progressFill.style.width = `${percent}%`;
    roundLabel.textContent = `ROUND ${String(Math.min(round + 1, totalRounds)).padStart(2, "0")} / ${String(totalRounds).padStart(2, "0")}`;
    challengeNumber.textContent = String(round + 1).padStart(3, "0");
    challengeStep.textContent = String(round + 1).padStart(2, "0");
    failureCount.textContent = mistakes === 0 ? "Zero mistakes. For now." : `${mistakes} ${mistakes === 1 ? "mistake" : "mistakes"}. The system remembers.`;
  }

  function completeRun(skipped) {
    if (cleanupGame) cleanupGame();
    window.clearInterval(nagTimer);
    captchaToggle.classList.remove("is-active");
    captchaToggle.classList.add("is-verified");
    captchaToggle.setAttribute("aria-pressed", "true");
    checkboxLabel.textContent = "Verified";
    verificationStatus.textContent = skipped ? "Stripe confirmed your $0.99 skip." : "Verification complete.";
    roundLabel.textContent = "ALL DONE (ALLEGEDLY)";
    progress.setAttribute("aria-valuenow", String(totalRounds));
    progressFill.style.width = "100%";
    challengeDialog.close();
    announce(skipped ? "Payment confirmed. Remaining challenges skipped." : "Verification complete. You may now continue.");
  }

  function advance() {
    if (cleanupGame) cleanupGame();
    round += 1;
    if (round >= totalRounds) {
      completeRun(false);
      announce("You passed. We're all very surprised.");
      return;
    }
    updateProgress();
    announce("Correct. Unfortunately, there is more.");
    window.setTimeout(renderRound, 500);
  }

  function renderRound() {
    if (cleanupGame) cleanupGame();
    activeGame = games.find((game) => game.id === selectedGameId) || games[round % games.length];
    title.textContent = activeGame.title;
    description.textContent = activeGame.description;
    gameKind.textContent = `${activeGame.type.toUpperCase()} GAME`;
    counter.textContent = `${games.length} ${games.length === 1 ? "GAME TYPE" : "GAME TYPES"} IN ROTATION`;
    host.replaceChildren();
    cleanupGame = activeGame.mount({
      element: host,
      round: round + 1,
      onComplete: advance,
      onFail: ({ mistakes: gameMistakes }) => {
        mistakes += 1;
        failureCount.textContent = `${mistakes} ${mistakes === 1 ? "mistake" : "mistakes"}. The system remembers.`;
        if (gameMistakes === 1) {
          openOffer("A MINOR SETBACK", "A button got you. Are you sure you don't want to pay? Skip the rest for $0.99.");
        } else if (mistakes % 2 === 0) {
          openOffer("QUICK QUESTION", "Are you sure you don't want to pay? You could skip every remaining challenge for $0.99.");
        }
      }
    });
  }

  function startRun() {
    if (cleanupGame) cleanupGame();
    round = 0;
    mistakes = 0;
    window.clearInterval(nagTimer);
    if (!challengeDialog.open) challengeDialog.showModal();
    captchaToggle.classList.remove("is-verified");
    captchaToggle.classList.add("is-active");
    captchaToggle.setAttribute("aria-pressed", "true");
    checkboxLabel.textContent = "Verifying...";
    verificationStatus.textContent = "Challenge in progress. This is taking longer than it should.";
    nagTimer = window.setInterval(() => {
      if (challengeDialog.open && !dialog.open) {
        openOffer("STILL THINKING?", "Are you sure you don't want to pay? Skip the remaining challenges for $0.99.");
      }
    }, 15000);
    updateProgress();
    renderRound();
  }

  function populateGameSelector() {
    gameSelector.replaceChildren(new Option("Rotate through games", ""));
    games.forEach((game) => {
      gameSelector.add(new Option(`${game.title} (${game.type})`, game.id));
    });
  }

  function openOffer(eyebrow, copy) {
    activeOfferIsPayment = eyebrow !== "A FAIR QUESTION";
    document.querySelector("#dialog-eyebrow").textContent = eyebrow;
    document.querySelector("#dialog-copy").textContent = copy;
    if (!dialog.open) dialog.showModal();
  }

  function dismissOffer() {
    dismissedPaymentOffer = activeOfferIsPayment;
    dialog.close();
  }

  document.querySelector("#buy-button").addEventListener("click", () => {
    openOffer("SECURE STRIPE CHECKOUT", "Continue to Stripe's hosted checkout to pay $0.99 and skip the remaining challenges. This page never handles card details.");
  });
  async function startCheckout() {
    const checkoutButton = document.querySelector("#confirm-buy");
    const originalContent = checkoutButton.innerHTML;
    checkoutButton.disabled = true;
    checkoutButton.textContent = "OPENING SECURE CHECKOUT...";
    try {
      const response = await fetch("/api/checkout-session", { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.url) throw new Error(result.error || "Checkout could not be started.");
      window.location.assign(result.url);
    } catch (error) {
      document.querySelector("#dialog-eyebrow").textContent = "CHECKOUT UNAVAILABLE";
      document.querySelector("#dialog-copy").textContent = error.message || "Could not reach the payment server. Check the server and Stripe configuration.";
      checkoutButton.disabled = false;
      checkoutButton.innerHTML = originalContent;
    }
  }
  document.querySelector("#confirm-buy").addEventListener("click", startCheckout);
  document.querySelector("#dialog-close").addEventListener("click", dismissOffer);
  document.querySelector("#keep-playing").addEventListener("click", dismissOffer);
  document.querySelector("#challenge-close").addEventListener("click", () => challengeDialog.close());
  challengeDialog.addEventListener("close", () => {
    window.clearInterval(nagTimer);
    if (captchaToggle.classList.contains("is-verified")) return;
    captchaToggle.classList.remove("is-active");
    captchaToggle.setAttribute("aria-pressed", "false");
    checkboxLabel.textContent = "I'm not a robot";
    verificationStatus.textContent = "Challenge closed. Select the checkbox to try again.";
    if (cleanupGame) cleanupGame();
  });
  function showHelp() {
    openOffer("A FAIR QUESTION", "This CAPTCHA demo uses hosted Stripe Checkout. Test mode is enabled by default, and this page never receives card details.");
    document.querySelector("#dialog-title").innerHTML = "Because the internet<br><em>is full of robots.</em>";
    document.querySelector("#confirm-buy").hidden = true;
    document.querySelector("#keep-playing").textContent = "Okay, let's play";
  }
  document.querySelector("#help-button").addEventListener("click", showHelp);
  document.querySelector("#help-link").addEventListener("click", showHelp);
  captchaToggle.addEventListener("click", () => {
    if (!captchaToggle.classList.contains("is-verified")) startRun();
  });
  gameSelector.addEventListener("change", () => {
    selectedGameId = gameSelector.value;
    if (challengeDialog.open && games.length) renderRound();
  });
  dialog.addEventListener("close", () => {
    const shouldReopen = dismissedPaymentOffer && activeOfferIsPayment;
    dismissedPaymentOffer = false;
    activeOfferIsPayment = false;
    document.querySelector("#confirm-buy").hidden = false;
    document.querySelector("#confirm-buy").disabled = false;
    document.querySelector("#confirm-buy").innerHTML = "<span>PAY &amp; SKIP</span><span>$0.99 ↗</span>";
    document.querySelector("#dialog-title").innerHTML = "Skip the struggle.<br><em>Keep your dignity.</em>";
    document.querySelector("#keep-playing").textContent = "No thanks, I enjoy tiny problems";
    if (shouldReopen && Math.random() < 0.2) {
      window.setTimeout(() => {
        if (challengeDialog.open && !dialog.open && !captchaToggle.classList.contains("is-verified")) {
          openOffer("ARE YOU SURE?", "Are you sure you don't want to pay? Skip the remaining challenges for $0.99.");
        }
      }, 250);
    }
  });
  dialog.addEventListener("cancel", () => {
    dismissedPaymentOffer = activeOfferIsPayment;
  });

  if (!games.length) {
    host.textContent = "No games are registered yet.";
    return;
  }
  populateGameSelector();

  async function verifyCheckoutReturn() {
    const query = new URLSearchParams(window.location.search);
    const sessionId = query.get("session_id");
    if (query.get("checkout") === "cancelled") {
      history.replaceState(null, "", window.location.pathname);
      verificationStatus.textContent = "Checkout cancelled. Your challenge is still waiting.";
      return;
    }
    if (query.get("checkout") !== "success" || !sessionId) return;
    history.replaceState(null, "", window.location.pathname);
    verificationStatus.textContent = "Confirming Stripe payment...";
    try {
      const response = await fetch(`/api/checkout-session?session_id=${encodeURIComponent(sessionId)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Payment confirmation failed.");
      if (!result.paid) throw new Error("Payment is not confirmed. The challenges remain active.");
      round = totalRounds;
      completeRun(true);
    } catch (error) {
      verificationStatus.textContent = error.message || "Could not confirm payment.";
    }
  }
  verifyCheckoutReturn();
})();