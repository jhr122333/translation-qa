import { runTranslation, runEvaluation } from './evaluator.js';
import { loadGlossary, addTerm, deleteTerm } from './glossary.js';

// ── 전역 상태 ──────────────────────────────────────────────
let baseGlossary = [];
let samples = [];
let translateDirection = "ko→en";
let qaDirection = "ko→en";
let currentGlossaryCat = "전체";
let lastTranslateResult = null; // { sourceText, translatedText, direction }

// ── 초기화 ────────────────────────────────────────────────
async function init() {
  await loadBaseData();
  restoreApiKey();
  setupTabs();
  setupTranslateTab();
  setupQATab();
  setupGlossaryTab();
  setupSamplesTab();
  syncButtons();
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
  const hasKey = !!getApiKey();
  ["translateBtn", "qaBtn"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !hasKey;
  });
  const tip = document.getElementById("translateTip");
  const tip2 = document.getElementById("qaTip");
  if (tip) tip.style.display = hasKey ? "none" : "";
  if (tip2) tip2.style.display = hasKey ? "none" : "";
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
  // 방향 토글
  document.querySelectorAll("#tab-translate .toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#tab-translate .toggle-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      translateDirection = btn.dataset.dir;
    });
  });

  // 글자 수 카운터
  const srcTA = document.getElementById("translateSource");
  srcTA.addEventListener("input", () => {
    document.getElementById("translateCharCount").textContent = `${srcTA.value.length}자`;
  });

  // 번역 실행
  document.getElementById("translateBtn").addEventListener("click", doTranslate);
}

async function doTranslate() {
  const apiKey = getApiKey();
  const sourceText = document.getElementById("translateSource").value.trim();
  if (!apiKey) { showToast("API Key를 입력해 주세요.", true); return; }
  if (!sourceText) { showToast("원문을 입력해 주세요.", true); return; }

  setLoading("translateBtn", true, "번역 중...");
  document.getElementById("translateResultPanel").innerHTML = `
    <div class="result-empty"><div class="result-empty-icon">⏳</div><p>번역 중입니다...</p></div>`;

  try {
    const { translatedText, usedTerms } = await runTranslation({
      apiKey, sourceText, direction: translateDirection, baseGlossary
    });
    lastTranslateResult = { sourceText, translatedText, direction: translateDirection };
    renderTranslateResult(translatedText, usedTerms, sourceText);
  } catch (err) {
    showToast("번역 오류: " + err.message, true);
    document.getElementById("translateResultPanel").innerHTML = `
      <div class="result-empty"><div class="result-empty-icon">⚠️</div><p>${err.message}</p></div>`;
  } finally {
    setLoading("translateBtn", false, "번역 실행");
  }
}

function renderTranslateResult(translatedText, usedTerms, sourceText) {
  const badgesHtml = usedTerms.length
    ? `<div class="term-badges-label">용어집 반영 용어</div>
       <div class="term-badges">${usedTerms.map(t =>
         `<span class="term-badge">${translateDirection === "ko→en" ? (t.abbr || t.en.split(' ')[0]) : t.ko}</span>`
       ).join('')}</div>`
    : '';

  document.getElementById("translateResultPanel").innerHTML = `
    <div class="panel-title">번역 결과</div>
    ${badgesHtml}
    <div class="translate-result-box" id="translateOutput" contenteditable="true">${escHtml(translatedText)}</div>
    <div class="btn-row">
      <button class="btn btn-secondary" id="copyTranslateBtn">복사</button>
      <button class="btn btn-primary" id="sendToQABtn">📊 QA 평가하기 →</button>
    </div>
  `;

  document.getElementById("copyTranslateBtn").addEventListener("click", () => {
    const text = document.getElementById("translateOutput").innerText;
    navigator.clipboard.writeText(text).then(() => showToast("복사되었습니다."));
  });

  document.getElementById("sendToQABtn").addEventListener("click", () => {
    const currentTranslated = document.getElementById("translateOutput").innerText.trim();
    sendToQA(sourceText, currentTranslated, translateDirection);
  });
}

function sendToQA(sourceText, translatedText, direction) {
  document.getElementById("qaSource").value = sourceText;
  document.getElementById("qaTarget").value = translatedText;
  setQADirection(direction);
  switchTab("tab-qa");
  showToast("QA 탭으로 이동했습니다. 평가를 시작하세요.");
}

