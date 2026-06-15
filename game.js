const CATEGORIES = [
  { key: 'ones', label: 'Ones', section: 'upper' },
  { key: 'twos', label: 'Twos', section: 'upper' },
  { key: 'threes', label: 'Threes', section: 'upper' },
  { key: 'fours', label: 'Fours', section: 'upper' },
  { key: 'fives', label: 'Fives', section: 'upper' },
  { key: 'sixes', label: 'Sixes', section: 'upper' },
  { key: 'threeKind', label: '3 of a Kind', section: 'lower' },
  { key: 'fourKind', label: '4 of a Kind', section: 'lower' },
  { key: 'fullHouse', label: 'Full House', section: 'lower' },
  { key: 'smallStraight', label: 'Small Straight', section: 'lower' },
  { key: 'largeStraight', label: 'Large Straight', section: 'lower' },
  { key: 'yahtzee', label: 'Ya-Ice', section: 'lower' },
  { key: 'chance', label: 'Chance', section: 'lower' },
];

const UPPER_BONUS_THRESHOLD = 63;
const UPPER_BONUS = 35;

const COLOR_PALETTE = [
  '#facc15', '#fb923c', '#f87171', '#f472b6', '#c084fc',
  '#818cf8', '#38bdf8', '#22d3ee', '#2dd4bf', '#4ade80', '#a3e635',
];

const STORAGE_KEY = 'yaice_multiplayer_players';

let dice = [1, 1, 1, 1, 1];
let held = [false, false, false, false, false];
let rollsLeft = 3;
let gameOver = false;
let players = [];
let playerScores = [];
let currentPlayerIndex = 0;
let scores = null; // reference to playerScores[currentPlayerIndex]
let lastAction = null;

const diceRow = document.getElementById('dice-row');
const rollBtn = document.getElementById('roll-btn');
const rollsLeftEl = document.getElementById('rolls-left');
const scorecardBody = document.getElementById('scorecard-body');
const totalScoreEl = document.getElementById('total-score');
const messageEl = document.getElementById('message');
const gameOverOverlay = document.getElementById('game-over');
const finalScoresEl = document.getElementById('final-scores');
const saveNotice = document.getElementById('save-notice');
const saveCategoryEl = document.getElementById('save-category');
const undoBtn = document.getElementById('undo-btn');
const playersBar = document.getElementById('players-bar');

const setupOverlay = document.getElementById('setup-overlay');
const modeButtons = document.querySelectorAll('.mode-btn');
const playerSetup = document.getElementById('player-setup');
const playerListEl = document.getElementById('player-list');
const addPlayerBtn = document.getElementById('add-player');
const startGameBtn = document.getElementById('start-game-btn');

const handoffOverlay = document.getElementById('handoff-overlay');
const handoffNameEl = document.getElementById('handoff-name');
const handoffOkBtn = document.getElementById('handoff-ok');

let setupMode = 'single';
let setupPlayers = [];

document.getElementById('new-game').addEventListener('click', () => {
  const inProgress = rollsLeft < 3 ||
    playerScores.some(ps => CATEGORIES.some(c => ps[c.key] !== null));
  if (inProgress && !confirm('Start a new game? Current progress will be lost.')) return;
  openSetup();
});
document.getElementById('restart-btn').addEventListener('click', openSetup);
rollBtn.addEventListener('click', rollDice);
undoBtn.addEventListener('click', undoLastAction);
handoffOkBtn.addEventListener('click', advanceToNextPlayer);

const shakeToggle = document.getElementById('shake-toggle');
const SHAKE_THRESHOLD = 22;
const SHAKE_COOLDOWN_MS = 2500;
let lastShakeTime = 0;

function handleMotion(event) {
  const acc = event.accelerationIncludingGravity || event.acceleration;
  if (!acc || acc.x === null || acc.x === undefined) return;

  const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
  const now = Date.now();
  if (magnitude > SHAKE_THRESHOLD && now - lastShakeTime > SHAKE_COOLDOWN_MS) {
    lastShakeTime = now;
    if (!gameOver && rollsLeft > 0) {
      rollDice();
    }
  }
}

function enableShake() {
  window.addEventListener('devicemotion', handleMotion);
  messageEl.textContent = 'Shake to roll enabled!';
}

function disableShake() {
  window.removeEventListener('devicemotion', handleMotion);
}

