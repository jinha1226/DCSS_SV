# 조준 모드 터치 개선과 선택 대상 하이라이트 구현계획서

작성일: 2026-10-13
대상: Codex 구현, Claude 검토
선행 커밋: b47d0a2 (superhot slow motion and aimed throwing)

## 1. 요구사항 (사용자)

1. 조준 모드는 투척과 마법이 같은 모듈을 쓴다. 지금도 `src/app/aiming.ts`가 둘을 함께 처리하므로 이 구조를 유지하고, 아래 개선은 두 조준에 똑같이 적용한다.
2. 투척을 누르고 몬스터를 고를 때, **선택된 몬스터가 확실히 하이라이트**되어야 한다.
3. 조준 중 **화면 터치가 슈퍼핫 슬로모션을 풀면 안 된다.** 터치가 이동 스틱으로 새어 나가 시간이 정상 속도로 돌아가는 일이 없어야 한다.

## 2. 현재 코드 상태와 문제

### 2.1 src/app/aiming.ts (150행)

- `Aim = {kind:'spell', id} | {kind:'throw'}`
- `makeAiming(canvas, floorPoint, getWorld, spellButtons)`가 돌려주는 것: `current`, `focus`, `begin`, `cancel`, `take()`
- 캔버스 이벤트 처리
  - `pointermove`: `focus`를 갱신한다.
    - 투척은 `throwAimTarget`, 마법은 `spellAtPoint`를 쓴다.
  - `pointerdown`(capture): **누르는 즉시** 확정한다.
    - 투척은 `queued = {throwAt: point}`, 마법은 대상이 있을 때만 확정한다.
    - 그다음 `finish()`를 부르고 `stopImmediatePropagation`으로 막는다.
  - `contextmenu`와 Esc는 취소한다.
- **문제 A — 터치에는 호버가 없다.**
  - `focus`는 pointermove로만 생긴다. 그래서 터치에서는 하이라이트를 한 번도 보지 못한 채 손가락이 닿는 순간 던져진다.
  - 조준을 시작해도 미리 선택된 대상이 없다.
- **문제 B — 빠른 투척이 하이라이트를 무시한다.**
  - 조준 중 버튼을 다시 누르면 `quickThrow`로 `throw: true`가 되어 1순위 자동 대상에게 날아간다.
  - 하이라이트된 대상과 다를 수 있다.

### 2.2 src/app/main.ts runLoop (약 224–300행)

- `stick.enabled = aim.current?.kind !== 'spell'`
  - **투척 조준 중에는 스틱이 켜져 있다.**
- `if (aim.current?.kind === 'throw' && Math.hypot(mx, my) > 0.3) aim.cancel()`
  - `mx, my`는 스틱 입력과 키보드 입력을 더한 값이다.
- **문제 C — 휴대폰에서 이동 중에 던질 수 없다.**
  - 한 손으로 스틱을 잡고 다른 손으로 던지기를 누르면, 조준이 시작되자마자 다음 스텝에서 스틱 입력 때문에 취소된다.
  - 그대로 정상 속도로 이동하고 투척은 일어나지 않는다.
- **문제 D — 터치가 슈퍼핫을 푼다.**
  - pointerdown capture가 캔버스 탭을 막지만, 스틱이 이미 잡혀 있거나 탭이 확정 직후 스틱으로 넘어가면 스틱이 움직인다.
  - 스틱이 움직이면 `active`가 되어 슬로모션이 풀린다.
  - 투척 확정 탭은 `pointerdown`에서 끝나므로, 같은 손가락의 이후 move/up은 스틱 쪽에 막히지 않는다.
  - 스틱은 `pointerdown`에서 시작하므로 지금은 대체로 안전하다. 하지만 개선 후 확정을 `pointerup`으로 옮기면 반드시 막아야 한다.

### 2.3 src/input/stick.ts

- `makeStick(canvas, root)`는 `{x, y, held, enabled, cancel()}`를 돌려준다.
- 캔버스 `pointerdown`에서 `enabled`이고 다른 포인터가 없을 때 시작한다.
- `cancel()`은 잡고 있던 스틱을 놓는다(`release()`).

### 2.4 하이라이트 그리기

- 3D: src/view3d/effects.ts `showTargets(targets, time, focus, style)`
  - 대상마다 링, 시질, 풀 3장을 그린다.
  - focus는 색에 1.35배 밝기를 곱하는 것뿐이다. **거의 구분되지 않는다.**
- 2D: src/view/render.ts 약 296행
  - focus는 선 두께만 0.11 대 0.075로 다르다.

## 3. 구현 방향

### 3.1 조준 상태를 순수 모듈로 분리 (테스트 가능)

`src/app/aimState.ts`를 새로 만든다. DOM은 쓰지 않는다. World는 import한다.

