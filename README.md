# Translation QA — Life Sciences Edition

**🔗 Live Demo: https://jhr122333.github.io/translation-qa/**

제약·바이오 도메인 전문 용어집 기반 AI 번역 + 번역학 3축 품질 평가 통합 시스템

---

## 워크플로우

```
[1. 번역]           →  [2. QA 평가]      →  [3. 용어 관리]
원문 입력               MQM 기반 오류 분류    전문 용어집 열람
RAG로 관련 용어 선별     용어 불일치 감지      RAG 관련도 점수 확인
AI 번역 실행            개선 제안 생성        커스텀 용어 추가·삭제
미등록 용어 후보 추출                         후보 용어 한 클릭 등록
```

번역 탭에서 "QA 평가하기 →" 클릭 시 결과가 QA 탭으로 자동 전달됩니다.

---

## 핵심 기능

### 🔤 RAG 기반 번역
- GMP / Clinical Trial / Regulatory / Pharmacovigilance / Manufacturing / Analytical 6개 카테고리, **80개 용어** 내장
- **TF-IDF 기반 RAG(Retrieval-Augmented Generation)**: 원문과 의미적으로 가장 관련된 용어 상위 15개만 선별해 프롬프트에 주입 → 전체 용어 주입 대비 정확도 향상·토큰 절감
- 번역 완료 후 RAG 관련도 점수(%) 배지로 시각적 확인

### 📊 번역학 3축 품질 평가
- **정확성 (Accuracy)**: 의미 손실·왜곡 여부
- **자연성 (Fluency)**: 목표어 표현의 자연스러움
- **적절성 (Adequacy)**: 도메인 용어 일관성
- 항목별 1~5점 + 코멘트 + 개선 제안문 자동 생성

### 🔍 용어 불일치 자동 감지
- 원문에 등장한 용어집 용어가 번역문에 올바르게 반영됐는지 자동 체크
- ✓ / ✗ 테이블로 시각적 표시

### 📚 용어집 관리 (확장 스키마)
- 용어별 `definition`(한글 정의) · `context`(사용 맥락) · `relatedTerms`(연관 ID) · `source`(ICH/FDA/EMA 출처) 필드 추가
- 커스텀 용어 추가 / 삭제 (localStorage 저장), 행 클릭 시 상세 사이드패널 열람

### 🤖 자동 용어 후보 추출
- 번역 결과에서 미등록 전문용어 자동 감지 (규칙 기반 패턴)
  - 괄호 약어 쌍 `Term (ABBR)` → 신뢰도 90%
  - 대문자 명사구 → 70%, 단독 약어 → 60%
- 감지된 후보를 한 클릭으로 용어집에 추가

### 🧪 샘플 데모
GMP SOP, 임상시험 동의서, CAPA 보고서 3개 샘플 제공.
각 샘플에 "좋은 번역 vs 나쁜 번역" 쌍이 있어 품질 차이를 즉시 비교 가능.

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| Frontend | Vanilla JS (ES Modules), HTML/CSS |
| AI API | Claude API (`claude-opus-4-5`) |
| RAG 엔진 | TF-IDF (브라우저 전용, 백엔드 없음) |
| 개발 방식 | **4개 AI 서브에이전트 병렬 협업** |
| 배포 | GitHub Pages |
| 빌드 | 없음 (Zero Build) |

---

## 로컬 실행

ES Modules 사용으로 `file://` 직접 실행 불가. 로컬 서버 필요.

```bash
# Python
cd translation-qa
python -m http.server 8080
# → http://localhost:8080 접속

# 또는 VS Code Live Server 확장 사용
```

API Key는 앱 상단 입력란에 Anthropic API Key 입력 후 사용.

---

## AI 에이전트 아키텍처

이 프로젝트의 v2 업그레이드는 **4개의 AI 서브에이전트를 병렬로 실행**하여 구현했습니다.

| 에이전트 | 역할 | 산출물 |
|---------|------|--------|
| **Agent 1 — DB** | 용어집 DB 설계 및 데이터 확충 | `data/glossary.json` (21개 → 80개, 스키마 확장) |
| **Agent 2 — RAG** | TF-IDF 기반 RAG 엔진 구현 | `js/rag.js` (신규), `js/api.js` (수정) |
| **Agent 3 — UI** | RAG 배지·사이드패널·관련도 컬럼 UI | `app.html`, `css/components.css`, `js/app.js` |
| **Agent 4 — 자동추출** | 번역 결과에서 미등록 용어 후보 자동 감지 | `js/termExtractor.js` (신규) |

각 에이전트는 독립적으로 파일을 생성·수정하고, 결과를 통합하는 방식으로 협업했습니다.

---

## 배경

번역학 석사 과정 + AI 콘텐츠 품질 평가 실무(Coupang)의 교차점에서 출발한 프로젝트.

- 번역 품질을 판단하는 기준인 정확성·자연성·적절성 프레임워크를 AI 평가에 적용
- 제약 도메인 SOP 문서를 다루는 실무 경험을 용어집 설계에 반영

**AX(AI Transformation) Portfolio** | 2025
