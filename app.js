const MAX_CARDS = 4;
const NUMBERS_PER_CARD = 15;
const STORAGE_KEY = "bingo-da-matematica-manual-v1";

const allNumbers = Array.from({ length: 90 }, (_, index) => index + 1);

const state = {
  activeCardCount: 1,
  cards: Array.from({ length: MAX_CARDS }, (_, index) => ({
    name: `Cartao ${index + 1}`,
    numbers: [],
  })),
  called: [],
  history: [],
  current: null,
  gameStarted: false,
  gameOver: false,
  winners: [],
  setupMessage: "",
};

const els = {
  newGameTop: document.querySelector("#newGameTop"),
  cardCountPicker: document.querySelector("#cardCountPicker"),
  setupCards: document.querySelector("#setupCards"),
  setupStatus: document.querySelector("#setupStatus"),
  startGame: document.querySelector("#startGame"),
  remainingCount: document.querySelector("#remainingCount"),
  winnerBanner: document.querySelector("#winnerBanner"),
  statusText: document.querySelector("#statusText"),
  question: document.querySelector("#question"),
  answer: document.querySelector("#answer"),
  newOperation: document.querySelector("#newOperation"),
  showAnswer: document.querySelector("#showAnswer"),
  newGame: document.querySelector("#newGame"),
  playCards: document.querySelector("#playCards"),
  calledNumbers: document.querySelector("#calledNumbers"),
  historyList: document.querySelector("#historyList"),
  chooseCards: document.querySelector("#chooseCards"),
  chooseCardsTop: document.querySelector("#chooseCardsTop"),
};

function clampCardCount(value) {
  return Math.min(MAX_CARDS, Math.max(1, Number(value) || 1));
}

function sortNumbers(numbers) {
  return [...new Set(numbers)]
    .map(Number)
    .filter((number) => Number.isInteger(number) && number >= 1 && number <= 90)
    .sort((a, b) => a - b);
}

function uniqueNumbersInOrder(numbers) {
  const seen = new Set();
  const result = [];

  (numbers || []).forEach((value) => {
    const number = Number(value);
    if (Number.isInteger(number) && number >= 1 && number <= 90 && !seen.has(number)) {
      seen.add(number);
      result.push(number);
    }
  });

  return result;
}

function activeCards() {
  return state.cards.slice(0, state.activeCardCount);
}

function isCardReady(card) {
  return card.numbers.length === NUMBERS_PER_CARD;
}

function readyCardCount() {
  return activeCards().filter(isCardReady).length;
}

function allCardsReady() {
  return readyCardCount() === state.activeCardCount;
}

function playableNumbers() {
  return sortNumbers(activeCards().flatMap((card) => card.numbers));
}

function availableNumbers() {
  const called = new Set(state.called);
  return playableNumbers().filter((number) => !called.has(number));
}

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activeCardCount: state.activeCardCount,
        cards: state.cards,
        called: state.called,
        history: state.history,
        current: state.current,
        gameStarted: state.gameStarted,
        gameOver: state.gameOver,
        winners: state.winners,
      }),
    );
  } catch (error) {
    console.warn("Nao foi possivel guardar o jogo.", error);
  }
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) return;

    state.activeCardCount = clampCardCount(saved.activeCardCount);
    state.cards = Array.from({ length: MAX_CARDS }, (_, index) => {
      const savedCard = saved.cards?.[index] || {};
      return {
        name: `Cartao ${index + 1}`,
        numbers: sortNumbers(savedCard.numbers || []).slice(0, NUMBERS_PER_CARD),
      };
    });
    state.called = uniqueNumbersInOrder(saved.called || []);
    state.history = Array.isArray(saved.history)
      ? saved.history
          .filter((item) => item && Number.isInteger(item.answer))
          .map((item) => ({
            problem: String(item.problem || ""),
            answer: item.answer,
          }))
      : [];
    state.current =
      saved.current && Number.isInteger(saved.current.answer)
        ? {
            problem: String(saved.current.problem || ""),
            answer: saved.current.answer,
            revealed: Boolean(saved.current.revealed),
          }
        : null;
    state.gameStarted = Boolean(saved.gameStarted) && allCardsReady();
    state.gameOver = Boolean(saved.gameOver) && state.gameStarted;
    state.winners = Array.isArray(saved.winners)
      ? saved.winners.filter((index) => Number.isInteger(index) && index >= 0 && index < MAX_CARDS)
      : [];
    if (!state.gameStarted) {
      state.current = null;
      state.gameOver = false;
      state.winners = [];
    }
  } catch (error) {
    console.warn("Nao foi possivel recuperar o jogo guardado.", error);
  }
}

