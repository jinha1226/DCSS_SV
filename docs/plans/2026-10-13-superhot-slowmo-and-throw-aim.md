# 구현계획서: 슈퍼핫 슬로모션 + 투척 타게팅

- 작성: Claude (검토 담당) · 구현: Codex
- 기준 커밋: `9df826b` (브랜치 `feat/dcss-sprites-in-3d`, main과 같음)
- 사용자 요청 원문
  - 6\. "슈퍼핫에서 손을 뗐을 때는 화면을 회색빛으로 바꾸고 시간이 천천히 흐르게 해줘."
  - 7\. "투척무기를 타게팅해서 던질 수 있게 해줘."
- 먼저 읽을 것: `docs/DEVELOPMENT_GUARDRAILS.md`. 특히 아래 규칙은 반드시 지킨다.
  - `src/sim`은 DOM과 캔버스를 모른다.
  - 파일 하나는 500줄까지(ESLint `max-lines`).
  - `npm run format` 후 `npm run check`와 `npx vite build`가 통과해야 한다.
  - 화면 전체가 번쩍이는 효과는 금지다.

---

## 0. 작업 범위 요약

| # | 무엇 | 어디를 바꾸나 |
|---|---|---|
| A | 슈퍼핫에서 입력이 없을 때 세계가 **멈추지 않고 느리게(0.15배)** 흐른다 | `src/app/main.ts`(스텝 루프), 새 상수 |
| B | 그동안 게임 화면이 **회색조**가 된다(UI는 그대로 컬러) | `src/app/main.ts`(클래스 토글), `src/styles/theme.css` |
| C | 느린 동안 3D 연출(애니메이션, 파티클)도 같은 배율로 느려진다 | `src/app/main.ts`의 draw 콜백에서 `dt` 배율 |
| D | 투척을 **조준해서** 던진다: 버튼/키를 누르면 조준 모드, 대상을 탭/클릭하면 그쪽으로 던진다 | `src/sim/types.ts`(Input), `src/sim/combat.ts`, `src/ui/throwButton.ts`, 새 `src/app/aiming.ts`, `src/view3d/effects.ts`(조준 원 재사용) |

---

## 1. 현재 코드 상태

### 1.1 스텝 루프와 슈퍼핫 (`src/app/main.ts`)

- `runLoop(step, draw)`(`src/app/loop.ts`)
  - 고정 `STEP`마다 `step()`을 부르고, 프레임마다 `draw(between)`를 부른다.
- `step` 안(현재 약 252~297행)의 흐름:
  - `spellButtons.takePress()`로 눌린 마법을 받는다.
  - 슈퍼핫이면 `spellButtons.beginTarget(id)`로 조준 모드에 들어간다. 실시간이면 `spellTarget`으로 자동 조준한다.
  - `input`을 만든다.
    - `throw: throwing.held || keys.has('Space') || keys.has('KeyJ')`
  - `active`는 이동, 투척, 도약, 마법, 계단 누름 중 하나라도 있으면 참이다.
  - 아래 조건이 **모두** 참일 때만 `stepWorld(world, input)`(고정 `STEP`)과 fx, `world3d.take`, `gameLog.take`, `pickups.take`를 실행한다.
    - `!ledger.open && !inventory.open && !skillBar.expanded && !gameLog.expanded && !spellButtons.targetingId && (!timeMode.superhot || active)`
  - 즉 **지금 슈퍼핫은 입력이 없으면 완전 정지**하고, 마법 조준 중에도 완전 정지한다.
- `stepWorld(w, input, dt = STEP)`(`src/sim/world.ts:434`)는 이미 `dt`를 받는다.
  - `src/sim` 안에 `STEP`을 직접 쓰는 곳은 없다(검색 확인 완료). 따라서 작은 `dt`로 불러도 규칙상 문제는 없어야 한다. 테스트로 확인할 것.
- `draw` 콜백(약 300~335행)은 실제 경과시간 `dt`를 계산해서 `world3d.render(..., between, dt, ctx)`에 넘긴다.
- 슈퍼핫 토글은 `src/ui/timeModeButton.ts`의 `timeMode.superhot`이다.

### 1.2 투척 (`src/sim/combat.ts`)

- `heroStrikes(w, dt, wantsThrow)`(약 272행)
  - `wantsThrow && h.throwing <= 0`이면 `throwNow(w)`를 부른다.
  - `stepWorld`에서 `heroStrikes(w, dt, input.throw === true)`로 불린다(`world.ts:460`).