```ts
export type Aim = { readonly kind: 'spell'; readonly id: string } | { readonly kind: 'throw' };
export interface AimState {
  readonly aim: Aim;
  readonly focus: Monster | undefined;     // 하이라이트 대상
  readonly pressing: boolean;              // 손가락/버튼이 화면을 누르고 있는 중
  readonly point?: { x: number; y: number }; // 마지막 포인터 바닥 좌표
}
export function startAim(w, aim): AimState          // focus = 첫 후보 (투척: throwCandidates[0], 마법: spellCandidates[0])
export function aimHover(w, s, point): AimState      // 누르지 않은 마우스 이동: point 근처 후보가 있으면 focus 교체, 없으면 유지
export function aimPress(w, s, point): AimState      // pressing=true, point 근처 후보가 있으면 focus 교체
export function aimDrag(w, s, point): AimState       // pressing 중 이동: aimPress와 같은 규칙
export function aimRelease(w, s): AimResult | undefined  // 확정 결과(아래 규칙), 확정 불가면 undefined
export function aimConfirm(w, s): AimResult | undefined  // 버튼/키 재입력: 현재 focus로 확정
```

- 후보 찾기에는 기존 `throwAimTarget`, `spellAtPoint`를 쓴다.
- `Aim` 타입은 aiming.ts에서 이 파일로 옮기고, aiming.ts는 re-export하거나 import한다.

**확정 규칙**

| 상황 | 투척 | 마법 |
|---|---|---|
| release, 손가락 아래(point 근처)에 후보가 있음 | 그 몬스터 위치로 `throwAt` | 그 몬스터로 `spell` |
| release, 근처 후보는 없고 point가 있음 | point로 `throwAt`(빈 바닥 투척, 기존 동작) | 확정하지 않음(조준 유지) |
| confirm(버튼/키 재입력) | focus가 있으면 focus 위치로 `throwAt`, 없으면 `throw: true`(자동) | focus가 있으면 그 대상으로 `spell` |

- 핵심 1: 터치 확정은 **pointerup에서** 한다.
  - 누르고 있는 동안 손가락 아래 몬스터가 하이라이트된다.
  - 끌어서 다른 몬스터로 옮길 수 있다.
  - 떼면 던진다.
- 핵심 2: 마우스는 지금처럼 호버로 하이라이트가 따라온다.
  - 클릭은 down 후 바로 up이므로 사실상 기존과 같은 느낌이다.
- 핵심 3: 빠른 확정(버튼 재입력)은 **하이라이트된 대상**을 쓴다.
  - 조준 시작 때 1순위가 미리 하이라이트되므로, 버튼 두 번이면 지금 보이는 대상에게 날아간다.
- `pointercancel`은 pressing만 풀고 확정하지 않는다.

### 3.2 aiming.ts: 이벤트 연결만 담당

- 상태는 `AimState | undefined` 하나로 들고, 위 순수 함수로 갱신한다.
- 캔버스 리스너는 모두 capture로 단다.
  - 조준 중이면 `preventDefault()`와 `stopImmediatePropagation()`을 부르고, 이벤트가 스틱에 가지 않게 한다.
  - `pointerdown`에서는 `canvas.setPointerCapture(e.pointerId)`를 try/catch로 감싸 호출하고, 그 pointerId를 기억한다.
    - 그 포인터의 `pointermove`, `pointerup`, `pointercancel`만 처리한다.
    - 그동안 다른 손가락의 pointerdown도 조준 중이면 삼킨다. 스틱이 시작되지 않게 하기 위해서다.
  - `pointerup`에서 `aimRelease` 결과가 있으면 `queued`에 넣고 조준을 끝낸다.
    - 결과가 없으면(마법인데 빈 곳) 조준을 유지하고 pressing만 푼다.
- 마우스 오른쪽 버튼, contextmenu, Esc는 지금처럼 취소한다.
- 공개 API에 `confirm(): void`를 추가한다.
  - `aimConfirm` 결과를 queued에 넣고 끝낸다.
  - 결과가 없으면 취소한다.
- `focus` getter는 `state?.focus`를 돌려준다.

### 3.3 main.ts runLoop

- 조준이 시작되는 순간 `stick.cancel()`을 부른다. 조준 중에는 `stick.enabled = !aim.current`로 **투척과 마법 모두** 스틱을 끈다.
- 던지기 입력 처리(`throwPressed` 블록)
  - 조준 중에 다시 누르면 `aim.confirm()`을 부른다(기존 `quickThrow` 대체).
  - 조준 중이 아니고 **지금 움직이는 중**(`Math.hypot(stick.x + key.x, stick.y + key.y) > 0.3`)이면 조준 모드에 들어가지 않는다. `throw: true`로 즉시 자동 투척한다.
    - 휴대폰에서 이동하며 던지는 흐름(문제 C)을 살리기 위해서다.
  - 멈춰 있으면 `aim.begin({kind:'throw'})`를 부른다.
