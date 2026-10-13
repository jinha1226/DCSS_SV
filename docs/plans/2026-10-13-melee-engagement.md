# 근접 공격 즉시 판정과 교전 감속 구현계획서

작성일: 2026-10-13
대상: Codex 구현, Claude 검토
선행 커밋: main 최신 (310cf3f 이후)

## 1. 요구사항 (사용자)

> 데미지를 무조건 주고받는 상황이 생겨야 하는데 지금은 안 된다.

1. **근접 공격의 준비 동작(windup)을 없앤다.** 몬스터는 사거리 안에 주인공이 있으면 일정 간격으로 바로 때린다. 모션이 잘 안 보여서 미리 보고 피하는 구조가 의미 없다.
2. **교전 감속**: 근접 몬스터의 사거리 안에 있는 동안 주인공 이동 속도가 느려진다. 무기 종류와 상관없이 거리로 판정한다.
3. 교전에서 벗어나는 방법은 "사거리 밖으로 나가기"다. 나가는 순간 원래 속도로 돌아온다. 빠져나가는 동안 공격 간격이 차면 한 대 맞을 수 있다.

## 2. 현재 코드 (조사 결과)

### 2.1 몬스터 공격 흐름

- `src/sim/ai/actions.ts:22`: `visible && ready && d <= reach`이면 `'melee'` 후보가 된다. `ready`는 `monster.rest <= 0`이다(`context.ts:48`).
- `src/sim/ai/executor.ts`
  - `executeMonsterAction`: melee, ranged, spell, item을 고르면 `m.attackMode`를 정하고 `m.wind = m.stats.windup`으로 준비 동작을 시작한다. 그동안 멈춰 선다(STILL).
  - `continueMonsterAction`: `m.wind`가 0 아래로 떨어지면 `finishMonsterAttack`을 부른다.
  - `finishMonsterAttack`: 근접 공격은 **그 순간** `d <= reach + GRACE(0.12)`일 때만 `hurtHero`가 맞는다. 독이나 조이기도 여기서 걸린다. 끝나면 `m.rest`를 정하고, flit(때리고 물러나기)을 건다.
  - **문제**: 준비 동작(0.18–0.85초) 사이에 한 발만 물러나면 근접 공격이 전부 빗나간다.
- `src/data/dcssTime.ts` `monsterTiming`: `rest = max(minRest, monsterAttack * turns(cost) - windup)`이다.
  - 준비 동작 + 쉬는 시간이 합쳐서 DCSS 공격 1회의 시간이 되도록 windup을 **빼 두었다**.
  - restMissile과 restSpell도 같은 방식이다.
- 준비 동작을 끊는 곳(`m.wind = -1`): `monster.ts` 기절·공포·혼란(100, 107, 112행), `combat.ts:387` 뿔 박치기, `traits.ts:31` 박치기 반격.
- 그림
  - 2D `src/view/render.ts:116`: `m.wind >= 0`이면 뒤로 젖혔다 찌르는 기울임을 그린다.
  - 3D `src/view3d/world3d.ts:411`: `m.wind`가 시작될 때 `actor.attack(windup + 0.15)`를 부른다.

### 2.2 주인공 이동

- `src/sim/world.ts` `walkHero` 부근(355행): `speed = heroSpeed(w) * slow`이다. `slow`는 물(0.7)과 조이기(0.45)의 곱이다.
- `src/sim/skills.ts:207` `heroSpeed`: 종족 속도 × 회피 기술, 무기 옵션, 부위, 가속, 버프 보정.
- 속도 수치: 몬스터 기본 이동은 4.4칸/초(`dungeon.json` dcssTime.monsterMove, DCSS 속도 10 기준)다. 주인공은 미노타우로스·딥엘프 6.5, 바라치 5.4다.
  - -30%면 6.5 → 4.55가 되어 보통 속도 몬스터보다 조금 빠르다. 그래서 걸어서 빠져나갈 수 있다.
  - 자칼(14), 늑대(17), 박쥐(30)처럼 빠른 적은 걸어서 못 떨친다. 의도한 대로다.
