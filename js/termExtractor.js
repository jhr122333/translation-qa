/**
 * termExtractor.js
 * 제약/바이오 번역 결과에서 미등록 전문 용어를 자동 감지하는 모듈
 */

// ── 카테고리별 키워드 사전 ─────────────────────────────────
const CATEGORY_KEYWORDS = {
  "GMP": [
    "validation", "validated", "batch", "manufacturing", "manufacture",
    "gmp", "sop", "deviation", "capa", "corrective", "preventive",
    "cleaning", "sterilization", "qualification", "iq", "oq", "pq",
    "change control", "out-of-specification", "oos", "release",
    "in-process", "reprocessing", "rework", "specification"
  ],
  "Clinical": [
    "trial", "clinical", "patient", "subject", "protocol", "adverse",
    "efficacy", "endpoint", "randomized", "placebo", "blind",
    "informed consent", "irb", "ethics", "dose", "dosing",
    "investigator", "sponsor", "cro", "phase", "cohort", "enrollment"
  ],
  "Regulatory": [
    "submission", "approval", "authorization", "ctd", "ind",
    "nda", "bla", "maa", "regulatory", "authority", "fda", "ema",
    "ich", "guideline", "label", "labeling", "dossier", "application",
    "variation", "amendment", "waiver"
  ],
  "Pharmacovigilance": [
    "safety", "signal", "icsr", "pharmacovigilance", "reporting",
    "adverse event", "adverse reaction", "adr", "sae", "serious",
    "expectedness", "causality", "susar", "psur", "pbrer",
    "risk management", "rmp", "vigilance"
  ],
  "Manufacturing": [
    "api", "fill", "sterile", "aseptic", "cleanroom", "clean room",
    "filtration", "lyophilization", "formulation", "excipient",
    "container", "closure", "primary packaging", "secondary packaging",
    "bulk", "drug substance", "drug product", "bioreactor", "upstream",
    "downstream", "purification", "yield"
  ],
  "Analytical": [
    "hplc", "assay", "specification", "dissolution", "purity",
    "potency", "identity", "impurity", "related substance", "residual",
    "solvent", "lod", "loq", "analytical", "method validation",
    "reference standard", "calibration", "uv", "gc", "ms",
    "spectroscopy", "chromatography"
  ]
};

// ── 1. 번역 결과에서 잠재적 전문 용어 추출 ───────────────────
/**
 * 번역 결과 텍스트에서 잠재적 전문 용어 후보를 추출한다.
 * @param {string} sourceText - 원문 텍스트
 * @param {string} targetText - 번역문 텍스트
 * @param {string} direction - 번역 방향 ("ko→en" | "en→ko")
 * @param {Array}  existingGlossary - 기존 용어집 배열
 * @returns {Array} [{ko, en, abbr, suggestedCategory}]
 */
export function extractCandidateTerms(sourceText, targetText, direction, existingGlossary) {
  const candidates = [];

  // 영어 텍스트 결정 (번역 방향에 따라 원문 또는 번역문에서 영어 추출)
  const enText = direction === "ko→en" ? targetText : sourceText;
  const koText = direction === "ko→en" ? sourceText : targetText;

  // ── 패턴 1: 괄호 안 약어와 앞의 명사구 쌍 추출 ──────────────
  // 예: "Quality Control (QC)", "품질 관리 (QC)", "Corrective And Preventive Action (CAPA)"
  const bracketAbbrPattern = /([A-Za-z\uAC00-\uD7A3][A-Za-z\uAC00-\uD7A3\s\-]{2,40})\s*\(([A-Z]{2,5})\)/g;
  let match;
  while ((match = bracketAbbrPattern.exec(enText + ' ' + koText)) !== null) {
    const phrase = match[1].trim();
    const abbr = match[2];

    // 영문 명사구인지 한글 명사구인지 구분
    const isEnPhrase = /^[A-Za-z]/.test(phrase);

    const candidate = {
      ko: isEnPhrase ? null : phrase,
      en: isEnPhrase ? phrase : null,
      abbr,
      suggestedCategory: inferCategory(phrase + ' ' + abbr),
      _source: "bracket_abbr"
    };
    candidates.push(candidate);
  }

  // ── 패턴 2: 영문 대문자 2단어 이상 명사구 ────────────────────
  // 예: "Quality Control", "Batch Release", "Standard Operating Procedure"
  const multiWordPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})\b/g;
  while ((match = multiWordPattern.exec(enText)) !== null) {
    const phrase = match[1];
    // 문장 시작의 단순 대문자 제외: 일반 영어 단어 블랙리스트
    if (_isCommonWord(phrase)) continue;

    candidates.push({
      ko: null,
      en: phrase,
      abbr: null,
      suggestedCategory: inferCategory(phrase),
      _source: "multiword_noun"
    });
  }

  // ── 패턴 3: 단독 영문 약어 (2-5글자 대문자) ──────────────────
  // 예: OOS, IMPD, CTD, CAPA, SOP
  const abbrPattern = /\b([A-Z]{2,5})\b/g;
  while ((match = abbrPattern.exec(enText)) !== null) {
    const abbr = match[1];
    // 이미 괄호 패턴에서 잡은 약어는 중복 추가하지 않음
    const alreadyCaptured = candidates.some(c => c.abbr === abbr);
    if (alreadyCaptured) continue;
    // 일반 영어 단어(관사, 전치사 등) 제외
    if (_isCommonAbbr(abbr)) continue;

    candidates.push({
      ko: null,
      en: abbr,
      abbr,
      suggestedCategory: inferCategory(abbr),
      _source: "standalone_abbr"
    });
  }

  // ── 중복 제거 및 기존 용어집 필터 ────────────────────────────
  const deduped = _deduplicateCandidates(candidates);
  const filtered = deduped.filter(c => !isDuplicate(c, existingGlossary));

  return filtered;
}