- `throwNow(w)`(126행)
  - `rankedThrowTargets(w)`(64행)로 대상 목록을 만든다. 대상은 보이는 곳에 있고 사거리 안이며, 정렬은 깨어 있는 투척형 > 깨어 있음 > 잠듦, 그다음 거리순이다.
  - `throwing.double` 효과만큼 여러 대상에게 `makeThrowShot(w, target)`(104행)을 쏜다.
  - 탄약을 줄이고 쿨다운을 설정하고 `throw` 이벤트를 낸다.
- `makeThrowShot(w, target)`은 대상 위치로의 방향 벡터만 쓴다. 대상 객체는 방향 계산에만 쓰인다.
- `throwTarget(w)`(77행)은 외부 공개용으로, 1순위 대상을 돌려준다.

### 1.3 투척 버튼 (`src/ui/throwButton.ts`)

- 누르고 있는 동안 `held`가 참이다(포인터 캡처).
- `show(w)`는 탄약, 쿨다운, 활성 상태를 그린다.
- 키보드는 Space/J를 누르고 있으면 계속 던진다(main.ts의 `input.throw`).

### 1.4 마법 조준 흐름 (참고할 기존 패턴)

- `spellButtons.beginTarget/cancelTarget/targetingId`(`src/ui/spellButtons.ts`)
- main.ts의 `canvas` 리스너:
  - `pointermove`: `floorPoint(event)`(3D는 `world3d.pick`, 2D는 화면→셀 변환)으로 바닥 좌표를 얻는다. 그 좌표로 `spellAtPoint`를 구해 `aimFocus`를 갱신한다.
  - `pointerdown`(capture): 대상이 있으면 `queuedSpell`을 넣고 조준을 끝낸다.
- 조준 원 그리기는 `World3D.render`의 `view.targetingSpell`, `view.targets`, `view.focus`에서 `effects.showTargets(spell, targets, time, focus)`(`src/view3d/effects.ts:54`)로 간다.
  - `spell.colour`, `spell.radius`를 쓴다.
- main.ts는 지금 369행이다. 조준 코드를 더 넣으면 500행에 가까워지므로 **조준 입력은 새 파일로 뺀다**(아래 D-3).

---

## 2. 구현 방향

### A. 슈퍼핫 슬로모션

1. `src/data/json/dungeon.json`에 `"superhotSlow": 0.15`를 추가하고, `src/data/packs.ts`의 `DUNGEON` 객체(12행부터 필드를 하나씩 나열함)에 `superhotSlow: dungeonRaw.superhotSlow`를 더한다. 수치는 data 표에 둔다는 규칙 때문이다.
2. main.ts `step`의 조건을 두 가지로 나눈다.
   - `paused` = `ledger.open || inventory.open || skillBar.expanded || gameLog.expanded`
     - 창이 떠 있는 경우다. 지금처럼 **완전 정지**한다.
   - `slow` = `timeMode.superhot && !active`
     - 마법 조준 중(`spellButtons.targetingId`)과 투척 조준 중도 `active`가 아니므로 **느리게 흐른다**. 조준 중 완전 정지는 없앤다.
3. `!paused`이면 아래처럼 스텝한다.
   - `const scale = slow ? DUNGEON.superhotSlow : 1;`
   - `stepWorld(world, input, STEP * scale)`
   - `fx.step(STEP * scale)`
   - `stepPose(heroPose, heroSprites, world, STEP * scale)`
   - 나머지(`world3d.take`, `gameLog.take`, `pickups.take`)는 그대로 둔다.
4. 조준 중에는 `input`의 이동과 투척을 0으로 둔다. 지금도 `stick.enabled = !spellButtons.targetingId`로 막고 있는데, 투척 조준에도 같게 적용한다.

### B. 회색 화면

1. main.ts에서 매 스텝 `root.classList.toggle('slowmo', slow && !paused)`를 한다. 바뀔 때만 토글해도 된다.
2. `theme.css`에 아래를 추가한다.
   - 3D 캔버스(`canvas.world3d`)가 있으면 그것만, 없으면(2D 렌더러) `.game-canvas`에 `filter: grayscale(0.85) brightness(0.9)`를 건다.
   - `transition: filter 0.25s`로 부드럽게 바뀌게 한다(번쩍임 금지 규칙).
   - HUD, 버튼, 로그 같은 DOM UI에는 걸지 않는다.
   - 선택자 예: `#app.slowmo .game-canvas.world3d`, 그리고 2D일 때는 `#app.slowmo:not(:has(.world3d)) .game-canvas`.
3. `prefers-reduced-motion`이어도 회색 전환은 유지한다. transition만 0으로 한다.
4. 알려진 한계(검토 때 확인할 것): 조준 원도 3D 캔버스 안이라 회색이 된다. 색 구분이 꼭 필요하면 후속 작업으로 three.js 후처리 패스에서 조준 원 레이어만 제외하는 방안을 쓴다. 이번 범위는 아니다.

