const state = {
  cards: [],
  called: [],
  current: null,
  pendingPhoto: "",
  pendingPhotos: [],
  detectedNumbers: [],
  detectedCardCount: 1,
  removedDetectedNumbers: [],
};

const storageKey = "math-bingo-state-v4";
localStorage.removeItem("math-bingo-state-v1");
localStorage.removeItem("math-bingo-state-v2");
localStorage.removeItem("math-bingo-state-v3");

const els = {
  cameraPhotos: document.querySelector("#cameraPhotos"),
  cardPhotos: document.querySelector("#cardPhotos"),
  photoPreview: document.querySelector("#photoPreview"),
  cardForm: document.querySelector("#cardForm"),
  cardName: document.querySelector("#cardName"),
  expectedCards: document.querySelector("#expectedCards"),
  expectedStatus: document.querySelector("#expectedStatus"),
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

function expectedNumberCount() {
  const cardCount = Number.parseInt(els.expectedCards.value, 10);
  return Math.max(1, Number.isFinite(cardCount) ? cardCount : 1) * 15;
}

function updateExpectedStatus() {
  const expected = expectedNumberCount();
  const actual = activeDetectedNumbers().length;
  const missing = Math.max(0, expected - actual);
  const cards = Math.max(1, Number.parseInt(els.expectedCards.value, 10) || state.detectedCardCount || 1);

  els.expectedStatus.className = `expected-status ${missing === 0 ? "good" : "warn"}`;
  els.expectedStatus.textContent = missing === 0
    ? `${cards} cartao(s), ${actual} numeros unicos`
    : `${cards} cartao(s), ${actual}/${expected} numeros unicos`;
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
    return makeAddSubProblem(target, 20, 5);
  }

  return makeAddSubProblem(target, 90, 10);
}

function makeAddSubProblem(target, maxFirst, maxTerm) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const termCount = randomInt(2, 5);
    const rest = [];
    let restTotal = 0;

    for (let index = 1; index < termCount; index += 1) {
      const sign = Math.random() > 0.45 ? 1 : -1;
      const value = randomInt(1, maxTerm);
      rest.push({ sign, value });
      restTotal += sign * value;
    }

    const first = target - restTotal;
    if (first >= 1 && first <= maxFirst) {
      return [
        `${first}`,
        ...rest.map((term) => `${term.sign > 0 ? "+" : "-"} ${term.value}`),
      ].join(" ");
    }
  }

  return `${target}`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
  updateExpectedStatus();
}

function toggleDetectedNumber(number) {
  if (state.removedDetectedNumbers.includes(number)) {
    state.removedDetectedNumbers = state.removedDetectedNumbers.filter((num) => num !== number);
  } else {
    state.removedDetectedNumbers.push(number);
  }
  renderDetectedNumbers();
}

function addNumberFromPhoto() {
  const value = window.prompt("Que numero queres confirmar nesta foto?");
  if (!value) return;

  const numbers = parseNumbers(value);
  if (numbers.length === 0) {
    setOcrStatus("Esse numero nao e valido. Usa numeros entre 1 e 90.", "warn");
    return;
  }

  state.detectedNumbers = mergeNumbers(state.detectedNumbers, numbers);
  state.removedDetectedNumbers = state.removedDetectedNumbers
    .filter((number) => !numbers.includes(number));
  renderDetectedNumbers();
  setOcrStatus(`Numero ${numbers.join(", ")} confirmado pela foto.`, "good");
}

function bindPhotoClick(item) {
  const image = item.querySelector("img");
  image.addEventListener("click", addNumberFromPhoto);
  image.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      addNumberFromPhoto();
    }
  });
}

async function recognizeNumbersFromPhoto(photoDataUrl) {
  if (!window.Tesseract) {
    setOcrStatus("Nao consegui carregar o leitor automatico. Confirma a ligacao a internet.", "warn");
    return;
  }

  setOcrStatus("A ler numeros da foto...", "busy");

  try {
    const cards = await prepareCardImagesForOcr(photoDataUrl);
    const cardNumbers = [];

    state.detectedCardCount = Math.max(state.detectedCardCount, cards.length);
    els.expectedCards.value = String(state.detectedCardCount);

    for (let cardIndex = 0; cardIndex < cards.length; cardIndex += 1) {
      const cellCandidates = new Map();
      const looseCandidates = new Map();

      for (let index = 0; index < cards[cardIndex].images.length; index += 1) {
        const variant = cards[cardIndex].images[index];
        const result = await window.Tesseract.recognize(variant.src, "eng", {
          tessedit_char_whitelist: "0123456789",
          tessedit_pageseg_mode: "6",
          logger: (progress) => {
            if (progress.status === "recognizing text") {
              const percent = Math.round((progress.progress || 0) * 100);
              setOcrStatus(`Cartao ${cardIndex + 1}/${cards.length}: leitura ${index + 1}/${cards[cardIndex].images.length}, ${percent}%`, "busy");
            }
          },
        });

        collectGridOcrCandidates(cellCandidates, looseCandidates, result, variant);
      }

      cardNumbers.push(selectCardNumbers(cellCandidates, looseCandidates));
    }

    const numbers = cardNumbers.flat().length > 0
      ? cardNumbers.flat()
      : [];
    state.detectedNumbers = mergeNumbers(state.detectedNumbers, numbers);
    renderDetectedNumbers();

    if (state.detectedNumbers.length === 0) {
      setOcrStatus("Nao encontrei numeros validos na grelha. Tenta uma foto mais direita e perto dos cartoes.", "warn");
      return;
    }

    const expected = expectedNumberCount();
    const detected = state.detectedNumbers.length;
    const tone = detected >= expected ? "good" : "warn";
    const message = detected >= expected
      ? `Detetei ${detected} numeros validos pela grelha em ${state.detectedCardCount} cartao(s).`
      : `Detetei ${detected} numeros validos pela grelha em ${state.detectedCardCount} cartao(s). Toca na foto para acrescentar os que faltam.`;
    setOcrStatus(message, tone);
  } catch (error) {
    setOcrStatus("Nao consegui ler esta foto. Tenta aproximar mais o cartao.", "warn");
  }
}

