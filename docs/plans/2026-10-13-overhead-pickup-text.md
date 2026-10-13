# 획득·숙련 알림을 머리 위 떠오르는 문구로 바꾸기 구현계획서

작성일: 2026-10-13
대상: Codex 구현, Claude 검토
선행 커밋: 21293e8 (skill toast), b1b3f88 (main 최신)

## 1. 요구사항 (사용자)

> 아이템 획득이랑 스킬업 로그가 너무 거슬리게 뜬다. 배경이나 테두리 없이, 로그 뜨듯이 중요 단어에 컬러가 있는 문구로, 머리 위쪽으로만 떴다가 사라지게 해야지. 지금은 캐릭터를 가린다.

- 상자(배경·테두리)와 아이콘을 없앤다.
- 문구는 글자만 쓴다. 테두리 대신 글자 외곽선이나 그림자로 읽히게 한다.
- 중요한 단어(아이템 이름, 금화 수, 기술 이름, 숙련 레벨, 새 능력 이름)만 색을 입힌다.
- 문구는 주인공 **머리 위**에 생기고, 위로 조금 떠오르며 사라진다.
- 캐릭터 몸을 가리면 안 된다.

## 2. 현재 코드

- `src/ui/pickupToast.ts` (`makePickupToast`): 줄 하나가 `.pickup-line` div다.
  - 픽업 줄은 아이콘 canvas(`.pickup-icon`)와 이름을 담는다.
  - 기술 줄은 글리프, 굵은 제목, 새 능력 `<small>`을 담는다.
  - 같은 key면 줄을 합치고 수를 올리며 `bump` 애니메이션을 다시 건다.
  - `MAX_LINES` 4, `PICKUP_SHOW_MS` 1600, `SKILL_SHOW_MS` 2200(+능력이 있으면 1000).
- `src/styles/theme.css` 898–990행의 `.pickup-toast`는 `position: fixed; top: 36%; left: 50%`로 화면 가운데에 고정돼 있다. 그래서 주인공(화면 중앙)을 가린다.
  - 가로 배치에서는 `--sidebar-width`를 뺀 가운데에 놓인다.
  - 줄 스타일은 `background: rgba(0,0,0,.78)`와 `border`를 쓴다.
- `src/app/main.ts:189` `makePickupToast(root, atlas)`, `:315` `pickups.take(world)`(매 스텝 이벤트를 읽음).
- 화면 좌표 변환 도구는 이미 있다.
  - `src/app/aiming.ts`의 `viewForAim`이 3D에서는 `world3d.project(x, z, height)`를 쓴다. 정규화 u, v(0–1, 캔버스 박스 기준)를 돌려준다. 2D에서는 셀 좌표 변환을 쓴다.
  - 주인공 그림 높이는 3D 타일 모드에서 `tileFigureHeight`(약 1.1칸), 모델 모드에서는 모델 높이다. `World3D.heightOf`(331행)를 참고한다.

## 3. 구현 방향

### 3.1 위치: 주인공 머리 위에 붙인다

- `makePickupToast`에 매 프레임 위치를 갱신하는 메서드를 추가한다: `place(anchor: { x: number; y: number } | undefined)`.
  - x, y는 **CSS 픽셀**, 뷰포트 기준이다.
  - 상자(`.pickup-toast`)의 `left`/`top`(또는 `transform: translate`)을 그 점으로 옮긴다. 상자의 아래 가장자리가 그 점에 오게 한다(`translate(-50%, -100%)`).
  - anchor가 undefined면(화면 밖, 렌더러 없음) 기존처럼 화면 가운데 위쪽(top 28%)으로 둔다.
- main.ts의 렌더 루프(매 프레임)에서 주인공 머리 위 점을 계산해 `pickups.place(...)`를 부른다.
  - 3D: `world3d.project(hero.x, hero.y, headHeight + 0.25)` → `{u, v}`를 3D 캔버스의 `getBoundingClientRect()`로 CSS 픽셀로 바꾼다. `headHeight`는 주인공 그림 높이이고, World3D에 `heroHeadHeight()` 같은 작은 공개 메서드로 노출한다(타일 모드: `tileFigureHeight` 기반, 모델 모드: 모델 높이).
  - 2D: 2D 렌더러가 주인공을 그리는 셀 위치에서 한 칸 위를 같은 식으로 CSS 픽셀로 바꾼다. 이미 있는 2D 변환(`viewForAim`의 2D 경로)을 재사용한다.
  - `getBoundingClientRect()`는 매 프레임 부르지 말고 resize 때 캐시해도 된다(이미 fit()이 있으면 거기서).
