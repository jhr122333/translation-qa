const API_URL = "https://api.anthropic.com/v1/messages";

// RAG 인덱스 캐시 (최초 호출 시 생성 후 재사용)
let _ragIndex = null;
let _ragGlossaryRef = null;

const TRANSLATE_SYSTEM = `You are a professional Life Sciences translator specializing in pharmaceutical and biotech documents. You have expert knowledge of GMP, clinical trials, regulatory submissions, and pharmacovigilance.

Rules:
1. Translate accurately and naturally for the target language.
2. ALWAYS use the exact terminology from the provided glossary.
3. Maintain formal register appropriate for regulatory/pharmaceutical documents.
4. Provide the translations for the given array of source segments. Return ONLY a valid JSON array of strings corresponding to the translations, in the exact same order as the input array. No explanations or notes.

Example Input:
[
  "This is the first sentence.",
  "This is the second sentence."
]

Example Output:
[
  "이것은 첫 번째 문장입니다.",
  "이것은 두 번째 문장입니다."
]`;

const QA_SYSTEM = `You are an expert translation quality evaluator specializing in Life Sciences and pharmaceutical documents.

You will be provided with an array of source segments and their corresponding translated segments, along with a glossary.
Evaluate EACH segment pair based on the Multidimensional Quality Metrics (MQM) framework.

Error Categories to check:
- Terminology (Glossary mismatch)
- Mistranslation (Incorrect meaning)
- Omission / Addition
- Style / Register (Inappropriate tone for pharma)

Severity Levels:
- Critical (Changes clinical/medical meaning, regulatory risk)
- Major (Clear error but meaning somewhat understandable)
- Minor (Typos, slight unnaturalness)
- None (No error)

Return ONLY a valid JSON array with the exact same length as the input pairs. Each object in the array MUST follow this structure:

[
  {
    "errorCategory": "Terminology" | "Mistranslation" | "Omission" | "Style" | "None",
    "severity": "Critical" | "Major" | "Minor" | "None",
    "comment": "<Korean: 1-2 sentences explaining the error or why it is good>",
    "suggestion": "<Korean: improved translation, or empty string if None>"
  },
  ...
]`;

export async function translate(apiKey, segments, direction, glossaryTerms) {
  // RAG: dynamic import 방식으로 rag.js 로드
  const { buildRagContext, buildRagIndex } = await import('./rag.js');

  // RAG 인덱스 캐시: glossaryTerms 참조가 바뀌면 재생성
  if (!_ragIndex || _ragGlossaryRef !== glossaryTerms) {
    _ragIndex = buildRagIndex(glossaryTerms);
    _ragGlossaryRef = glossaryTerms;
  }

  // 전체 세그먼트를 합쳐 쿼리로 사용
  const queryText = segments.join(' ');

  // RAG로 관련 용어만 추출 (상위 15개)
  const { terms: relevantTerms, contextString: termList } = buildRagContext(
    queryText,
    glossaryTerms,
    _ragIndex,
    direction,
    15
  );

  const userMessage = `Translation Direction: ${direction === "ko→en" ? "Korean to English" : "English to Korean"}.

[Mandatory Glossary — use these exact terms]
${termList || '(해당 용어 없음)'}

[Source Segments (JSON Array)]
${JSON.stringify(segments, null, 2)}`;

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
      max_tokens: 2000,
      system: TRANSLATE_SYSTEM,
      messages: [{ role: "user", content: userMessage }]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "번역 API 호출 실패");
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "[]";
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch(e) {
    console.error("Failed to parse translation JSON:", text);
    throw new Error("번역 결과를 JSON 형식으로 파싱할 수 없습니다.");
  }
}

export async function evaluate(apiKey, segmentPairs, direction, glossaryTerms) {
  const termList = glossaryTerms
    .map(t => `${t.ko} ↔ ${t.en}${t.abbr ? ' (' + t.abbr + ')' : ''}`)
    .join('\n');

  const userMessage = `Translation Direction: ${direction}

[Reference Glossary]
${termList}

[Segment Pairs for QA (JSON)]
${JSON.stringify(segmentPairs, null, 2)}`;

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
      max_tokens: 2000,
      system: QA_SYSTEM,
      messages: [{ role: "user", content: userMessage }]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "평가 API 호출 실패");
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "[]";
  try {
      return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (e) {
     console.error("Failed to parse QA JSON:", text);
     throw new Error("평가 결과를 JSON 형식으로 파싱할 수 없습니다.");
  }
}