shakeToggle.addEventListener('change', () => {
  if (!shakeToggle.checked) {
    disableShake();
    return;
  }

  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission()
      .then(permissionState => {
        if (permissionState === 'granted') {
          enableShake();
        } else {
          shakeToggle.checked = false;
          messageEl.textContent = 'Motion permission denied. Cannot enable shake to roll.';
        }
      })
      .catch(() => {
        shakeToggle.checked = false;
        messageEl.textContent = 'Motion permission request failed.';
      });
  } else if (typeof DeviceMotionEvent !== 'undefined') {
    enableShake();
  } else {
    shakeToggle.checked = false;
    messageEl.textContent = 'Shake detection is not supported on this device.';
  }
});

function setAccent(color) {
  document.documentElement.style.setProperty('--accent', color);
}

function emptyScores() {
  const s = {};
  CATEGORIES.forEach(c => s[c.key] = null);
  return s;
}

function loadSavedPlayers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(p => p && typeof p.name === 'string' && typeof p.color === 'string')) {
      return parsed;
    }
  } catch (e) {}
  return null;
}

function pickRandomColor(exclude = []) {
  const available = COLOR_PALETTE.filter(c => !exclude.includes(c));
  const pool = available.length > 0 ? available : COLOR_PALETTE;
  return pool[Math.floor(Math.random() * pool.length)];
}

function openSetup() {
  setupMode = 'single';
  const saved = loadSavedPlayers();
  if (saved && saved.length >= 2) {
    setupPlayers = saved.map(p => ({ name: p.name, color: p.color }));
  } else {
    const c1 = pickRandomColor();
    const c2 = pickRandomColor([c1]);
    setupPlayers = [{ name: '', color: c1 }, { name: '', color: c2 }];
  }
  renderSetup();
  setupOverlay.classList.remove('hidden');
}

modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    setupMode = btn.dataset.mode;
    renderSetup();
  });
});

addPlayerBtn.addEventListener('click', () => {
  setupPlayers.push({ name: '', color: pickRandomColor(setupPlayers.map(p => p.color)) });
  renderPlayerList();
});

startGameBtn.addEventListener('click', () => {
  if (setupMode === 'multi') {
    if (setupPlayers.length < 2) {
      alert('Add at least 2 players for multiplayer.');
      return;
    }
    players = setupPlayers.map((p, i) => ({
      name: p.name.trim() || `Player ${i + 1}`,
      color: p.color,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
  } else {
    players = [{ name: 'Player', color: '#facc15' }];
  }
  startGame();
});

function renderSetup() {
  modeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === setupMode);
  });
  playerSetup.classList.toggle('hidden', setupMode !== 'multi');
  renderPlayerList();
}

function renderPlayerList() {
  playerListEl.innerHTML = '';
  setupPlayers.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'player-row';

    const top = document.createElement('div');
    top.className = 'player-row-top';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'player-name-input';
    input.placeholder = `Player ${i + 1}`;
    input.value = p.name;
    input.addEventListener('input', () => { p.name = input.value; });
    top.appendChild(input);

    if (setupPlayers.length > 2) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove-player-btn';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        setupPlayers.splice(i, 1);
        renderPlayerList();
      });
      top.appendChild(removeBtn);
    }

    row.appendChild(top);

    const swatches = document.createElement('div');
    swatches.className = 'color-swatches';
    COLOR_PALETTE.forEach(color => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'color-swatch' + (p.color === color ? ' selected' : '');
      swatch.style.background = color;
      swatch.addEventListener('click', () => {
        p.color = color;
        renderPlayerList();
      });
      swatches.appendChild(swatch);
    });
    row.appendChild(swatches);

    playerListEl.appendChild(row);
  });
}

function startGame() {
  dice = [1, 1, 1, 1, 1];
  held = [false, false, false, false, false];
  rollsLeft = 3;
  gameOver = false;
  lastAction = null;
  currentPlayerIndex = 0;
  playerScores = players.map(() => emptyScores());
  scores = playerScores[0];
  setAccent(players[0].color);
  setupOverlay.classList.add('hidden');
  gameOverOverlay.classList.add('hidden');
  hideSaveNotice();
  messageEl.textContent = 'Roll the dice to begin!';
  render();
}

function hideSaveNotice() {
  saveNotice.classList.add('hidden');
}

function showSaveNotice(label) {
  saveCategoryEl.textContent = label;
  saveNotice.classList.remove('hidden');
}

