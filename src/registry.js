(function () {
  const games = new Map();

  function register(game) {
    if (!game || typeof game.id !== "string" || typeof game.type !== "string" ||
        typeof game.title !== "string" || typeof game.description !== "string" ||
        typeof game.mount !== "function") {
      throw new TypeError("A game needs id, type, title, description, and mount().");
    }
    if (games.has(game.id)) {
      throw new Error(`A game with id "${game.id}" is already registered.`);
    }
    games.set(game.id, Object.freeze({ ...game }));
  }

  function list() {
    return Array.from(games.values());
  }

  function get(id) {
    return games.get(id);
  }

  window.CaptchaGames = Object.freeze({ register, list, get });
})();