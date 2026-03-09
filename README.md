# Translation QA — Life Sciences Edition

## 소개

제약·바이오 업계의 번역 품질 관리 문제를 해결하기 위한 인하우스 경량 번역 + QA 통합 데모.
번역학 프레임워크(정확성·자연성·적절성)와 Claude API를 결합해 전문 용어 일관성을 자동으로 보장.

## 핵심 기능

- **용어집 기반 번역**: GMP·임상시험·규제·PV 용어 21개 내장, 번역 시 자동 반영
- **3축 품질 평가**: 정확성(Accuracy) / 자연성(Fluency) / 적절성(Adequacy)
- **용어 불일치 자동 감지**: 번역 결과와 용어집 대조
- **번역 → QA 원클릭 연동**: 번역 결과를 QA 탭으로 즉시 전달
- **사용자 커스텀 용어 추가/삭제**
- **샘플 데모**: 좋은 번역 vs 나쁜 번역 즉시 비교

## 기술 스택

Vanilla JS (ES Modules) · Claude API (claude-opus-4-5) · GitHub Pages
