(function () {
  function mount({ element, round, onComplete, onFail }) {
    const requiredDodges = 3 + round;
    const timers = new Set();
    const obstacles = [];
    let animationFrame = 0;
    let lastFrame = 0;
    let nextObstacleAt = 0;
    let score = 0;
    let mistakes = 0;
    let jumpUntil = 0;
    let inputPending = false;
    let finished = false;

    element.innerHTML = `
      <div class="dino-game">
        <div class="dino-hud"><span id="dino-status">CACTUS INCOMING. GET READY.</span><span id="dino-score">0 / ${requiredDodges}</span></div>
        <div class="dino-track" role="img" aria-label="Dinosaur runner game">
          <div class="dino-skyline" aria-hidden="true"></div>
          <div class="dino-sprite" id="dino-sprite" aria-hidden="true">🦖</div>
          <div class="dino-ground" aria-hidden="true"></div>
        </div>
        <div class="dino-controls"><button class="dino-jump" id="dino-jump" type="button">JUMP <span aria-hidden="true">↑</span></button><span class="dino-key-hint">OR PRESS SPACE</span></div>
      </div>
      <div class="game-hint"><span class="hint-mark" aria-hidden="true">↳</span><span>Dodge ${requiredDodges} cacti. Jump as each one approaches.</span></div>
    `;

    const track = element.querySelector(".dino-track");
    const dino = element.querySelector("#dino-sprite");
    const status = element.querySelector("#dino-status");
    const scoreDisplay = element.querySelector("#dino-score");
    const jumpButton = element.querySelector("#dino-jump");
    const speed = 185 + round * 24;
    const jumpDuration = 720;
    const maxInputDelayMs = 1000;
    const hitboxInset = 5;

    function schedule(callback, delay) {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (!finished) callback();
      }, delay);
      timers.add(timer);
    }

    function requestJump() {
      if (finished || inputPending) return;
      inputPending = true;
      jumpButton.disabled = true;
      status.textContent = "JUMP!";
      const inputDelay = Math.min(maxInputDelayMs, 100 + Math.random() * (maxInputDelayMs - 100));
      schedule(() => {
        inputPending = false;
        jumpButton.disabled = false;
        jumpUntil = performance.now() + jumpDuration;
        dino.classList.add("is-airborne");
        status.textContent = "NICE HOP.";
        schedule(() => dino.classList.remove("is-airborne"), jumpDuration);
      }, inputDelay);
    }

    function spawnObstacle(now) {
      const obstacle = document.createElement("span");
      obstacle.className = "dino-obstacle";
      obstacle.setAttribute("aria-hidden", "true");
      obstacle.textContent = "🌵";
      track.append(obstacle);
      obstacles.push({ element: obstacle, x: track.clientWidth + 18, counted: false });
      nextObstacleAt = now + 1450 + Math.random() * 650;
    }

    function handleCollision(now) {
      mistakes += 1;
      score = 0;
      scoreDisplay.textContent = `0 / ${requiredDodges}`;
      status.textContent = "MISSED THE JUMP. TRY AGAIN.";
      obstacles.forEach(({ element: item }) => item.remove());
      obstacles.length = 0;
      onFail({ mistakes, gameId: "dino-delay" });
      nextObstacleAt = now + 1250;
    }

    function frame(now) {
      if (finished) return;
      if (!lastFrame) {
        lastFrame = now;
        nextObstacleAt = now + 500;
      }
      const delta = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;
      if (now >= nextObstacleAt) spawnObstacle(now);

      const dinoBounds = dino.getBoundingClientRect();
      const dinoHitbox = {
        left: dinoBounds.left + hitboxInset,
        right: dinoBounds.right - hitboxInset,
        top: dinoBounds.top + hitboxInset,
        bottom: dinoBounds.bottom - hitboxInset
      };
      for (let index = obstacles.length - 1; index >= 0; index -= 1) {
        const obstacle = obstacles[index];
        obstacle.x -= speed * delta;
        obstacle.element.style.left = `${obstacle.x}px`;
        const obstacleBounds = obstacle.element.getBoundingClientRect();
        const overlaps = obstacleBounds.left + hitboxInset < dinoHitbox.right &&
          obstacleBounds.right - hitboxInset > dinoHitbox.left &&
          obstacleBounds.top + hitboxInset < dinoHitbox.bottom &&
          obstacleBounds.bottom - hitboxInset > dinoHitbox.top;
        if (overlaps) {
          handleCollision(now);
          break;
        }
        if (!obstacle.counted && obstacleBounds.right < dinoHitbox.left) {
          obstacle.counted = true;
          score += 1;
          scoreDisplay.textContent = `${score} / ${requiredDodges}`;
          status.textContent = "DODGED. MORE CACTI INCOMING.";
          if (score >= requiredDodges) {
            finished = true;
            status.textContent = "SOMEHOW, YOU MADE IT.";
            onComplete({ gameId: "dino-delay", mistakes, dodges: score });
            return;
          }
        }
        if (obstacle.x < -30) {
          obstacle.element.remove();
          obstacles.splice(index, 1);
        }
      }
      if (!finished) animationFrame = window.requestAnimationFrame(frame);
    }

    function onKeyDown(event) {
      if (event.code !== "Space" || event.repeat) return;
      event.preventDefault();
      requestJump();
    }

    jumpButton.addEventListener("click", requestJump);
    window.addEventListener("keydown", onKeyDown);
    animationFrame = window.requestAnimationFrame(frame);

    return function cleanup() {
      finished = true;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", onKeyDown);
      timers.forEach(window.clearTimeout);
      timers.clear();
      obstacles.forEach(({ element: obstacle }) => obstacle.remove());
      element.replaceChildren();
    };
  }

  window.CaptchaGames.register({
    id: "dino-delay",
    type: "runner",
    title: "Help the dinosaur jump.",
    description: "Dodge the cacti. Jump at the right moment.",
    mount
  });
})();