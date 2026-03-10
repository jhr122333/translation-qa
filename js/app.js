import { runTranslation, runEvaluation } from './evaluator.js';
import { loadGlossary, addTerm, deleteTerm, detectUsedTerms } from './glossary.js';
import { extractCandidateTerms, formatExtractedTerms } from './termExtractor.js';

// ── 전역 상태 ──────────────────────────────────────────────
let baseGlossary = [];
let samples = [];
let translateDirection = "ko→en";
let qaDirection = "ko→en";
let currentGlossaryCat = "전체";
let isDemoMode = false;

// ── 데모 mock 데이터 ───────────────────────────────────────
const DEMO_TRANSLATION_SEGMENTS = [
  "This Standard Operating Procedure (SOP) defines the cleaning validation procedures for manufacturing equipment.",
  "If residue limits are exceeded after cleaning, a Deviation report must be prepared and a Corrective and Preventive Action (CAPA) plan must be established."
];

const DEMO_QA_GOOD = [
  { errorCategory: "None", severity: "None", comment: "SOP 등 핵심 용어가 원문 의미를 완전히 반영하였습니다.", suggestion: "" },
  { errorCategory: "None", severity: "None", comment: "Deviation, CAPA 등 용어집 기반 전문 용어가 정확하게 사용되었습니다.", suggestion: "" }
];

const DEMO_QA_BAD = [
  { errorCategory: "Terminology", severity: "Critical", comment: "SOP가 'work instruction'으로 잘못 번역되었습니다.", suggestion: "This Standard Operating Procedure (SOP) defines..." },
  { errorCategory: "Mistranslation", severity: "Major", comment: "일탈(Deviation)이 'problem'으로 표현되어 규제 맥락에서 심각한 오류입니다.", suggestion: "If residue limits are exceeded after cleaning, a Deviation report..." }
];

// 간단한 문장 분할 정규식 (마침표/물음표/느낌표 뒤 공백 또는 줄바꿈)
function segmentText(text) {
  return text.split(/(?<=[.!?])\s+|[\n]+/).map(s => s.trim()).filter(s => s.length > 0);
}

// ── 초기화 ────────────────────────────────────────────────
async function init() {
  await loadBaseData();
  restoreApiKey();
  setupTabs();
  setupDemoMode();
  setupTranslateTab();
  setupQATab();
  setupGlossaryTab();
  setupSamplesTab();
  syncButtons();

  // API 키가 없으면 자동으로 데모 모드 시작 (포트폴리오 방문자 UX)
  if (!getApiKey()) {
    toggleDemoMode();
  }
}

async function loadBaseData() {
  const [gRes, sRes] = await Promise.all([
    fetch('./data/glossary.json'),
    fetch('./data/samples.json')
  ]);
  baseGlossary = await gRes.json();
  samples = await sRes.json();
}

// ── API Key ────────────────────────────────────────────────
function restoreApiKey() {
  const saved = sessionStorage.getItem("tqa_api_key");
  if (saved) {
    const inp = document.getElementById("apiKeyInput");
    inp.value = saved;
    inp.type = "password";
  }
}

document.getElementById("saveKeyBtn").addEventListener("click", () => {
  const key = document.getElementById("apiKeyInput").value.trim();
  if (!key) { showToast("API Key를 입력해 주세요.", true); return; }
  sessionStorage.setItem("tqa_api_key", key);
  document.getElementById("apiKeyInput").type = "password";
  syncButtons();
  showToast("API Key가 저장되었습니다.");
});

document.getElementById("apiKeyInput").addEventListener("input", syncButtons);

function getApiKey() {
  return document.getElementById("apiKeyInput").value.trim();
}

function syncButtons() {
  const active = isDemoMode || !!getApiKey();
  ["translateBtn", "qaBtn"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !active;
  });
  const tip  = document.getElementById("translateTip");
  const tip2 = document.getElementById("qaTip");
  if (tip)  tip.style.display  = active ? "none" : "";
  if (tip2) tip2.style.display = active ? "none" : "";
}

// ── 데모 모드 ─────────────────────────────────────────────
function setupDemoMode() {
  document.getElementById("demoModeBtn").addEventListener("click", toggleDemoMode);
}

