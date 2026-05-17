const state = {
  cards: [],
  called: [],
  current: null,
  pendingPhoto: "",
};

const storageKey = "math-bingo-state-v1";

const els = {
  cardPhotos: document.querySelector("#cardPhotos"),
  photoPreview: document.querySelector("#photoPreview"),
  cardForm: document.querySelector("#cardForm"),
  cardName: document.querySelector("#cardName"),
  cardNumbers: document.querySelector("#cardNumbers"),
  cardsGrid: document.querySelector("#cardsGrid"),
  cardCount: document.querySelector("#cardCount"),
  remainingCount: document.querySelector("#remainingCount"),
  statusText: document.querySelector("#statusText"),
  question: document.querySelector("#question"),
  answer: document.querySelector("#answer"),
  startGame: document.querySelector("#startGame"),
  playRound: document.querySelector("#playRound"),
  revealAnswer: document.querySelector("#revealAnswer"),
  resetAll: document.querySelector("#resetAll"),
  levelSelect: document.querySelector("#levelSelect"),
  avoidRepeats: document.querySelector("#avoidRepeats"),
  template: document.querySelector("#cardTemplate"),
};

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    state.cards = Array.isArray(parsed.cards) ? parsed.cards : [];
    state.called = Array.isArray(parsed.called) ? parsed.called : [];
    state.current = parsed.current || null;
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify({
    cards: state.cards,
    called: state.called,
    current: state.current,
  }));
}

function parseNumbers(value) {
  return [...new Set((value.match(/\d+/g) || [])
    .map(Number)
    .filter((num) => Number.isInteger(num) && num > 0 && num <= 99))]
    .sort((a, b) => a - b);
}

function allNumbers() {
  return [...new Set(state.cards.flatMap((card) => card.numbers))].sort((a, b) => a - b);
}

function playableNumbers() {
  const numbers = els.levelSelect.value === "easy"
    ? allNumbers().filter((num) => num <= 20)
    : allNumbers();
  if (!els.avoidRepeats.checked) return numbers;
  return numbers.filter((num) => !state.called.includes(num));
}

function makeProblem(target) {
  const level = els.levelSelect.value;

  if (level === "easy" || target <= 20) {
    return makeEasyProblem(target);
  }

  const tens = Math.floor(target / 10) * 10;
  const ones = target - tens;
  const options = [
    `${tens} + ${ones}`,
    `${target + 1} - 1`,
    `${target - 2} + 2`,
    `${Math.max(10, tens - 10)} + ${target - Math.max(10, tens - 10)}`,
  ].filter((problem) => !problem.includes("+ 0"));

  return options[Math.floor(Math.random() * options.length)];
}

function makeEasyProblem(target) {
  if (target <= 2) return `${target + 1} - 1`;

  const options = [];
  const upperAddend = Math.min(10, target - 1);
  for (let left = 1; left <= upperAddend; left += 1) {
    const right = target - left;
    if (right >= 1 && right <= 10) options.push(`${left} + ${right}`);
  }

  for (let left = target + 1; left <= Math.min(20, target + 10); left += 1) {
    options.push(`${left} - ${left - target}`);
  }

  return options[Math.floor(Math.random() * options.length)] || `${target} + 0`;
}

function updateCounts() {
  const cardsLabel = state.cards.length === 1 ? "1 cartao" : `${state.cards.length} cartoes`;
  const remaining = playableNumbers().length;
  const remainingLabel = remaining === 1 ? "1 numero" : `${remaining} numeros`;

  els.cardCount.textContent = cardsLabel;
  els.remainingCount.textContent = remainingLabel;
  els.playRound.disabled = state.cards.length === 0 || remaining === 0;
  els.revealAnswer.disabled = !state.current;

  if (state.cards.length === 0) {
    els.statusText.textContent = "Adiciona pelo menos um cartao para comecar.";
  } else if (remaining === 0) {
    els.statusText.textContent = els.levelSelect.value === "easy"
      ? "Neste nivel so saem numeros ate 20. Muda o nivel ou adiciona esses numeros."
      : "Todos os numeros ja sairam. Podes limpar ou permitir repeticoes.";
  }
}

function renderCards() {
  els.cardsGrid.innerHTML = "";

  if (state.cards.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Os cartoes guardados aparecem aqui.";
    els.cardsGrid.append(empty);
    updateCounts();
    return;
  }

  state.cards.forEach((card) => {
    const node = els.template.content.firstElementChild.cloneNode(true);
    const img = node.querySelector("img");
    const title = node.querySelector("h3");
    const summary = node.querySelector("p");
    const remove = node.querySelector(".remove-card");
    const grid = node.querySelector(".number-grid");

    img.src = card.photo || "";
    img.hidden = !card.photo;
    title.textContent = card.name;
    summary.textContent = `${card.numbers.length} numeros`;
    remove.addEventListener("click", () => removeCard(card.id));

    card.numbers.forEach((number) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "number-tile";
      tile.textContent = number;
      tile.title = `Marcar ${number}`;
      if (state.called.includes(number)) tile.classList.add("called");
      if (state.current?.answer === number) tile.classList.add("current");
      tile.addEventListener("click", () => toggleCalled(number));
      grid.append(tile);
    });

    els.cardsGrid.append(node);
  });

  updateCounts();
}