- 이동으로 조준을 취소하는 조건은 **키보드 이동만** 본다.
  - `Math.hypot(key.x, key.y) > 0.3`이면 취소한다.
  - 스틱은 조준 중 꺼져 있으므로 볼 필요가 없다.
  - 마법 조준에도 같은 규칙을 적용한다. 지금은 마법 조준 중 키보드 이동이 취소하지 않으니, 둘을 맞춘다.
- 마법 버튼을 슈퍼핫에서 다시 누르면(같은 마법) 지금은 취소한다.
  - 이것도 `aim.confirm()`으로 바꿔 투척과 같게 한다.
  - focus가 없으면 confirm은 취소로 끝난다.
- 슬로모션
  - `active` 계산은 지금 그대로 둔다.
  - 조준 중에는 `input.mx/my = 0`, `throw=false`, `hop=false`가 이미 들어간다. 스틱도 꺼지므로 확정 전까지 계속 0.15배로 흐른다.
  - 확정한 스텝 하나만 `throwAt`/`spell` 때문에 active가 된다.
- main.ts는 eslint max-lines 500 이하를 유지한다(현재 368행).

### 3.4 하이라이트 강화

- 3D (`effects.ts showTargets`)
  - focus 대상
    - 링 크기를 `* 1.15`로 키운다.
    - 밝기 1.6배.
    - pulse 진폭을 0.04에서 0.1로 올린다.
    - 몬스터 머리 위(y ≈ 1.4)에 아래를 가리키는 작은 표식을 단다.
      - 가산 블렌딩 평면(기존 `lightMaterial` + `glowTexture`) 또는 작은 원뿔 `ConeGeometry(0.12, 0.25, 4)`를 뒤집어 쓴다.
      - 위아래로 `sin(time*6)*0.06` 흔든다.
      - 색은 style.colour다.
  - focus가 아닌 후보: 밝기 0.55배.
  - focus가 없으면 전부 1배.
  - 표식 메시는 Effects가 하나만 만들어 재사용하고, focus가 없으면 `visible=false`로 둔다.
- 2D (`render.ts`)
  - focus 원은 반지름 `px*0.56`, 두께 `px*0.12`로 그린다.
  - 그 위에 작은 삼각형(머리 위 ▼)을 같은 색으로 채운다.
  - 나머지 후보는 `globalAlpha 0.55`로 그린다.
- 전체 화면 플래시는 넣지 않는다(가드레일).

## 4. 테스트

`tests/unit/aimState.test.ts`를 새로 만든다. arena() 헬퍼와 spawnMonster를 쓰고, environment는 node다.

1. `startAim(w, {kind:'throw'})`의 focus는 `throwCandidates(w)[0]`이다.
2. `aimPress` 후 `aimDrag`로 다른 몬스터 근처로 옮기면 focus가 그 몬스터로 바뀐다. `aimRelease`는 그 몬스터 좌표로 `throwAt`을 돌려준다.
3. 투척에서 몬스터가 없는 바닥에서 release하면 그 point로 `throwAt`을 돌려준다.
4. 마법에서 빈 곳 release는 `undefined`를 돌려주고, 상태는 유지된다(호출 측 판단).
5. `aimConfirm`은 focus가 있으면 focus 좌표의 `throwAt`, 없으면 `{throw: true}`에 해당하는 결과를 돌려준다.
   - 결과 타입에 `quick: true` 같은 필드를 두어 구분해도 된다.
6. `aimHover`는 후보가 없는 곳으로 가도 focus를 유지한다.
7. 기존 `tests/unit/superhotThrow.test.ts`는 그대로 통과한다.

## 5. 수동 확인 (Claude가 Playwright로 확인한다. Codex는 브라우저를 띄울 수 없다)

- 슈퍼핫, 몬스터 2마리 이상, 던지기 버튼을 누른 상태에서 확인한다.
  - 1순위 몬스터에 노란 링과 머리 위 표식이 보이고, 다른 후보는 흐리다.
  - 캔버스를 터치(touch 포인터)로 누른 채 다른 몬스터로 끌면 하이라이트가 옮겨 가고, 떼면 그쪽으로 날아간다.
  - 누르고 끄는 동안 world 시간 증가율이 0.15배 그대로다(스틱이 생기지 않는다).
- 이동 중(키 누른 채) 던지기를 누르면 조준 없이 바로 던진다.
- 마법 조준도 같은 하이라이트와 같은 누름·끌기·떼기 흐름으로 동작한다.

## 6. 완료 조건

- 위 테스트를 추가하고 전부 통과한다. `npm run format`, `npm run check`, `npx vite build`가 통과한다.
- 커밋은 하나로 하고 push는 하지 않는다.
  - 메시지 예: `feat: touch-friendly aiming with a highlighted target`
  - 끝에 빈 줄 다음 `Co-Authored-By: Codex <noreply@openai.com>`를 넣는다.
- 계획과 다르게 판단한 부분이 있으면 마지막 메시지에 이유와 함께 적는다.
