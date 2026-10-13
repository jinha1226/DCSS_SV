# 스킬 숙련도 상승 토스트 구현계획서

작성일: 2026-10-13
대상: Codex 구현, Claude 검토

## 1. 요구사항

- 아이템 습득 로그(`pickupToast`)처럼, **스킬 숙련도가 오를 때** 게임 화면 가운데에 잠깐 줄을 띄운다.
- 예: `✦ 전투 숙련도 5`
- 그 레벨에서 새 능력이 열리면(skills.json `effects[].level` + `text`) 줄 아래에 작은 글씨로 보여 준다.
  예: `새 능력: 체력이 두 배 빨리 찬다`
- 게임 로그(`gameLog`)에 이미 나오는 "OO 숙련도가 N단계가 되었다." 줄은 그대로 둔다.

## 2. 현재 코드 상태

### 2.1 스킬 숙련도가 오르는 곳 (src/sim/skills.ts)

- `earnSkillXp(w, id, amount)` (약 83–102행)
  - `trainSkills`가 경험치를 얻을 때마다 부른다.
  - COMMON 스킬 6개(fighting, armour, dodging, stealth, spellcasting, throwing)와 무기/방패 스킬을 **한 스텝에 함께** 훈련한다.
  - 그래서 같은 스텝에 여러 스킬이 동시에 오를 수 있다.
  - while 루프로 한 번에 여러 단계가 오를 수도 있다.
  - 끝에서 `w.hero.skills[id] = level`로 값을 쓴다.
- `chooseSkill(w, id)` (약 199–213행)
  - 예전 스킬 선택 카드 경로다. `w.hero.skills[id] = choice.to`로 쓴다.
- `openStartingSkills`
  - 시작 숙련도를 깐다. **토스트 대상이 아니다.**

### 2.2 이벤트 구조

- `SimEvent` 유니온: src/sim/types.ts 약 240–276행
  - `pickup` 이벤트가 마지막 멤버다.
- sim은 `w.events.push(...)`로 이벤트를 넣는다.
- 앱은 매 스텝 `world.events`를 읽는다.

### 2.3 화면 쪽

- `src/ui/pickupToast.ts` (96행)
  - `makePickupToast(root, atlas)`가 `{ take(w), clear() }`를 돌려준다.
  - `w.events`의 `pickup`을 읽어 `.pickup-toast` 상자에 `.pickup-line`을 붙인다.
  - 1.6초 뒤 `leaving` 클래스로 사라진다.
  - 최대 3줄이고, 같은 key는 개수를 합친다(`bump` 애니메이션).
- 호출: src/app/main.ts
  - `pickups.take(world)`는 `gameLog.take` 다음에 부른다.
  - `pickups.clear()`는 reset과 chooseCharacter에서 부른다.
- 스타일: src/styles/theme.css 약 872–945행 (`.pickup-toast`, `.pickup-line`, `.gold`, `.bump`, `.leaving`, `.pickup-icon`)
- 스킬 아이콘: src/ui/skillBar.ts의 `ICONS`(내보내지 않은 상수)
  - 스킬 id를 글리프에 매핑한다(✦ ⚔ ❄ …).
- 스킬 이름과 효과: `skillData(id)` (src/data/skills.ts)
  - `.name`(한글)과 `.effects[]`(`level?`, `text?`)를 준다.
- 색 토큰: theme.css `:root`
  - 숙련도 줄에는 `--cyan #55ffff`를 쓰고, 새 능력 줄에는 `--good #55ff55`를 쓴다.
  - 금화는 이미 `--gold-hi`를 쓴다.

## 3. 구현 방향

### 3.1 sim: `skill` 이벤트 추가

src/sim/types.ts의 `SimEvent`에 다음 멤버를 추가한다.

```ts
/** A skill went up: the level it reached, and the level it had before. */
| { readonly type: 'skill'; readonly id: string; readonly from: number; readonly level: number }
```

src/sim/skills.ts:

- `earnSkillXp`
  - 루프 전에 `const before = level`을 잡는다.
  - 끝에서 `level > before`이면 `w.events.push({ type: 'skill', id, from: before, level })`를 **한 번만** 넣는다.
  - 여러 단계가 올라도 이벤트는 하나이고, `level`은 최종 값이다.
- `chooseSkill`
  - `gained > 0`일 때 같은 이벤트를 넣는다(`from: before, level: choice.to`).
- `openStartingSkills`와 그 밖의 직접 대입은 손대지 않는다.
- sim에는 DOM을 쓰지 않는다. 가드레일을 지킨다.

### 3.2 새 능력 계산 (순수 함수)

`src/data/skills.ts`에 순수 함수를 추가한다(DOM 없음, 테스트 가능).

```ts
/** The perks a skill opens on the way from one level to another, in order: the `text` of each effect whose level falls in (from, to]. */
export function unlockedPerks(id: string, from: number, to: number): string[]
```

- `skillData(id).effects` 중 `level !== undefined`이고 `from < level <= to`이며 `text`가 있는 것의 `text`를 level 순으로 돌려준다.
- `perLevel`만 있는 효과는 제외한다.

### 3.3 UI: pickupToast가 skill 이벤트도 처리

파일은 새로 만들지 않고 `src/ui/pickupToast.ts`를 확장한다.

