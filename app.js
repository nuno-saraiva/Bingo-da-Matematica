const state = {
  cards: [],
  called: [],
  current: null,
  pendingPhoto: "",
  pendingPhotos: [],
  detectedNumbers: [],
  removedDetectedNumbers: [],
};

const storageKey = "math-bingo-state-v4";
localStorage.removeItem("math-bingo-state-v1");
localStorage.removeItem("math-bingo-state-v2");
localStorage.removeItem("math-bingo-state-v3");

const els = {
  cardPhotos: document.querySelector("#cardPhotos"),
  photoPreview: document.querySelector("#photoPreview"),
  cardForm: document.querySelector("#cardForm"),
  cardName: document.querySelector("#cardName"),
  detectedNumbers: document.querySelector("#detectedNumbers"),
  ocrStatus: document.querySelector("#ocrStatus"),
  saveCard: document.querySelector("#saveCard"),
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
    .filter((num) => Number.isInteger(num) && num > 0 && num <= 90))]
    .sort((a, b) => a - b);
}

function mergeNumbers(existing, incoming) {
  return [...new Set([...existing, ...incoming])]
    .filter((num) => num > 0 && num <= 90)
    .sort((a, b) => a - b);
}

function activeDetectedNumbers() {
  return state.detectedNumbers.filter((num) => !state.removedDetectedNumbers.includes(num));
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

  if (level === "easy" && target <= 20) {
    return makeEasyProblem(target);
  }

  return makeNinetyProblem(target);
}

function makeNinetyProblem(target) {
  const options = [];
  const tens = Math.max(10, Math.floor(target / 10) * 10);
  const ones = target - tens;

  if (ones > 0) options.push(`${tens} + ${ones}`);
  if (target > 10) options.push(`${target - 10} + 10`);
  if (target <= 80) options.push(`${target + 10} - 10`);
  if (target > 5) options.push(`${target - 5} + 5`);
  if (target <= 85) options.push(`${target + 5} - 5`);
  if (target > 2) options.push(`${target - 2} + 2`);

  if (options.length === 0) return makeEasyProblem(target);

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

function setOcrStatus(message, tone = "") {
  els.ocrStatus.textContent = message;
  els.ocrStatus.className = `ocr-status ${tone}`.trim();
}

function renderDetectedNumbers() {
  els.detectedNumbers.innerHTML = "";

  state.detectedNumbers.forEach((number) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "detected-chip";
    chip.textContent = number;
    chip.title = `Ignorar ${number}`;
    if (state.removedDetectedNumbers.includes(number)) chip.classList.add("removed");
    chip.addEventListener("click", () => toggleDetectedNumber(number));
    els.detectedNumbers.append(chip);
  });

  els.saveCard.disabled = activeDetectedNumbers().length === 0;
}

function toggleDetectedNumber(number) {
  if (state.removedDetectedNumbers.includes(number)) {
    state.removedDetectedNumbers = state.removedDetectedNumbers.filter((num) => num !== number);
  } else {
    state.removedDetectedNumbers.push(number);
  }
  renderDetectedNumbers();
}

async function recognizeNumbersFromPhoto(photoDataUrl) {
  if (!window.Tesseract) {
    setOcrStatus("Nao consegui carregar o leitor automatico. Confirma a ligacao a internet.", "warn");
    return;
  }

  setOcrStatus("A ler numeros da foto...", "busy");

  try {
    const images = await prepareImagesForOcr(photoDataUrl);
    const reads = [];

    for (let index = 0; index < images.length; index += 1) {
      const result = await window.Tesseract.recognize(images[index], "eng", {
        tessedit_char_whitelist: "0123456789",
        tessedit_pageseg_mode: "6",
        logger: (progress) => {
          if (progress.status === "recognizing text") {
            const percent = Math.round((progress.progress || 0) * 100);
            setOcrStatus(`A ler numeros... ${index + 1}/${images.length}, ${percent}%`, "busy");
          }
        },
      });

      reads.push(result.data.text);
    }

    const numbers = parseNumbers(reads.join(" "));
    state.detectedNumbers = mergeNumbers(state.detectedNumbers, numbers);
    renderDetectedNumbers();

    if (state.detectedNumbers.length === 0) {
      setOcrStatus("Nao encontrei numeros de 1 a 90. Tenta uma foto mais perto, direita e com boa luz.", "warn");
      return;
    }

    setOcrStatus(`Detetei ${state.detectedNumbers.length} numeros de 1 a 90. Toca num numero se quiseres ignora-lo.`, "good");
  } catch (error) {
    setOcrStatus("Nao consegui ler esta foto. Tenta aproximar mais o cartao.", "warn");
  }
}

