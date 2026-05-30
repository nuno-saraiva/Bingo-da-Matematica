(function () {
  const sectionLabel = document.querySelector(".cards-area .eyebrow");
  const sectionTitle = document.querySelector("#cards-title");
  if (sectionLabel) sectionLabel.textContent = "3. Numeros";
  if (sectionTitle) sectionTitle.textContent = "Numeros que sairam";

  if (els.levelSelect) els.levelSelect.value = "tens";
  if (els.avoidRepeats) els.avoidRepeats.checked = true;

  playableNumbers = function () {
    const numbers = allNumbers();
    if (!els.avoidRepeats || !els.avoidRepeats.checked) return numbers;
    return numbers.filter((num) => !state.called.includes(num));
  };

  makeProblem = function (target) {
    return makeAddSubProblem(target, 90, 10);
  };

  updateCounts = function () {
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
      els.statusText.textContent = "Todos os numeros ja sairam. Podes limpar para recomecar.";
    }
  };

  renderCards = function () {
    els.cardsGrid.innerHTML = "";

    if (state.cards.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Depois de guardares os cartoes, os resultados anteriores aparecem aqui.";
      els.cardsGrid.append(empty);
      updateCounts();
      return;
    }

    if (state.called.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Quando carregares em Ver solucao, o resultado fica guardado aqui.";
      els.cardsGrid.append(empty);
      updateCounts();
      return;
    }

    const history = document.createElement("div");
    history.className = "results-history";
    state.called.forEach((number) => {
      const chip = document.createElement("span");
      chip.className = "result-chip";
      if (state.current?.answer === number) chip.classList.add("current");
      chip.textContent = number;
      history.append(chip);
    });
    els.cardsGrid.append(history);
    updateCounts();
  };

  renderCards();
}());