- 주석 설명을 "줍기와 숙련도 상승을 가운데에 잠깐 보여 준다"로 고친다.
- 함수 이름 `makePickupToast`는 그대로 둔다. main.ts는 바꾸지 않아도 된다.
- `take(w)` 루프에서 `e.type === 'skill'`을 처리한다.
  - key: `'skill:' + e.id`
    - 이미 떠 있는 같은 스킬 줄이 있으면 새 줄을 만들지 않는다.
    - 대신 텍스트를 최신 레벨로 바꾸고, `bump` 애니메이션을 주고, 타이머를 다시 건다.
    - 새 능력 줄은 누적해서 덧붙인다.
  - 줄 구성: `<div class="pickup-line skill">` 안에
    - 아이콘 `<span class="pickup-glyph">` (ICONS 글리프)
    - 본문 `<span class="pickup-text">`
      - `<b>` 안에 `${skill.name} 숙련도 ${level}` (예: `전투 숙련도 5`)
      - 새 능력이 있으면 그 아래 `<small class="pickup-perk">새 능력: ${text}</small>`. 능력마다 한 줄이다.
  - 텍스트는 `textContent`로만 넣는다(innerHTML 금지).
  - 표시 시간: 스킬 줄은 `SKILL_SHOW_MS = 2200`이다. 새 능력이 있으면 `+1000`ms를 더한다. 줍기는 기존 1.6초 그대로다.
- 최대 줄 수
  - `MAX_LINES`를 4로 올린다.
  - 한 스텝에 여러 스킬이 함께 오르는 일이 흔하므로, 넘치면 기존처럼 가장 오래된 줄부터 `drop`한다.
- ICONS 공유
  - src/ui/skillBar.ts의 `ICONS`를 `export const SKILL_ICONS`로 이름을 바꿔 내보낸다.
  - skillBar 내부 사용처도 바꾼다.
  - pickupToast는 그것을 import한다. 없는 id는 `'✦'`로 둔다.
- 기존 pickup 처리 코드는 동작이 바뀌지 않게 둔다.
  - 줄 텍스트를 갱신하는 부분(`line.node.lastElementChild!.textContent = ...`)은 skill 줄과 구조가 다르다.
  - 줍기와 스킬을 각각 작은 함수(`showPickup`, `showSkill`)로 나누고 공통 부분(줄 찾기·bump·타이머·drop)은 헬퍼로 묶는다.
  - 파일은 eslint max-lines 500 이하로 유지한다(150줄 안팎 예상).

### 3.4 CSS (src/styles/theme.css, pickup 블록 아래)

```css
.pickup-line.skill { color: var(--cyan); border-color: #2a6a6a; }
.pickup-glyph { width: 28px; text-align: center; font-size: 18px; }
.pickup-text { display: flex; flex-direction: column; line-height: 1.25; }
.pickup-perk { color: var(--good); font: 400 12px var(--mono); }
```

- 기존 `.pickup-line`에는 `white-space: nowrap`이 있다. perk 줄이 길면 화면 밖으로 나가므로 `.pickup-line.skill`에는 `max-width: min(90vw, 420px)`과 `white-space: normal`을 준다.
- 전체 화면 플래시나 번쩍임은 넣지 않는다(가드레일).

## 4. 테스트

`tests/unit/skillEvents.test.ts`를 새로 만든다. arena() 헬퍼는 tests/unit/arena.ts에 있고, pickupEvents.test.ts가 쓰는 방식을 참고한다.

1. 다음 단계까지 모자란 만큼 경험치를 주면 `{type:'skill', id, from, level: from+1}` 이벤트가 나온다.
   - `w.hero.skillXp`를 문턱 바로 아래로 맞추고 `trainSkills(w, 충분한 양)`을 부른다.
   - 적성 배율이 있으니 넉넉한 양을 준다.
   - 또는 `skillXpToNext`로 계산한다.
2. 문턱을 넘지 않으면 `skill` 이벤트가 없다.
3. 한 번에 여러 단계가 올라도 그 스킬의 이벤트는 하나이고, `level`은 최종 레벨이다.
4. `unlockedPerks('fighting', 1, 2)`는 skills.json의 fighting level 2 text("체력이 두 배 빨리 찬다")를 포함한다. `unlockedPerks('fighting', 2, 2)`는 빈 배열이다.
5. 기존 테스트(skills.test.ts, skillBar.test.ts, pickupEvents.test.ts)가 그대로 통과한다.
   - SimEvent에 멤버가 늘어 `switch` 망라 검사가 깨지는 곳이 있으면 처리한다.

## 5. 수동 확인

- `npm run format`, `npm run check`, `npx vite build`가 모두 통과해야 한다.
- 게임에서 몬스터 몇 마리를 잡아 숙련도가 오를 때 다음을 확인한다.
  - 화면 가운데(가로 레이아웃은 사이드바를 뺀 가운데)에 청록색 줄이 2초쯤 떴다가 사라진다.
  - 같은 스텝에 여러 스킬이 오르면 최대 4줄까지 쌓인다.
  - 같은 스킬이 연달아 오르면 줄 하나에서 숫자만 바뀌고 튄다.
  - 새 능력이 열리는 레벨에서는 초록 작은 글씨 줄이 함께 보인다.

## 6. 완료 조건

- 위 테스트를 추가하고 전부 통과한다.
- format, check, build가 통과한다.
- 커밋은 하나로 하고 push는 하지 않는다.
  - 커밋 메시지 예: `feat: show skill level-ups over the middle of the game view`
  - 끝에 빈 줄 다음 `Co-Authored-By: Codex <noreply@openai.com>`를 넣는다.
- 계획과 다르게 판단한 부분이 있으면 마지막 메시지에 이유와 함께 적는다.