### C. 연출도 느리게

- draw 콜백에서 `world3d.render(..., dt * visualScale, ctx)`로 넘긴다.
  - `visualScale`은 마지막 스텝의 `scale` 값을 변수로 기억한 것이다.
- 2D 렌더러(`drawWorld`)도 `dt`를 쓰면 같게 적용한다.

### D. 투척 조준

**동작 정의**

| 상황 | 결과 |
|---|---|
| 투척 버튼 탭 / Space·J 한 번 누름 | 조준 모드 시작. 실시간·슈퍼핫 모두 해당 |
| 조준 중 몬스터 근처 탭/클릭 | 그 몬스터에게 던지고 조준 종료 |
| 조준 중 빈 바닥 탭/클릭 | 그 방향으로 던지고(사거리까지 날아감) 조준 종료 |
| 조준 중 투척 버튼 다시 탭 / Space·J 다시 누름 | 자동 1순위 대상에게 던지고(지금의 빠른 투척) 조준 종료 |
| 조준 중 Esc / 우클릭 / 조이스틱을 움직이기 시작함 | 조준 취소 |
| 탄약 0, 쿨다운 중, 투척 기술 없음 | 조준 모드에 들어가지 않는다(버튼 disabled 그대로) |

- 기존의 "누르고 있으면 연사"는 없앤다.
- 마법 조준 중에 투척 조준을 시작하면 마법 조준은 취소한다. 반대 경우도 같다. 조준은 하나만 활성화된다.

**D-1. sim (`src/sim/types.ts`, `src/sim/combat.ts`, `src/sim/world.ts`)**

1. `Input`에 `throwAt?: { readonly x: number; readonly y: number }`를 추가한다. 기존 `throw?: boolean`은 "자동 대상에게 지금 던지기"로 의미를 유지한다.
2. `heroStrikes(w, dt, wantsThrow, throwAt?)`로 인자를 확장한다.
   - `world.ts:460`에서 `input.throwAt`을 넘긴다.
3. `throwNow(w, at?)` 동작:
   - `at`이 없으면 지금과 같다.
   - `at`이 있으면:
     - `rankedThrowTargets(w)` 중 `at`에서 `max(0.9, m.stats.radius + 0.4)` 안에 있고 가장 가까운 몬스터를 1순위로 삼는다. 나머지 순위는 그대로 둔다(`throwing.double`용).
     - 그런 몬스터가 없으면 `at` 방향으로 1발을 던진다. 이를 위해 `makeThrowShot`을 방향(`dx, dy`)을 받는 형태로 바꾸고, 대상 버전은 그 위에 얹는다.
     - 대상이 하나도 없어도 `at`이 있으면 던질 수 있어야 한다(빈 바닥 투척). 지금은 `if (!targets.length) return;`으로 막혀 있다.
   - 쿨다운 중(`h.throwing > 0`)이면 `at` 입력은 무시한다. 이 경우 UI가 조준 모드를 유지하지 않도록 D-3에서 막는다.
4. 공개 함수 `throwAimTarget(w, x, y): Monster | undefined`를 추가한다. 위의 근처 몬스터 찾기와 같은 로직으로, UI의 하이라이트용이다.
5. 공개 함수 `throwCandidates(w): Monster[]`(= `rankedThrowTargets`)를 추가한다. 조준 원 표시용이다.

**D-2. 투척 버튼 (`src/ui/throwButton.ts`)**

- `held` 대신 `takePress(): boolean`(눌림 1회 소비)과 `aiming: boolean` 표시용 setter를 둔다.
  - `pointerdown`에서 눌림을 기록한다.
- 조준 중에는 `button.classList.toggle('targeting', aiming)`로 마법 버튼과 같은 스타일을 쓴다. `theme.css`의 `.spell-buttons button.targeting` 규칙을 `.throw-button.targeting`에도 적용한다.

**D-3. 조준 입력 모듈 (새 파일 `src/app/aiming.ts`)**

- main.ts의 마법 조준 포인터 코드(`pointermove`/`pointerdown`, `floorPoint`, `aimFocus`)를 이 파일로 옮긴다. 투척 조준도 같은 곳에서 처리한다.
- 인터페이스 예:

  ```ts
  type Aim = { kind: 'spell'; id: string } | { kind: 'throw' };
  interface Aiming {
    readonly current: Aim | undefined;
    readonly focus: Monster | undefined;
    begin(aim: Aim): void;
    cancel(): void;
    /** step에서 한 번 읽는다: 확정된 마법 시전이나 투척 지점. */
    take(): { spell?: { id: string; x: number; y: number }; throwAt?: { x: number; y: number } };
  }
  function makeAiming(canvas, floorPoint, getWorld, spellButtons): Aiming
  ```

