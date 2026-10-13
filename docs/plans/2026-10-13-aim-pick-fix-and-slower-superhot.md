# 조준 좌표 오류 수정과 슈퍼핫 감속 조정 구현계획서

작성일: 2026-10-13
대상: Codex 구현, Claude 검토
선행 커밋: 6258753 (touch-friendly aiming, `src/app/aimState.ts`)

## 1. 요구사항 (사용자)

1. "던지기 타겟 선택이 잘 안 된다. 엉뚱한 곳으로 날아간다." → 탭·클릭한 몬스터를 정확히 고르게 한다.
2. "슈퍼핫 모드를 조금 더 느리게" → 손을 뗐을 때 흐르는 속도를 0.15배에서 **0.06배**로 낮춘다.

## 2. 원인 분석 (현재 코드)

### 2.1 원인 A — 화면 좌표의 배율이 3D 캔버스와 다르다 (핵심 버그)

- `src/app/aiming.ts`의 `makeFloorPoint`는 다음처럼 동작한다.
  ```ts
  const sx = (event.clientX - rect.left) * (canvas.width / rect.width);
  const sy = (event.clientY - rect.top) * (canvas.height / rect.height);
  if (world3d) return world3d.pick(sx, sy);
  ```
  - `canvas`는 2D 오버레이 캔버스다.
  - main.ts `fit()`에서 `canvas.width = clientWidth * dpr`로 정한다. dpr은 최대 3이다.
- `src/view3d/world3d.ts:169` `pick(px, py)`는 `px / this.canvas.width`로 NDC를 만든다.
  - `this.canvas`는 **3D 캔버스**다.
  - 3D 캔버스의 픽셀 배율은 `resize()`에서 `Math.min(dpr, quality==='high' ? 2 : 1.25)`이다. 2D 캔버스와 다르다.
- 결과: devicePixelRatio가 1.25를 넘는 기기에서는 NDC가 dpr/1.25배만큼 부풀어, 클릭 지점이 화면 가운데(주인공)에서 바깥으로 밀려난다.
  - 휴대폰(dpr 3)이나 고해상도 노트북(dpr 1.5–2)이 해당된다.
  - 예: dpr 3이면 2.4배 밀려난다.
  - 그래서 대상 근처 판정에 실패하고, 엉뚱한 바닥 방향으로 날아간다.
- 마법 조준(`spellAtPoint`)도 같은 좌표를 쓰므로 같은 버그가 있다.

### 2.2 원인 B — 몬스터 몸을 탭해도 바닥은 그 뒤쪽이다

- `pick`은 y=0 바닥 평면과 광선의 교점을 돌려준다.
- 카메라는 56° 내려다보고, 몬스터 그림(TileFigure/모델)은 바닥 위로 약 1칸 높이로 서 있다.
- 그래서 몬스터의 몸통이나 머리를 탭하면 바닥 교점이 몬스터 발밑보다 **화면 위쪽(뒤쪽)으로 0.5–1칸** 떨어진다.
- 판정 반경 `max(0.9, radius+0.4)` 경계에서 자주 빗나간다.

## 3. 구현 방향

### 3.1 화면 좌표를 정규화 좌표로 넘긴다 (원인 A)

- `World3D.pick(px, py)` 시그니처를 `pick(u: number, v: number)`로 바꾼다.
  - `u, v`는 0–1 범위의 정규화 좌표다. 캔버스 왼쪽 위가 (0, 0)이다.
  - NDC는 `(u*2-1, -(v*2-1))`로 만든다.
  - 주석에 "u, v are fractions of the canvas box"라고 적는다.
- `makeFloorPoint`는 다음처럼 바꾼다.
  - `u = (clientX - rect.left) / rect.width`, `v = (clientY - rect.top) / rect.height`
  - 3D면 `world3d.pick(u, v)`를 부른다.
  - 2D 경로는 기존처럼 `canvas.width` 픽셀로 계산한다. 2D는 같은 캔버스에 그리므로 맞다.
- 2D 오버레이 캔버스와 3D 캔버스가 화면에서 같은 사각형을 덮는지 확인한다(CSS `.game-canvas`).
  - 다르면 3D 쪽 rect(`world3d` 캔버스의 `getBoundingClientRect()`)를 기준으로 계산한다.
- `pick` 다른 호출처가 있으면 모두 같은 규칙으로 바꾼다. 현재는 aiming.ts 한 곳뿐이다.

### 3.2 몬스터는 화면 공간에서 고른다 (원인 B)

- `World3D`에 메서드를 추가한다.
  ```ts
  /** Where a point above the floor lands on the canvas, as fractions of the canvas box. */
  project(x: number, z: number, height: number): { u: number; v: number } | undefined
  ```
  - `new THREE.Vector3(x, height, z).project(this.camera)`의 NDC를 u, v로 바꾼다.
  - 카메라 뒤(`z > 1`)면 `undefined`를 돌려준다.
- 조준 대상 선택 함수(순수 함수)를 `src/app/aimState.ts`에 추가하거나 같은 폴더의 새 파일로 둔다.
  ```ts
  export function nearestOnScreen(
    candidates: readonly Monster[],
    pointer: { u: number; v: number },
    project: (m: Monster) => { u: number; v: number } | undefined,
    aspect: number,          // rect.width / rect.height, 가로 세로 거리 보정용
    maxDistance: number,     // 정규화 거리 한계(세로 기준), 기본 0.07
  ): Monster | undefined
  ```
  - 각 후보를 투영할 때 발밑(height 0)과 몸통 중심(height 0.55)을 둘 다 계산한다. 그 둘을 잇는 선분까지의 거리로 판정해, 머리를 탭해도 발을 탭해도 잡히게 한다.
  - 거리는 `du * aspect, dv`의 유클리드 거리로 잰다.
  - `maxDistance` 안에서 가장 가까운 후보를 고른다.
  - 2D 렌더러에는 `project`를 2D 셀 좌표 변환으로 넘긴다. 이때 height는 무시한다.
