# 주문 데이터 구조

주문은 `src/data/json/spells.json`에 정의한다. 원작 DCSS의 학파 구분을 참고하되 효과와 수치는 직접 설계한다.

- `schools: string[]`: 학파 한 개 이상. 복합 학파는 모두 충족해야 해금된다.
- `level: 1..7`: 기본 해금 단계. `requirements`가 없으면 모든 학파에서 이 단계가 필요하다.
- `requirements?: Record<string, number>`: 복합 학파별 요구 단계. 지정할 때는 `schools`의 모든 학파를 적는다.
- `mana`, `shape`, `colour`: 소모 마나, 주문 형태, 효과 색.
- `damage`, `range`: 직접 공격하는 주문에만 필수. 보조 주문은 생략할 수 있다.
- `speed`, `radius`, `duration`, `tick`, `pierce`: 기존 투사체/광선/범위/구름 옵션.
- `targets`, `chainRadius`, `effect`, `distance`: 연쇄/보조 효과 확장용.

지원 중인 `shape`: `projectile`, `beam`, `burst`, `cloud`, `utility`.
데이터 형식만 예약한 형태: `chain`, `summon`, `construct`, `debuff`, `teleport`. **동작 구현 전에는 이 형태의 주문이 전투에 나오지 않는다.**

예시 (새 주문을 게임에 추가한 것은 아님):

```json
{
  "id": "chain_lightning",
  "name": "연쇄번개",
  "schools": ["air", "conjuration"],
  "requirements": { "air": 7, "conjuration": 5 },
  "level": 7,
  "mana": 16,
  "shape": "chain",
  "damage": 18,
  "range": 7,
  "targets": 5,
  "chainRadius": 3,
  "colour": "#dce8ff"
}
```

추가 학파를 활성화하려면 해당 스킬을 `skills.json`에 정의하고 주문 실행 로직도 구현해야 한다.

## 장비 기반 단일 학파 (2026-10-12)

- 각 주문은 단일 `school` 속성만 가진다. 다중 학파와 실패율은 없다.
- 학파 필요 레벨은 `requirement ?? max(0, spellRequirementStep × (level - 1))`로 계산한다. 현재 단계 계수는 `dungeon.json`의 3이다.
- 1레벨 주문은 학파 레벨 0에서 사용 가능하다. 잠긴 주문은 UI에 필요 학파 레벨을 표시한다.
- 현재 분류는 임시: 마력침·집광선 → 대기, 파동탄 → 화염, 분광창 → 빙결, 중력꽃·붕괴장 → 대지, 공허폭발 → 강령, 점멸·위상막 → 주술. 새 주문 설계는 하지 않았다.
- 장착한 지팡이·마법서만 버튼 주문을 주며, 마법봉은 자동 공격만 준다.