- 도약(`src/sim/hop.ts` `tryHop`)은 **바라치 종족 특성**(`hopTrait`)이다. 모든 캐릭터가 쓰는 것은 아니다.

### 2.3 봇 측정

- `tests/bench/bots.ts` `RunResult`에 seconds, kills, hp, fell, depth, won, level 등이 있다. **받은 피해 합계는 없다.**

## 3. 구현 방향

### 3.1 근접 공격: 준비 동작 없이 바로

- `executeMonsterAction`에서 `'melee'`를 고르면 `m.wind`를 걸지 않고 **그 자리에서** 근접 공격을 끝낸다.
  - 같은 프레임에 `finishMonsterAttack(context)`을 부르는 방식으로 한다. 반환은 STILL이다.
  - ranged, spell, item은 **지금처럼 준비 동작을 유지한다.** 투사체와 주문은 피하라고 있는 공격이고, 준비 동작이 예고 역할을 한다.
- 처음 붙는 순간의 틈(첫 접촉 지연)
  - 몬스터가 근접 사거리에 **새로 들어온** 시점부터 `DUNGEON.melee.firstContact`(0.2초)가 지나야 첫 근접 공격을 할 수 있다.
  - 구현 예: Monster에 `contact: number` 필드를 둔다(사거리 안에 연속으로 있은 시간). monster step에서 `d <= reach`면 `+= dt`, 아니면 0으로 둔다. melee 후보 조건에 `m.contact >= firstContact`를 더한다.
  - `rest`가 이미 남아 있으면 그것이 우선한다. 두 조건이 모두 만족돼야 때린다.
- `finishMonsterAttack`의 근접 판정 `d <= reach + GRACE`는 그대로 둔다. 즉시 판정이므로 사실상 항상 맞는다.
- 공격 간격 유지
  - 근접 쉬는 시간은 `monsterAttack * turns(attack)` **전체**로 바꾼다. windup을 빼지 않는다. 그래야 초당 공격 횟수가 지금과 같다.
  - `monsterTiming`에서 `rest`(근접)만 windup을 빼지 않게 하고, `restMissile`과 `restSpell`은 지금처럼 뺀다.
  - `MonsterTiming.rest` 주석도 고친다.
  - 관련 단위 테스트(dcssTime 등)가 있으면 기대값을 새 규칙으로 고친다.
- `monsters.json`의 `windup`은 원거리, 주문, 아이템 준비 시간으로 계속 쓴다. 데이터 설명(note)이 있으면 "근접에는 쓰지 않음"을 적는다.
- 끊기 효과(`m.wind = -1`)는 그대로 둔다. 원거리와 주문에는 여전히 의미가 있다.
- 그림
  - 근접 공격이 맞는 순간 몬스터가 앞으로 찌르는 동작을 보여 준다.
  - 3D: world3d의 `m.wind >= 0` 분기는 원거리·주문용으로 남긴다. 근접은 공격 이벤트(이미 `hurtHero`가 내는 피격 이벤트나 새 `{type:'monsterStrike', ...}` 중 기존에 있는 것)로 `actor.attack(0.25)`를 부른다. 이미 비슷한 이벤트가 있으면 재사용한다.
  - 2D: `render.ts`의 기울임도 원거리·주문 준비 동작에만 쓰인다. 근접은 맞는 순간 짧게(0.12초) 앞으로 찌르는 오프셋을 준다. Monster에 `lunge` 타이머를 두거나 기존 `flash` 같은 타이머 방식을 따른다.

### 3.2 교전 감속

- 판정: 살아 있고 깨어 있으며 근접 공격을 하는 몬스터 중, 주인공과의 거리가 `그 몬스터의 근접 reach + GRACE` 이하인 것이 하나라도 있으면 **교전 중**이다.
  - 근접을 하지 않는 순수 원거리나 주문 전용 몬스터는 제외한다. 기준은 데이터에서 근접 공격이 있는지로 판단하고, 기존 필드를 찾아 쓴다.
  - 기절이나 공포 상태인 몬스터, 아군·소환수(있다면)는 제외한다.
