/**
 * DARTS HORSE - Begleit-App
 * Vanilla JavaScript State Management, Game Logic, PWA Registration & UI Handling
 */

// Register Service Worker for PWA Offline Functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registriert:', reg))
      .catch(err => console.warn('Service Worker Fehler:', err));
  });
}

// Preset Challenges Categories
const PRESET_CHALLENGES = {
  numbers: [
    'Single 20', 'Double 20', 'Triple 20',
    'Single 19', 'Double 19', 'Triple 19',
    'Single 18', 'Double 18', 'Triple 18',
    'Single 17', 'Double 17', 'Triple 17',
    'Single 16', 'Double 16', 'Triple 16',
    'Single Bull', 'Double Bull (Bullseye)',
    'Beliebiges Double', 'Beliebiges Triple'
  ],
  areas: [
    'Innerer Ring (Triples)',
    'Äußerer Ring (Doubles)',
    'Rotes Feld (20, 18, 14, 12, 8, 6, 2, Bull)',
    'Grünes Feld (1, 4, 9, 11, 13, 15, 17, 19, Single Bull)',
    'Schwarzes Segment',
    'Weißes Segment',
    'Über der Bullseye-Horizontale (Top Half)',
    'Unter der Bullseye-Horizontale (Bottom Half)'
  ],
  techniques: [
    'Schwacher Arm (Off-Hand)',
    'Geschlossene Augen (Blind)',
    'Zwischen den Beinen',
    'Auf einem Bein stehend',
    'Ohne Schwung (Ausholen)',
    'Knieend geworfen',
    'Rückwärts zum Board (Über Schulter)',
    'Schnellwurf (< 3 Sekunden)'
  ]
};

// Global App State
const state = {
  setupPlayers: ['Spieler 1', 'Spieler 2'],
  settings: {
    callerPenalty: 0.5, // 0, 0.5, or 1
    callerMode: 'strict', // 'strict' or 'streak'
    targetWord: 'HORSE'
  },
  gameActive: false,
  game: {
    targetWord: 'HORSE',
    players: [], // Array of { id, name, penaltyScore, isEliminated, stats: { callerHits, soleSurvivorHits, defendedHits } }
    activeCallerIndex: 0,
    currentChallenge: null,
    roundHistory: [] // Array of { id, callerId, challenge, callerHit, playerResults: [{playerId, hit, penaltyAdded}] }
  },
  matchHistory: [] // Stored finished matches
};