function collectGridOcrCandidates(cellCandidates, looseCandidates, result, variant) {
  const words = Array.isArray(result.data.words) ? result.data.words : [];

  words.forEach((word) => {
    const bbox = word.bbox || word.symbols?.[0]?.bbox;
    const numbers = parseNumbers(word.text);
    if (numbers.length === 0) return;

    numbers.forEach((number) => {
      addLooseCandidate(looseCandidates, number, word.confidence || 0);
    });

    if (!bbox) return;
    const cell = gridCellFromBox(bbox, variant.width, variant.height);
    if (!cell) return;

    numbers
      .filter((number) => numberFitsColumn(number, cell.col))
      .forEach((number) => addCellCandidate(cellCandidates, cell, number, word.confidence || 0, bbox));
  });

  if (words.length === 0) {
    parseNumbers(result.data.text || "").forEach((number) => {
      addLooseCandidate(looseCandidates, number, 35);
    });
  }
}

function addLooseCandidate(candidates, number, confidence) {
  const previous = candidates.get(number) || { number, count: 0, confidence: 0 };
  previous.count += 1;
  previous.confidence += confidence;
  candidates.set(number, previous);
}

function addCellCandidate(cellCandidates, cell, number, confidence, bbox) {
  const key = `${cell.row}-${cell.col}`;
  const candidates = cellCandidates.get(key) || new Map();
  const previous = candidates.get(number) || {
    number,
    row: cell.row,
    col: cell.col,
    count: 0,
    confidence: 0,
    sizeScore: 0,
  };
  const boxHeight = Math.max(1, bbox.y1 - bbox.y0);
  const cellHeight = Math.max(1, cell.height);
  const relativeCenterY = ((bbox.y0 + bbox.y1) / 2 - cell.top) / cellHeight;
  const mainNumberBonus = boxHeight > cellHeight * 0.28 && relativeCenterY < 0.72 ? 35 : 0;
  previous.count += 1;
  previous.confidence += confidence;
  previous.sizeScore += mainNumberBonus;
  candidates.set(number, previous);
  cellCandidates.set(key, candidates);
}

function selectCardNumbers(cellCandidates, looseCandidates) {
  const byCell = [...cellCandidates.values()]
    .map((candidates) => [...candidates.values()]
      .map((item) => ({
        ...item,
        score: item.count * 120 + item.confidence + item.sizeScore,
      }))
      .sort((a, b) => b.score - a.score)[0])
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  if (byCell.length >= 8) {
    return byCell
      .slice(0, 15)
      .map((item) => item.number)
      .sort((a, b) => a - b);
  }

  const fallback = [...looseCandidates.values()]
    .map((item) => ({
      number: item.number,
      count: item.count,
      score: item.count * 100 + item.confidence,
    }))
    .filter((item) => item.count >= 2 || item.number >= 10)
    .sort((a, b) => b.score - a.score);

  return fallback
    .slice(0, 15)
    .map((item) => item.number)
    .sort((a, b) => a - b);
}

function gridCellFromBox(bbox, width, height) {
  const bounds = gridBounds(width, height);
  const centerX = (bbox.x0 + bbox.x1) / 2;
  const centerY = (bbox.y0 + bbox.y1) / 2;
  if (centerX < bounds.left || centerX > bounds.right || centerY < bounds.top || centerY > bounds.bottom) {
    return null;
  }

  const cellWidth = (bounds.right - bounds.left) / 9;
  const cellHeight = (bounds.bottom - bounds.top) / 3;
  const col = Math.floor((centerX - bounds.left) / cellWidth);
  const row = Math.floor((centerY - bounds.top) / cellHeight);
  if (col < 0 || col > 8 || row < 0 || row > 2) return null;

  return {
    row,
    col,
    top: bounds.top + row * cellHeight,
    height: cellHeight,
  };
}