function toggleDemoMode() {
  isDemoMode = !isDemoMode;
  const btn = document.getElementById("demoModeBtn");
  const group = document.getElementById("apiKeyGroup");
  let banner = document.getElementById("demoBanner");

  if (isDemoMode) {
    // API 키 영역 숨기고 데모 뱃지로 교체
    group.style.display = "none";
    let demoBadge = document.getElementById("demoBadge");
    if (!demoBadge) {
      demoBadge = document.createElement("div");
      demoBadge.id = "demoBadge";
      demoBadge.style.cssText = `
        background: var(--color-primary-light); color: var(--color-primary);
        padding: .3rem .9rem; border-radius: 999px;
        font-size: .8rem; font-weight: 700; flex-shrink: 0;
      `;
      demoBadge.textContent = "🎭 데모 모드 실행 중";
      group.insertAdjacentElement("afterend", demoBadge);
    }

    // 버튼 상태 변경
    btn.textContent = "✕ 데모 종료";
    btn.style.background = "rgba(255,255,255,.3)";

    // 상단 배너 삽입
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "demoBanner";
      banner.style.cssText = `
        background: var(--color-primary-light); color: var(--color-primary);
        text-align: center; padding: .5rem 1rem; font-size: .875rem; font-weight: 600;
        position: sticky; top: 54px; z-index: 89;
      `;
      banner.innerHTML = "🎭 데모 모드 — API 키 없이 샘플 번역·평가 결과를 체험합니다";
      document.querySelector(".tabs-nav").insertAdjacentElement("afterend", banner);
    }

    // 샘플 1 원문 자동 로드
    const s = samples[0];
    document.getElementById("translateSource").value = s.source;
    document.getElementById("translateCharCount").textContent = `${s.source.length}자`;
    translateDirection = s.direction;
    document.querySelectorAll("#tab-translate .toggle-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.dir === s.direction);
    });
    switchTab("tab-translate");
    showToast("데모 모드 시작! 번역 실행을 눌러보세요.");
  } else {
    btn.textContent = "🎭 데모 모드";
    btn.style.background = "rgba(255,255,255,.15)";
    group.style.display = "";
    document.getElementById("demoBadge")?.remove();
    banner?.remove();
    showToast("데모 모드 종료.");
  }

  syncButtons();
}

// ── 탭 제어 ────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.toggle("active", c.id === tabId));
}

// ── 탭 1: 번역 ────────────────────────────────────────────
function setupTranslateTab() {
  document.querySelectorAll("#tab-translate .toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#tab-translate .toggle-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      translateDirection = btn.dataset.dir;
    });
  });

  const srcTA = document.getElementById("translateSource");
  srcTA.addEventListener("input", () => {
    document.getElementById("translateCharCount").textContent = `${srcTA.value.length}자`;
  });

  document.getElementById("translateBtn").addEventListener("click", doTranslate);
}

async function doTranslate() {
  const sourceText = document.getElementById("translateSource").value.trim();
  if (!sourceText) { showToast("원문을 입력해 주세요.", true); return; }

  const segments = segmentText(sourceText);
  
  setLoading("translateBtn", true, "번역 중...");
  document.getElementById("translateResultPanel").innerHTML = `
    <div class="result-empty"><div class="result-empty-icon">⏳</div><p>번역 중입니다...</p></div>`;

  try {
    let translatedSegments, usedTerms;

    if (isDemoMode) {
      await delay(1500);
      translatedSegments = DEMO_TRANSLATION_SEGMENTS.slice(0, segments.length);
      // 만약 원문 세그먼트 수가 더 많으면 마지막 mock 문장 복제
      while(translatedSegments.length < segments.length) translatedSegments.push(DEMO_TRANSLATION_SEGMENTS[1]);
      
      const glossary = loadGlossary(baseGlossary);
      const { detectUsedTerms } = await import('./glossary.js');
      const allUsed = new Set();
      usedTerms = [];
      translatedSegments.forEach(target => {
        detectUsedTerms(target, translateDirection, glossary).forEach(t => {
          if (!allUsed.has(t.id)) { allUsed.add(t.id); usedTerms.push(t); }
        });
      });
    } else {
      const apiKey = getApiKey();
      if (!apiKey) { showToast("API Key를 입력해 주세요.", true); return; }
      ({ translatedSegments, usedTerms } = await runTranslation({
        apiKey, segments, direction: translateDirection, baseGlossary
      }));
    }

    renderTranslateResult(translatedSegments, usedTerms, segments);
  } catch (err) {
    showToast("번역 오류: " + err.message, true);
    document.getElementById("translateResultPanel").innerHTML = `
      <div class="result-empty"><div class="result-empty-icon">⚠️</div><p>${err.message}</p></div>`;
  } finally {
    setLoading("translateBtn", false, "번역 실행");
  }
}

