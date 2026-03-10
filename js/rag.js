// rag.js - RAG Engine for Terminology Retrieval (Browser-only, TF-IDF based)

// ── 상수 ────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'for', 'in', 'to', 'with', 'and', 'or', 'is',
  'are', 'was', 'be', 'by', 'on', 'at', 'as', 'it', 'its', 'this', 'that',
  'from', 'has', 'have', 'been', 'will', 'not', 'no'
]);

const MIN_SCORE_THRESHOLD = 0.05;
const ABBR_WEIGHT = 2.0;
const EXACT_MATCH_WEIGHT = 3.0;

// ── 토큰화 ───────────────────────────────────────────────────

/**
 * 영어 텍스트 토큰화: 소문자화 후 단어 분리, stop words 제거
 * @param {string} text
 * @returns {string[]}
 */
function tokenizeEn(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[\s\-_\/,.;:()\[\]{}|"'!?@#$%^&*+=<>]+/)
    .filter(w => w.length >= 2 && !STOP_WORDS.has(w));
}

/**
 * 한국어 텍스트 토큰화: 공백 및 특수문자 기준, 2글자 이상만
 * @param {string} text
 * @returns {string[]}
 */
function tokenizeKo(text) {
  if (!text) return [];
  return text
    .split(/[\s\-_\/,.;:()\[\]{}|"'!?@#$%^&*+=<>]+/)
    .filter(w => w.length >= 2);
}

/**
 * 혼합 텍스트(한+영) 토큰화
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  if (!text) return [];
  const tokens = [];
  // 영어 세그먼트 추출
  const enTokens = tokenizeEn(text);
  tokens.push(...enTokens);
  // 한국어 세그먼트 추출 (영문자/숫자 제거 후)
  const koText = text.replace(/[a-zA-Z0-9]+/g, ' ');
  const koTokens = tokenizeKo(koText);
  tokens.push(...koTokens);
  return tokens;
}

// ── TF 계산 ──────────────────────────────────────────────────

/**
 * 토큰 배열로부터 TF(Term Frequency) 맵 생성
 * @param {string[]} tokens
 * @returns {Map<string, number>}
 */
function computeTF(tokens) {
  const tf = new Map();
  if (tokens.length === 0) return tf;
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  // 정규화
  for (const [key, count] of tf.entries()) {
    tf.set(key, count / tokens.length);
  }
  return tf;
}

// ── 인덱스 구축 ──────────────────────────────────────────────

/**
 * TF-IDF 기반 인덱스 구축
 * @param {Array<{id:string, ko:string, en:string, abbr?:string, definition?:string, context?:string, category?:string}>} glossary
 * @returns {{ termDocs: Array, idf: Map<string, number>, totalDocs: number }}
 */
export function buildRagIndex(glossary) {
  // 각 용어에 대해 문서 텍스트와 토큰 생성
  const termDocs = glossary.map(term => {
    const textParts = [
      term.ko || '',
      term.en || '',
      term.abbr || '',
      term.definition || '',
      term.context || '',
      term.category || ''
    ];
    const fullText = textParts.join(' ');
    const tokens = tokenize(fullText);

    // 약어는 별도로 소문자화하여 토큰에 추가 (가중치는 scoring 시 적용)
    if (term.abbr) {
      tokens.push(term.abbr.toLowerCase());
    }

    const tf = computeTF(tokens);
    return { term, tokens, tf, fullText };
  });

  // IDF 계산: 전체 문서 중 각 토큰이 등장하는 문서 수 집계
  const docFreq = new Map();
  const totalDocs = termDocs.length;

  for (const doc of termDocs) {
    const seenTokens = new Set(doc.tokens);
    for (const token of seenTokens) {
      docFreq.set(token, (docFreq.get(token) || 0) + 1);
    }
  }

  // IDF = log((N + 1) / (df + 1)) + 1  (smoothed)
  const idf = new Map();
  for (const [token, df] of docFreq.entries()) {
    idf.set(token, Math.log((totalDocs + 1) / (df + 1)) + 1);
  }

  return { termDocs, idf, totalDocs };
}

// ── TF-IDF 벡터 및 코사인 유사도 ────────────────────────────

/**
 * TF 맵과 IDF 맵으로 TF-IDF 벡터(Map) 생성
 * @param {Map<string, number>} tf
 * @param {Map<string, number>} idf
 * @returns {Map<string, number>}
 */
function computeTFIDF(tf, idf) {
  const tfidf = new Map();
  for (const [token, tfVal] of tf.entries()) {
    const idfVal = idf.get(token) || 1;
    tfidf.set(token, tfVal * idfVal);
  }
  return tfidf;
}

/**
 * 두 TF-IDF 벡터(Map)의 코사인 유사도 계산
 * @param {Map<string, number>} vecA
 * @param {Map<string, number>} vecB
 * @returns {number}
 */
function cosineSimilarity(vecA, vecB) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [key, valA] of vecA.entries()) {
    dot += valA * (vecB.get(key) || 0);
    normA += valA * valA;
  }
  for (const valB of vecB.values()) {
    normB += valB * valB;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

// ── 관련 용어 검색 ───────────────────────────────────────────

/**
 * 쿼리 텍스트로 관련 용어 검색 (TF-IDF 코사인 유사도 기반)
 * @param {string} queryText
 * @param {Array} glossary
 * @param {{ termDocs: Array, idf: Map, totalDocs: number }} ragIndex
 * @param {number} topK
 * @returns {Array<{term: object, score: number}>}
 */
export function retrieveRelevantTerms(queryText, glossary, ragIndex, topK = 10) {
  if (!queryText || !ragIndex || !ragIndex.termDocs) return [];

  const { termDocs, idf } = ragIndex;

  // 쿼리 토큰화 및 TF-IDF 벡터 생성
  const queryTokens = tokenize(queryText);
  const queryTF = computeTF(queryTokens);
  const queryVec = computeTFIDF(queryTF, idf);

  const queryLower = queryText.toLowerCase();

  const scored = termDocs.map(doc => {
    const { term } = doc;

    // 문서 TF-IDF 벡터
    const docVec = computeTFIDF(doc.tf, idf);

    // 기본 코사인 유사도
    let score = cosineSimilarity(queryVec, docVec);

    // 약어 매칭 가중치: 쿼리에 약어가 정확히 포함되면 ABBR_WEIGHT 적용
    if (term.abbr && queryText.includes(term.abbr)) {
      score *= ABBR_WEIGHT;
    }

    // 정확한 문자열 포함 가중치: ko 또는 en이 쿼리에 포함되면 EXACT_MATCH_WEIGHT 적용
    const koLower = (term.ko || '').toLowerCase();
    const enLower = (term.en || '').toLowerCase();
    if (
      (koLower && queryLower.includes(koLower)) ||
      (enLower && queryLower.includes(enLower))
    ) {
      score *= EXACT_MATCH_WEIGHT;
    }

    return { term, score };
  });

  return scored
    .filter(item => item.score >= MIN_SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ── RAG 컨텍스트 생성 ─────────────────────────────────────────

/**
 * 번역 프롬프트용 컨텍스트 생성
 * @param {string} queryText
 * @param {Array} glossary
 * @param {{ termDocs: Array, idf: Map, totalDocs: number }} ragIndex
 * @param {'ko→en'|'en→ko'} direction
 * @param {number} topK
 * @returns {{ terms: Array, contextString: string }}
 */
export function buildRagContext(queryText, glossary, ragIndex, direction, topK = 10) {
  const results = retrieveRelevantTerms(queryText, glossary, ragIndex, topK);
  const terms = results.map(r => r.term);

  const contextString = terms
    .map(t => {
      if (direction === 'ko→en') {
        return `${t.ko} → ${t.en}${t.abbr ? ' (' + t.abbr + ')' : ''}`;
      } else {
        return `${t.en}${t.abbr ? ' (' + t.abbr + ')' : ''} → ${t.ko}`;
      }
    })
    .join('\n');

  return { terms, contextString };
}

// ── UI 표시용 포맷 ─────────────────────────────────────────────

/**
 * RAG 검색 결과를 UI 표시용으로 포맷
 * @param {Array<{term: object, score: number}>} results
 * @param {'ko→en'|'en→ko'} direction
 * @returns {Array<{term: object, relevancePercent: number, matchReason: string}>}
 */
export function formatRagResults(results, direction) {
  if (!results || results.length === 0) return [];

  // 최대 스코어로 정규화하여 퍼센트 계산
  const maxScore = results[0]?.score || 1;

  return results.map(({ term, score }) => {
    const relevancePercent = Math.round((score / maxScore) * 100);

    // matchReason 생성
    const reasons = [];
    if (term.abbr) {
      reasons.push(`약어: ${term.abbr}`);
    }
    if (term.category) {
      reasons.push(`카테고리: ${term.category}`);
    }

    const displayTerm = direction === 'ko→en'
      ? `${term.ko} → ${term.en}`
      : `${term.en} → ${term.ko}`;

    return {
      term,
      relevancePercent,
      matchReason: reasons.length > 0 ? reasons.join(', ') : '텍스트 유사도'
    };
  });
}