- 효과: `walkHero`의 `slow`에 `DUNGEON.melee.engagedSlow`(0.7, 즉 -30%)를 곱한다. 물과 조이기와 곱으로 겹친다.
- 사거리 밖으로 나가면 다음 스텝부터 바로 원래 속도다. 교전 상태를 따로 오래 저장하지 않는다. 판정은 매 스텝 계산한다(`heroEngaged(w): boolean`, `src/sim/` 적절한 곳).
- 도약: 바라치 도약의 이동량은 이 감속을 받지 않는다(도약은 걷기 경로가 아니라 이미 그럴 수도 있다. 확인만 하고 필요하면 예외를 둔다).
- UI(작게)
  - 교전 중임을 알 수 있게 3D와 2D 모두 주인공 발밑 원을 붉게 바꾸거나, HUD에 작은 `교전` 표시를 띄운다.
  - 기존 구조에서 가장 작은 변경으로 하나만 고른다. 마지막 메시지에 무엇을 골랐는지 적는다.

### 3.3 데이터

`src/data/json/dungeon.json`에 다음을 추가하고 `src/data/packs.ts`의 `DUNGEON`과 `validate.ts` 검사에 반영한다.

```json
"melee": {
  "note": "근접 공격은 준비 동작 없이 바로 맞는다. firstContact는 사거리에 처음 들어온 뒤 첫 공격까지의 초, engagedSlow는 근접 적 사거리 안에서의 이동 속도 배율",
  "firstContact": 0.2,
  "engagedSlow": 0.7
}
```

### 3.4 봇 측정에 받은 피해 추가

- `RunResult`에 `taken`(그 판에서 주인공이 받은 피해 합계)을 추가한다.
  - `hurtHero`가 이미 내는 이벤트(피해량 포함)를 bots의 play 루프에서 모아 더한다. 이벤트에 피해량이 없으면 스텝 전후 hp 차이로 센다. 회복과 섞이지 않게 감소분만 센다.
- `summary`에 `taken`의 평균을 넣는다.

## 4. 테스트

- 근접 몬스터가 사거리에 들어온 뒤 `firstContact` 전에는 안 때리고, 지나면 **같은 스텝에** 피해가 들어간다(준비 동작 없음).
- 주인공이 매 스텝 바로 뒤로 물러나도(사거리 경계에서 왔다 갔다), 사거리 안에 있는 동안 공격 간격마다 피해가 들어간다. 기존에는 빗나가던 상황이다.
- 근접 공격 간격(초당 횟수)이 바뀌기 전과 같다. 예: 쥐의 두 공격 사이 시간이 `monsterAttack * 10 / dcssSpeed`와 같다.
- 원거리와 주문은 여전히 `windup` 동안 준비하고, 끝날 때 쏜다(기존 테스트 유지).
- 교전 감속
  - 근접 몬스터 사거리 안에서는 같은 입력에 대한 이동 거리가 0.7배다.
  - 밖에서는 1배다.
  - 기절한 몬스터 옆에서는 1배다.
- 기존 테스트 중 windup 근접 동작을 전제한 것은 새 규칙에 맞게 고친다. 어떤 테스트를 왜 고쳤는지 마지막 메시지에 적는다.

## 5. 봇 측정 (Codex가 실행)

- 바뀌기 전 main과 바뀐 뒤를 같은 조건으로 각각 `npm run bench`로 돌린다. 클리어 수, 평균 레벨, 처치, **받은 피해**, 사망 수를 비교한다.
- 다른 작업과 동시에 돌리면 시간 초과가 나므로 하나씩 돌린다. 시간 초과가 나도 출력된 숫자를 그대로 보고한다.
- 바뀌기 전 수치는 이 변경을 넣기 전 상태(`git stash`를 쓰지 말고, 변경 전에 먼저 돌려 둔다)로 측정한다.

## 6. 완료 조건

- `npm run format`, `npm run check`, `npx vite build`가 통과한다.
- **git 커밋은 하지 말고 변경을 작업 트리에 남긴다.** `npm ci`는 실행하지 않는다.
- 마지막 메시지(한국어)에 다음을 적는다.
  - 바꾼 파일 목록
  - 고친 기존 테스트와 이유
  - 교전 표시로 고른 방식
  - 봇 측정 전후 비교표
  - 계획과 다르게 판단한 점