function renderTranslateResult(translatedSegments, usedTerms, originalSegments) {
  // 용어 배지: RAG 모드 여부에 따라 색상 분기 + 관련도 퍼센트 표시
  const badgesHtml = usedTerms.length
    ? `<div class="term-badges-label">용어집 반영 용어</div>
       <div class="term-badges">${usedTerms.map(t => {
         const label = translateDirection === "ko→en" ? (t.abbr || t.en.split(' ')[0]) : t.ko;
         // RAG 모드면 RAG 배지, 아니면 기존 정확 매칭 배지
         if (window.__ragMode) {
           const pct = t.__relevance !== undefined ? Math.round(t.__relevance * 100) : Math.floor(Math.random() * 20 + 75);
           return `<span class="term-badge-rag" title="RAG 시맨틱 매칭">${label}<span class="relevance-pct">${pct}%</span></span>`;
         } else {
           const pct = 100; // 정확 매칭은 100%
           return `<span class="term-badge-exact" title="정확 매칭 (용어집)">${label}<span class="relevance-pct">${pct}%</span></span>`;
         }
       }).join('')}</div>`
    : '';

  const demoTag = isDemoMode
    ? `<div style="font-size:.75rem;color:var(--color-text-muted);margin-bottom:.5rem;">🎭 데모 결과</div>` : '';

  const mergedText = translatedSegments.join(' ');

  // 번역 결과를 로컬 스토리지 또는 글로벌 상태로 임시 저장하여 QA로 넘기기 쉽게 함
  window.__lastSegments = originalSegments.map((src, i) => ({ source: src, target: translatedSegments[i] || "" }));

  document.getElementById("translateResultPanel").innerHTML = `
    <div class="panel-title">번역 결과</div>
    ${demoTag}
    ${badgesHtml}
    <div class="translate-result-box" id="translateOutput" contenteditable="true">${escHtml(mergedText)}</div>
    <div class="btn-row">
      <button class="btn btn-secondary" id="copyTranslateBtn">복사</button>
      <button class="btn btn-primary" id="sendToQABtn">📊 QA 에디터로 연동 →</button>
    </div>
  `;

  document.getElementById("copyTranslateBtn").addEventListener("click", () => {
    const text = document.getElementById("translateOutput").innerText;
    navigator.clipboard.writeText(text).then(() => showToast("복사되었습니다."));
  });

  document.getElementById("sendToQABtn").addEventListener("click", () => {
    sendToQA(window.__lastSegments, translateDirection);
  });

  // ── 용어 자동 추출 연동 ────────────────────────────────────
  const glossary = loadGlossary(baseGlossary);
  const rawCandidates = extractCandidateTerms(
    originalSegments.join(' '),
    mergedText,
    translateDirection,
    glossary
  );
  const formattedTerms = formatExtractedTerms(rawCandidates);

  if (formattedTerms.length > 0) {
    renderExtractedTerms(formattedTerms, translateDirection);
  }
}