function renderQuestion() {
  if (!state.current) {
    els.question.textContent = "?";
    els.answer.hidden = true;
    els.answer.textContent = "";
    return;
  }

  els.question.textContent = `${state.current.problem} = ?`;
  els.answer.textContent = `Resultado: ${state.current.answer}`;
  els.answer.hidden = !state.current.revealed;
}

function removeCard(cardId) {
  state.cards = state.cards.filter((card) => card.id !== cardId);
  const stillVisible = allNumbers();
  state.called = state.called.filter((number) => stillVisible.includes(number));
  saveState();
  renderCards();
}

function toggleCalled(number) {
  if (state.called.includes(number)) {
    state.called = state.called.filter((called) => called !== number);
  } else {
    state.called.push(number);
  }
  saveState();
  renderCards();
}

function addCard(event) {
  event.preventDefault();

  const numbers = parseNumbers(els.cardNumbers.value);
  if (numbers.length === 0) {
    els.cardNumbers.focus();
    els.statusText.textContent = "Escreve pelo menos um numero do cartao.";
    return;
  }

  state.cards.push({
    id: crypto.randomUUID(),
    name: els.cardName.value.trim() || `Cartao ${state.cards.length + 1}`,
    numbers,
    photo: state.pendingPhoto,
  });

  state.pendingPhoto = "";
  els.cardForm.reset();
  els.photoPreview.innerHTML = "";
  els.statusText.textContent = "Cartao guardado. Ja podes iniciar a jogada.";
  saveState();
  renderCards();
}

function handlePhotos(event) {
  const [file] = [...event.target.files];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    state.pendingPhoto = reader.result;
    els.photoPreview.innerHTML = "";

    const item = document.createElement("div");
    item.className = "photo-item";
    item.innerHTML = `
      <img src="${reader.result}" alt="Foto do cartao selecionado" />
      <div>
        <strong>${file.name}</strong>
        <small>Olha para a foto e escreve os numeros na caixa acima.</small>
      </div>
    `;
    els.photoPreview.append(item);

    if (!els.cardName.value.trim()) {
      els.cardName.value = file.name.replace(/\.[^.]+$/, "");
    }
  });
  reader.readAsDataURL(file);
}

function startGame() {
  if (state.cards.length === 0) {
    els.statusText.textContent = "Primeiro guarda os numeros de um cartao.";
    return;
  }

  state.current = null;
  els.statusText.textContent = "Tudo pronto. Clica em Jogar para sair uma conta.";
  saveState();
  renderQuestion();
  renderCards();
}

function playRound() {
  const numbers = playableNumbers();
  if (numbers.length === 0) {
    els.statusText.textContent = "Nao ha mais numeros disponiveis neste modo.";
    updateCounts();
    return;
  }

  const answer = numbers[Math.floor(Math.random() * numbers.length)];
  state.current = {
    answer,
    problem: makeProblem(answer),
    revealed: false,
  };

  els.statusText.textContent = "Resolve a conta e procura o resultado no cartao.";
  saveState();
  renderQuestion();
  renderCards();
}

function revealAnswer() {
  if (!state.current) return;

  state.current.revealed = true;
  if (!state.called.includes(state.current.answer)) {
    state.called.push(state.current.answer);
  }

  els.statusText.textContent = "Resultado marcado nos cartoes.";
  saveState();
  renderQuestion();
  renderCards();
}

function resetAll() {
  const confirmed = window.confirm("Limpar cartoes, jogadas e marcacoes?");
  if (!confirmed) return;

  state.cards = [];
  state.called = [];
  state.current = null;
  state.pendingPhoto = "";
  localStorage.removeItem(storageKey);
  els.cardForm.reset();
  els.photoPreview.innerHTML = "";
  els.statusText.textContent = "Tudo limpo. Adiciona novos cartoes.";
  renderQuestion();
  renderCards();
}

els.cardPhotos.addEventListener("change", handlePhotos);
els.cardForm.addEventListener("submit", addCard);
els.startGame.addEventListener("click", startGame);
els.playRound.addEventListener("click", playRound);
els.revealAnswer.addEventListener("click", revealAnswer);
els.resetAll.addEventListener("click", resetAll);
els.levelSelect.addEventListener("change", updateCounts);
els.avoidRepeats.addEventListener("change", updateCounts);

loadState();
renderQuestion();
renderCards();