// DOM Element References
const elements = {
  // Navigation
  btnNavGame: document.getElementById('btn-nav-game'),
  btnNavHistory: document.getElementById('btn-nav-history'),
  viewSetup: document.getElementById('view-setup'),
  viewGame: document.getElementById('view-game'),
  viewHistory: document.getElementById('view-history'),

  // Setup View
  resumePrompt: document.getElementById('resume-prompt'),
  btnResumeGame: document.getElementById('btn-resume-game'),
  btnDiscardGame: document.getElementById('btn-discard-game'),
  inputPlayerName: document.getElementById('input-player-name'),
  btnAddPlayer: document.getElementById('btn-add-player'),
  playerListSetup: document.getElementById('player-list-setup'),
  btnShufflePlayers: document.getElementById('btn-shuffle-players'),
  selectCallerPenalty: document.getElementById('select-caller-penalty'),
  selectCallerMode: document.getElementById('select-caller-mode'),
  inputTargetWord: document.getElementById('input-target-word'),
  btnStartGame: document.getElementById('btn-start-game'),

  // Game View
  btnAbortGame: document.getElementById('btn-abort-game'),
  activeCallerName: document.getElementById('active-caller-name'),
  gamePlayersList: document.getElementById('game-players-list'),
  selectedChallengeDisplay: document.getElementById('selected-challenge-display'),
  currentChallengeText: document.getElementById('current-challenge-text'),
  btnAnnounceChallenge: document.getElementById('btn-announce-challenge'),

  // Presets & Tabs
  presetGridNumbers: document.getElementById('preset-grid-numbers'),
  presetGridAreas: document.getElementById('preset-grid-areas'),
  presetGridTechniques: document.getElementById('preset-grid-techniques'),
  inputCustomChallenge: document.getElementById('input-custom-challenge'),
  btnUseCustomChallenge: document.getElementById('btn-use-custom-challenge'),
  btnUseVerbalChallenge: document.getElementById('btn-use-verbal-challenge'),

  // Modal Round Eval
  modalRoundEval: document.getElementById('modal-round-eval'),
  evalRoundTitle: document.getElementById('eval-round-title'),
  evalChallengeName: document.getElementById('eval-challenge-name'),
  evalStepCaller: document.getElementById('eval-step-caller'),
  evalCallerName: document.getElementById('eval-caller-name'),
  btnCallerHit: document.getElementById('btn-caller-hit'),
  btnCallerMiss: document.getElementById('btn-caller-miss'),
  evalStepOthers: document.getElementById('eval-step-others'),
  evalOthersList: document.getElementById('eval-others-list'),
  btnSubmitRoundResults: document.getElementById('btn-submit-round-results'),

  // Modal Game Over
  modalGameOver: document.getElementById('modal-game-over'),
  winnerAnnouncement: document.getElementById('winner-announcement'),
  deadliestChallengeText: document.getElementById('deadliest-challenge-text'),
  gameOverHistoryLog: document.getElementById('game-over-history-log'),
  btnRestartGame: document.getElementById('btn-restart-game'),

  // History View
  historyList: document.getElementById('history-list'),
  btnClearHistory: document.getElementById('btn-clear-history')
};

// Current Evaluation Flow Temporary State
let currentRoundEval = {
  callerHit: null,
  otherResults: {} // playerId -> boolean (hit or miss)
};

/* ==========================================================================
   INITIALIZATION & LOCAL STORAGE
   ========================================================================== */

function init() {
  loadLocalStorage();
  renderSetupPlayerList();
  renderPresetGrids();
  setupEventListeners();
  checkUnfinishedGame();
}

function loadLocalStorage() {
  const savedHistory = localStorage.getItem('horse_match_history');
  if (savedHistory) {
    try {
      state.matchHistory = JSON.parse(savedHistory);
    } catch (e) {
      console.error('Fehler beim Laden der Match-Historie', e);
    }
  }

  const savedGame = localStorage.getItem('horse_active_game');
  if (savedGame) {
    try {
      state.savedGameData = JSON.parse(savedGame);
    } catch (e) {
      console.error('Fehler beim Laden des aktiven Spiels', e);
    }
  }
}

function checkUnfinishedGame() {
  if (state.savedGameData && state.savedGameData.gameActive) {
    elements.resumePrompt.classList.remove('hidden');
  } else {
    elements.resumePrompt.classList.add('hidden');
  }
}

function saveActiveGameToStorage() {
  if (state.gameActive) {
    const saveData = {
      gameActive: true,
      settings: state.settings,
      game: state.game
    };
    localStorage.setItem('horse_active_game', JSON.stringify(saveData));
  } else {
    localStorage.removeItem('horse_active_game');
  }
}

function saveMatchHistoryToStorage() {
  localStorage.setItem('horse_match_history', JSON.stringify(state.matchHistory));
}

/* ==========================================================================
   UI NAVIGATION & VIEWS
   ========================================================================== */

function switchView(viewName) {
  elements.viewSetup.classList.add('hidden');
  elements.viewGame.classList.add('hidden');
  elements.viewHistory.classList.add('hidden');

  elements.btnNavGame.classList.remove('active');
  elements.btnNavHistory.classList.remove('active');

  if (viewName === 'setup') {
    elements.viewSetup.classList.remove('hidden');
    elements.btnNavGame.classList.add('active');
    checkUnfinishedGame();
  } else if (viewName === 'game') {
    elements.viewGame.classList.remove('hidden');
    elements.btnNavGame.classList.add('active');
  } else if (viewName === 'history') {
    elements.viewHistory.classList.remove('hidden');
    elements.btnNavHistory.classList.add('active');
    renderMatchHistory();
  }
}