function renderExtractedTerms(terms, direction) {
  const panel = document.getElementById("translateResultPanel");
  if (!panel) return;

  // 이미 섹션이 있으면 제거 후 재렌더링
  const existing = panel.querySelector(".term-extraction-section");
  if (existing) existing.remove();

  const cardsHtml = terms.map((t, i) => {
    const displayName = t.abbr
      ? `${t.abbr}${t.en && t.en !== t.abbr ? ' — ' + t.en : ''}`
      : (t.en || t.ko || "—");

    const koLabel = t.ko ? `<span class="extracted-term-ko">${t.ko}</span>` : '';

    return `
      <div class="extracted-term-card" data-index="${i}">
        <div class="extracted-term-info">
          <div class="extracted-term-name">${escHtml(displayName)}</div>
          ${koLabel}
          <div class="extracted-term-meta">
            <span class="badge-cat">${t.suggestedCategory}</span>
            <span class="extracted-term-source">${t.source}</span>
          </div>
        </div>
        <div class="extracted-term-right">
          <div class="confidence-wrap">
            <div class="confidence-label">${t.confidence}%</div>
            <div class="confidence-bar">
              <div class="confidence-bar-fill" style="width:${t.confidence}%;"></div>
            </div>
          </div>
          <button class="btn-add-term" data-index="${i}">용어집에 추가</button>
        </div>
      </div>
    `;
  }).join('');

  const section = document.createElement("div");
  section.className = "term-extraction-section";
  section.innerHTML = `
    <div class="term-extraction-header">
      <span class="term-extraction-icon">💡</span>
      <span class="term-extraction-title">새 전문용어 발견</span>
      <span class="term-extraction-count">${terms.length}개 후보</span>
    </div>
    <div class="term-extraction-body">
      ${cardsHtml}
    </div>
  `;

  panel.appendChild(section);

  // [용어집에 추가] 버튼 이벤트 바인딩
  section.querySelectorAll(".btn-add-term").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index, 10);
      const t = terms[idx];

      const newTerm = addTerm({
        category: t.suggestedCategory,
        ko: t.ko || (direction === "en→ko" ? t.en : ""),
        en: t.en || (direction === "ko→en" ? t.ko : t.abbr || ""),
        abbr: t.abbr || ""
      });

      btn.textContent = "✓ 추가됨";
      btn.disabled = true;
      btn.classList.add("btn-add-term--added");

      showToast(`"${t.abbr || t.en || t.ko}" 용어가 용어집에 추가되었습니다.`);
    });
  });
}

function sendToQA(segmentPairs, direction) {
  if (!segmentPairs || segmentPairs.length === 0) return;
  
  setQADirection(direction);
  switchTab("tab-qa");
  
  // render initial Side-by-Side table for QA input
  renderQATable(segmentPairs, true);
  showToast("QA 탭으로 연동되었습니다. MQM 평가를 시작하세요.");
}

// ── 탭 2: QA 평가 ─────────────────────────────────────────
function setupQATab() {
  document.querySelectorAll("#tab-qa .toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      setQADirection(btn.dataset.dir);
      // Update existing rows if any
      const existing = getSegmentPairsFromDOM();
      if (existing.length) {
         window.__lastSegments = existing;
         renderQATable(existing, true);
      }
    });
  });
  document.getElementById("qaBtn").addEventListener("click", doEvaluate);
}

function setQADirection(dir) {
  qaDirection = dir;
  document.querySelectorAll("#tab-qa .toggle-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.dir === dir);
  });
}

function getSegmentPairsFromDOM() {
  if (!window.__lastSegments) return [];
  const rows = document.querySelectorAll(".qa-row");
  const pairs = [];
  rows.forEach((row, i) => {
    const targetEl = row.querySelector(".seg-target");
    pairs.push({
       source: window.__lastSegments[i].source,
       target: targetEl ? targetEl.innerText.trim() : window.__lastSegments[i].target
    });
  });
  return pairs.length ? pairs : window.__lastSegments;
}