function undoLastAction() {
  if (!lastAction) return;
  scores[lastAction.key] = null;
  dice = lastAction.dice;
  held = lastAction.held;
  rollsLeft = lastAction.rollsLeft;
  gameOver = false;
  gameOverOverlay.classList.add('hidden');
  lastAction = null;
  hideSaveNotice();
  messageEl.textContent = 'Undid last score. Pick another category.';
  render();
}

function rollDice() {
  if (rollsLeft <= 0 || gameOver) return;

  hideSaveNotice();
  lastAction = null;

  const diceEls = diceRow.querySelectorAll('.die');
  for (let i = 0; i < 5; i++) {
    if (!held[i]) {
      dice[i] = Math.floor(Math.random() * 6) + 1;
      diceEls[i].classList.add('rolling');
      setTimeout(() => diceEls[i].classList.remove('rolling'), 400);
    }
  }
  rollsLeft--;
  messageEl.textContent = rollsLeft > 0
    ? 'Tap dice to hold them, then roll again or pick a category.'
    : 'No rolls left. Pick a category to score.';
  render();
}

function toggleHold(index) {
  if (gameOver) return;
  if (rollsLeft === 3) {
    messageEl.textContent = 'Roll first before holding dice.';
    return;
  }
  if (rollsLeft === 0) return;
  held[index] = !held[index];
  render();
}

function diceCounts() {
  const counts = {};
  dice.forEach(d => counts[d] = (counts[d] || 0) + 1);
  return counts;
}

function sumDice() {
  return dice.reduce((a, b) => a + b, 0);
}

function calcScore(key) {
  const counts = diceCounts();
  const values = Object.values(counts);
  const sum = sumDice();
  const sortedUnique = Object.keys(counts).map(Number).sort((a, b) => a - b);

  switch (key) {
    case 'ones': return (counts[1] || 0) * 1;
    case 'twos': return (counts[2] || 0) * 2;
    case 'threes': return (counts[3] || 0) * 3;
    case 'fours': return (counts[4] || 0) * 4;
    case 'fives': return (counts[5] || 0) * 5;
    case 'sixes': return (counts[6] || 0) * 6;
    case 'threeKind': return values.some(v => v >= 3) ? sum : 0;
    case 'fourKind': return values.some(v => v >= 4) ? sum : 0;
    case 'fullHouse': {
      const vals = values.slice().sort();
      return (vals.length === 2 && vals[0] === 2 && vals[1] === 3) ? 25 : 0;
    }
    case 'smallStraight': {
      const straights = [[1,2,3,4],[2,3,4,5],[3,4,5,6]];
      return straights.some(s => s.every(n => sortedUnique.includes(n))) ? 30 : 0;
    }
    case 'largeStraight': {
      const straights = [[1,2,3,4,5],[2,3,4,5,6]];
      return straights.some(s => s.length === sortedUnique.length && s.every(n => sortedUnique.includes(n))) ? 40 : 0;
    }
    case 'yahtzee': return values.some(v => v === 5) ? 50 : 0;
    case 'chance': return sum;
    default: return 0;
  }
}

function selectCategory(key) {
  if (gameOver) return;
  if (scores[key] !== null) return;
  if (rollsLeft === 3) {
    messageEl.textContent = 'Roll the dice first.';
    return;
  }
  lastAction = {
    key,
    dice: [...dice],
    held: [...held],
    rollsLeft,
  };
  scores[key] = calcScore(key);
  held = [false, false, false, false, false];
  rollsLeft = 3;

  const category = CATEGORIES.find(c => c.key === key);
  showSaveNotice(category.label);

  const allDone = playerScores.every(ps => CATEGORIES.every(c => ps[c.key] !== null));
  if (allDone) {
    endGame();
  } else if (players.length > 1) {
    const nextIndex = (currentPlayerIndex + 1) % players.length;
    handoffNameEl.textContent = players[nextIndex].name;
    handoffOverlay.classList.remove('hidden');
  } else {
    messageEl.textContent = 'Roll the dice for your next turn!';
  }
  render();
}

function advanceToNextPlayer() {
  handoffOverlay.classList.add('hidden');
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  scores = playerScores[currentPlayerIndex];
  dice = [1, 1, 1, 1, 1];
  held = [false, false, false, false, false];
  rollsLeft = 3;
  lastAction = null;
  hideSaveNotice();
  setAccent(players[currentPlayerIndex].color);
  messageEl.textContent = 'Roll the dice for your next turn!';
  render();
}