/* ==========================================================================
   SETUP SCREEN LOGIC
   ========================================================================== */

function renderSetupPlayerList() {
  elements.playerListSetup.innerHTML = '';
  state.setupPlayers.forEach((player, index) => {
    const li = document.createElement('li');
    li.className = 'player-setup-item';
    li.innerHTML = `
      <span class="player-name-text">${index + 1}. ${escapeHTML(player)}</span>
      <div class="player-controls">
        <button class="btn-icon" data-action="up" data-index="${index}" title="Nach oben">⬆️</button>
        <button class="btn-icon" data-action="down" data-index="${index}" title="Nach unten">⬇️</button>
        <button class="btn-icon" data-action="remove" data-index="${index}" title="Löschen">❌</button>
      </div>
    `;
    elements.playerListSetup.appendChild(li);
  });
}

function addSetupPlayer() {
  const name = elements.inputPlayerName.value.trim();
  if (name) {
    state.setupPlayers.push(name);
    elements.inputPlayerName.value = '';
    renderSetupPlayerList();
  }
}

function handlePlayerListControl(e) {
  const btn = e.target.closest('.btn-icon');
  if (!btn) return;
  const action = btn.dataset.action;
  const index = parseInt(btn.dataset.index, 10);

  if (action === 'remove') {
    if (state.setupPlayers.length <= 2) {
      alert('Mindestens 2 Spieler erforderlich!');
      return;
    }
    state.setupPlayers.splice(index, 1);
  } else if (action === 'up' && index > 0) {
    const temp = state.setupPlayers[index];
    state.setupPlayers[index] = state.setupPlayers[index - 1];
    state.setupPlayers[index - 1] = temp;
  } else if (action === 'down' && index < state.setupPlayers.length - 1) {
    const temp = state.setupPlayers[index];
    state.setupPlayers[index] = state.setupPlayers[index + 1];
    state.setupPlayers[index + 1] = temp;
  }
  renderSetupPlayerList();
}

function shuffleSetupPlayers() {
  for (let i = state.setupPlayers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.setupPlayers[i], state.setupPlayers[j]] = [state.setupPlayers[j], state.setupPlayers[i]];
  }
  renderSetupPlayerList();
}

/* ==========================================================================
   PRESET CHALLENGES & TABS
   ========================================================================== */

function renderPresetGrids() {
  renderGridCategory(elements.presetGridNumbers, PRESET_CHALLENGES.numbers);
  renderGridCategory(elements.presetGridAreas, PRESET_CHALLENGES.areas);
  renderGridCategory(elements.presetGridTechniques, PRESET_CHALLENGES.techniques);
}

function renderGridCategory(container, items) {
  container.innerHTML = '';
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.textContent = item;
    btn.addEventListener('click', () => selectChallenge(item));
    container.appendChild(btn);
  });
}

function selectChallenge(challengeText) {
  state.game.currentChallenge = challengeText;
  elements.currentChallengeText.textContent = challengeText;
  elements.selectedChallengeDisplay.classList.remove('hidden');
  elements.selectedChallengeDisplay.scrollIntoView({ behavior: 'smooth' });
}

/* ==========================================================================
   GAME ENGINE & STATE MANAGEMENT
   ========================================================================== */