function resetProgress(message = "") {
  state.called = [];
  state.history = [];
  state.current = null;
  state.gameStarted = false;
  state.gameOver = false;
  state.winners = [];
  state.setupMessage = message;
}

function setActiveCardCount(count) {
  state.activeCardCount = clampCardCount(count);
  resetProgress("Escolhe 15 numeros em cada cartao ativo.");
  render();
}

function toggleNumber(cardIndex, number) {
  if (state.gameStarted) {
    state.setupMessage = "Para mudar os cartoes, comeca um novo jogo.";
    render();
    return;
  }

  const card = state.cards[cardIndex];
  const selected = card.numbers.includes(number);

  if (selected) {
    card.numbers = card.numbers.filter((item) => item !== number);
    state.setupMessage = "";
  } else if (card.numbers.length < NUMBERS_PER_CARD) {
    card.numbers = sortNumbers([...card.numbers, number]);
    state.setupMessage = "";
  } else {
    state.setupMessage = `${card.name} ja tem 15 numeros. Tira um numero para escolher outro.`;
  }

  render();
}

function clearCard(cardIndex) {
  if (state.gameStarted) {
    state.setupMessage = "Para limpar cartoes, comeca um novo jogo.";
    render();
    return;
  }

  state.cards[cardIndex].numbers = [];
  state.setupMessage = `${state.cards[cardIndex].name} ficou limpo.`;
  render();
}

function startGame() {
  if (!allCardsReady()) {
    const missingCards = activeCards()
      .filter((card) => !isCardReady(card))
      .map((card) => `${card.name}: ${card.numbers.length}/15`)
      .join(" | ");
    state.setupMessage = `Ainda falta completar: ${missingCards}.`;
    render();
    return;
  }

  state.called = [];
  state.history = [];
  state.current = null;
  state.gameStarted = true;
  state.gameOver = false;
  state.winners = [];
  state.setupMessage = "Jogo iniciado.";
  render();
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addCandidate(candidates, problem, answer) {
  if (answer >= 1 && answer <= 90) {
    candidates.push(problem);
  }
}

function buildOperation(target) {
  const candidates = [];
  const multiplicationCandidates = [];

  for (let factor = 1; factor <= 10; factor += 1) {
    const other = target / factor;
    if (Number.isInteger(other) && other >= 1 && other <= 10) {
      const problem = `${factor} x ${other}`;
      addCandidate(candidates, problem, target);
      if (factor > 1 && other > 1) {
        addCandidate(multiplicationCandidates, problem, target);
      }
    }
  }

  for (let index = 0; index < 10; index += 1) {
    const addend = randomInt(0, Math.min(10, target));
    addCandidate(candidates, `${addend} + ${target - addend}`, target);
  }

  for (const addend of [10, 20, 30, 40, 50]) {
    if (target > addend) {
      addCandidate(candidates, `${addend} + ${target - addend}`, target);
    }
  }

  for (let subtrahend = 1; subtrahend <= 10; subtrahend += 1) {
    if (target + subtrahend <= 90) {
      addCandidate(candidates, `${target + subtrahend} - ${subtrahend}`, target);
    }
  }

  for (let index = 0; index < 14; index += 1) {
    const first = randomInt(0, 10);
    const second = randomInt(0, 10);
    const third = target - first - second;
    if (third >= 0 && third <= 90) {
      addCandidate(candidates, `${first} + ${second} + ${third}`, target);
    }
  }

  for (let index = 0; index < 18; index += 1) {
    const plus = randomInt(1, 10);
    const minus = randomInt(1, 10);
    const start = target - plus + minus;
    if (start >= 0 && start <= 90 && start + plus >= minus) {
      addCandidate(candidates, `${start} + ${plus} - ${minus}`, target);
    }
  }

  for (let index = 0; index < 18; index += 1) {
    const minus = randomInt(1, 10);
    const plus = randomInt(1, 10);
    const start = target + minus - plus;
    if (start >= minus && start <= 90) {
      addCandidate(candidates, `${start} - ${minus} + ${plus}`, target);
    }
  }

  if (target < 90) {
    addCandidate(candidates, `${target + 1} - 1`, target);
  }

  if (target > 1) {
    addCandidate(candidates, `${target - 1} + 1`, target);
  }

  if (multiplicationCandidates.length && Math.random() < 0.35) {
    return randomItem(multiplicationCandidates);
  }

  return randomItem(candidates);
}

function newOperation() {
  if (!state.gameStarted || state.gameOver) return;

  if (state.current && !state.current.revealed) {
    return;
  }

  const available = availableNumbers();
  if (!available.length) {
    state.gameOver = true;
    state.setupMessage = "Ja sairam todos os numeros dos cartoes.";
    render();
    return;
  }

  const answer = randomItem(available);
  state.current = {
    problem: buildOperation(answer),
    answer,
    revealed: false,
  };
  render();
}

function findWinners() {
  const called = new Set(state.called);
  return activeCards()
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card.numbers.every((number) => called.has(number)))
    .map(({ index }) => index);
}

