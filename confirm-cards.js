(function () {
  state.detectedCardNumbers = Array.isArray(state.detectedCardNumbers) ? state.detectedCardNumbers : [];
  state.removedDetectedCells = Array.isArray(state.removedDetectedCells) ? state.removedDetectedCells : [];

  if (typeof activeDetectedCardNumbers === "function") {
    return;
  }

  const originalHandlePhotos = handlePhotos;
  const originalAddCard = addCard;
  const originalResetAll = resetAll;

  function detectedCellKey(cardIndex, number) {
    return `${cardIndex}:${number}`;
  }

  function isDetectedCardNumberRemoved(cardIndex, number) {
    return state.removedDetectedCells.includes(detectedCellKey(cardIndex, number))
      || state.removedDetectedNumbers.includes(number);
  }

  function rebuildDetectedNumbersFromCards() {
    state.detectedNumbers = mergeNumbers([], state.detectedCardNumbers.flat());
  }

  activeDetectedNumbers = function () {
    if (state.detectedCardNumbers.length > 0) {
      return mergeNumbers([], activeDetectedCardNumbers().flat());
    }
    return state.detectedNumbers.filter((num) => !state.removedDetectedNumbers.includes(num));
  };

  activeDetectedCardNumbers = function () {
    return state.detectedCardNumbers
      .map((numbers, cardIndex) => numbers.filter((num) => !isDetectedCardNumberRemoved(cardIndex, num)))
      .filter((numbers) => numbers.length > 0);
  };

  updateExpectedStatus = function () {
    const expectedPositions = expectedNumberCount();
    const cardGroups = activeDetectedCardNumbers();
    const actualPositions = cardGroups.length > 0
      ? cardGroups.reduce((sum, numbers) => sum + numbers.length, 0)
      : activeDetectedNumbers().length;
    const uniqueCount = activeDetectedNumbers().length;
    const missing = Math.max(0, expectedPositions - actualPositions);
    const cards = Math.max(1, Number.parseInt(els.expectedCards.value, 10) || state.detectedCardCount || 1);

    els.expectedStatus.className = `expected-status ${missing === 0 ? "good" : "warn"}`;
    els.expectedStatus.textContent = missing === 0
      ? `${cards} cartao(s), ${actualPositions} posicoes (${uniqueCount} unicos)`
      : `${cards} cartao(s), ${actualPositions}/${expectedPositions} posicoes (${uniqueCount} unicos)`;
  };

  renderDetectedNumbers = function () {
    els.detectedNumbers.innerHTML = "";

    if (state.detectedCardNumbers.length > 0) {
      state.detectedCardNumbers.forEach((numbers, cardIndex) => {
        els.detectedNumbers.append(renderDetectedCard(numbers, cardIndex));
      });
    } else {
      const chips = document.createElement("div");
      chips.className = "detected-card-chips";
      state.detectedNumbers.forEach((number) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "detected-chip";
        chip.textContent = number;
        chip.title = `Ignorar ${number}`;
        if (state.removedDetectedNumbers.includes(number)) chip.classList.add("removed");
        chip.addEventListener("click", () => toggleDetectedNumber(number));
        chips.append(chip);
      });
      els.detectedNumbers.append(chips);
    }

    els.saveCard.disabled = activeDetectedNumbers().length === 0;
    updateExpectedStatus();
  };

  function renderDetectedCard(numbers, cardIndex) {
    const activeNumbers = numbers.filter((number) => !isDetectedCardNumberRemoved(cardIndex, number));
    const section = document.createElement("section");
    section.className = "detected-card";

    const heading = document.createElement("div");
    heading.className = "detected-card-head";
    heading.innerHTML = `
      <strong>Cartao ${cardIndex + 1}</strong>
      <span>${activeNumbers.length}/15 numeros</span>
    `;

    const chips = document.createElement("div");
    chips.className = "detected-card-chips";
    numbers.forEach((number) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "detected-chip";
      chip.textContent = number;
      chip.title = `Ignorar ${number} neste cartao`;
      if (isDetectedCardNumberRemoved(cardIndex, number)) chip.classList.add("removed");
      chip.addEventListener("click", () => toggleDetectedNumber(number, cardIndex));
      chips.append(chip);
    });

    const correction = document.createElement("label");
    correction.className = "detected-card-correction";
    correction.innerHTML = `
      Corrigir numeros do Cartao ${cardIndex + 1}
      <input type="text" value="${activeNumbers.join(", ")}" inputmode="numeric" />
    `;

    const updateButton = document.createElement("button");
    updateButton.type = "button";
    updateButton.className = "mini-button";
    updateButton.textContent = "Atualizar cartao";
    updateButton.addEventListener("click", () => {
      updateDetectedCardNumbers(cardIndex, correction.querySelector("input").value);
    });

    section.append(heading, chips, correction, updateButton);
    return section;
  }

  toggleDetectedNumber = function (number, cardIndex = null) {
    if (Number.isInteger(cardIndex)) {
      const key = detectedCellKey(cardIndex, number);
      if (state.removedDetectedCells.includes(key)) {
        state.removedDetectedCells = state.removedDetectedCells.filter((item) => item !== key);
      } else {
        state.removedDetectedCells.push(key);
      }
      renderDetectedNumbers();
      return;
    }

    if (state.removedDetectedNumbers.includes(number)) {
      state.removedDetectedNumbers = state.removedDetectedNumbers.filter((num) => num !== number);
    } else {
      state.removedDetectedNumbers.push(number);
    }
    renderDetectedNumbers();
  };

  function updateDetectedCardNumbers(cardIndex, value) {
    const numbers = parseNumbers(value);
    if (numbers.length === 0) {
      setOcrStatus("Esse cartao precisa de pelo menos um numero valido entre 1 e 90.", "warn");
      return;
    }

    state.detectedCardNumbers[cardIndex] = numbers;
    state.removedDetectedCells = state.removedDetectedCells
      .filter((key) => !key.startsWith(`${cardIndex}:`));
    state.removedDetectedNumbers = state.removedDetectedNumbers
      .filter((number) => !numbers.includes(number));
    rebuildDetectedNumbersFromCards();
    renderDetectedNumbers();
    setOcrStatus(`Cartao ${cardIndex + 1} atualizado com ${numbers.length} numero(s).`, numbers.length === 15 ? "good" : "warn");
  }

  recognizeNumbersFromPhoto = async function (photoDataUrl) {
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

        const selected = selectCardNumbers(cellCandidates, looseCandidates);
        if (selected.length > 0) cardNumbers.push(selected);
      }

      state.detectedCardNumbers = [...state.detectedCardNumbers, ...cardNumbers];
      state.detectedCardCount = Math.max(state.detectedCardCount, state.detectedCardNumbers.length);
      els.expectedCards.value = String(state.detectedCardCount);
      rebuildDetectedNumbersFromCards();
      renderDetectedNumbers();

      if (activeDetectedNumbers().length === 0) {
        setOcrStatus("Nao encontrei numeros validos na grelha. Tenta uma foto mais direita e perto dos cartoes.", "warn");
        return;
      }

      const expected = expectedNumberCount();
      const positions = activeDetectedCardNumbers().reduce((sum, group) => sum + group.length, 0);
      const detected = activeDetectedNumbers().length;
      const tone = positions >= expected ? "good" : "warn";
      const message = positions >= expected
        ? `Detetei ${positions} posicoes em ${state.detectedCardCount} cartao(s), ${detected} numeros unicos.`
        : `Detetei ${positions}/${expected} posicoes em ${state.detectedCardCount} cartao(s), ${detected} numeros unicos. Corrige por cartao antes de guardar.`;
      setOcrStatus(message, tone);
    } catch (error) {
      setOcrStatus("Nao consegui ler esta foto. Tenta aproximar mais o cartao.", "warn");
    }
  };

  addCard = function (event) {
    event.preventDefault();

    const cardGroups = activeDetectedCardNumbers();
    const numbers = activeDetectedNumbers();
    if (numbers.length === 0) {
      els.statusText.textContent = "Escolhe uma foto e espera que os numeros sejam detetados.";
      return;
    }

    if (cardGroups.length > 1) {
      const baseName = els.cardName.value.trim() || `Cartoes ${state.cards.length + 1}`;
      cardGroups.forEach((group, index) => {
        state.cards.push({
          id: crypto.randomUUID(),
          name: `${baseName} ${index + 1}`,
          numbers: [...new Set(group)].sort((a, b) => a - b),
          photo: state.pendingPhotos[index] || state.pendingPhotos[0] || state.pendingPhoto,
        });
      });
    } else {
      state.cards.push({
        id: crypto.randomUUID(),
        name: els.cardName.value.trim() || `Cartoes ${state.cards.length + 1}`,
        numbers,
        photo: state.pendingPhotos[0] || state.pendingPhoto,
      });
    }

    state.pendingPhoto = "";
    state.pendingPhotos = [];
    state.detectedNumbers = [];
    state.detectedCardNumbers = [];
    state.detectedCardCount = 1;
    state.removedDetectedNumbers = [];
    state.removedDetectedCells = [];
    els.cardForm.reset();
    resetPhotoInputs();
    els.photoPreview.innerHTML = "";
    setOcrStatus("Escolhe uma foto para eu ler os numeros.");
    els.expectedCards.value = "1";
    renderDetectedNumbers();
    els.statusText.textContent = cardGroups.length > 1
      ? "Cartoes guardados. Ja podes iniciar a jogada."
      : "Cartao guardado. Ja podes iniciar a jogada.";
    saveState();
    renderCards();
  };

  handlePhotos = async function (event) {
    const files = [...event.target.files];
    if (files.length === 0) return;

    state.pendingPhoto = "";
    state.pendingPhotos = [];
    state.detectedNumbers = [];
    state.detectedCardNumbers = [];
    state.removedDetectedNumbers = [];
    state.removedDetectedCells = [];
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
  };

  resetAll = function () {
    originalResetAll();
    state.detectedCardNumbers = [];
    state.removedDetectedCells = [];
    renderDetectedNumbers();
  };

  els.cardPhotos.removeEventListener("change", originalHandlePhotos);
  els.cameraPhotos.removeEventListener("change", originalHandlePhotos);
  els.cardForm.removeEventListener("submit", originalAddCard);
  els.resetAll.removeEventListener("click", originalResetAll);
  els.cardPhotos.addEventListener("change", handlePhotos);
  els.cameraPhotos.addEventListener("change", handlePhotos);
  els.cardForm.addEventListener("submit", addCard);
  els.resetAll.addEventListener("click", resetAll);

  renderDetectedNumbers();
}());