function startNewGame() {
  if (state.setupPlayers.length < 2) {
    alert('Bitte trage mindestens 2 Spieler ein!');
    return;
  }

  const targetWordInput = elements.inputTargetWord.value.trim().toUpperCase() || 'HORSE';
  const callerPenalty = parseFloat(elements.selectCallerPenalty.value);
  const callerMode = elements.selectCallerMode.value;

  state.settings = {
    callerPenalty: callerPenalty,
    callerMode: callerMode,
    targetWord: targetWordInput
  };

  state.game = {
    targetWord: targetWordInput,
    players: state.setupPlayers.map((name, idx) => ({
      id: 'p_' + idx + '_' + Date.now(),
      name: name,
      penaltyScore: 0, // Max = targetWord.length
      isEliminated: false,
      stats: {
        callerHits: 0,
        soleSurvivorHits: 0,
        defendedHits: 0
      }
    })),
    activeCallerIndex: 0,
    currentChallenge: null,
    roundHistory: []
  };

  state.gameActive = true;
  saveActiveGameToStorage();
  switchView('game');
  renderGameScreen();
}

function resumeSavedGame() {
  if (state.savedGameData && state.savedGameData.game) {
    state.game = state.savedGameData.game;
    state.settings = state.savedGameData.settings;
    state.gameActive = true;
    switchView('game');
    renderGameScreen();
  }
}

function discardSavedGame() {
  localStorage.removeItem('horse_active_game');
  state.savedGameData = null;
  elements.resumePrompt.classList.add('hidden');
}

function abortCurrentGame() {
  if (confirm('Möchtest du das aktuelle Spiel wirklich abbrechen?')) {
    state.gameActive = false;
    saveActiveGameToStorage();
    switchView('setup');
  }
}

/* ==========================================================================
   GAME UI RENDERING & HOLO LETTERS
   ========================================================================== */

function renderGameScreen() {
  const activeCaller = state.game.players[state.game.activeCallerIndex];
  elements.activeCallerName.textContent = activeCaller ? activeCaller.name : '-';

  // Render Players
  elements.gamePlayersList.innerHTML = '';
  state.game.players.forEach((player, idx) => {
    const isCaller = idx === state.game.activeCallerIndex;
    const card = document.createElement('div');
    card.className = `game-player-card ${isCaller ? 'is-caller' : ''} ${player.isEliminated ? 'is-eliminated' : ''}`;

    // Generate Holo Letters HTML
    const holoLettersHtml = renderHoloLetters(player.penaltyScore, state.game.targetWord);

    card.innerHTML = `
      <div class="player-card-header">
        <span class="player-card-name">${escapeHTML(player.name)} ${isCaller ? '📢 (Caller)' : ''}</span>
        ${player.isEliminated ? '<span class="eliminated-badge">AUSGESCHIEDEN</span>' : ''}
      </div>
      <div class="horse-letters-container">
        ${holoLettersHtml}
      </div>
      <div class="player-live-stats">
        <div class="stat-item">
          <span class="stat-value">${player.stats.callerHits}</span>
          <span class="stat-desc">Ansagen getr.</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${player.stats.soleSurvivorHits}</span>
          <span class="stat-desc">Einzig getr.</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${player.stats.defendedHits}</span>
          <span class="stat-desc">Abgewehrt</span>
        </div>
      </div>
    `;

    elements.gamePlayersList.appendChild(card);
  });

  // Reset challenge selection
  state.game.currentChallenge = null;
  elements.selectedChallengeDisplay.classList.add('hidden');
}

/**
 * Generates Holo Letter visualization
 * Full letter lost = red background
 * Half letter lost = 135 deg diagonal split background
 * Intact = Holo transparent glow
 */
function renderHoloLetters(penaltyScore, targetWord) {
  let html = '';
  const letters = targetWord.split('');

  letters.forEach((char, idx) => {
    // Each letter corresponds to index + 1 full penalty point
    const threshold = idx + 1;
    let classNames = 'holo-letter';

    if (penaltyScore >= threshold) {
      classNames += ' full-lost';
    } else if (penaltyScore >= threshold - 0.5) {
      classNames += ' half-lost';
    }

    html += `<div class="${classNames}">${char}</div>`;
  });

  return html;
}

/* ==========================================================================
   ROUND EVALUATION FLOW
   ========================================================================== */