- `spellButtons.targetingId`는 계속 쓰되, 시작과 취소는 `Aiming`을 거친다.
- 키 처리:
  - Space/J는 `keys` 집합이 아니라 keydown **엣지**(눌린 순간)로 읽어야 한다. `src/input/keys.ts`에 `takeTap(code)` 같은 엣지 소비 함수를 추가한다.
  - Esc는 조준을 취소한다. 지금 Esc는 ledger에서도 쓰므로 ledger가 열려 있으면 ledger 쪽이 우선이다.
- 조이스틱이나 이동 키 입력 크기가 0.3을 넘으면 투척 조준을 취소한다(이동하려는 의도).

**D-4. 조준 원 (`src/view3d/effects.ts`, `World3D.render`의 `View3D`)**

- `View3D`에 `throwAim?: { targets: readonly Monster[]; focus?: Monster }`를 추가한다.
- `Effects.showTargets`를 일반화하거나 투척용 호출을 하나 더 둔다.
  - 색: 투척은 `#ffff55`(DCSS 노랑).
  - 반경: `m.stats.radius + 0.35`.
  - 마법과 동시에 보이지 않으므로 같은 원 풀을 써도 된다.
- 2D 렌더러(`src/view/render.ts`/`fx`)에 조준 원이 있다면 같은 정보를 넘긴다. 없으면 3D만 해도 된다(2D는 디버그용 `?r=2d`).

---

## 3. 테스트 (vitest, `tests/unit`)

1. `superhot` 관련(sim만 사용):
   - 같은 시드의 세계 둘을 만든다. 하나는 `stepWorld(w, STILL, STEP)`을 10번, 하나는 `stepWorld(w, STILL, STEP*0.15)`를 10번 돌린다.
   - 몬스터가 영웅에게 다가간 거리가 뒤쪽이 대략 0.15배인지 확인한다(`arena` + 몬스터 하나 배치, `tests/unit/arena.ts` 참고).
   - `w.time` 증가량이 `0.15 * 10 * STEP`인지 확인한다.
2. `throwAt`:
   - 몬스터 두 마리(가까운 것, 먼 것)를 두고 `throwAt`을 먼 몬스터 위치로 준다. 첫 `shot`의 속도 벡터가 먼 몬스터 쪽인지 확인한다.
   - 몬스터가 없을 때 `throwAt`을 주면 탄약이 1 줄고 shot이 그 방향으로 생기는지 확인한다.
   - `throwAt` 없이 `throw: true`이면 기존처럼 1순위 대상에게 가는지 확인한다(회귀).
   - 쿨다운 중에는 `throwAt`이 무시되는지 확인한다.
3. `throwAimTarget`: 지점 근처의 몬스터를 고르고, 너무 멀면 `undefined`를 돌려주는지 확인한다.
4. 기존 테스트 310개가 모두 통과해야 한다. 투척 관련 기존 테스트가 `input.throw` 연사를 가정한다면 의미에 맞게 고친다.

## 4. 수동 확인(스크린샷으로 검토할 것)

- PC 1280×800과 폰 390×844 각각에서 확인한다.
  1. 슈퍼핫을 켜고 손을 떼면 게임 화면만 회색이 되고, 몬스터가 느리게 다가온다. 이동하면 컬러로 돌아오고 정상 속도가 된다.
  2. 마법 조준 중에도 느리게 흐르고 회색이다.
  3. 투척 버튼 탭 → 노란 조준 원 → 몬스터 탭 → 그 몬스터에게 부메랑이 날아간다.
  4. 빈 바닥 탭 → 그 방향으로 날아간다.
  5. 버튼을 두 번 탭하면 자동 대상에게 던진다.
- 기존 확인 스크립트(`/mnt/d/PROJ_SV/art3d/tools/themeshot.mjs`, `kill.mjs`)를 참고해서 확인용 스크립트를 만들어도 된다.

## 5. 완료 조건

- [ ] `npm run format`, `npm run check`(lint+tsc+test), `npx vite build` 통과
- [ ] 새로 바꾼 파일 모두 500줄 이하. main.ts는 오히려 줄어야 한다(조준 코드 이동).
- [ ] `src/sim`에 DOM 의존이 없다.
- [ ] 커밋 하나로 정리한다. 메시지 예: `feat: superhot slow-motion in grey, aimed throwing`
- [ ] push는 하지 않는다. Claude 검토 후에 올린다.
