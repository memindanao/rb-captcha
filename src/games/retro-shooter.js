(function () {
  const map = [
    "##########",
    "#........#",
    "#.##....##",
    "#........#",
    "#.####...#",
    "#........#",
    "#.##..##.#",
    "#........#",
    "#........#",
    "##########"
  ];
  const width = 192;
  const height = 120;
  const fieldOfView = Math.PI / 3;

  function mount({ element, onComplete, onFail }) {
    const canvasWidth = width;
    const canvasHeight = height;
    const keys = new Set();
    const enemies = [
      { x: 6.5, y: 1.5, alive: true },
      { x: 7.5, y: 5.5, alive: true }
    ];
    const timers = new Set();
    let player = { x: 1.5, y: 1.5, angle: 0 };
    let animationFrame = 0;
    let lastFrame = 0;
    let kills = 0;
    let shots = 0;
    let finished = false;
    let flashUntil = 0;
    let damageUntil = 0;
    let exitUnlocked = false;

    element.innerHTML = `
      <div class="retro-game">
        <div class="retro-hud"><span id="retro-status">FIND THE EXIT</span><span id="retro-count">TARGETS 0 / 2</span></div>
        <div class="retro-screen-wrap">
          <canvas class="retro-screen" width="${canvasWidth}" height="${canvasHeight}" aria-label="Low-resolution first-person maze"></canvas>
          <div class="retro-crosshair" aria-hidden="true">+</div>
          <div class="retro-screen-flash" aria-hidden="true"></div>
        </div>
        <div class="retro-controls">
          <div class="retro-move-pad" aria-label="Movement controls">
            <button type="button" data-action="forward" aria-label="Move forward">↑</button>
            <button type="button" data-action="left" aria-label="Turn left">←</button>
            <button type="button" data-action="back" aria-label="Move backward">↓</button>
            <button type="button" data-action="right" aria-label="Turn right">→</button>
          </div>
          <div class="retro-action-pad">
            <button type="button" id="retro-fire">FIRE</button>
            <button type="button" id="retro-use">USE</button>
          </div>
        </div>
        <div class="retro-readout"><span id="retro-ammo">BLASTER: READY</span><span>WASD / ARROWS · SPACE · E</span></div>
      </div>
    `;

    const canvas = element.querySelector(".retro-screen");
    const context = canvas.getContext("2d", { alpha: false });
    const status = element.querySelector("#retro-status");
    const count = element.querySelector("#retro-count");
    const ammo = element.querySelector("#retro-ammo");
    const flash = element.querySelector(".retro-screen-flash");
    const depthBuffer = new Float32Array(canvasWidth);

    context.imageSmoothingEnabled = false;

    function isWall(x, y) {
      const cellX = Math.floor(x);
      const cellY = Math.floor(y);
      return !map[cellY] || map[cellY][cellX] !== ".";
    }

    function castRay(angle) {
      const directionX = Math.cos(angle);
      const directionY = Math.sin(angle);
      let cellX = Math.floor(player.x);
      let cellY = Math.floor(player.y);
      const deltaX = Math.abs(1 / (directionX || 0.00001));
      const deltaY = Math.abs(1 / (directionY || 0.00001));
      const stepX = directionX < 0 ? -1 : 1;
      const stepY = directionY < 0 ? -1 : 1;
      let sideX = (directionX < 0 ? player.x - cellX : cellX + 1 - player.x) * deltaX;
      let sideY = (directionY < 0 ? player.y - cellY : cellY + 1 - player.y) * deltaY;
      let side = 0;
      let distance = 12;

      for (let steps = 0; steps < 24; steps += 1) {
        if (sideX < sideY) {
          sideX += deltaX;
          cellX += stepX;
          side = 0;
        } else {
          sideY += deltaY;
          cellY += stepY;
          side = 1;
        }
        if (!map[cellY] || map[cellY][cellX] !== ".") {
          distance = side === 0 ? sideX - deltaX : sideY - deltaY;
          break;
        }
      }
      return { distance: Math.max(0.001, distance), side, cellX, cellY };
    }

    function drawWorld(now) {
      context.fillStyle = "#17202b";
      context.fillRect(0, 0, canvasWidth, canvasHeight / 2);
      context.fillStyle = "#38372f";
      context.fillRect(0, canvasHeight / 2, canvasWidth, canvasHeight / 2);
      context.fillStyle = "#242b32";
      context.fillRect(0, canvasHeight / 2 - 1, canvasWidth, 2);

      for (let x = 0; x < canvasWidth; x += 1) {
        const rayAngle = player.angle - fieldOfView / 2 + (x / canvasWidth) * fieldOfView;
        const hit = castRay(rayAngle);
        const correctedDistance = hit.distance * Math.cos(rayAngle - player.angle);
        depthBuffer[x] = correctedDistance;
        const wallHeight = Math.min(canvasHeight, Math.floor(canvasHeight / Math.max(0.1, correctedDistance)));
        const top = Math.floor((canvasHeight - wallHeight) / 2);
        const texture = (hit.cellX * 13 + hit.cellY * 7) % 3;
        const shade = Math.max(35, 205 - correctedDistance * 25 - (hit.side ? 28 : 0));
        const red = Math.floor(shade * (texture === 1 ? 0.82 : 1));
        const green = Math.floor(shade * (texture === 2 ? 0.67 : 0.78));
        const blue = Math.floor(shade * (texture === 0 ? 0.5 : 0.57));
        context.fillStyle = `rgb(${red},${green},${blue})`;
        context.fillRect(x, top, 1, wallHeight);
        context.fillStyle = `rgba(15,18,24,${Math.min(0.55, correctedDistance / 14)})`;
        for (let stripe = top + 5; stripe < top + wallHeight; stripe += 9) {
          context.fillRect(x, stripe, 1, 1);
        }
      }

      const sprites = enemies.filter((enemy) => enemy.alive).map((enemy) => ({ ...enemy, kind: "enemy" }));
      if (exitUnlocked) sprites.push({ x: 8.45, y: 8.35, kind: "exit" });
      sprites.sort((a, b) => distanceTo(b) - distanceTo(a));
      sprites.forEach((sprite) => drawSprite(sprite, now));
      drawCrosshair(now);
    }

    function distanceTo(sprite) {
      return Math.hypot(sprite.x - player.x, sprite.y - player.y);
    }

    function drawSprite(sprite, now) {
      const dx = sprite.x - player.x;
      const dy = sprite.y - player.y;
      const distance = Math.hypot(dx, dy);
      let angle = Math.atan2(dy, dx) - player.angle;
      while (angle > Math.PI) angle -= Math.PI * 2;
      while (angle < -Math.PI) angle += Math.PI * 2;
      if (Math.abs(angle) > fieldOfView * 0.7 || distance < 0.25) return;

      const screenX = Math.floor((0.5 + angle / fieldOfView) * canvasWidth);
      const spriteHeight = Math.min(canvasHeight, Math.floor(canvasHeight / distance * (sprite.kind === "exit" ? 0.8 : 0.68)));
      const spriteWidth = sprite.kind === "exit" ? Math.max(7, Math.floor(spriteHeight * 0.55)) : Math.max(5, Math.floor(spriteHeight * 0.52));
      const top = Math.floor(canvasHeight / 2 - spriteHeight / 2);
      const left = screenX - Math.floor(spriteWidth / 2);

      for (let column = 0; column < spriteWidth; column += 1) {
        const screenColumn = left + column;
        if (screenColumn < 0 || screenColumn >= canvasWidth || distance >= depthBuffer[screenColumn]) continue;
        const edge = column < 2 || column >= spriteWidth - 2;
        if (sprite.kind === "exit") {
          context.fillStyle = edge ? "#161b23" : "#6e35a6";
          context.fillRect(screenColumn, top, 1, spriteHeight);
          context.fillStyle = "#b78be3";
          if (column > spriteWidth * 0.25 && column < spriteWidth * 0.75) {
            context.fillRect(screenColumn, top + Math.floor(spriteHeight * 0.18), 1, Math.max(1, Math.floor(spriteHeight * 0.05)));
          }
        } else {
          const inset = Math.floor(Math.sin(column * 1.7 + now * 0.004) * 1.2);
          context.fillStyle = edge ? "#411b22" : (column % 4 === 0 ? "#f09a52" : "#c8473c");
          context.fillRect(screenColumn, top + Math.max(0, inset), 1, spriteHeight);
          context.fillStyle = "#f7d96c";
          if (column > spriteWidth * 0.26 && column < spriteWidth * 0.45) {
            context.fillRect(screenColumn, top + Math.floor(spriteHeight * 0.32), 1, Math.max(1, Math.floor(spriteHeight * 0.07)));
          }
          if (column > spriteWidth * 0.58 && column < spriteWidth * 0.76) {
            context.fillRect(screenColumn, top + Math.floor(spriteHeight * 0.32), 1, Math.max(1, Math.floor(spriteHeight * 0.07)));
          }
        }
      }
    }

    function drawCrosshair(now) {
      context.fillStyle = now < flashUntil ? "#fff18a" : "#d8dcdd";
      context.fillRect(canvasWidth / 2 - 2, canvasHeight / 2, 5, 1);
      context.fillRect(canvasWidth / 2, canvasHeight / 2 - 2, 1, 5);
      if (now < damageUntil) {
        context.fillStyle = "rgba(220,48,48,0.2)";
        context.fillRect(0, 0, canvasWidth, canvasHeight);
      }
    }

    function move(distance) {
      const nextX = player.x + Math.cos(player.angle) * distance;
      const nextY = player.y + Math.sin(player.angle) * distance;
      if (!isWall(nextX + Math.sign(distance) * 0.12, player.y)) player.x = nextX;
      if (!isWall(player.x, nextY + Math.sign(distance) * 0.12)) player.y = nextY;
    }

    function turn(direction) {
      player.angle += direction * 0.09;
    }

    function fire() {
      if (finished) return;
      shots += 1;
      flashUntil = performance.now() + 100;
      ammo.textContent = `BLASTER: ${shots} SHOTS`;
      const wallDistance = castRay(player.angle).distance;
      let target = null;
      let nearest = Infinity;
      enemies.forEach((enemy) => {
        if (!enemy.alive) return;
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const distance = Math.hypot(dx, dy);
        let angle = Math.atan2(dy, dx) - player.angle;
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;
        if (Math.abs(angle) < 0.12 && distance < wallDistance + 0.2 && distance < nearest) {
          target = enemy;
          nearest = distance;
        }
      });
      if (target) {
        target.alive = false;
        kills += 1;
        count.textContent = `TARGETS ${kills} / ${enemies.length}`;
        status.textContent = kills === enemies.length ? "EXIT OPEN. FIND THE PURPLE DOOR." : "TARGET CLEARED.";
        if (kills === enemies.length) exitUnlocked = true;
      } else {
        status.textContent = "SHOT MISSED.";
      }
    }

    function useExit() {
      if (finished) return;
      if (!exitUnlocked) {
        status.textContent = "EXIT LOCKED. CLEAR THE TARGETS.";
        return;
      }
      if (Math.hypot(8.45 - player.x, 8.35 - player.y) < 1.15) {
        finished = true;
        status.textContent = "LEVEL COMPLETE.";
        onComplete({ gameId: "retro-shooter", kills, shots });
      } else {
        status.textContent = "MOVE CLOSER TO THE PURPLE DOOR.";
      }
    }

    function handleAction(action) {
      if (finished) return;
      if (action === "forward") move(0.18);
      if (action === "back") move(-0.15);
      if (action === "left") turn(-1);
      if (action === "right") turn(1);
      if (action === "fire") fire();
      if (action === "use") useExit();
    }

    function onKeyDown(event) {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "e"].includes(key)) {
        event.preventDefault();
      }
      keys.add(key);
      if (key === " ") fire();
      if (key === "e") useExit();
    }

    function onKeyUp(event) {
      keys.delete(event.key.toLowerCase());
    }

    function frame(now) {
      if (finished) return;
      const elapsed = lastFrame ? Math.min((now - lastFrame) / 16.67, 2) : 1;
      lastFrame = now;
      const moveSpeed = 0.07 * elapsed;
      const turnSpeed = 0.055 * elapsed;
      if (keys.has("w") || keys.has("arrowup")) move(moveSpeed);
      if (keys.has("s") || keys.has("arrowdown")) move(-moveSpeed);
      if (keys.has("a")) turn(-turnSpeed / 0.09);
      if (keys.has("d")) turn(turnSpeed / 0.09);
      if (keys.has("arrowleft")) turn(-turnSpeed / 0.09);
      if (keys.has("arrowright")) turn(turnSpeed / 0.09);
      drawWorld(now);
      animationFrame = window.requestAnimationFrame(frame);
    }

    element.querySelectorAll("[data-action]").forEach((button) => {
      const action = button.dataset.action;
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        handleAction(action);
      });
    });
    element.querySelector("#retro-fire").addEventListener("click", fire);
    element.querySelector("#retro-use").addEventListener("click", useExit);
    canvas.addEventListener("click", fire);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    drawWorld(performance.now());
    animationFrame = window.requestAnimationFrame(frame);

    return function cleanup() {
      finished = true;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      timers.forEach(window.clearTimeout);
      timers.clear();
      keys.clear();
      element.replaceChildren();
    };
  }

  window.CaptchaGames.register({
    id: "retro-shooter",
    type: "retro FPS",
    title: "Clear the pixel maze.",
    description: "Find the targets, then locate the exit.",
    mount
  });
})();