function openRoundEvaluationModal() {
  if (!state.game.currentChallenge) return;

  const caller = state.game.players[state.game.activeCallerIndex];
  elements.evalRoundTitle.textContent = `Runde auswerten - Ansager: ${caller.name}`;
  elements.evalChallengeName.textContent = state.game.currentChallenge;
  elements.evalCallerName.textContent = caller.name;

  // Reset temp eval state
  currentRoundEval = {
    callerHit: null,
    otherResults: {}
  };

  // Show Step A (Caller Hit/Miss), Hide Step B
  elements.evalStepCaller.classList.remove('hidden');
  elements.evalStepOthers.classList.add('hidden');

  elements.modalRoundEval.classList.remove('hidden');
}

function handleCallerResult(hit) {
  currentRoundEval.callerHit = hit;
  const caller = state.game.players[state.game.activeCallerIndex];

  if (hit) {
    // Caller Hit -> Proceed to Step B (Other active players)
    caller.stats.callerHits++;
    setupOthersEvaluationStep();
    elements.evalStepCaller.classList.add('hidden');
    elements.evalStepOthers.classList.remove('hidden');
  } else {
    // Caller Missed -> Caller gets penalty according to rules, round ends immediately!
    const penalty = state.settings.callerPenalty;
    if (penalty > 0) {
      caller.penaltyScore += penalty;
      checkPlayerElimination(caller);
    }

    // Record round log
    state.game.roundHistory.push({
      roundNumber: state.game.roundHistory.length + 1,
      callerId: caller.id,
      callerName: caller.name,
      challenge: state.game.currentChallenge,
      callerHit: false,
      penaltiesGiven: [{ playerId: caller.id, playerName: caller.name, penalty: penalty }]
    });

    closeEvaluationAndNextTurn(false); // caller missed
  }
}

function setupOthersEvaluationStep() {
  elements.evalOthersList.innerHTML = '';
  currentRoundEval.otherResults = {};

  const activeOthers = state.game.players.filter((p, idx) => !p.isEliminated && idx !== state.game.activeCallerIndex);

  if (activeOthers.length === 0) {
    // No other active players left (should not happen before game over)
    submitRoundResults();
    return;
  }

  activeOthers.forEach(p => {
    currentRoundEval.otherResults[p.id] = false; // default miss

    const row = document.createElement('div');
    row.className = 'eval-player-row';
    row.innerHTML = `
      <span>${escapeHTML(p.name)}</span>
      <button class="toggle-hit-btn" data-player-id="${p.id}">❌ Verfehlt</button>
    `;

    const toggleBtn = row.querySelector('.toggle-hit-btn');
    toggleBtn.addEventListener('click', () => {
      currentRoundEval.otherResults[p.id] = !currentRoundEval.otherResults[p.id];
      if (currentRoundEval.otherResults[p.id]) {
        toggleBtn.classList.add('is-hit');
        toggleBtn.textContent = '✅ Getroffen';
      } else {
        toggleBtn.classList.remove('is-hit');
        toggleBtn.textContent = '❌ Verfehlt';
      }
    });

    elements.evalOthersList.appendChild(row);
  });
}

function submitRoundResults() {
  const caller = state.game.players[state.game.activeCallerIndex];
  const activeOthers = state.game.players.filter((p, idx) => !p.isEliminated && idx !== state.game.activeCallerIndex);

  const penaltiesGiven = [];
  let successfulOthersCount = 0;

  activeOthers.forEach(p => {
    const hit = currentRoundEval.otherResults[p.id];
    if (hit) {
      successfulOthersCount++;
      p.stats.defendedHits++;
    } else {
      // Missed caller's successful challenge -> 1 letter penalty
      p.penaltyScore += 1.0;
      checkPlayerElimination(p);
      penaltiesGiven.push({ playerId: p.id, playerName: p.name, penalty: 1.0 });
    }
  });

  // Track Sole Survivor stat for caller (if NO other player hit the challenge)
  if (successfulOthersCount === 0 && activeOthers.length > 0) {
    caller.stats.soleSurvivorHits++;
  }

  // Record round log
  state.game.roundHistory.push({
    roundNumber: state.game.roundHistory.length + 1,
    callerId: caller.id,
    callerName: caller.name,
    challenge: state.game.currentChallenge,
    callerHit: true,
    penaltiesGiven: penaltiesGiven
  });

  closeEvaluationAndNextTurn(true); // caller hit
}

