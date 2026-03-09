# Translation QA — Life Sciences Edition

**🔗 Live Demo: https://jhr122333.github.io/translation-qa/**

제약·바이오 도메인 전문 용어집 기반 AI 번역 + 번역학 3축 품질 평가 통합 시스템

---

## 기획 의도

번역가 구인공고를 보면 의료·제약 분야는 항상 "전문 지식 필수"라는 조건이 붙어 있습니다.
처음엔 그게 언어 실력의 문제라고 생각했어요.

그런데 실제 제약업계 사례를 리서치하다 다른 이유를 발견했습니다.
직원들이 사내 번역 솔루션이 없어 Google Translate로 기밀 SOP 문서를 번역하고,
`Deviation(일탈)`을 `discrepancy(불일치)`로 잘못 옮겨도 아무도 검수하지 못하는 현실.

허들은 전문 지식이 아니라 **도메인 용어의 일관성을 보장하는 시스템의 부재**였습니다.

그래서 만들었습니다.
Life Sciences 전문 용어집을 내장하고, 번역부터 품질 평가까지 한 흐름으로 처리하는 인하우스 경량 툴을.

---

## 워크플로우

```
[1. 번역]  →  [2. QA 평가]  →  [3. 용어 관리]
원문 입력      3축 자동 평가     전문 용어집 열람
용어집 기반    용어 불일치 감지   커스텀 용어 추가
번역 실행      개선 제안 생성    실시간 검색·필터
```

번역 탭에서 "QA 평가하기 →" 클릭 시 결과가 QA 탭으로 자동 전달됩니다.

---

## 핵심 기능

### 🔤 용어집 기반 번역
- GMP / Clinical Trial / Regulatory / Pharmacovigilance 4개 카테고리, 21개 용어 내장
- 번역 시 용어집 자동 참조 → 일관된 도메인 용어 사용 보장
- 번역 완료 후 사용된 용어 뱃지로 시각적 확인

### 📊 번역학 3축 품질 평가
- **정확성 (Accuracy)**: 의미 손실·왜곡 여부
- **자연성 (Fluency)**: 목표어 표현의 자연스러움
- **적절성 (Adequacy)**: 도메인 용어 일관성
- 항목별 1~5점 + 코멘트 + 개선 제안문 자동 생성

### 🔍 용어 불일치 자동 감지
- 원문에 등장한 용어집 용어가 번역문에 올바르게 반영됐는지 자동 체크
- ✓ / ✗ 테이블로 시각적 표시

### 📚 용어집 관리
- 기본 21개 용어 조회 및 카테고리 필터
- 커스텀 용어 추가 / 삭제 (localStorage 저장)

### 🧪 샘플 데모
GMP SOP, 임상시험 동의서, CAPA 보고서 3개 샘플 제공.
각 샘플에 "좋은 번역 vs 나쁜 번역" 쌍이 있어 품질 차이를 즉시 비교 가능.

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| Frontend | Vanilla JS (ES Modules), HTML/CSS |
| AI API | Claude API (`claude-opus-4-5`) |
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

## 배경

번역학 석사 과정 + AI 콘텐츠 품질 평가 실무(Coupang)의 교차점에서 출발한 프로젝트.

번역 품질을 판단하는 기준인 정확성·자연성·적절성 프레임워크를 AI 평가에 적용하고,
제약 도메인 SOP 문서를 다루는 실무 경험을 용어집 설계에 반영했습니다.

**AX(AI Transformation) Portfolio** | 2025
