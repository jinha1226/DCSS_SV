# 문서 안내

문서가 여러 번의 방향 전환을 거치며 쌓였다. 두 문서가 어긋나면 **위쪽 묶음이 맞다.** 아래 "지난 기록"은 당시 판단을 남긴 것이라 지금 코드와 다를 수 있다.

## 지금 기준 (작업 전에 읽는다)

| 문서 | 내용 |
| --- | --- |
| [ROADMAP.md](ROADMAP.md) | **큰 방향과 전체 로드맵**: 타겟, 배포 단계(웹 알파 → 레딧 → 스팀), DCSS 데이터 적용 규칙, 아직 없는 시스템(저장·신앙·다국어·몬스터 등), 다음 구현계획서 순서 |
| [DEVELOPMENT_GUARDRAILS.md](DEVELOPMENT_GUARDRAILS.md) | 작업 규칙과 불변 조건. 코드를 고치기 전에 반드시 읽는다 |
| [IMPLEMENTATION_2RUNE.md](IMPLEMENTATION_2RUNE.md) | 현재 로드맵(24층·2룬, 01~08 단계)과 진행·검증 기록 |
| [SKILL_TRAINING.md](SKILL_TRAINING.md) | 현재 성장 기획: 스킬 20개(상한 27), 주손/보조손, 장비 기반 훈련, 레벨업 보상(부위 강화·획득). §6에 사용자가 정할 것. 구현계획은 [plans/2026-10-13-level27-slot-enhancement.md](plans/2026-10-13-level27-slot-enhancement.md) |
| [IMPL_EQUIPMENT_TRAINING.md](IMPL_EQUIPMENT_TRAINING.md) | 위 기획의 구현 지시서와 "이번 범위가 아닌 것" |
| [MAGIC_DESIGN.md](MAGIC_DESIGN.md) | 마법 설계 초안: 7학파 × 9마법, 새 동작 묶음, 정할 것 |
| [AUTOMATIC_GROWTH.md](AUTOMATIC_GROWTH.md) | 자동 성장 1차 설계. 겹치는 부분은 SKILL_TRAINING.md가 우선 |
| [UI_BACKLOG.md](UI_BACKLOG.md) | 보류한 UI 정리 목록 |

## 데이터와 시스템 설명

| 문서 | 내용 |
| --- | --- |
| [ITEMS.md](ITEMS.md) | 아이템 JSON 구조, 마법 장비와 보조손 |
| [SPELLS.md](SPELLS.md) | 주문 JSON 구조, 단일 학파와 필요 레벨 |
| [DAMAGE.md](DAMAGE.md) | 물리·속성 피해와 저항 |
| [utility-ai.md](utility-ai.md) | 몬스터 Utility AI와 공용 효과 처리 |
| [SPECIES.md](SPECIES.md) | 종족 27종 설계 목록(플레이 가능 3종) |
| [TILES.md](TILES.md) | 타일 출처, 라이선스 대조, 타일 더하는 법 |

## 지난 기록 (참고용)

| 문서 | 무엇이 바뀌었나 |
| --- | --- |
| [PLAN.md](PLAN.md) | 첫 시험판(3층, 5분, 스킬 카드) 계획. 기술 선택과 코드 구조 설명은 아직 유효 |
| [PLAN2.md](PLAN2.md) | 6~13단계 계획. 던전 구성은 IMPLEMENTATION_2RUNE.md, 성장은 SKILL_TRAINING.md로 넘어감 |
| [CODEX_PROMPT.md](CODEX_PROMPT.md) | 3단계 인수인계. 유효한 규칙은 DEVELOPMENT_GUARDRAILS.md §6으로 옮김 |
| [STAGE4.md](STAGE4.md), [STAGE5.md](STAGE5.md), [STAGE7.md](STAGE7.md), [STAGE8.md](STAGE8.md), [STAGE10.md](STAGE10.md) | 단계별 지시서. 스킬 카드·적성 6단계 제한 등은 폐기됨 |
| [AUDIT_RECENT_CHANGES.md](AUDIT_RECENT_CHANGES.md) | 2·3단계 점검. 지적 사항은 PR #2 이후 해결 |