function checkPlayerElimination(player) {
  if (player.penaltyScore >= state.game.targetWord.length) {
    player.isEliminated = true;
  }
}

function closeEvaluationAndNextTurn(callerHit) {
  elements.modalRoundEval.classList.add('hidden');

  // Check Game Over Condition (only 1 or 0 non-eliminated players left)
  const remainingPlayers = state.game.players.filter(p => !p.isEliminated);

  if (remainingPlayers.length <= 1) {
    handleGameOver(remainingPlayers[0]);
    return;
  }

  // Determine Next Caller
  if (state.settings.callerMode === 'streak' && callerHit && !state.game.players[state.game.activeCallerIndex].isEliminated) {
    // Caller stays
  } else {
    // Advance to next active caller reihum
    advanceToNextCaller();
  }

  saveActiveGameToStorage();
  renderGameScreen();
}

function advanceToNextCaller() {
  let nextIdx = state.game.activeCallerIndex;
  const total = state.game.players.length;

  for (let i = 0; i < total; i++) {
    nextIdx = (nextIdx + 1) % total;
    if (!state.game.players[nextIdx].isEliminated) {
      state.game.activeCallerIndex = nextIdx;
      return;
    }
  }
}

/* ==========================================================================
   GAME OVER & STATISTICS
   ========================================================================== */

function handleGameOver(winner) {
  state.gameActive = false;
  saveActiveGameToStorage();

  const winnerName = winner ? winner.name : 'Niemand';
  elements.winnerAnnouncement.textContent = `🏆 ${winnerName} gewinnt das Spiel!`;

  // Find "Deadliest Challenge"
  const deadliest = calculateDeadliestChallenge();
  elements.deadliestChallengeText.textContent = deadliest ? `${deadliest.challenge} (${deadliest.penalties} Buchstaben verteilt)` : 'Keine';

  // Render Round History Log
  elements.gameOverHistoryLog.innerHTML = '';
  state.game.roundHistory.forEach(r => {
    const logItem = document.createElement('div');
    logItem.className = 'log-item';
    let penaltyText = 'Keine Strafen';
    if (r.penaltiesGiven.length > 0) {
      penaltyText = r.penaltiesGiven.map(p => `${p.playerName}: +${p.penalty}`).join(', ');
    }
    logItem.innerHTML = `
      <strong>Runde ${r.roundNumber} (${r.callerName}):</strong> "${escapeHTML(r.challenge)}" <br>
      Resultat: ${r.callerHit ? '✅ Got' : '❌ Verfehlt'} | Strafen: ${penaltyText}
    `;
    elements.gameOverHistoryLog.appendChild(logItem);
  });

  // Save to Finished Match History
  const matchRecord = {
    id: 'match_' + Date.now(),
    date: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    winnerName: winnerName,
    players: state.game.players.map(p => ({ name: p.name, score: p.penaltyScore, stats: p.stats })),
    deadliestChallenge: deadliest ? deadliest.challenge : '-',
    roundHistory: state.game.roundHistory
  };

  state.matchHistory.unshift(matchRecord);
  saveMatchHistoryToStorage();

  elements.modalGameOver.classList.remove('hidden');
}

