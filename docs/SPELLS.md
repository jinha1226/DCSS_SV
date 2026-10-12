# 주문 데이터 구조

주문은 `src/data/json/spells.json`에 정의한다. 원작 DCSS의 학파 구분을 참고하되 효과와 수치는 직접 설계한다.

> **현재 규칙은 맨 아래 두 절("장비 기반 단일 학파", "마법 63개와 새 필드")이다.** 바로 아래의 `schools`·`requirements`·복합 학파 설명과 `conjuration` 예시는 이전 구조이며 지금은 쓰지 않는다. 주문마다 `school` 하나만 가진다.

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
- 학파 필요 레벨은 `requirement ?? max(0, spellRequirementStep × (level - 2))`로 계산한다(2026-10-12에 `level - 1`에서 바꿈). 현재 단계 계수는 `dungeon.json`의 3이다.
- 1·2레벨 주문은 학파 레벨 0에서 사용 가능하다. 잠긴 주문은 UI에 필요 학파 레벨을 표시한다.
- (지난 기록) 임시 분류였던 마법 12개는 마법 63개 설계로 대체됐다.
- 장착한 지팡이·마법서만 버튼 주문을 주며, 마법봉은 자동 공격만 준다.

## 마법 63개와 새 필드 (2026-10-12, [MAGIC_DESIGN.md](MAGIC_DESIGN.md))

- 학파 7개 × 1~9레벨. `auto: true`는 1·4·7레벨에만 있고 MP가 0이다(지팡이·마법봉의 자동 공격). 나머지는 버튼 마법이고 `cooldown`(초)이 반드시 있다.
- `enabled`: 동작이 구현된 마법만 `true`. 켜진 마법은 `projectile`, `beam`, `burst`, `cloud`, `utility`(effect `blink`, `guard`) 중 하나여야 한다. 예약 모양: `chain`, `cone`, `aura`, `buff`, `mark`, `storm`, `delayed`, `field`, `terrain`, `summon`, `construct`, `debuff`, `teleport`.
- `element`: `fire`, `cold`, `electric`, `poison`, `negative`. 없으면 물리(갑옷 적용).
- `monsterMana`: 몬스터가 낼 MP. 없으면 `mana`.
- 필요 학파 레벨: `requirement ?? max(0, 3 × (level − 2))`.
- `onHit: { effect, power?, duration?, damage? }`: 맞힌 몬스터에 거는 부가 효과. effect는 `slow`(power=느려지는 비율), `stun`, `confuse`, `vulnerable`(power=추가 피해 비율), `rot`(power=갑옷 감소, damage=초당 피해), `poison`·`burn`(power=초당 피해), `knockback`·`pull`(power=미는 속도), `drain`(power=회복 비율).
- `buff`: 자신에게. effect `armour`(power=갑옷), `speed`(power=이동 속도 비율). `debuff`: 대상 주변 `radius` 안. effect `freeze`(기절), `confuse`, `rot`.
- 기본 `damage`가 없거나 0인 마법은 학파 레벨이 올라도 피해가 0이다.