function gridBounds(width, height) {
  return {
    left: width * 0.075,
    right: width * 0.93,
    top: height * 0.17,
    bottom: height * 0.82,
  };
}

function numberFitsColumn(number, col) {
  if (col === 0) return number >= 1 && number <= 9;
  const min = col * 10;
  const max = col === 8 ? 90 : col * 10 + 9;
  return number >= min && number <= max;
}

function prepareCardImagesForOcr(photoDataUrl) {
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
      const bands = detectCardBands(original, canvas.width, canvas.height);
      const regions = bands.length > 0
        ? bands.map((band) => cropImageData(original, canvas.width, canvas.height, 0, band.y, canvas.width, band.height))
        : [original];

      resolve(regions.map((region) => ({
        images: [
          makeOcrVariant(region.data, region.width, region.height, "contrast"),
          makeOcrVariant(region.data, region.width, region.height, "red-green"),
          makeOcrVariant(region.data, region.width, region.height, "dark-text"),
        ],
      })));
    });
    image.addEventListener("error", reject);
    image.src = photoDataUrl;
  });
}

function detectCardBands(source, width, height) {
  const minBandHeight = Math.round(height * 0.11);
  const rows = [];

  for (let y = 0; y < height; y += 1) {
    let white = 0;
    for (let x = 0; x < width; x += 4) {
      const index = (y * width + x) * 4;
      const red = source.data[index];
      const green = source.data[index + 1];
      const blue = source.data[index + 2];
      if (red > 185 && green > 185 && blue > 185) white += 1;
    }
    rows.push(white / Math.ceil(width / 4));
  }

  const threshold = 0.18;
  const bands = [];
  let start = -1;
  for (let y = 0; y < rows.length; y += 1) {
    if (rows[y] > threshold && start === -1) start = y;
    if ((rows[y] <= threshold || y === rows.length - 1) && start !== -1) {
      const end = y;
      if (end - start >= minBandHeight) {
        const pad = Math.round((end - start) * 0.08);
        bands.push({
          y: Math.max(0, start - pad),
          height: Math.min(height - Math.max(0, start - pad), end - start + pad * 2),
        });
      }
      start = -1;
    }
  }

  const merged = [];
  const mergeGap = Math.round(height * 0.025);
  bands.forEach((band) => {
    const previous = merged[merged.length - 1];
    if (previous && band.y - (previous.y + previous.height) <= mergeGap) {
      const end = Math.max(previous.y + previous.height, band.y + band.height);
      previous.height = end - previous.y;
    } else {
      merged.push({ ...band });
    }
  });

  return merged
    .filter((band) => band.height >= minBandHeight && band.height <= height * 0.45)
    .sort((a, b) => b.height - a.height)
    .slice(0, 20)
    .sort((a, b) => a.y - b.y);
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
  return {
    src: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
    mode,
  };
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
  state.detectedCardCount = 1;
  state.removedDetectedNumbers = [];
  els.cardForm.reset();
  resetPhotoInputs();
  els.photoPreview.innerHTML = "";
  setOcrStatus("Escolhe uma foto para eu ler os numeros.");
  els.expectedCards.value = "1";
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

  state.detectedCardCount = files.length;
  els.expectedCards.value = String(files.length);
  updateExpectedStatus();

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const photo = await readFileAsDataUrl(file);
    state.pendingPhoto = photo;
    state.pendingPhotos.push(photo);

    const item = document.createElement("div");
    item.className = "photo-item";
    item.innerHTML = `
      <img src="${photo}" alt="Foto do cartao selecionado" tabindex="0" />
      <div>
        <strong>${file.name}</strong>
        <small>A procurar numeros de 1 a 90. Toca na foto para confirmar outro numero.</small>
      </div>
    `;
    els.photoPreview.append(item);
    bindPhotoClick(item);

    setOcrStatus(`A ler foto ${index + 1}/${files.length}...`, "busy");
    await recognizeNumbersFromPhoto(photo);
  }

  event.target.value = "";
}

function resetPhotoInputs() {
  els.cardPhotos.value = "";
  els.cameraPhotos.value = "";
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
  resetPhotoInputs();
  els.photoPreview.innerHTML = "";
  setOcrStatus("Escolhe uma foto para eu ler os numeros.");
  renderDetectedNumbers();
  els.statusText.textContent = "Tudo limpo. Adiciona novos cartoes.";
  renderQuestion();
  renderCards();
}

els.cardPhotos.addEventListener("change", handlePhotos);
els.cameraPhotos.addEventListener("change", handlePhotos);
els.cardForm.addEventListener("submit", addCard);
els.startGame.addEventListener("click", startGame);
els.playRound.addEventListener("click", playRound);
els.revealAnswer.addEventListener("click", revealAnswer);
els.resetAll.addEventListener("click", resetAll);
els.levelSelect.addEventListener("change", updateCounts);
els.avoidRepeats.addEventListener("change", updateCounts);
els.expectedCards.addEventListener("input", updateExpectedStatus);

loadState();
renderQuestion();
renderDetectedNumbers();
renderCards();
