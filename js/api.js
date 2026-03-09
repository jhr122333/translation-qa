const API_URL = "https://api.anthropic.com/v1/messages";

const TRANSLATE_SYSTEM = `You are a professional Life Sciences translator specializing in pharmaceutical and biotech documents. You have expert knowledge of GMP, clinical trials, regulatory submissions, and pharmacovigilance.

Rules:
1. Translate accurately and naturally for the target language
2. ALWAYS use the exact terminology from the provided glossary
3. Maintain formal register appropriate for regulatory/pharmaceutical documents
4. Return ONLY the translated text, no explanations or notes`;

const QA_SYSTEM = `You are an expert translation quality evaluator specializing in Life Sciences and pharmaceutical documents.

Evaluate based on three criteria. Respond ONLY in valid JSON:

{
  "accuracy": {
    "score": <integer 1-5>,
    "comment": "<Korean: 2 sentences>"
  },
  "fluency": {
    "score": <integer 1-5>,
    "comment": "<Korean: 2 sentences>"
  },
  "adequacy": {
    "score": <integer 1-5>,
    "comment": "<Korean: 2 sentences — check glossary consistency strictly>"
  },
  "overall": "<Korean: 3 sentences>",
  "suggestion": "<Korean: improved translation for most problematic sentence, or '전반적으로 번역 품질이 우수합니다' if no major issues>"
}

Scoring: 5=Excellent 4=Good 3=Acceptable 2=Poor 1=Unacceptable`;

export async function translate(apiKey, sourceText, direction, glossaryTerms) {
  const termList = glossaryTerms
    .map(t => direction === "ko→en"
      ? `${t.ko} → ${t.en}${t.abbr ? ' (' + t.abbr + ')' : ''}`
      : `${t.en}${t.abbr ? ' (' + t.abbr + ')' : ''} → ${t.ko}`)
    .join('\n');

  const userMessage = `Translate the following text from ${direction === "ko→en" ? "Korean to English" : "English to Korean"}.

[Mandatory Glossary — use these exact terms]
${termList}

[Source Text]
${sourceText}`;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 1000,
      system: TRANSLATE_SYSTEM,
      messages: [{ role: "user", content: userMessage }]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "번역 API 호출 실패");
  }

  const data = await response.json();
  return data.content?.[0]?.text?.trim() || "";
}

export async function evaluate(apiKey, sourceText, targetText, direction, glossaryTerms) {
  const termList = glossaryTerms
    .map(t => `${t.ko} ↔ ${t.en}${t.abbr ? ' (' + t.abbr + ')' : ''}`)
    .join('\n');

  const userMessage = `Translation Direction: ${direction}

[Source Text]
${sourceText}

[Translated Text]
${targetText}

[Reference Glossary]
${termList}`;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 1000,
      system: QA_SYSTEM,
      messages: [{ role: "user", content: userMessage }]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "평가 API 호출 실패");
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}
