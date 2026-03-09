# AX Checklist — Translation QA · Life Sciences Edition

> AI Experience(AX) 포트폴리오 구현 체크리스트
> Claude API를 활용한 도메인 특화 번역·품질 평가 시스템

---

## 1. Claude API 연동

| 항목 | 구현 여부 | 비고 |
|------|:---------:|------|
| Claude API 직접 호출 (브라우저 → API) | ✅ | `anthropic-dangerous-direct-browser-access: true` |
| 번역용 / 평가용 분리 호출 | ✅ | `translate()` · `evaluate()` 함수 분리 |
| 모델 지정 | ✅ | `claude-opus-4-5` |
| 에러 핸들링 (API 실패 시 사용자 알림) | ✅ | `showToast()` 오류 메시지 표시 |
| API 키 세션 저장 (재입력 방지) | ✅ | `sessionStorage` 활용 |

---

## 2. 프롬프트 엔지니어링

| 항목 | 구현 여부 | 비고 |
|------|:---------:|------|
| 역할 설정 (System Prompt) | ✅ | "Life Sciences 전문 번역가" 페르소나 부여 |
| 도메인 제약 조건 명시 | ✅ | 규제 문서 격식체 유지, 원문 추가 설명 금지 |
| 구조화된 출력 요청 (JSON) | ✅ | QA 평가 결과를 JSON 스키마로 강제 지정 |
| Few-shot 없이 Zero-shot 성능 확보 | ✅ | 명확한 채점 기준(1–5점)으로 일관된 출력 유도 |
| 용어집 동적 주입 | ✅ | 번역·평가 요청 시 관련 용어 목록을 User Message에 삽입 |
| 양방향 번역 지원 | ✅ | `ko→en` / `en→ko` 방향에 따라 프롬프트 분기 |

---

## 3. 도메인 특화 설계

| 항목 | 구현 여부 | 비고 |
|------|:---------:|------|
| Life Sciences 전문 용어집 내장 | ✅ | GMP / Clinical Trial / Regulatory / PV 4개 카테고리, 21개 용어 |
| 번역 결과의 용어 사용 자동 감지 | ✅ | `detectUsedTerms()` — 용어 뱃지로 시각화 |
| 용어 불일치 자동 감지 | ✅ | `detectMismatches()` — 원문-번역문 대조 테이블 |
| 사용자 커스텀 용어 추가 / 삭제 | ✅ | `localStorage` 영속 저장 |
| 번역학 3축 평가 프레임워크 적용 | ✅ | 정확성(Accuracy) · 자연성(Fluency) · 적절성(Adequacy) |

---

## 4. AI UX 패턴

| 항목 | 구현 여부 | 비고 |
|------|:---------:|------|
| 로딩 상태 피드백 (스피너 + 텍스트) | ✅ | "번역 중..." / "평가 중..." 버튼 상태 변경 |
| 워크플로우 연동 (번역 → QA 원클릭) | ✅ | "📊 QA 평가하기 →" 버튼으로 탭 간 데이터 전달 |
| 데모 모드 (API 키 없이 전체 기능 체험) | ✅ | Mock 데이터 + 1.5–2초 딜레이로 실제 API와 동일한 UX |
| 포트폴리오 방문자 자동 데모 시작 | ✅ | API 키 미저장 시 `init()`에서 자동 데모 모드 진입 |
| 샘플 데모 (Good vs. Bad 비교) | ✅ | 3개 샘플 × 좋은/나쁜 번역 즉시 실행 |
| 결과 복사 버튼 | ✅ | 번역 결과 / QA 결과 Clipboard 복사 |
| 토스트 알림 (성공 / 오류 구분) | ✅ | 색상 분리 (`--color-primary` / `--color-error`) |

---

## 5. 프론트엔드 아키텍처

| 항목 | 구현 여부 | 비고 |
|------|:---------:|------|
| ES Modules 구조 분리 | ✅ | `api.js` · `glossary.js` · `evaluator.js` · `app.js` |
| 빌드 도구 없이 GitHub Pages 배포 | ✅ | Vanilla JS, 번들러 미사용 |
| 반응형 레이아웃 (모바일 대응) | ✅ | `@media (max-width: 768px)` 브레이크포인트 |
| CSS 변수 기반 디자인 토큰 | ✅ | `base.css`에서 색상·간격·폰트 일괄 관리 |
| 상태 관리 (탭·방향·데모) | ✅ | 모듈 스코프 변수, 외부 라이브러리 미사용 |

---

## 6. 실제 활용 시나리오 검증

| 시나리오 | 검증 여부 | 설명 |
|----------|:---------:|------|
| GMP SOP 한→영 번역 | ✅ | 표준작업절차서, 일탈, CAPA 용어 자동 반영 |
| 임상시험 동의서 영→한 번역 | ✅ | 자발적 참여, SAE, 규제기관 용어 처리 |
| CAPA 보고서 한→영 번역 | ✅ | Deviation, 근본 원인 분석 용어 처리 |
| 나쁜 번역 QA 오류 감지 | ✅ | SOP→work instruction 등 용어 불일치 3건 감지 |
| 좋은 번역 QA 고득점 확인 | ✅ | 정확성·자연성·적절성 4–5점 수준 평가 |

---

## 데모 링크

🔗 **GitHub Pages**: `https://jhr122333.github.io/translation-qa/`
📂 **Repository**: `https://github.com/jhr122333/translation-qa`

> API 키 없이 바로 체험 가능 — 페이지 진입 시 데모 모드 자동 시작