function renderQATable(segmentPairs, isInputOnly = false) {
  const tbody = document.getElementById("qaResultTbody");
  if (!segmentPairs || segmentPairs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="result-empty"><div class="result-empty-icon">📊</div><p>번역 결과가 없습니다.</p></td></tr>`;
    return;
  }

  window.__lastSegments = segmentPairs; // cache for saving edits

  tbody.innerHTML = segmentPairs.map((pair, i) => {
    // If we have QA results attached
    let qaHtml = `<span style="color:var(--color-text-muted);font-size:.8rem;">평가 대기 중...</span>`;
    
    if (!isInputOnly && pair.qaResult) {
       const qa = pair.qaResult;
       const isErr = qa.errorCategory !== "None";
       
       let classMap = { "Critical": "mqm-crit", "Major": "mqm-maj", "Minor": "mqm-min", "None": "mqm-none" };
       const badgeCls = classMap[qa.severity] || "mqm-none";
       
       let suggHtml = qa.suggestion ? `<div class="mqm-sugg">제안: ${qa.suggestion}</div>` : '';
       let termMismatches = '';
       if (pair.mismatches && pair.mismatches.length) {
          termMismatches = `<div style="margin-top:.3rem;font-size:.7rem;color:var(--color-error);font-weight:600;">⚠ 용어 불일치 감지: ${pair.mismatches.filter(m=>!m.found).map(m=>m.sourceTerm).join(', ')}</div>`;
       }

       qaHtml = `
         <div class="mqm-badge ${badgeCls}">
           <div class="mqm-cat">${qa.errorCategory} <span style="opacity:.6;font-size:.65rem;border-left:1px solid currentColor;margin-left:4px;padding-left:4px;">${qa.severity}</span></div>
           <div class="mqm-comment">${qa.comment}</div>
           ${suggHtml}
           ${termMismatches}
         </div>
       `;
    }

    return `
      <tr class="qa-row" data-index="${i}">
        <td class="seg-source">${escHtml(pair.source)}</td>
        <td class="seg-target" contenteditable="true">${escHtml(pair.target)}</td>
        <td class="seg-qa-cell">${qaHtml}</td>
      </tr>
    `;
  }).join('');
}

async function doEvaluate() {
  const segmentPairs = getSegmentPairsFromDOM();
  if (!segmentPairs || segmentPairs.length === 0) { showToast("평가할 원문/번역문 쌍이 없습니다.", true); return; }

  setLoading("qaBtn", true, "▶ 평가 진행 중...");
  
  // Show loading state in cells
  document.querySelectorAll(".seg-qa-cell").forEach(cell => {
    cell.innerHTML = `<span class="spinner" style="border-top-color:var(--color-primary);border-width:2px;width:.8em;height:.8em;"></span><span style="font-size:.75rem;margin-left:5px;color:var(--color-text-muted);">평가 중...</span>`;
  });

  try {
    let evalResults;

    if (isDemoMode) {
      await delay(2000);
      // 샘플에 따라 bad/good 데모 데이터 매핑
      const isBad = segmentPairs.some(p => p.target.includes("work instruction") || p.target.includes("problem report") || p.target.includes("corrective measures"));
      const mockObj = isBad ? DEMO_QA_BAD : DEMO_QA_GOOD;
      
      const glossary = loadGlossary(baseGlossary);
      const { detectMismatches } = await import('./glossary.js');
      
      evalResults = segmentPairs.map((pair, i) => {
         const mm = detectMismatches(pair.source, pair.target, qaDirection, glossary);
         const res = mockObj[i] || { errorCategory: "None", severity: "None", comment: "데모 모드 임의 결과 처리" };
         return { ...res, mismatches: mm };
      });
    } else {
      const apiKey = getApiKey();
      if (!apiKey) { showToast("API Key를 입력해 주세요.", true); return; }
      evalResults = await runEvaluation({ apiKey, segmentPairs, direction: qaDirection, baseGlossary });
    }

    // attach results to pairs
    segmentPairs.forEach((pair, i) => {
      pair.qaResult = evalResults[i];
      pair.mismatches = evalResults[i]?.mismatches;
    });

    renderQATable(segmentPairs, false);
    
    const copyBtn = document.getElementById("copyQABtn");
    copyBtn.style.display = "inline-flex";
    copyBtn.onclick = () => copyQAResult(segmentPairs);

  } catch (err) {
    showToast("평가 오류: " + err.message, true);
    document.querySelectorAll(".seg-qa-cell").forEach(cell => cell.innerHTML = `<span style="color:var(--color-error);font-size:.75rem;">⚠ 오류 발생</span>`);
  } finally {
    setLoading("qaBtn", false, "▶ MQM 품질 평가 시작");
  }
}

function copyQAResult(segmentPairs) {
  const text = [
    "[MQM 리뷰 평가 최종 결과]",
    `방향: ${qaDirection}`,
    "--------------------------------------------------",
    ...segmentPairs.map((p, i) => {
      const q = p.qaResult;
      return `[${i+1}] 원문: ${p.source}\n    번역: ${p.target}\n    MQM: ${q.errorCategory} (${q.severity})\n    코멘트: ${q.comment}\n`;
    })
  ].join('\n');
  navigator.clipboard.writeText(text)
    .then(() => showToast("결과가 복사되었습니다."))
    .catch(() => showToast("복사에 실패했습니다.", true));
}

// ── 탭 3: 용어집 ───────────────────────────────────────────

// RAG 모드 전역 상태
window.__ragMode = false;

// RAG 시뮬레이션: 검색어와 용어의 시맨틱 관련도 점수 계산 (0~1)
function calcRagRelevance(term, searchQuery) {
  if (!searchQuery) return Math.random() * 0.3 + 0.55; // 검색어 없을 땐 랜덤 적당값
  const q = searchQuery.toLowerCase();
  const koScore  = term.ko.toLowerCase().includes(q) ? 1.0 : 0;
  const enScore  = term.en.toLowerCase().includes(q) ? 0.95 : 0;
  const abbrScore = term.abbr && term.abbr.toLowerCase().includes(q) ? 0.9 : 0;
  const catScore  = term.category.toLowerCase().includes(q) ? 0.5 : 0;
  // 부분 문자 유사도 보너스
  const partialKo = [...q].filter(ch => term.ko.includes(ch)).length / Math.max(q.length, 1) * 0.4;
  const partialEn = [...q].filter(ch => term.en.toLowerCase().includes(ch)).length / Math.max(q.length, 1) * 0.35;
  const raw = Math.max(koScore, enScore, abbrScore, catScore, partialKo, partialEn);
  return Math.min(raw + (Math.random() * 0.08), 1.0); // 소량 랜덤 노이즈 추가
}

// 용어 상세 사이드패널 열기
function openTermPanel(term, rowEl) {
  // 이전 선택 해제
  document.querySelectorAll(".glossary-table tbody tr.row-selected").forEach(r => r.classList.remove("row-selected"));
  if (rowEl) rowEl.classList.add("row-selected");

  // 패널 데이터 채우기
  document.getElementById("panelTermTitle").textContent = term.ko || "—";
  document.getElementById("panelTermSubtitle").textContent = term.en || "—";

  // 정의 (definition 필드가 없으면 카테고리 설명 대체)
  const defEl = document.getElementById("panelDefinition");
  defEl.textContent = term.definition ||
    `"${term.en}"의 한국어 표준 번역어로, ${term.category} 영역에서 사용되는 전문 용어입니다.`;

  // 메타 정보
  document.getElementById("panelSource").textContent = term.source || "ICH / FDA / KP";
  document.getElementById("panelCategory").textContent = term.category || "—";
  document.getElementById("panelAbbr").textContent = term.abbr || "—";

  // 사용 맥락
  const ctxWrap = document.getElementById("panelContextWrap");
  if (term.context) {
    document.getElementById("panelContext").textContent = term.context;
    ctxWrap.style.display = "";
  } else {
    ctxWrap.style.display = "none";
  }

  // 관련 용어
  const relWrap = document.getElementById("panelRelatedWrap");
  const relList = document.getElementById("panelRelatedTerms");
  if (term.relatedTerms && term.relatedTerms.length) {
    relList.innerHTML = term.relatedTerms.map(rt =>
      `<span class="term-related-chip">${rt}</span>`
    ).join("");
    relWrap.style.display = "";
  } else {
    relWrap.style.display = "none";
  }

  // RAG 관련도 스코어 (RAG 모드일 때만)
  const ragWrap = document.getElementById("panelRagWrap");
  if (window.__ragMode && term.__relevance !== undefined) {
    const pct = Math.round(term.__relevance * 100);
    document.getElementById("panelRagBar").style.width = `${pct}%`;
    document.getElementById("panelRagScore").textContent = `${pct}%`;
    ragWrap.style.display = "";
  } else {
    ragWrap.style.display = "none";
  }

  // 패널 열기
  const panel = document.getElementById("termDetailPanel");
  const overlay = document.getElementById("termDetailOverlay");
  panel.classList.add("open");
  overlay.classList.add("visible");
}

// 용어 상세 사이드패널 닫기
function closeTermPanel() {
  const panel = document.getElementById("termDetailPanel");
  const overlay = document.getElementById("termDetailOverlay");
  panel.classList.remove("open");
  overlay.classList.remove("visible");
  document.querySelectorAll(".glossary-table tbody tr.row-selected").forEach(r => r.classList.remove("row-selected"));
}

function setupGlossaryTab() {
  document.getElementById("catFilters").addEventListener("click", e => {
    const btn = e.target.closest(".cat-btn");
    if (!btn) return;
    document.querySelectorAll("#catFilters .cat-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentGlossaryCat = btn.dataset.cat;
    renderGlossary();
  });

  // 기존 glossarySearch input 이벤트는 RAG 토글 설정 후에 교체하므로 여기선 제거
  // (RAG 토글 핸들러 내에서 처리)

  // RAG 토글 버튼
  document.getElementById("ragToggleBtn").addEventListener("click", () => {
    window.__ragMode = !window.__ragMode;
    const btn = document.getElementById("ragToggleBtn");
    btn.classList.toggle("active", window.__ragMode);
    btn.querySelector(".rag-toggle-icon").textContent = window.__ragMode ? "✦" : "🔍";

    // 관련도 컬럼 헤더 표시/숨김
    document.getElementById("colRelevance").style.display = window.__ragMode ? "" : "none";

    // RAG 모드 시 검색어가 있으면 로딩 인디케이터 노출
    const indicator = document.getElementById("ragSearchIndicator");
    const searchVal = document.getElementById("glossarySearch").value.trim();
    if (window.__ragMode && searchVal) {
      indicator.classList.add("visible");
      setTimeout(() => {
        indicator.classList.remove("visible");
        renderGlossary();
      }, 900);
    } else {
      renderGlossary();
    }

    // 열려 있는 패널 RAG 섹션 갱신
    const panel = document.getElementById("termDetailPanel");
    if (panel.classList.contains("open")) {
      document.getElementById("panelRagWrap").style.display = window.__ragMode ? "" : "none";
    }

    showToast(window.__ragMode ? "RAG 시맨틱 검색 모드 활성화" : "일반 검색 모드로 전환");
  });

  // 검색 입력: RAG 모드면 인디케이터 후 렌더, 일반이면 즉시 렌더
  document.getElementById("glossarySearch").addEventListener("input", () => {
    const indicator = document.getElementById("ragSearchIndicator");
    if (window.__ragMode) {
      indicator.classList.add("visible");
      clearTimeout(indicator._t);
      indicator._t = setTimeout(() => {
        indicator.classList.remove("visible");
        renderGlossary();
      }, 700);
    } else {
      renderGlossary();
    }
  });

  // 패널 닫기 버튼
  document.getElementById("termDetailClose").addEventListener("click", closeTermPanel);

  // 오버레이 클릭 시 닫기
  document.getElementById("termDetailOverlay").addEventListener("click", closeTermPanel);

  // ESC 키로 패널 닫기
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeTermPanel();
  });

  document.getElementById("addTermBtn").addEventListener("click", () => {
    const category = document.getElementById("newCategory").value;
    const ko = document.getElementById("newKo").value.trim();
    const en = document.getElementById("newEn").value.trim();
    const abbr = document.getElementById("newAbbr").value.trim();
    if (!ko || !en) { showToast("한국어와 영어 용어를 입력해 주세요.", true); return; }
    addTerm({ category, ko, en, abbr });
    document.getElementById("newKo").value = "";
    document.getElementById("newEn").value = "";
    document.getElementById("newAbbr").value = "";
    renderGlossary();
    showToast("용어가 추가되었습니다.");
  });

  renderGlossary();
}

function renderGlossary() {
  const glossary = loadGlossary(baseGlossary);
  const search = document.getElementById("glossarySearch").value.toLowerCase();

  let filtered = glossary.filter(t => {
    const catOk = currentGlossaryCat === "전체" || t.category === currentGlossaryCat ||
      (currentGlossaryCat === "사용자 정의" && t.editable);
    const searchOk = !search ||
      t.ko.toLowerCase().includes(search) ||
      t.en.toLowerCase().includes(search) ||
      (t.abbr && t.abbr.toLowerCase().includes(search));
    return catOk && searchOk;
  });

  // RAG 모드: 관련도 스코어 계산 및 정렬
  if (window.__ragMode) {
    filtered = filtered.map(t => ({ ...t, __relevance: calcRagRelevance(t, search) }));
    if (search) filtered.sort((a, b) => b.__relevance - a.__relevance);
  }

  document.getElementById("glossaryCount").textContent = `총 ${filtered.length}개 용어`;

  // 관련도 컬럼 헤더 동기화
  document.getElementById("colRelevance").style.display = window.__ragMode ? "" : "none";

  const tbody = document.getElementById("glossaryTbody");
  tbody.innerHTML = filtered.map(t => {
    // RAG 관련도 셀
    let relevanceTd = "";
    if (window.__ragMode && t.__relevance !== undefined) {
      const pct = Math.round(t.__relevance * 100);
      const cls = pct >= 80 ? "high" : pct >= 50 ? "mid" : "low";
      relevanceTd = `<td class="td-relevance" style="text-align:center;"><span class="relevance-score ${cls}">${pct}%</span></td>`;
    } else {
      relevanceTd = `<td class="td-relevance" style="display:none;text-align:center;">—</td>`;
    }

    return `
    <tr data-term-id="${t.id}">
      <td><span class="badge-cat">${t.category}</span></td>
      <td>${t.ko}</td>
      <td>${t.en}</td>
      <td>${t.abbr || '—'}</td>
      ${relevanceTd}
      <td>${t.editable
        ? `<button class="btn-danger-sm" data-del="${t.id}">삭제</button>`
        : `<span class="lock-icon" title="기본 제공 용어">🔒</span>`
      }</td>
    </tr>`;
  }).join("");

  // 행 클릭 이벤트: 사이드패널 오픈
  tbody.querySelectorAll("tr[data-term-id]").forEach((row, i) => {
    row.addEventListener("click", e => {
      // 삭제 버튼 클릭은 패널 열지 않음
      if (e.target.closest("[data-del]")) return;
      openTermPanel(filtered[i], row);
    });
  });

  // 삭제 버튼 이벤트
  tbody.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      deleteTerm(btn.dataset.del);
      closeTermPanel();
      renderGlossary();
      showToast("용어가 삭제되었습니다.");
    });
  });
}

// ── 탭 4: 샘플 데모 ────────────────────────────────────────
function setupSamplesTab() {
  const grid = document.getElementById("samplesGrid");

  grid.innerHTML = samples.map(s => `
    <div class="sample-card">
      <div class="sample-card-head">
        <div class="sample-card-title">${s.title}</div>
        <div class="sample-badges">
          <span class="badge badge-dir">${s.direction}</span>
          <span class="badge badge-cat2">${s.category}</span>
        </div>
      </div>
      <p class="sample-preview">${s.source}</p>
      <p class="sample-error">⚠ ${s.errorDesc}</p>
      <div class="sample-actions">
        <button class="btn btn-open btn-sm" data-id="${s.id}" data-action="translate">번역 탭에서 열기</button>
        <button class="btn btn-good btn-sm" data-id="${s.id}" data-action="good">✓ 좋은 번역 QA</button>
        <button class="btn btn-bad btn-sm"  data-id="${s.id}" data-action="bad">✗ 나쁜 번역 QA</button>
      </div>
    </div>`).join("");

  grid.addEventListener("click", async e => {
    const btn = e.target.closest("[data-id][data-action]");
    if (!btn) return;
    const sample = samples.find(s => s.id === parseInt(btn.dataset.id));
    if (!sample) return;

    if (btn.dataset.action === "translate") {
      loadSampleToTranslate(sample);
    } else {
      await loadSampleToQA(sample, btn.dataset.action);
    }
  });
}

function loadSampleToTranslate(sample) {
  document.getElementById("translateSource").value = sample.source;
  document.getElementById("translateCharCount").textContent = `${sample.source.length}자`;
  translateDirection = sample.direction;
  document.querySelectorAll("#tab-translate .toggle-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.dir === sample.direction);
  });
  switchTab("tab-translate");
  showToast("원문이 번역 탭에 로드되었습니다.");
}

async function loadSampleToQA(sample, type) {
  const segmentPairs = [
     { source: sample.source, target: type === "good" ? sample.good : sample.bad }
  ];
  setQADirection(sample.direction);
  switchTab("tab-qa");
  renderQATable(segmentPairs, true);
  await doEvaluate();
}

// ── 유틸 ───────────────────────────────────────────────────
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setLoading(btnId, loading, loadingText) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (loading) {
    btn.dataset.origText = btn.textContent;
    btn.innerHTML = `<span class="spinner"></span> ${loadingText}`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.origText || loadingText;
    btn.disabled = !(isDemoMode || getApiKey());
  }
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, isError = false) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.background = isError ? "var(--color-error)" : "var(--color-primary)";
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2800);
}

// ── 실행 ──────────────────────────────────────────────────
init();
