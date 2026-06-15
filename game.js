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

let dice = [1, 1, 1, 1, 1];
let held = [false, false, false, false, false];
let rollsLeft = 3;
let scores = {}; // key -> number or null
let gameOver = false;

const diceRow = document.getElementById('dice-row');
const rollBtn = document.getElementById('roll-btn');
const rollsLeftEl = document.getElementById('rolls-left');
const scorecardBody = document.getElementById('scorecard-body');
const totalScoreEl = document.getElementById('total-score');
const messageEl = document.getElementById('message');
const gameOverOverlay = document.getElementById('game-over');
const finalScoreEl = document.getElementById('final-score');

document.getElementById('new-game').addEventListener('click', () => {
  if (confirm('Start a new game? Current progress will be lost.')) {
    resetGame();
  }
});
document.getElementById('restart-btn').addEventListener('click', resetGame);
rollBtn.addEventListener('click', rollDice);

const shakeToggle = document.getElementById('shake-toggle');
const SHAKE_THRESHOLD = 22;
const SHAKE_COOLDOWN_MS = 1000;
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

function resetGame() {
  dice = [1, 1, 1, 1, 1];
  held = [false, false, false, false, false];
  rollsLeft = 3;
  scores = {};
  CATEGORIES.forEach(c => scores[c.key] = null);
  gameOver = false;
  gameOverOverlay.classList.add('hidden');
  messageEl.textContent = 'Roll the dice to begin!';
  render();
}

function rollDice() {
  if (rollsLeft <= 0 || gameOver) return;

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
  scores[key] = calcScore(key);
  held = [false, false, false, false, false];
  rollsLeft = 3;

  if (CATEGORIES.every(c => scores[c.key] !== null)) {
    endGame();
  } else {
    messageEl.textContent = 'Roll the dice for your next turn!';
  }
  render();
}

function upperTotal() {
  return CATEGORIES.filter(c => c.section === 'upper')
    .reduce((sum, c) => sum + (scores[c.key] || 0), 0);
}

function upperBonus() {
  return upperTotal() >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0;
}

function lowerTotal() {
  return CATEGORIES.filter(c => c.section === 'lower')
    .reduce((sum, c) => sum + (scores[c.key] || 0), 0);
}

function grandTotal() {
  return upperTotal() + upperBonus() + lowerTotal();
}

function endGame() {
  gameOver = true;
  finalScoreEl.textContent = `Final Score: ${grandTotal()}`;
  gameOverOverlay.classList.remove('hidden');
}

function render() {
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
  bonusRow.innerHTML = `<td>Upper Bonus (≥${UPPER_BONUS_THRESHOLD})</td><td class="score-value">${upperBonus()}</td>`;
  scorecardBody.appendChild(bonusRow);

  totalScoreEl.textContent = grandTotal();
}

resetGame();