function prepareImagesForOcr(photoDataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => {
      const maxSide = 2200;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);

      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const original = context.getImageData(0, 0, canvas.width, canvas.height);
      const regions = [
        original,
        cropImageData(original, canvas.width, canvas.height, 0, 0, canvas.width, Math.round(canvas.height * 0.55)),
        cropImageData(original, canvas.width, canvas.height, 0, Math.round(canvas.height * 0.38), canvas.width, Math.round(canvas.height * 0.62)),
        cropImageData(original, canvas.width, canvas.height, 0, Math.round(canvas.height * 0.25), canvas.width, Math.round(canvas.height * 0.5)),
        cropImageData(original, canvas.width, canvas.height, 0, Math.round(canvas.height * 0.5), canvas.width, Math.round(canvas.height * 0.5)),
      ];

      resolve(regions.flatMap((region) => [
        makeOcrVariant(region.data, region.width, region.height, "contrast"),
        makeOcrVariant(region.data, region.width, region.height, "red-green"),
        makeOcrVariant(region.data, region.width, region.height, "dark-text"),
      ]));
    });
    image.addEventListener("error", reject);
    image.src = photoDataUrl;
  });
}

function cropImageData(source, sourceWidth, sourceHeight, x, y, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.putImageData(source, 0, 0);
  return context.getImageData(x, y, width, height);
}

function makeOcrVariant(source, width, height, mode) {
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = new ImageData(new Uint8ClampedArray(source), width, height);

  for (let index = 0; index < imageData.data.length; index += 4) {
    const red = imageData.data[index];
    const green = imageData.data[index + 1];
    const blue = imageData.data[index + 2];
    const gray = red * 0.299 + green * 0.587 + blue * 0.114;
    let ink = false;

    if (mode === "red-green") {
      const redInk = red > green * 1.18 && red > blue * 1.18 && red > 70;
      const greenInk = green > red * 1.08 && green > blue * 1.08 && green > 55;
      ink = redInk || greenInk;
    } else if (mode === "dark-text") {
      ink = gray < 135;
    } else {
      ink = gray < 170;
    }

    const output = ink ? 0 : 255;
    imageData.data[index] = output;
    imageData.data[index + 1] = output;
    imageData.data[index + 2] = output;
  }

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  sourceCanvas.getContext("2d").putImageData(imageData, 0, 0);
  context.imageSmoothingEnabled = false;
  context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

function renderQuestion() {
  if (!state.current) {
    els.question.textContent = "?";
    els.answer.hidden = true;
    els.answer.textContent = "";
    return;
  }

  els.question.textContent = `${state.current.problem} = ?`;
  els.answer.textContent = `Solucao: ${state.current.answer}`;
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

  const numbers = activeDetectedNumbers();
  if (numbers.length === 0) {
    els.statusText.textContent = "Escolhe uma foto e espera que os numeros sejam detetados.";
    return;
  }

  state.cards.push({
    id: crypto.randomUUID(),
    name: els.cardName.value.trim() || `Cartoes ${state.cards.length + 1}`,
    numbers,
    photo: state.pendingPhotos[0] || state.pendingPhoto,
  });

  state.pendingPhoto = "";
  state.pendingPhotos = [];
  state.detectedNumbers = [];
  state.removedDetectedNumbers = [];
  els.cardForm.reset();
  els.photoPreview.innerHTML = "";
  setOcrStatus("Escolhe uma foto para eu ler os numeros.");
  renderDetectedNumbers();
  els.statusText.textContent = "Cartao guardado. Ja podes iniciar a jogada.";
  saveState();
  renderCards();
}

async function handlePhotos(event) {
  const files = [...event.target.files];
  if (files.length === 0) return;

  state.pendingPhoto = "";
  state.pendingPhotos = [];
  state.detectedNumbers = [];
  state.removedDetectedNumbers = [];
  renderDetectedNumbers();
  els.photoPreview.innerHTML = "";

  if (!els.cardName.value.trim()) {
    els.cardName.value = files.length === 1
      ? files[0].name.replace(/\.[^.]+$/, "")
      : `Cartoes ${state.cards.length + 1}`;
  }

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const photo = await readFileAsDataUrl(file);
    state.pendingPhoto = photo;
    state.pendingPhotos.push(photo);

    const item = document.createElement("div");
    item.className = "photo-item";
    item.innerHTML = `
      <img src="${photo}" alt="Foto do cartao selecionado" />
      <div>
        <strong>${file.name}</strong>
        <small>A procurar numeros de 1 a 90 nesta foto.</small>
      </div>
    `;
    els.photoPreview.append(item);

    setOcrStatus(`A ler foto ${index + 1}/${files.length}...`, "busy");
    await recognizeNumbersFromPhoto(photo);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
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

  els.statusText.textContent = "Resolve a conta. Quando acabares, carrega em Ver solucao.";
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

  els.statusText.textContent = "Agora podes confirmar se acertaste.";
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
  state.pendingPhotos = [];
  state.detectedNumbers = [];
  state.removedDetectedNumbers = [];
  localStorage.removeItem(storageKey);
  els.cardForm.reset();
  els.photoPreview.innerHTML = "";
  setOcrStatus("Escolhe uma foto para eu ler os numeros.");
  renderDetectedNumbers();
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
renderDetectedNumbers();
renderCards();