function showAnswer() {
  if (!state.current || state.current.revealed || state.gameOver) return;

  state.current.revealed = true;

  if (!state.called.includes(state.current.answer)) {
    state.called.push(state.current.answer);
    state.history.push({
      problem: state.current.problem,
      answer: state.current.answer,
    });
  }

  state.winners = findWinners();
  if (state.winners.length) {
    state.gameOver = true;
  }

  render();
}

function newGame({ keepCards = true } = {}) {
  if (!keepCards) {
    state.cards = Array.from({ length: MAX_CARDS }, (_, index) => ({
      name: `Cartao ${index + 1}`,
      numbers: [],
    }));
    state.activeCardCount = 1;
  }

  resetProgress(keepCards ? "Novo jogo pronto com os mesmos cartoes." : "Escolhe os cartoes para comecar.");
  render();
}

function chooseCards() {
  resetProgress("Podes ajustar os cartoes e voltar a iniciar.");
  document.querySelector("#setup-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
  render();
}

function renderCardCountPicker() {
  els.cardCountPicker.innerHTML = "";

  for (let count = 1; count <= MAX_CARDS; count += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `segment-button${count === state.activeCardCount ? " active" : ""}`;
    button.dataset.cardCount = String(count);
    button.textContent = String(count);
    button.setAttribute("aria-pressed", String(count === state.activeCardCount));
    button.disabled = state.gameStarted;
    button.addEventListener("click", () => setActiveCardCount(count));
    els.cardCountPicker.append(button);
  }
}

function renderSetupCards() {
  els.setupCards.innerHTML = "";

  activeCards().forEach((card, cardIndex) => {
    const cardElement = document.createElement("article");
    cardElement.className = `setup-card${isCardReady(card) ? " ready" : ""}`;

    const header = document.createElement("div");
    header.className = "card-title";

    const titleBlock = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = card.name;
    const status = document.createElement("div");
    status.className = `card-status${isCardReady(card) ? " ready" : ""}`;
    status.textContent = `${card.numbers.length}/15 numeros selecionados`;
    titleBlock.append(title, status);

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "mini-button";
    clearButton.dataset.clearCard = String(cardIndex);
    clearButton.textContent = "Limpar cartao";
    clearButton.disabled = state.gameStarted || card.numbers.length === 0;
    clearButton.addEventListener("click", () => clearCard(cardIndex));

    header.append(titleBlock, clearButton);

    const grid = document.createElement("div");
    grid.className = "number-picker";
    grid.setAttribute("aria-label", `Numeros do ${card.name}`);

    allNumbers.forEach((number) => {
      const selected = card.numbers.includes(number);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `number-button${selected ? " selected" : ""}`;
      button.dataset.card = String(cardIndex);
      button.dataset.number = String(number);
      button.textContent = String(number);
      button.setAttribute("aria-pressed", String(selected));
      button.disabled = state.gameStarted || (!selected && card.numbers.length >= NUMBERS_PER_CARD);
      button.addEventListener("click", () => toggleNumber(cardIndex, number));
      grid.append(button);
    });

    cardElement.append(header, grid);
    els.setupCards.append(cardElement);
  });
}

function renderSetupStatus() {
  const ready = readyCardCount();
  els.setupStatus.textContent = `${ready}/${state.activeCardCount} prontos`;
  els.startGame.disabled = !allCardsReady() || state.gameStarted;
}

function renderGameBoard() {
  const available = availableNumbers().length;
  els.remainingCount.textContent = state.gameStarted ? `${available} por sair` : "0 numeros";

  if (state.winners.length) {
    const names = state.winners.map((index) => state.cards[index].name);
    const message =
      names.length === 1
        ? `Bingo! O ${names[0]} esta completo.`
        : `Bingo! ${names.join(" e ")} estao completos.`;
    els.winnerBanner.hidden = false;
    els.winnerBanner.textContent = message;
  } else {
    els.winnerBanner.hidden = true;
    els.winnerBanner.textContent = "";
  }

  if (!state.gameStarted) {
    els.statusText.textContent = allCardsReady()
      ? "Tudo pronto. Carrega em Iniciar jogo."
      : state.setupMessage || "Escolhe 15 numeros em cada cartao para comecar.";
  } else if (state.gameOver && state.winners.length) {
    els.statusText.textContent = "Jogo terminado. Podes comecar um novo jogo.";
  } else if (state.gameOver) {
    els.statusText.textContent = "Ja sairam todos os numeros.";
  } else if (!state.current) {
    els.statusText.textContent = "Carrega em Nova operacao.";
  } else if (state.current.revealed) {
    els.statusText.textContent = "Resultado marcado nos cartoes.";
  } else {
    els.statusText.textContent = "Resolve a conta. O resultado esta escondido.";
  }

  els.question.textContent = state.current ? state.current.problem : "?";
  els.answer.hidden = !state.current?.revealed;
  els.answer.textContent = state.current?.revealed ? `Resultado: ${state.current.answer}` : "";

  const waitingForReveal = Boolean(state.current && !state.current.revealed);
  els.newOperation.disabled = !state.gameStarted || state.gameOver || waitingForReveal || available === 0;
  els.showAnswer.disabled = !state.gameStarted || state.gameOver || !waitingForReveal;
}

function renderPlayCards() {
  els.playCards.innerHTML = "";

  if (!state.gameStarted && !activeCards().some((card) => card.numbers.length)) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Os cartoes aparecem aqui depois de escolheres os numeros.";
    els.playCards.append(empty);
    return;
  }

  const called = new Set(state.called);
  activeCards().forEach((card, cardIndex) => {
    const missing = card.numbers.filter((number) => !called.has(number)).length;
    const complete = card.numbers.length === NUMBERS_PER_CARD && missing === 0;
    const article = document.createElement("article");
    article.className = `play-card${complete ? " complete" : ""}`;

    const header = document.createElement("div");
    header.className = "play-card-head";
    const title = document.createElement("h3");
    title.textContent = card.name;
    const detail = document.createElement("p");
    detail.textContent =
      card.numbers.length === NUMBERS_PER_CARD
        ? complete
          ? "Completo"
          : `Faltam ${missing}`
        : `${card.numbers.length}/15 selecionados`;
    header.append(title, detail);

    const grid = document.createElement("div");
    grid.className = "play-number-grid";
    sortNumbers(card.numbers).forEach((number) => {
      const item = document.createElement("span");
      const isCurrent = state.current?.revealed && state.current.answer === number;
      item.className = `play-number${called.has(number) ? " called" : ""}${isCurrent ? " current" : ""}`;
      item.textContent = String(number);
      grid.append(item);
    });

    if (!card.numbers.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Ainda sem numeros.";
      article.append(header, empty);
    } else {
      article.append(header, grid);
    }

    article.dataset.playCard = String(cardIndex);
    els.playCards.append(article);
  });
}