function upperTotal(s) {
  return CATEGORIES.filter(c => c.section === 'upper')
    .reduce((sum, c) => sum + (s[c.key] || 0), 0);
}

function upperBonus(s) {
  return upperTotal(s) >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0;
}

function lowerTotal(s) {
  return CATEGORIES.filter(c => c.section === 'lower')
    .reduce((sum, c) => sum + (s[c.key] || 0), 0);
}

function grandTotal(s) {
  return upperTotal(s) + upperBonus(s) + lowerTotal(s);
}

function endGame() {
  gameOver = true;
  finalScoresEl.innerHTML = '';
  const results = players.map((p, i) => ({ player: p, total: grandTotal(playerScores[i]) }));
  const maxScore = Math.max(...results.map(r => r.total));
  results
    .slice()
    .sort((a, b) => b.total - a.total)
    .forEach(r => {
      const row = document.createElement('div');
      row.className = 'final-score-row' + (players.length > 1 && r.total === maxScore ? ' winner' : '');
      const label = document.createElement('span');
      label.className = 'player-label';
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.width = '10px';
      dot.style.height = '10px';
      dot.style.borderRadius = '50%';
      dot.style.background = r.player.color;
      label.appendChild(dot);
      label.appendChild(document.createTextNode(r.player.name));
      const score = document.createElement('span');
      score.textContent = r.total;
      row.appendChild(label);
      row.appendChild(score);
      finalScoresEl.appendChild(row);
    });
  gameOverOverlay.classList.remove('hidden');
}

function renderPlayersBar() {
  if (players.length <= 1) {
    playersBar.classList.add('hidden');
    playersBar.innerHTML = '';
    return;
  }
  playersBar.classList.remove('hidden');
  playersBar.innerHTML = '';
  players.forEach((p, i) => {
    const chip = document.createElement('div');
    chip.className = 'player-chip' + (i === currentPlayerIndex ? ' current' : '');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = p.color;
    const name = document.createElement('span');
    name.textContent = p.name;
    const score = document.createElement('span');
    score.className = 'chip-score';
    score.textContent = grandTotal(playerScores[i]);
    chip.appendChild(dot);
    chip.appendChild(name);
    chip.appendChild(score);
    playersBar.appendChild(chip);
  });
}

function render() {
  renderPlayersBar();

  // Dice
  diceRow.innerHTML = '';
  const FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  for (let i = 0; i < 5; i++) {
    const die = document.createElement('div');
    die.className = 'die' + (held[i] ? ' held' : '');
    die.textContent = FACES[dice[i]];
    die.addEventListener('click', () => toggleHold(i));
    diceRow.appendChild(die);
  }

  rollsLeftEl.textContent = `Rolls left: ${rollsLeft}`;
  rollBtn.disabled = rollsLeft <= 0 || gameOver;

  // Scorecard
  scorecardBody.innerHTML = '';
  let lastSection = null;
  CATEGORIES.forEach(cat => {
    if (cat.section !== lastSection) {
      const sectionRow = document.createElement('tr');
      sectionRow.className = 'section-row';
      const label = cat.section === 'upper' ? 'Upper Section' : 'Lower Section';
      sectionRow.innerHTML = `<td colspan="2">${label}</td>`;
      scorecardBody.appendChild(sectionRow);
      lastSection = cat.section;
    }

    const filled = scores[cat.key] !== null;
    const canSelect = !filled && !gameOver && rollsLeft < 3;
    const row = document.createElement('tr');
    row.className = 'score-row ' + (filled ? 'filled' : 'unfilled') + (canSelect ? ' selectable' : '');

    let displayValue;
    if (filled) {
      displayValue = scores[cat.key];
    } else if (canSelect) {
      displayValue = calcScore(cat.key);
    } else {
      displayValue = '-';
    }

    row.innerHTML = `<td>${cat.label}</td><td class="score-value">${displayValue}</td>`;
    if (canSelect) {
      row.addEventListener('click', () => selectCategory(cat.key));
    }
    scorecardBody.appendChild(row);
  });

  // Bonus row
  const bonusRow = document.createElement('tr');
  bonusRow.className = 'score-row filled';
  bonusRow.innerHTML = `<td>Upper Bonus (≥${UPPER_BONUS_THRESHOLD})</td><td class="score-value">${upperBonus(scores)}</td>`;
  scorecardBody.appendChild(bonusRow);

  totalScoreEl.textContent = grandTotal(scores);
}

players = [{ name: 'Player', color: '#facc15' }];
startGame();
