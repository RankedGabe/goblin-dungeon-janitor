(() => {
  const roomNames = ["The Muddy Entrance", "The Goblin Pantry", "The Great Hall", "The Potion Annex", "The Dragon's Foyer"];
  const dungeonNames = ["THE STARTER CRYPT", "THE SOGGY CATACOMBS", "THE UNLICENSED LAIR", "THE DRAGON'S TAX SHELTER", "THE INFINITE BASEMENT"];
  const shiftNames = ["The After-Party", "A Goblin's Work Is Never Done", "Deep Clean, Deep Trouble", "The Night of a Thousand Mops"];
  const tileTypes = {
    grime: { icon: "💩", label: "SLIME", verb: "Mopped", loot: 0 },
    loot: { icon: "🪙", label: "LOOT", verb: "Collected", loot: 8 },
    trap: { icon: "🪤", label: "TRAP", verb: "Trap repaired", loot: 7 },
    monster: { icon: "👾", label: "MONSTER", verb: "Shushed", loot: 3 },
    debris: { icon: "🦴", label: "DEBRIS", verb: "Cleared", loot: 0 },
    lore: { icon: "📜", label: "NOTE", verb: "Read the note", loot: 0 },
  };
  const tasks = [
    { kind: "grime", title: "Mop the slime", icon: "💩" },
    { kind: "loot", title: "Collect dropped loot", icon: "🪙" },
    { kind: "trap", title: "Repair the traps", icon: "🪤" },
    { kind: "monster", title: "Shoo the monsters", icon: "👾" },
    { kind: "debris", title: "Clear the bones", icon: "🦴" },
    { kind: "lore", title: "Read the sealed note", icon: "📜" },
  ];
  const dungeonNotes = [
    { title: "A bill with no author", entry: "The note is tucked beneath a cracked tile: “The Guild says this place has been empty for a century. The footprints say otherwise. If you’re reading this, don’t let them seal the east stair. — M.” The ink is still wet." },
    { title: "The pantry crown", entry: "A second note, written on the back of a hero’s tavern bill: “The crown in the trophy room is a fake. The real one is under the goblin pantry. The little ones are guarding it because nobody told them the war ended.” Someone has drawn a smiling mushroom." },
    { title: "The landlord’s hoard", entry: "“The dragon isn’t guarding treasure. She’s guarding the deeds. The Guild sold the dungeon to a dragon and then sent heroes to evict her. Ask who signed the papers.” The signature is the same M." },
    { title: "An old friend", entry: "A grease-stained sketch shows the missing mopkeeper, Mara, beside a dragon in an apron. “Found work downstairs. Tell the Guild I’m not missing. Tell the dragon I’m taking lunch.” The handwriting ends in a tiny mop doodle." },
    { title: "The night shift", entry: "“You found me. Good. The heroes are here for a union meeting, not a raid. Keep the ballroom clean. I’m bringing soup.” It’s signed Mara Vell, who has apparently been living in a dragon’s dungeon for months." },
  ];
  const chapterOpeners = [
    { title: "A note in the mud", entry: "The Guild hired you after the last hero party left a crater where the cellar used to be. Someone keeps leaving notes in rooms the party swears they never entered." },
    { title: "The stair on no map", entry: "A new shift, a new floor plan. The Guild’s blueprint shows a solid wall where the east stair should be. Your mop says otherwise. Fresh footprints go down." },
    { title: "A crown in the pantry", entry: "The pantry is still humming. The goblins have barricaded the door with soup pots, and the Guild's recovery team keeps asking about a crown. Nobody mentioned a crown in your contract." },
    { title: "Deeds in the hoard", entry: "The dragon's foyer is polished enough to see the forged eviction notices on the wall. Someone has been disguising a property grab as a hero's quest." },
    { title: "Soup at midnight", entry: "The ballroom is set for a feast, not a fight. A dragon-sized apron hangs by the door. Someone has left a second bowl on the table—for you." },
  ];
  const state = {
    floor: 1, room: 0, gold: 15, mop: 0, helpers: 0, kit: 0,
    board: [], toastTimeout: null, payout: 0, player: 5,
    actions: 0, maxActions: 0, nextActionBonus: 0, shiftActionBonus: 0,
    roomPenalty: 0, transitioning: false, selectedFavor: null, rumorKnown: false,
  };
  const music = {
    context: null, master: null, enabled: false, loopTimer: null,
    suspendTimer: null, step: 0, starting: false,
  };
  const $ = (id) => document.getElementById(id);

  function roomTaskCount() {
    return Math.min(11, 7 + Math.floor((state.floor - 1) / 2) + (state.room === 2 ? 1 : 0));
  }

  function makeRoom() {
    const count = roomTaskCount();
    const kinds = ["grime", "loot", "trap", "monster", "debris"];
    const pool = [];
    for (let i = 0; i < count; i++) {
      const kind = kinds[(i + state.room + state.floor - 1) % kinds.length];
      pool.push(kind);
    }
    if (state.room === 2) pool[pool.length - 1] = "lore";
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    state.board = Array.from({ length: 16 }, (_, index) => ({
      id: index,
      kind: pool[index] || null,
      cleaned: false,
    }));
    state.player = 5;
    if (state.board[state.player].kind) {
      const openTile = state.board.find((tile) => !tile.kind);
      [state.board[state.player].kind, openTile.kind] = [openTile.kind, state.board[state.player].kind];
    }
    state.maxActions = 23 + Math.min(6, state.floor - 1) + state.shiftActionBonus;
    state.actions = state.maxActions;
    state.roomPenalty = 0;
    state.transitioning = false;
    if (state.room === 0 && state.floor > 1) {
      const opener = chapterOpeners[Math.min(state.floor - 1, chapterOpeners.length - 1)];
      $("journal-title").textContent = opener.title;
      $("journal-entry").textContent = state.rumorKnown
        ? `The mimic's coin-marked message reads: “Mara’s alive. Check the pantry. The dragon owes me three gold.” ${opener.entry}`
        : opener.entry;
    }
    // Skeletons clear one small mess apiece as the room opens.
    for (let i = 0; i < state.helpers; i++) {
      const helperTask = state.board.find((tile) => !tile.cleaned && ["grime", "debris"].includes(tile.kind));
      if (helperTask) helperTask.cleaned = true;
    }
    render();
    if (state.helpers) showToast(`Your skeleton${state.helpers > 1 ? "s" : ""} got to work. Mostly unsupervised.`);
  }

  function countKind(kind) {
    return state.board.filter((tile) => tile.kind === kind && !tile.cleaned).length;
  }

  function render() {
    const board = $("room-board");
    board.replaceChildren();
    state.board.forEach((tile) => {
      const button = document.createElement("button");
      const isPlayer = tile.id === state.player;
      button.className = `tile${tile.cleaned ? " cleaned" : ""}${isPlayer ? " player-tile" : ""}`;
      button.dataset.kind = tile.kind || "empty";
      button.dataset.id = String(tile.id);
      button.type = "button";
      button.setAttribute("aria-label", isPlayer ? "Your janitor. Use the arrow keys or WASD to move." : tile.kind && !tile.cleaned ? `${tileTypes[tile.kind].label.toLowerCase()}, click next to it to work or click again to approach` : "Open floor. Click to walk here.");
      if (tile.kind) button.title = `${tileTypes[tile.kind].verb} this ${tileTypes[tile.kind].label.toLowerCase()}`;
      if (isPlayer) {
        button.innerHTML = '<span class="tile-icon janitor-icon" aria-hidden="true">🧹</span><span class="tile-label">YOU</span>';
        button.addEventListener("click", () => showToast("That's you! Use WASD or the arrow keys to move."));
      } else if (tile.kind && !tile.cleaned) {
        button.disabled = state.actions <= 0 || state.transitioning;
        button.innerHTML = `<span class="tile-icon" aria-hidden="true">${tileTypes[tile.kind].icon}</span><span class="tile-label">${tileTypes[tile.kind].label}</span>`;
        button.addEventListener("click", () => approachOrWork(tile.id));
      } else {
        button.disabled = state.actions <= 0 || state.transitioning;
        button.innerHTML = `<span class="tile-icon" aria-hidden="true">${tile.cleaned ? "✨" : ""}</span>${tile.cleaned ? '<span class="tile-label">DONE</span>' : ""}`;
        button.addEventListener("click", () => moveTo(tile.id));
      }
      board.append(button);
    });

    const remaining = state.board.filter((tile) => tile.kind && !tile.cleaned).length;
    $("tasks-remaining").textContent = remaining === 1 ? "1 thing needs doing" : `${remaining} things need doing`;
    $("task-pips").replaceChildren(...state.board.filter((tile) => tile.kind).map((tile) => {
      const pip = document.createElement("span");
      pip.className = `task-pip${tile.cleaned ? " done" : ""}`;
      return pip;
    }));
    $("action-count").textContent = `${state.actions} / ${state.maxActions}`;
    $("action-fill").style.width = `${state.maxActions ? (state.actions / state.maxActions) * 100 : 0}%`;
    $("action-footnote").textContent = state.actions > 0 ? "Each step and chore costs actions." : "You're out of shift actions.";
    $("overtime-button").hidden = state.actions > 0 || state.transitioning;
    $("objective-list").replaceChildren(...tasks.filter((task) => state.board.some((tile) => tile.kind === task.kind)).map((task) => {
      const left = countKind(task.kind);
      const item = document.createElement("div");
      item.className = `objective${left === 0 ? " complete" : ""}`;
      item.innerHTML = `<span class="objective-name"><span class="objective-icon" aria-hidden="true">${task.icon}</span>${task.title}</span><span class="objective-count">${left === 0 ? "✓" : left}</span>`;
      return item;
    }));
    $("gold-count").textContent = state.gold;
    $("floor-kicker").textContent = `DUNGEON ${String(state.floor).padStart(2, "0")}`;
    $("floor-name").textContent = dungeonNames[Math.min(state.floor - 1, dungeonNames.length - 1)];
    $("shift-name").textContent = shiftNames[(state.floor - 1) % shiftNames.length];
    $("room-progress").textContent = `Room ${state.room + 1} of 3`;
    $("room-number").textContent = String(state.room + 1).padStart(2, "0");
    $("room-name").textContent = roomNames[(state.room + state.floor - 1) % roomNames.length];
    $("shift-progress-fill").style.width = `${((state.room + 1) / 3) * 100}%`;
    $("mop-level").textContent = `Lv. ${state.mop}`;
    $("helper-level").textContent = `× ${state.helpers}`;
    $("kit-level").textContent = `Lv. ${state.kit}`;
    $("mop-description").textContent = state.mop === 0 ? "Wipe a little faster." : state.mop === 1 ? "Wiping also clears nearby slime." : "A truly unreasonable slime radius.";
    $("helper-description").textContent = state.helpers === 0 ? "A tireless, mildly haunted helper." : `Clears ${state.helpers} mess${state.helpers === 1 ? "" : "es"} when you enter a room.`;
    $("kit-description").textContent = state.kit ? `Repairs earn +${state.kit * 4} bonus gold.` : "Repairs earn you a little extra.";
    $("buy-mop").disabled = state.mop >= 2 || state.gold < mopCost();
    $("buy-mop").innerHTML = state.mop >= 2 ? "<span>Fully upgraded</span><span class=\"price\">✓</span>" : `<span>Upgrade</span><span class="price">◈ ${mopCost()}</span>`;
    $("buy-helper").disabled = state.gold < helperCost();
    $("buy-helper").innerHTML = `<span>Hire helper</span><span class="price">◈ ${helperCost()}</span>`;
    $("buy-kit").disabled = state.kit >= 3 || state.gold < kitCost();
    $("buy-kit").innerHTML = state.kit >= 3 ? "<span>Fully upgraded</span><span class=\"price\">✓</span>" : `<span>Get the kit</span><span class="price">◈ ${kitCost()}</span>`;
    $("chapter-progress").textContent = `CHAPTER ${String(state.floor).padStart(2, "0")}`;
    $("clue-progress").textContent = state.rumorKnown ? "MIMIC'S WHISPER" : "FIELD NOTES";
  }

  function mopCost() { return state.mop === 0 ? 35 : 60; }
  function helperCost() { return 45 + state.helpers * 30; }
  function kitCost() { return 40 + state.kit * 35; }

  function neighbors(id) {
    return [id - 4, id + 4, ...(id % 4 ? [id - 1] : []), ...(id % 4 < 3 ? [id + 1] : [])]
      .filter((neighbor) => neighbor >= 0 && neighbor < 16);
  }

  function walkable(id) {
    const tile = state.board[id];
    return id === state.player || !tile.kind || tile.cleaned;
  }

  function findPath(goals) {
    const queue = [state.player];
    const parent = new Map([[state.player, null]]);
    let destination = null;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor];
      if (goals.has(current)) {
        destination = current;
        break;
      }
      for (const next of neighbors(current)) {
        if (!parent.has(next) && walkable(next)) {
          parent.set(next, current);
          queue.push(next);
        }
      }
    }
    if (destination === null) return null;
    const path = [];
    while (destination !== state.player) {
      path.unshift(destination);
      destination = parent.get(destination);
    }
    return path;
  }

  function spendActions(amount) {
    if (state.transitioning) return false;
    if (state.actions < amount) {
      showToast("Not enough actions. Work overtime or plan a shorter route.");
      return false;
    }
    state.actions -= amount;
    return true;
  }

  function moveTo(id) {
    if (state.transitioning || state.actions <= 0 || id === state.player) return;
    const path = findPath(new Set([id]));
    if (!path || !path.length) {
      showToast("That way is blocked. Clear a path around the mess.");
      return;
    }
    if (!spendActions(1)) return;
    state.player = path[0];
    render();
    const target = state.board[id];
    showToast(target.kind && !target.cleaned ? "One step closer. Get next to the mess to work." : "Moved one step. Every step spends a shift action.");
  }

  function approachOrWork(id) {
    if (state.transitioning || state.actions <= 0) return;
    const tile = state.board[id];
    if (!tile || tile.cleaned || !tile.kind) return;
    if (neighbors(state.player).includes(id)) {
      cleanTile(id);
      return;
    }
    const route = findPath(new Set(neighbors(id).filter(walkable)));
    if (!route || !route.length) {
      showToast("Can't reach that mess yet. Clear a route around it.");
      return;
    }
    if (!spendActions(1)) return;
    state.player = route[0];
    render();
    showToast("One step closer. Get next to the mess to work.");
  }

  function actionCost(kind) {
    if (kind === "monster") return 2;
    if (kind === "trap") return Math.max(1, 2 - state.kit);
    return 1;
  }

  function cleanTile(id) {
    const tile = state.board.find((item) => item.id === id);
    if (!tile || tile.cleaned || !tile.kind || state.transitioning) return;
    if (!neighbors(state.player).includes(id)) {
      showToast("You need to stand next to a mess to work on it.");
      return;
    }
    const kind = tile.kind;
    if (!spendActions(actionCost(kind))) return;
    tile.cleaned = true;
    let message = `${tileTypes[kind].verb}!`;
    let earned = tileTypes[kind].loot + (kind === "trap" ? state.kit * 4 : 0);
    if (kind === "lore") {
      const note = dungeonNotes[Math.min(state.floor - 1, dungeonNotes.length - 1)];
      $("journal-title").textContent = note.title;
      $("journal-entry").textContent = state.rumorKnown
        ? `${note.entry} The mimic was right about the hidden mark: Mara Vell is alive.`
        : note.entry;
      state.rumorKnown = false;
      message = "A sealed note from the missing mopkeeper!";
    }
    if (kind === "grime" && state.mop > 0) {
      let swiped = 0;
      for (const neighborId of neighbors(id)) {
        const neighbor = state.board.find((item) => item.id === neighborId);
        if (neighbor && neighbor.kind === "grime" && !neighbor.cleaned && swiped < state.mop) {
          neighbor.cleaned = true;
          swiped++;
        }
      }
      if (swiped) message = `Turbo mop! ${swiped + 1} slime spots gone.`;
    }
    state.gold += earned;
    state.payout += earned;
    render();
    showToast(earned > 0 ? `${message} +${earned} gold` : message);
    if (state.board.every((item) => !item.kind || item.cleaned)) finishRoom();
  }

  function finishRoom() {
    state.transitioning = true;
    const bonus = Math.max(0, 12 + state.floor * 2 - state.roomPenalty);
    state.gold += bonus;
    state.payout += bonus;
    render();
    showToast(bonus ? `Room spotless! Guild bonus: +${bonus} gold.` : "Room spotless. Overtime ate the bonus.");
    window.setTimeout(() => {
      if (state.room < 2) {
        state.room++;
        makeRoom();
      } else {
        finishShift();
      }
    }, 950);
  }

  function workOvertime() {
    if (state.actions > 0 || state.transitioning) return;
    state.actions += 8;
    state.maxActions += 8;
    state.roomPenalty += 12;
    render();
    showToast("You stay late: +8 actions, but this room's guild bonus is gone.");
  }

  function finishShift() {
    const stipend = 25 + state.floor * 5;
    state.gold += stipend;
    state.payout += stipend;
    $("modal-eyebrow").textContent = `DUNGEON ${String(state.floor).padStart(2, "0")} COMPLETE`;
    $("modal-copy").textContent = state.floor === 1
      ? "The east stair was supposed to be sealed a century ago. Behind it: fresh boot prints, and a note signed M. The Guild wants the stair bricked up. The monsters want it left alone."
      : state.floor === 2
        ? "The goblins weren't guarding a crown. They were keeping it safe. Your contract says not to ask questions. The Guild has underlined that part twice."
        : state.floor === 3
          ? "The dragon's hoard is made of property deeds. Someone in the Guild has been staging raids to take her home."
          : "Mara Vell, the missing mopkeeper, is leaving notes. She knows what happened, and someone really doesn't want you to find her.";
    $("modal-payout").textContent = `◈ ${state.payout} gold`;
    $("continue-button").innerHTML = `Accept favor &amp; enter dungeon ${String(state.floor + 1).padStart(2, "0")} <span aria-hidden="true">→</span>`;
    $("continue-button").disabled = true;
    $("favor-intro").textContent = "The union has one favor in the budget. Pick what helps most next shift.";
    document.querySelectorAll(".favor-choice").forEach((button) => button.classList.remove("selected"));
    state.selectedFavor = null;
    $("modal-backdrop").classList.remove("hidden");
    state.floor++;
  }

  function selectFavor(favor, button) {
    state.selectedFavor = favor;
    document.querySelectorAll(".favor-choice").forEach((choice) => choice.classList.toggle("selected", choice === button));
    $("continue-button").disabled = false;
    $("favor-intro").textContent = favor === "gold"
      ? "The Guild opens its purse. You’ll get 30 gold before the next shift."
      : favor === "actions"
        ? "The union finds you fresh gloves and a better route: +6 actions in every room next dungeon."
        : "The mimic whispers: “Mara’s alive. Check the pantry. And tell the dragon I’m still owed three gold.” +15 gold, and the next note will make more sense.";
  }

  function startNextShift() {
    if (!state.selectedFavor) return;
    if (state.selectedFavor === "gold") state.gold += 30;
    if (state.selectedFavor === "actions") state.nextActionBonus = 6;
    if (state.selectedFavor === "mimic") {
      state.gold += 15;
      state.rumorKnown = true;
    }
    state.shiftActionBonus = state.nextActionBonus;
    state.nextActionBonus = 0;
    state.room = 0;
    state.payout = 0;
    $("modal-backdrop").classList.add("hidden");
    render();
    makeRoom();
  }

  function purchase(type) {
    const price = type === "mop" ? mopCost() : type === "helper" ? helperCost() : kitCost();
    if (state.gold < price) {
      showToast("Not enough gold. Get scrubbing!");
      return;
    }
    if ((type === "mop" && state.mop >= 2) || (type === "kit" && state.kit >= 3)) return;
    state.gold -= price;
    if (type === "mop") state.mop++;
    if (type === "helper") state.helpers++;
    if (type === "kit") state.kit++;
    render();
    showToast(type === "helper" ? "A skeleton has joined the night shift." : "Upgrade acquired. The mess is on notice.");
  }

  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(state.toastTimeout);
    state.toastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 1900);
  }

  function handleMovementKey(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || $("modal-backdrop").classList.contains("hidden") === false) return;
    if (event.target.matches("input, textarea, select, [contenteditable=true]")) return;
    const movement = {
      ArrowUp: -4, w: -4, ArrowDown: 4, s: 4,
      ArrowLeft: -1, a: -1, ArrowRight: 1, d: 1,
    };
    const offset = movement[event.key] ?? movement[event.key.toLowerCase()];
    if (offset === undefined) return;
    event.preventDefault();
    const target = state.player + offset;
    if (target < 0 || target >= 16 ||
      (Math.abs(offset) === 1 && Math.floor(target / 4) !== Math.floor(state.player / 4))) {
      showToast("The dungeon wall is not part of the route.");
      return;
    }
    const tile = state.board[target];
    if (tile.kind && !tile.cleaned) {
      cleanTile(target);
      return;
    }
    moveTo(target);
  }

  function updateMusicButton() {
    const button = $("music-toggle");
    const label = music.enabled ? "Music on" : "Music off";
    $("music-label").textContent = label;
    button.setAttribute("aria-pressed", String(music.enabled));
    button.setAttribute("aria-label", `${music.enabled ? "Mute" : "Unmute"} background music`);
    button.title = `${music.enabled ? "Mute" : "Unmute"} background music`;
  }

  function fadeMusicIn() {
    const now = music.context.currentTime;
    music.master.gain.cancelScheduledValues(now);
    music.master.gain.setValueAtTime(music.master.gain.value, now);
    music.master.gain.linearRampToValueAtTime(0.2, now + 0.2);
  }

  function playNote(frequency, start, duration, volume, waveform) {
    const oscillator = music.context.createOscillator();
    const envelope = music.context.createGain();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, start);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(volume, start + 0.035);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(music.master);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.04);
  }

  function playMusicStep() {
    if (!music.enabled || music.context.state !== "running") return;
    const notes = [12, 15, 19, 22, 19, 15, 12, null, 17, 19, 22, 24, 22, 19, 15, null];
    const roots = [0, -5, -3, -7];
    const root = roots[Math.floor(music.step / 4) % roots.length];
    const now = music.context.currentTime;
    const baseNote = 146.83 * (2 ** (root / 12));
    if (music.step % 4 === 0) {
      playNote(baseNote / 2, now, 1.25, 0.24, "sine");
      playNote(baseNote, now, 0.95, 0.07, "triangle");
    }
    const melody = notes[music.step % notes.length];
    if (melody !== null) playNote(baseNote * (2 ** (melody / 12)), now, 0.42, 0.12, "triangle");
    music.step++;
    music.loopTimer = window.setTimeout(playMusicStep, 620);
  }

  async function toggleMusic() {
    if (!music.enabled) {
      if (music.starting) return;
      const AudioContextType = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextType) {
        showToast("This browser can't play dungeon music.");
        return;
      }
      music.starting = true;
      try {
        if (!music.context || music.context.state === "closed") {
          music.context = new AudioContextType();
          music.master = music.context.createGain();
          music.master.gain.setValueAtTime(0, music.context.currentTime);
          music.master.connect(music.context.destination);
          music.step = 0;
        }
        window.clearTimeout(music.suspendTimer);
        await music.context.resume();
        music.enabled = true;
        fadeMusicIn();
        updateMusicButton();
        playMusicStep();
        showToast("Dungeon tunes, now featuring questionable goblin humming.");
      } catch (error) {
        music.enabled = false;
        updateMusicButton();
        showToast("The dungeon music couldn't start in this browser.");
      } finally {
        music.starting = false;
      }
      return;
    }

    music.enabled = false;
    window.clearTimeout(music.loopTimer);
    window.clearTimeout(music.suspendTimer);
    if (music.context && music.context.state !== "closed") {
      music.master.gain.setTargetAtTime(0, music.context.currentTime, 0.025);
      music.suspendTimer = window.setTimeout(() => music.context.suspend(), 130);
    }
    updateMusicButton();
  }

  function handleVisibilityChange() {
    if (!music.context || !music.enabled) return;
    if (document.hidden) {
      window.clearTimeout(music.loopTimer);
      music.context.suspend();
    } else {
      music.context.resume().then(() => {
        if (music.enabled) playMusicStep();
      }).catch(() => {
        music.enabled = false;
        updateMusicButton();
      });
    }
  }

  function cleanupMusic() {
    window.clearTimeout(music.loopTimer);
    window.clearTimeout(music.suspendTimer);
    if (music.context && music.context.state !== "closed") music.context.close();
  }

  updateMusicButton();
  $("music-toggle").addEventListener("click", toggleMusic);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", cleanupMusic);
  $("buy-mop").addEventListener("click", () => purchase("mop"));
  $("buy-helper").addEventListener("click", () => purchase("helper"));
  $("buy-kit").addEventListener("click", () => purchase("kit"));
  $("overtime-button").addEventListener("click", workOvertime);
  document.addEventListener("keydown", handleMovementKey);
  document.querySelectorAll(".favor-choice").forEach((button) => {
    button.addEventListener("click", () => selectFavor(button.dataset.favor, button));
  });
  $("continue-button").addEventListener("click", startNextShift);
  makeRoom();
})();
