const STORAGE_KEY = "tqa_custom_glossary";

export function loadGlossary(baseGlossary) {
  const custom = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  return [...baseGlossary, ...custom];
}

export function addTerm(term) {
  const custom = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  const newTerm = { id: "u" + Date.now(), ...term, editable: true };
  custom.push(newTerm);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
  return newTerm;
}

export function deleteTerm(id) {
  const custom = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom.filter(t => t.id !== id)));
}

export function detectMismatches(sourceText, targetText, direction, glossary) {
  return glossary
    .filter(term => {
      const src = direction === "ko→en" ? term.ko : term.en;
      return sourceText.includes(src);
    })
    .map(term => {
      const src = direction === "ko→en" ? term.ko : term.en;
      const expected = direction === "ko→en" ? term.en : term.ko;
      const found =
        targetText.toLowerCase().includes(expected.toLowerCase()) ||
        (term.abbr && targetText.includes(term.abbr));
      return { sourceTerm: src, expectedTarget: expected, abbr: term.abbr, found };
    });
}

export function detectUsedTerms(translatedText, direction, glossary) {
  return glossary.filter(term => {
    const target = direction === "ko→en" ? term.en : term.ko;
    return translatedText.toLowerCase().includes(target.toLowerCase()) ||
      (term.abbr && translatedText.includes(term.abbr));
  });
}