- aiming.ts에서 hover, press, drag 때 후보를 고르는 방식을 바꾼다.
  1. 먼저 `nearestOnScreen`으로 몬스터를 찾는다.
     - 후보 목록은 투척이면 `throwCandidates(w)`, 마법이면 `spellCandidates(w, spell)`이다.
  2. 찾으면 그 몬스터를 focus로 둔다. 확정 결과는 몬스터 좌표로 한다(`throwAt = {x: m.x, y: m.y}` 또는 spell target).
  3. 못 찾으면 기존처럼 바닥 좌표(`floorPoint`)로 `throwAimTarget`/`spellAtPoint`를 시도한다. 그래도 없으면 투척은 빈 바닥 투척을 한다.
- aimState의 순수 함수(`aimPress`/`aimDrag`/`aimHover`)가 지금 `point`만 받는다면, 선택적 인자 `picked?: Monster`를 추가한다. picked가 있으면 그것을 우선한다.
  - 테스트 가능성을 유지하기 위해서다.
- 2D 렌더러에서도 같은 함수를 쓴다(높이 0의 셀 좌표 투영).

### 3.2.1 하이라이트와 실제 투척을 일치시킨다

- 현재 `aimState.ts`의 `pointState`는 손가락 아래에 후보가 없으면 `focus`를 그대로 둔다(`?? state.focus`).
- 그런데 `aimRelease`는 그 지점에 후보가 없으면 빈 바닥으로 던진다.
- 그래서 화면에는 몬스터 A가 하이라이트돼 있는데, 떼면 바닥으로 날아가는 불일치가 생긴다.
- 규칙
  - **누르는 중(press/drag)**: 손가락 아래 후보가 없으면 `focus = undefined`. 하이라이트를 지운다.
    - 투척이면 대신 바닥 조준점(작은 노란 X나 점)을 point 위치에 보여 준다. 3D는 effects에 작은 평면 하나, 2D는 작은 원이다.
  - **떼기**: 마지막 focus가 있으면 그 몬스터, 없으면 point(투척) 또는 확정 안 함(마법).
    - 즉 release는 state.point를 다시 판정하지 않고, press·drag 때 정해진 focus를 그대로 쓴다.
  - **마우스 호버(누르지 않음)**: 지금처럼 후보가 없으면 focus를 유지한다. 버튼 재입력 확정용이다.
- 테스트 갱신
  - drag로 빈 곳에 가면 focus가 undefined가 되고, release는 그 point로 `throwAt`을 돌려준다.
  - 몬스터 위에서 떼면 그 몬스터 좌표를 돌려준다.

### 3.3 슈퍼핫 감속 0.15 → 0.06

- `src/data/json/dungeon.json`의 `"superhotSlow"`를 `0.06`으로 바꾼다.
- `tests/unit/superhotThrow.test.ts`의 비율 검사는 `toBeCloseTo(DUNGEON.superhotSlow, 1)`이다. 0.06에서도 통과하는지 확인한다.
  - 몬스터 이동량이 너무 작아 비율이 불안정하면 스텝 수를 늘린다(예: 10 → 40).
- 렌더 dt와 포즈 dt는 이미 같은 배율을 쓴다(main.ts `visualScale`). 그래서 따로 바꿀 것은 없다.

## 4. 테스트

- `tests/unit/aimPick.test.ts`를 새로 만든다.
  1. `nearestOnScreen`: 가짜 `project`(몬스터 x, y를 그대로 u, v로)로 두 후보 중 포인터에 가까운 쪽을 고른다.
  2. 한계 밖이면 `undefined`를 돌려준다.
  3. 발밑과 몸통 중심을 잇는 선분 판정: 몸통 쪽(위쪽 v)을 가리켜도 그 몬스터가 잡힌다.
  4. aspect 보정: 가로로 긴 화면에서 가로 거리가 더 크게 계산된다.
- `World3D.pick`/`project`는 three.js 카메라가 필요하다.
  - 단위 테스트가 무거우면 순수 계산 부분(정규화 → NDC)만 작은 함수(`ndcFromUnit(u, v)`)로 빼서 테스트한다.
- 기존 테스트(superhotThrow, aimState 등)는 모두 통과한다.

## 5. 수동 확인 (Claude가 Playwright로 확인한다)

- `deviceScaleFactor: 2`와 `3`인 브라우저 컨텍스트, 몬스터 2마리, 슈퍼핫 투척 조준 상태에서 확인한다.
  - 각 몬스터의 화면 위치(몸통)를 탭하면 그 몬스터 쪽으로 shot이 날아간다(`w.shots[0]`의 vx, vy 방향 확인).
- 슈퍼핫 무입력 시 world 시간 증가율이 실시간 대비 약 0.06배다.

## 6. 완료 조건

- format, check, build가 통과한다.
- 커밋은 기본 git 인덱스로 하나만 만들고, push는 하지 않는다.
  - 메시지 예: `fix: aim picks the creature under the pointer on high-DPI screens; slower superhot`
  - 끝에 빈 줄 다음 `Co-Authored-By: Codex <noreply@openai.com>`를 넣는다.
- 계획과 다르게 판단한 부분이 있으면 마지막 메시지에 이유와 함께 적는다.
