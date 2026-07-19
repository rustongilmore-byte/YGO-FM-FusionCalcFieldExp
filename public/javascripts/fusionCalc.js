const outputLeft = document.getElementById("outputarealeft");
const outputRight = document.getElementById("outputarearight");

const INPUT_GROUPS = {
  hand: {
    count: 5,
    label: "Hand",
  },
  field: {
    count: 5,
    label: "Field",
  },
};

// Initialize Awesomplete.
const awesompleteOptions = {
  list: card_db()
    .get()
    .map((card) => card.Name),
  autoFirst: true,
  filter: Awesomplete.FILTER_STARTSWITH,
};

const completions = {};

Object.keys(INPUT_GROUPS).forEach((groupName) => {
  const group = INPUT_GROUPS[groupName];

  for (let slot = 1; slot <= group.count; slot += 1) {
    const inputId = groupName + slot;
    const input = document.getElementById(inputId);
    completions[inputId] = new Awesomplete(input, awesompleteOptions);
  }
});

function getCardByName(cardName) {
  return card_db({ Name: { isnocase: cardName } }).first();
}

function getCardById(id) {
  return card_db({ Id: id }).first() || null;
}

function formatStats(attack, defense) {
  return "(" + attack + "/" + defense + ")";
}

// Monster types occupy the first 20 entries in this project's card database.
function isMonster(card) {
  return card.Type < 20;
}

function checkCard(cardName, infoId) {
  const info = $("#" + infoId);
  const card = getCardByName(cardName);

  if (!card) {
    info.html("Invalid card name");
  } else if (isMonster(card)) {
    info.html(formatStats(card.Attack, card.Defense) + " [" + cardTypes[card.Type] + "]");
  } else {
    info.html("[" + cardTypes[card.Type] + "]");
  }
}

function getCardsFromGroup(groupName) {
  const cards = [];
  const group = INPUT_GROUPS[groupName];

  for (let slot = 1; slot <= group.count; slot += 1) {
    const name = $("#" + groupName + slot).val();
    const card = getCardByName(name);

    if (card) {
      cards.push({
        card,
        zone: group.label,
        slot,
      });
    }
  }

  return cards;
}

function findFusion(card1, card2) {
  const firstList = fusionsList[card1.Id] || [];
  const direct = firstList.find((fusion) => fusion.card === card2.Id);

  if (direct) {
    return getCardById(direct.result);
  }

  // The database should normally contain both directions, but checking the
  // reverse direction makes field support safer if an entry is one-sided.
  const secondList = fusionsList[card2.Id] || [];
  const reverse = secondList.find((fusion) => fusion.card === card1.Id);

  return reverse ? getCardById(reverse.result) : null;
}

function canEquip(card1, card2) {
  const firstList = equipsList[card1.Id] || [];
  const secondList = equipsList[card2.Id] || [];

  return firstList.includes(card2.Id) || secondList.includes(card1.Id);
}

function compareEntries(entry1, entry2, source) {
  const fusionResult = findFusion(entry1.card, entry2.card);

  return {
    fusion: fusionResult
      ? {
          entry1,
          entry2,
          result: fusionResult,
          source,
        }
      : null,
    equip: canEquip(entry1.card, entry2.card)
      ? {
          entry1,
          entry2,
          source,
        }
      : null,
  };
}

function compareWithinGroup(entries, source) {
  const fusions = [];
  const equips = [];

  for (let first = 0; first < entries.length - 1; first += 1) {
    for (let second = first + 1; second < entries.length; second += 1) {
      const comparison = compareEntries(entries[first], entries[second], source);

      if (comparison.fusion) {
        fusions.push(comparison.fusion);
      }

      if (comparison.equip) {
        equips.push(comparison.equip);
      }
    }
  }

  return { fusions, equips };
}

function compareBetweenGroups(firstGroup, secondGroup, source) {
  const fusions = [];
  const equips = [];

  firstGroup.forEach((entry1) => {
    secondGroup.forEach((entry2) => {
      const comparison = compareEntries(entry1, entry2, source);

      if (comparison.fusion) {
        fusions.push(comparison.fusion);
      }

      if (comparison.equip) {
        equips.push(comparison.equip);
      }
    });
  });

  return { fusions, equips };
}

function entryLabel(entry) {
  return entry.zone + " " + entry.slot;
}

function resultsToHTML(results) {
  if (results.length === 0) {
    return "<p class='text-center text-muted'>None found.</p>";
  }

  return results
    .map((result) => {
      let html =
        "<div class='result-div'>" +
        "<strong>" +
        result.source +
        "</strong>" +
        "<br>" +
        entryLabel(result.entry1) +
        ": " +
        result.entry1.card.Name +
        "<br>" +
        entryLabel(result.entry2) +
        ": " +
        result.entry2.card.Name;

      if (result.result) {
        html += "<br>Result: " + result.result.Name;

        if (isMonster(result.result)) {
          html += " " + formatStats(result.result.Attack, result.result.Defense);
        } else {
          html += " [" + cardTypes[result.result.Type] + "]";
        }
      }

      return html + "</div>";
    })
    .join("\n");
}

function resultAttack(result) {
  if (!result.result || !isMonster(result.result)) {
    return 0;
  }

  return Number(result.result.Attack) || 0;
}

function findFusions() {
  const handCards = getCardsFromGroup("hand");
  const fieldCards = getCardsFromGroup("field");

  const handResults = compareWithinGroup(handCards, "Hand + Hand");
  const fieldResults = compareBetweenGroups(handCards, fieldCards, "Hand + Field");

  // Cards already sitting on the field cannot be selected together as a new
  // play, so Field + Field combinations are intentionally not calculated.
  const fusions = handResults.fusions.concat(fieldResults.fusions);
  const equips = handResults.equips.concat(fieldResults.equips);

  fusions.sort((a, b) => resultAttack(b) - resultAttack(a));

  outputLeft.innerHTML = "<h2 class='center'>Fusions:</h2>" + resultsToHTML(fusions);
  outputRight.innerHTML = "<h2 class='center'>Equips:</h2>" + resultsToHTML(equips);
}

function resultsClear() {
  outputLeft.innerHTML = "";
  outputRight.innerHTML = "";
}

function clearInputGroup(groupName) {
  const group = INPUT_GROUPS[groupName];

  for (let slot = 1; slot <= group.count; slot += 1) {
    $("#" + groupName + slot).val("");
    $("#" + groupName + slot + "-info").html("");
  }
}

function refreshResults() {
  resultsClear();
  findFusions();
}

function setUpInput(inputId) {
  $("#" + inputId).on("change", function () {
    completions[this.id].select();

    if (this.value === "") {
      $("#" + this.id + "-info").html("");
    } else {
      checkCard(this.value, this.id + "-info");
    }

    refreshResults();
  });

  $("#" + inputId).on("awesomplete-selectcomplete", function () {
    checkCard(this.value, this.id + "-info");
    refreshResults();
  });
}

Object.keys(INPUT_GROUPS).forEach((groupName) => {
  const group = INPUT_GROUPS[groupName];

  for (let slot = 1; slot <= group.count; slot += 1) {
    setUpInput(groupName + slot);
  }
});

$("#resetHandBtn").on("click", function () {
  clearInputGroup("hand");
  refreshResults();
});

$("#resetFieldBtn").on("click", function () {
  clearInputGroup("field");
  refreshResults();
});

$("#resetBtn").on("click", function () {
  clearInputGroup("hand");
  clearInputGroup("field");
  resultsClear();
});