// ── 2. 카테고리 자동 추론 ─────────────────────────────────────
/**
 * 용어 텍스트를 분석해 제약/바이오 카테고리를 추론한다.
 * @param {string} term - 용어 텍스트 (영문/약어 포함)
 * @returns {string} 카테고리명
 */
export function inferCategory(term) {
  const lower = term.toLowerCase();

  let bestCategory = "일반";
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        // 완전 일치는 가중치 2배
        score += lower === kw ? 2 : 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

// ── 3. 중복 체크 (부분 일치 포함) ────────────────────────────
/**
 * 후보 용어가 기존 용어집에 이미 존재하는지 확인한다.
 * 정확 일치, 약어 일치, 80% 이상 유사도를 모두 체크한다.
 * @param {{ko, en, abbr}} candidate
 * @param {Array} glossary
 * @returns {boolean}
 */
export function isDuplicate(candidate, glossary) {
  const candEn = (candidate.en || "").toLowerCase().trim();
  const candAbbr = (candidate.abbr || "").toLowerCase().trim();
  const candKo = (candidate.ko || "").toLowerCase().trim();

  for (const term of glossary) {
    const termEn = (term.en || "").toLowerCase().trim();
    const termKo = (term.ko || "").toLowerCase().trim();
    const termAbbr = (term.abbr || "").toLowerCase().trim();

    // 정확 일치
    if (candEn && termEn && candEn === termEn) return true;
    if (candKo && termKo && candKo === termKo) return true;

    // 약어 일치
    if (candAbbr && termAbbr && candAbbr === termAbbr) return true;

    // 80% 이상 유사도 (Dice coefficient 기반)
    if (candEn && termEn && _similarity(candEn, termEn) >= 0.8) return true;
    if (candKo && termKo && _similarity(candKo, termKo) >= 0.8) return true;
  }

  return false;
}

// ── 4. 추출 결과를 UI용으로 포맷 ─────────────────────────────
/**
 * 추출된 후보 용어에 신뢰도 점수와 출처 정보를 추가해 UI 렌더링용으로 반환한다.
 * @param {Array} candidates - extractCandidateTerms()의 반환값
 * @returns {Array} [{ko, en, abbr, suggestedCategory, confidence, source}]
 */
export function formatExtractedTerms(candidates) {
  return candidates.map(c => {
    let confidence;
    let sourceLabel;

    switch (c._source) {
      case "bracket_abbr":
        confidence = 90;
        sourceLabel = "괄호 약어 쌍";
        break;
      case "multiword_noun":
        confidence = 70;
        sourceLabel = "대문자 명사구";
        break;
      case "standalone_abbr":
        confidence = 60;
        sourceLabel = "단독 약어";
        break;
      default:
        confidence = 50;
        sourceLabel = "기타";
    }

    return {
      ko: c.ko || null,
      en: c.en || null,
      abbr: c.abbr || null,
      suggestedCategory: c.suggestedCategory || "일반",
      confidence,
      source: sourceLabel
    };
  }).sort((a, b) => b.confidence - a.confidence); // 신뢰도 내림차순 정렬
}

// ── 내부 유틸 함수 ────────────────────────────────────────────

/**
 * 일반 영어 단어 블랙리스트 (전문 용어가 아닌 단어 필터용)
 */
const COMMON_WORDS = new Set([
  "The", "This", "That", "These", "Those", "With", "From", "Into", "Upon",
  "After", "Before", "During", "Between", "Through", "About", "Against",
  "Standard", "General", "Final", "First", "Last", "New", "Any", "All",
  "Each", "Both", "Such", "Other", "Same", "More", "Most", "Less",
  "Also", "Well", "Just", "Only", "Even", "Then", "When", "Where"
]);

function _isCommonWord(phrase) {
  // 2단어 이상 구문에서 첫 단어만 대문자인 경우 (문장 시작) 필터링
  const words = phrase.split(/\s+/);
  if (words.length === 1) return COMMON_WORDS.has(words[0]);
  // 모든 단어가 COMMON_WORDS에 포함되면 제외
  return words.every(w => COMMON_WORDS.has(w));
}

/**
 * 약어이지만 일반 단어로 쓰이는 패턴 제외
 */
const COMMON_ABBRS = new Set([
  "A", "AN", "THE", "OR", "AND", "BUT", "FOR", "NOR", "SO", "YET",
  "TO", "OF", "IN", "ON", "AT", "BY", "UP", "AS", "IS", "IT",
  "IF", "BE", "NO", "DO", "US", "WE", "HE", "SHE", "ME",
  "MR", "DR", "MS", "ETC", "VIA", "VS", "RE"
]);

function _isCommonAbbr(abbr) {
  return COMMON_ABBRS.has(abbr);
}

/**
 * 후보 목록 내부 중복 제거 (동일 영문 표현 기준)
 */
function _deduplicateCandidates(candidates) {
  const seen = new Set();
  return candidates.filter(c => {
    const key = (c.abbr || c.en || c.ko || "").toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Dice coefficient를 이용한 문자열 유사도 계산 (0~1)
 */
function _similarity(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const aBigrams = new Map();
  for (let i = 0; i < a.length - 1; i++) {
    const bigram = a.substring(i, i + 2);
    aBigrams.set(bigram, (aBigrams.get(bigram) || 0) + 1);
  }

  let intersectionSize = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bigram = b.substring(i, i + 2);
    const count = aBigrams.get(bigram) || 0;
    if (count > 0) {
      aBigrams.set(bigram, count - 1);
      intersectionSize++;
    }
  }

  return (2.0 * intersectionSize) / (a.length + b.length - 2);
}