function calculateDeadliestChallenge() {
  const challengeMap = {};

  state.game.roundHistory.forEach(r => {
    let totalPenaltiesInRound = 0;
    r.penaltiesGiven.forEach(p => {
      totalPenaltiesInRound += p.penalty;
    });

    if (totalPenaltiesInRound > 0) {
      challengeMap[r.challenge] = (challengeMap[r.challenge] || 0) + totalPenaltiesInRound;
    }
  });

  let deadliest = null;
  let maxPenalties = 0;

  for (const [challenge, penalties] of Object.entries(challengeMap)) {
    if (penalties > maxPenalties) {
      maxPenalties = penalties;
      deadliest = { challenge, penalties };
    }
  }

  return deadliest;
}

/* ==========================================================================
   MATCH HISTORY VIEW
   ========================================================================== */

function renderMatchHistory() {
  elements.historyList.innerHTML = '';

  if (state.matchHistory.length === 0) {
    elements.historyList.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Noch keine vergangenen Spiele gespeichert.</p>';
    return;
  }

  state.matchHistory.forEach(m => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const playerScores = m.players.map(p => `${escapeHTML(p.name)} (${p.score})`).join(', ');

    item.innerHTML = `
      <div class="history-item-header">
        <span class="history-winner">🏆 Sieger: ${escapeHTML(m.winnerName)}</span>
        <span class="history-date">${m.date}</span>
      </div>
      <div><strong>Spieler:</strong> ${playerScores}</div>
      <div><strong>Tödlichste Challenge:</strong> ${escapeHTML(m.deadliestChallenge)}</div>
    `;

    elements.historyList.appendChild(item);
  });
}

function clearMatchHistory() {
  if (confirm('Möchtest du die gesamte Match-Historie löschen?')) {
    state.matchHistory = [];
    saveMatchHistoryToStorage();
    renderMatchHistory();
  }
}

/* ==========================================================================
   EVENT LISTENERS SETUP
   ========================================================================== */

function setupEventListeners() {
  // Navigation
  elements.btnNavGame.addEventListener('click', () => switchView(state.gameActive ? 'game' : 'setup'));
  elements.btnNavHistory.addEventListener('click', () => switchView('history'));

  // Setup Actions
  elements.btnAddPlayer.addEventListener('click', addSetupPlayer);
  elements.inputPlayerName.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addSetupPlayer();
  });
  elements.playerListSetup.addEventListener('click', handlePlayerListControl);
  elements.btnShufflePlayers.addEventListener('click', shuffleSetupPlayers);

  elements.btnStartGame.addEventListener('click', startNewGame);
  elements.btnResumeGame.addEventListener('click', resumeSavedGame);
  elements.btnDiscardGame.addEventListener('click', discardSavedGame);

  // Game View Actions
  elements.btnAbortGame.addEventListener('click', abortCurrentGame);
  elements.btnAnnounceChallenge.addEventListener('click', openRoundEvaluationModal);

  // Custom Challenge Handlers
  elements.btnUseCustomChallenge.addEventListener('click', () => {
    const val = elements.inputCustomChallenge.value.trim();
    if (val) {
      selectChallenge(val);
      elements.inputCustomChallenge.value = '';
    }
  });

  elements.btnUseVerbalChallenge.addEventListener('click', () => {
    selectChallenge('Mündliche / Freie Ansage am Board');
  });

  // Modal Round Eval Actions
  elements.btnCallerHit.addEventListener('click', () => handleCallerResult(true));
  elements.btnCallerMiss.addEventListener('click', () => handleCallerResult(false));
  elements.btnSubmitRoundResults.addEventListener('click', submitRoundResults);

  // Modal Game Over Actions
  elements.btnRestartGame.addEventListener('click', () => {
    elements.modalGameOver.classList.add('hidden');
    switchView('setup');
  });

  // History Clear
  elements.btnClearHistory.addEventListener('click', clearMatchHistory);

  // Tabs Switching
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

      btn.classList.add('active');
      const targetTab = btn.dataset.tab;
      document.getElementById(targetTab).classList.add('active');
    });
  });
}

// Utility: HTML Escape for XSS prevention
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Initialize application on DOM ready
document.addEventListener('DOMContentLoaded', init);