// ── 탭 2: QA 평가 ─────────────────────────────────────────
function setupQATab() {
  // 방향 토글
  document.querySelectorAll("#tab-qa .toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      setQADirection(btn.dataset.dir);
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

async function doEvaluate() {
  const apiKey = getApiKey();
  const sourceText = document.getElementById("qaSource").value.trim();
  const targetText = document.getElementById("qaTarget").value.trim();
  if (!apiKey) { showToast("API Key를 입력해 주세요.", true); return; }
  if (!sourceText || !targetText) { showToast("원문과 번역문을 모두 입력해 주세요.", true); return; }

  setLoading("qaBtn", true, "평가 중...");
  document.getElementById("qaResultPanel").innerHTML = `
    <div class="result-empty"><div class="result-empty-icon">⏳</div><p>평가 중입니다...</p></div>`;

  try {
    const result = await runEvaluation({
      apiKey, sourceText, targetText, direction: qaDirection, baseGlossary
    });
    renderQAResult(result);
  } catch (err) {
    showToast("평가 오류: " + err.message, true);
    document.getElementById("qaResultPanel").innerHTML = `
      <div class="result-empty"><div class="result-empty-icon">⚠️</div><p>${err.message}</p></div>`;
  } finally {
    setLoading("qaBtn", false, "평가 시작");
  }
}

function renderQAResult(result) {
  const axes = [
    { key: "accuracy", label: "정확성 Accuracy" },
    { key: "fluency",  label: "자연성 Fluency" },
    { key: "adequacy", label: "적절성 Adequacy" }
  ];

  const scoresHtml = axes.map(ax => {
    const score = result[ax.key]?.score ?? 0;
    const comment = result[ax.key]?.comment ?? "";
    return `
      <div class="score-item">
        <div class="score-item-header">
          <span class="score-item-label">${ax.label}</span>
          <span class="score-item-value">${score}<span> / 5</span></span>
        </div>
        <div class="gauge"><div class="gauge-fill" data-score="${score}"></div></div>
        <div class="score-comment">${comment}</div>
      </div>`;
  }).join("");

  const mismatches = result.mismatches || [];
  const mismatchHtml = mismatches.length ? `
    <div class="mismatch-section">
      <div class="mismatch-label">용어 일관성 검사</div>
      <table class="mismatch-table">
        <thead><tr><th>원문 용어</th><th>기대 번역</th><th>사용 여부</th></tr></thead>
        <tbody>
          ${mismatches.map(m => `
            <tr>
              <td>${m.sourceTerm}</td>
              <td>${m.expectedTarget}${m.abbr ? ` <em style="color:var(--color-text-muted)">(${m.abbr})</em>` : ''}</td>
              <td class="${m.found ? 'status-ok' : 'status-err'}">${m.found ? '✓' : '✗'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : '';

  document.getElementById("qaResultPanel").innerHTML = `
    <div class="panel-title">평가 결과</div>
    <div class="score-list">${scoresHtml}</div>
    ${mismatchHtml}
    <div class="result-box-label">종합 평가</div>
    <div class="result-box">${result.overall ?? ''}</div>
    <div class="result-box-label">개선 제안</div>
    <div class="result-box suggestion">${result.suggestion ?? ''}</div>
    <button class="btn btn-secondary btn-sm" id="copyQABtn">결과 복사</button>
  `;

  document.getElementById("copyQABtn").addEventListener("click", () => copyQAResult(result));
}

function copyQAResult(result) {
  const text = [
    "[번역 QA 평가 결과]",
    `방향: ${qaDirection}`,
    "",
    `■ 정확성: ${result.accuracy?.score}/5`,
    result.accuracy?.comment,
    "",
    `■ 자연성: ${result.fluency?.score}/5`,
    result.fluency?.comment,
    "",
    `■ 적절성: ${result.adequacy?.score}/5`,
    result.adequacy?.comment,
    "",
    "■ 종합 평가",
    result.overall,
    "",
    "■ 개선 제안",
    result.suggestion
  ].join('\n');
  navigator.clipboard.writeText(text)
    .then(() => showToast("결과가 복사되었습니다."))
    .catch(() => showToast("복사에 실패했습니다.", true));
}

// ── 탭 3: 용어집 ───────────────────────────────────────────
function setupGlossaryTab() {
  document.getElementById("catFilters").addEventListener("click", e => {
    const btn = e.target.closest(".cat-btn");
    if (!btn) return;
    document.querySelectorAll("#catFilters .cat-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentGlossaryCat = btn.dataset.cat;
    renderGlossary();
  });

  document.getElementById("glossarySearch").addEventListener("input", renderGlossary);

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
  const filtered = glossary.filter(t => {
    const catOk = currentGlossaryCat === "전체" || t.category === currentGlossaryCat ||
      (currentGlossaryCat === "사용자 정의" && t.editable);
    const searchOk = !search ||
      t.ko.toLowerCase().includes(search) ||
      t.en.toLowerCase().includes(search) ||
      (t.abbr && t.abbr.toLowerCase().includes(search));
    return catOk && searchOk;
  });

  document.getElementById("glossaryCount").textContent = `총 ${filtered.length}개 용어`;

  const tbody = document.getElementById("glossaryTbody");
  tbody.innerHTML = filtered.map(t => `
    <tr>
      <td><span class="badge-cat">${t.category}</span></td>
      <td>${t.ko}</td>
      <td>${t.en}</td>
      <td>${t.abbr || '—'}</td>
      <td>${t.editable
        ? `<button class="btn-danger-sm" data-del="${t.id}">삭제</button>`
        : `<span class="lock-icon" title="기본 제공 용어">🔒</span>`
      }</td>
    </tr>`).join("");

  tbody.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      deleteTerm(btn.dataset.del);
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
  // 방향 토글 동기화
  translateDirection = sample.direction;
  document.querySelectorAll("#tab-translate .toggle-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.dir === sample.direction);
  });
  switchTab("tab-translate");
  showToast("원문이 번역 탭에 로드되었습니다.");
}

async function loadSampleToQA(sample, type) {
  document.getElementById("qaSource").value = sample.source;
  document.getElementById("qaTarget").value = type === "good" ? sample.good : sample.bad;
  setQADirection(sample.direction);
  switchTab("tab-qa");
  await doEvaluate();
}

// ── 유틸 ───────────────────────────────────────────────────
function setLoading(btnId, loading, loadingText) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (loading) {
    btn.dataset.origText = btn.textContent;
    btn.innerHTML = `<span class="spinner"></span> ${loadingText}`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.origText || loadingText;
    btn.disabled = !getApiKey();
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