function renderHistory() {
  els.calledNumbers.innerHTML = "";
  els.historyList.innerHTML = "";

  if (!state.called.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Os resultados das operacoes aparecem aqui.";
    els.calledNumbers.append(empty);
  } else {
    state.called.forEach((number) => {
      const chip = document.createElement("span");
      const isCurrent = state.current?.revealed && state.current.answer === number;
      chip.className = `called-chip${isCurrent ? " current" : ""}`;
      chip.textContent = String(number);
      els.calledNumbers.append(chip);
    });
  }

  if (!state.history.length) return;

  state.history.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "history-row";

    const problem = document.createElement("strong");
    problem.textContent = `${index + 1}. ${item.problem}`;
    const answer = document.createElement("span");
    answer.textContent = `= ${item.answer}`;

    row.append(problem, answer);
    els.historyList.append(row);
  });
}

function render() {
  renderCardCountPicker();
  renderSetupCards();
  renderSetupStatus();
  renderGameBoard();
  renderPlayCards();
  renderHistory();
  saveState();
}

els.startGame.addEventListener("click", startGame);
els.newOperation.addEventListener("click", newOperation);
els.showAnswer.addEventListener("click", showAnswer);
els.newGame.addEventListener("click", () => newGame());
els.newGameTop.addEventListener("click", () => newGame());
els.chooseCards?.addEventListener("click", chooseCards);
els.chooseCardsTop?.addEventListener("click", chooseCards);

loadState();
render();