- 상자는 문구의 **아래 끝이 머리 위 점**에 닿고 위로 쌓인다. 새 줄은 맨 아래(머리 쪽), 오래된 줄은 위로 밀린다.
  - `flex-direction: column`, 새 줄을 append하면 아래에 붙는다. 현재와 같다.
- 이동 중에도 머리를 따라간다(프레임마다 place).

### 3.2 모양: 상자 없이 글자만

- `.pickup-line`의 `background`, `border`, `padding`을 없앤다.
  - 가독성은 `text-shadow`(사방 1px 검정 + 0 0 4px 검정 정도)로 확보한다.
  - 글꼴은 `700 13px var(--mono)`이다(휴대폰에서도 13px).
- 아이콘 canvas와 기술 글리프를 **없앤다**. `icon()`, `.pickup-icon`, `.pickup-glyph` 관련 코드와 CSS를 지운다. `atlas` 인자가 필요 없어지면 시그니처에서 빼고 main.ts 호출도 고친다.
- 색은 강조 단어에만 입힌다. 나머지는 연한 흰색(`#e8e2d0`)이다.
  - 픽업: `<b class="hl-item">{이름}</b>` + 수량(`×3`)은 기본색. 이름 색은 `--gold-hi`(아이템) 정도로 한다.
  - 금화: `금화 <b class="hl-gold">+12</b>`이다.
  - 부메랑(ammo): 아이템과 같다.
  - 기술: `<b class="hl-skill">{기술}</b> 숙련 <b class="hl-level">{레벨}</b>`이다. 색은 `--cyan`(기술), `--gold-hi`(레벨)이다.
  - 새 능력: 다음 줄에 `새 능력 <b class="hl-perk">{능력}</b>`이다. 색은 `--good`이다.
  - DOM은 `textContent`/`createElement`로만 만든다(innerHTML 금지, 이름은 데이터라 안전하지만 일관성을 위해).
- 줄 사이 간격은 2px, 최대 줄 수는 4 그대로 둔다.

### 3.3 움직임: 머리 위에서 떠올라 사라진다

- 나타날 때: `opacity 0 → 1`, `translate 0 6px → 0`, 0.18s이다.
- 머무는 동안: 위로 천천히 6px 떠오른다(머무는 시간 전체에 걸친 `translate` 애니메이션).
  - 줄 단위 애니메이션으로 하고, 상자 자체는 머리를 따라간다.
- 사라질 때(`.leaving`): `opacity → 0`, `translate → -12px`, 0.35s이다.
- `bump`(같은 아이템을 또 주움)는 scale 1.08을 유지한다.
- `prefers-reduced-motion`이면 떠오르는 이동 없이 페이드만 한다.

### 3.4 그 밖

- 시간 상수(`PICKUP_SHOW_MS` 등)와 합치기 로직은 유지한다.
- `clear()`는 유지한다(층 이동 등).
- 슈퍼핫 회색 필터(`#app.slowmo .game-canvas.world3d`)는 3D 캔버스에만 걸린다. 문구는 DOM이므로 색이 유지된다. 이것을 확인한다.

## 4. 테스트

- 기존 `tests/unit/skillEvents.test.ts`처럼 DOM 없이 가능한 부분만 단위 테스트한다.
  - 문구 조립을 순수 함수로 뺀다. 예: `pickupParts(w, e) → [{text, tone?}]`, `skillParts(e, perks) → ...`
  - 그 함수가 `[{text:'금화 '}, {text:'+12', tone:'gold'}]`처럼 강조 조각을 돌려주는지 검사한다.
- 머리 위 좌표 변환(정규화 u, v → CSS 픽셀, 캔버스 rect 오프셋 포함)도 순수 함수로 만든다. 예: `screenFromUnit(u, v, rect)`. 그리고 테스트한다.

## 5. 수동 확인 (Claude가 Playwright로)

- PC 1280×800와 휴대폰 390×844(DSF 3)에서 확인한다.
  - 금화 픽업과 기술 레벨업 이벤트를 주입해 스크린샷을 찍는다.
  - 문구가 주인공 머리 위에 있고 몸을 가리지 않는지 본다. 상자와 테두리가 없는지 본다.
  - 이동 중에 따라오는지 본다.

## 6. 완료 조건

- `npm run format`, `npm run check`, `npx vite build`가 통과한다.
- **git 커밋은 하지 말고 변경을 작업 트리에 남긴다.** `npm ci`는 실행하지 않는다.
- 계획과 다르게 판단한 부분은 마지막 메시지에 이유와 함께 적는다.
