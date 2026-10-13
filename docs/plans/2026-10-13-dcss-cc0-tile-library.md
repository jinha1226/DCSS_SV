# DCSS CC0 타일 전체 들여오기 구현계획서

작성일: 2026-10-13
대상: Codex 구현, Claude 검토
선행 커밋: main 최신. 획득 문구 계획(2026-10-13-overhead-pickup-text.md) 다음에 진행한다.

## 1. 요구사항 (사용자)

> CC0인 DCSS 타일을 싹 긁어와서 우리가 사용하자.

- DCSS의 타일 중 재사용 가능한(CC0) 것을 **전부** 저장소에 들여온다.
- 게임 코드와 데이터에서 이름으로 바로 쓸 수 있게 한다.
- 지금 대역(같은 그림 돌려쓰기)인 몬스터를 제 타일로 바꾼다.
- 라이선스 규칙은 테스트로 지킨다.

## 2. 현재 상태와 조사 결과 (Claude가 조사함)

### 2.1 지금의 타일 구조

- `assets/tiles/**.png` 168장은 손으로 골라 이름을 바꾼 것이다. 출처는 `docs/TILES.md`의 표에 있다.
- `npm run tiles`(`tools/packTiles.mjs`)가 이 폴더 전체를 `public/tiles.png`(16열 시트)와 `src/data/tiles.gen.ts`(`TILE_NAMES` as const)로 묶는다.
- `TileName`은 `TILE_NAMES`의 유니언이다. 데이터(`items.json`, `monsters.json`)는 `itemCatalog.ts`의 `hasTile`로 검사한다.
- `tests/unit/tiles.test.ts`는 디스크의 png 목록과 `TILE_NAMES`가 같은지, 시트 크기와 위치를 검사한다.
- 몬스터 21종 중 13종(브랜치 전용)이 기존 8개 타일을 돌려쓴다. 예: naga → `mon/gnoll`.

### 2.2 원본과 라이선스

원본은 Claude가 이미 받아 두었다. Codex 샌드박스에는 네트워크가 없으므로 아래 경로를 **읽기 전용**으로 쓴다.

- DCSS 타일:
  - 경로: `/tmp/claude-1000/-mnt-d-PROJ-SV/a1fa3e89-4f2e-4b8c-8bce-3042185990c9/scratchpad/dcss/crawl/crawl-ref/source/rltiles`
  - 출처: crawl/crawl `871aabe2082cb5819a4ec044ea8f840388598ff4` (2026-10-13)
  - png는 8,747장이다. 그중 `UNUSED/`가 596장이다.
- 라이선스 목록 저장소:
  - 경로: `/tmp/claude-1000/-mnt-d-PROJ-SV/a1fa3e89-4f2e-4b8c-8bce-3042185990c9/scratchpad/dcss/tiles`
  - 출처: crawl/tiles `a6ea1655db5c044829d9eea19a232fa6fcac87b0`
  - `TILES_UNDER_UNKNOWN_LICENSE.md`는 재사용 불가 목록이다. 세 부분으로 되어 있다.
    1. 1–130행: 2010년 목록. **경로 없는 파일 이름**만 있다(127개, 예: `- javelin1.png`).
    2. `# These are all stolen from nethack` 아래: `crawl-ref/source/rltiles/...` 경로.
    3. `# These are considered excluded until/if we hear back` 아래: 작가별(`- Bloax`)로 `\t- rltiles/...` 경로가 있다(약 1,100개).
       - 일부는 옛 폴더 이름(`rltiles/dc-dngn/...`, `rltiles/dc-mon/...`)이다. 지금 구조에는 그 폴더가 없다.
  - `releases/Ancient/Oct-5-2010/`는 2010년 CC0 배포본이다. 위 3번의 작가들이 손대기 **전** 그림이 들어 있다.
- DCSS `LICENSE`: "The majority of Crawl's tiles and artwork are released under the CC0 license, and new submissions are under this license unless otherwise specified … see https://github.com/crawl/tiles".

### 2.3 제외 규칙 (확정)

rltiles 기준 상대 경로 `p`(예: `mon/animals/rat.png`)는 다음 중 하나라도 맞으면 **제외**한다.

1. `p`가 목록의 경로와 같다.
   - 목록 경로에서 앞의 `crawl-ref/source/`와 `rltiles/`를 떼고 비교한다.
2. `p`의 파일 이름이 2010년 목록(경로 없는 이름)에 있다.
3. `p`의 파일 이름이 목록의 옛 `dc-*` 경로 항목의 파일 이름과 같다.
   - 옛 경로는 지금 구조로 대응시킬 수 없으므로 보수적으로 이름으로 막는다.

이 규칙으로 계산하면 사용 가능한 것은 7,810장이다(`UNUSED` 포함, 크기 무관). 32×32가 대부분이고, 32×48 등 다른 크기가 약 180장이다.

### 2.4 이미 쓰는 타일 중 규칙에 걸리는 것 (중요)

`assets/tiles`의 다음 파일은 지금 DCSS 판이 3번 목록(작가 미확인)에 정확한 경로로 올라 있다. 이전 도입 때는 2010년 이름 목록하고만 대조해서 놓쳤다.

| 우리 파일 | 목록 경로 (작가) | 2010 배포본 대체 파일 (`releases/Ancient/Oct-5-2010/` 기준) |
| --- | --- | --- |
| `hero/minotaur.png` | `mon/minotaur.png` (Team Impy) | `dc-mon/minotaur.png` |
| `player/base/minotaur_m.png` | `player/base/minotaur_m.png` (Team Impy) | `player/base/minotaur_m.png` |
| `item/war_axe1.png` | `item/weapon/war_axe1.png` (dd) | `item/weapon/war_axe1.png` |
| `item/battle_axe1.png` | `item/weapon/battle_axe1.png` (dd) | `item/weapon/battle_axe1.png` |
| `item/armour/chain_mail1.png` | `item/armour/chain_mail1.png` (Bloax) | `item/armour/chain_mail1.png` |
| `mon/rat.png` | `mon/animals/rat.png` (Bloax) | `dc-mon/animals/rat.png` |
| `player/body/chainmail.png` | `player/body/chainmail.png` (Bloax) | `player/body/chainmail.png` |
| `player/body/leather_armour.png` | `player/body/leather_armour.png` (Bloax) | `player/body/leather_armour.png` |
| `feat/stone_stairs_down.png` | `dngn/gateways/stone_stairs_down.png` (white_noise) | `dc-dngn/gateways/stone_stairs_down.png` |
| `feat/stone_stairs_up.png` | 같은 계열. 대조해서 확인한다 | `dc-dngn/gateways/stone_stairs_up.png` |
| `item/ring/diamond.png` | `item/ring/diamond.png` (white_noise) | `item/ring/diamond.png` |
| `item/ring/silver.png` | `item/ring/silver.png` (white_noise) | `item/ring/silver.png` |

- 이 파일들은 **2010 배포본 그림으로 교체**한다. 이름은 그대로 두어 코드는 바뀌지 않는다.
  - 2010 판이 32×32가 아니면 Claude에게 보고하고 대체 타일을 제안한다.
- `assets/tiles`의 다른 파일도 아래 3.3의 출처표로 전부 다시 대조한다. 걸리는 것이 더 있으면 같은 방식으로 처리하고 보고한다.

## 3. 구현 방향

### 3.1 라이브러리 들여오기: `tools/importDcssTiles.mjs`

- 사용법: `node tools/importDcssTiles.mjs <rltiles 폴더> <crawl/tiles 폴더> <crawl 커밋> <tiles 커밋>`
- 하는 일
  1. 목록 파일을 2.3 규칙대로 파싱한다.
  2. rltiles 아래 모든 png를 돌며, 제외되지 않은 것을 `assets/dcss/<p>`에 **바이트 그대로** 복사한다. 폴더 구조와 `UNUSED/`도 유지한다.
  3. 다음 파일을 쓴다.
     - `assets/dcss/index.json`: `{ "source": {"crawl": <커밋>, "tiles": <커밋>}, "tiles": [{"name": "dcss/mon/animals/wolf", "w": 32, "h": 32}, ...] }`. 이름순으로 정렬한다. 이름은 `dcss/` + 경로에서 `.png`를 뗀 것이다.
     - `assets/dcss/excluded.json`: `[{"path": "mon/animals/rat.png", "rule": "path|basename2010|dcBasename|nethack"}]`
     - `assets/dcss/unknown-license.txt`: 목록 원문 사본. 테스트가 이것을 읽는다.
  4. 같은 입력으로 다시 돌리면 결과가 같아야 한다(결정적). 기존 `assets/dcss`는 지우고 다시 만든다.
- `package.json`에 `"tiles:import"` 스크립트를 추가한다. 인자는 문서에 적는다.
- 실행해서 결과물을 작업 트리에 남긴다. 약 7,800장, 20MB 남짓이다. 저장소에 커밋하는 것이 맞다(오프라인 빌드, 재현성).

### 3.2 런타임 시트: 쓰는 것만 묶는다

7,800장을 한 시트에 넣으면 수 MB에서 10MB가 넘어 모바일 첫 로딩에 맞지 않는다. 그래서 **참조된 타일만** 시트에 넣는다.

- `tools/packTiles.mjs`를 확장한다.
  - 지금처럼 `assets/tiles/**`(손으로 고른 층)를 모두 넣는다. 이름 규칙도 그대로다.
  - 추가로 `dcss/...` 이름 중 다음에 해당하는 것을 넣는다.
    1. `src/**/*.ts`와 `src/**/*.json`(단, `tiles.gen.ts` 제외)에서 따옴표 안의 `dcss/[A-Za-z0-9_+\-/]+` 문자열을 찾는다. 그중 `assets/dcss/index.json`에 있는 이름이다.
    2. `assets/dcss-include.json`의 항목이다.
       - 정확한 이름이거나 `*`로 끝나는 접두어다(예: `"dcss/mon/dragons/hydra*"`).
       - 템플릿 문자열로 만드는 이름(`${}`)용이다.
  - 소스에서 찾은 `dcss/...` 이름이 index에 없으면 **오류로 멈춘다**(오타 방지).
    - 다만 접두어로만 쓰이는 문자열(뒤에 `${`가 붙는 경우)은 무시한다.
  - 32×32가 아닌 dcss 타일이 참조되면 오류로 멈춘다. 지금 시트는 32×32 전용이다.
  - `tiles.gen.ts`는 지금 형식 그대로 둔다. 손으로 고른 층과 dcss 층을 합쳐 이름순으로 정렬한다.
- 흐름: 코드나 데이터에 `'dcss/mon/animals/wolf'`를 쓰고 `npm run tiles`를 돌리면 시트에 들어가고 `TileName` 타입도 생긴다.
- `tests/unit/tiles.test.ts`를 새 규칙에 맞게 고친다.
  - 기대 목록은 "assets/tiles 전부 + 참조된 dcss"이다. 수집 함수는 packTiles와 공유한다. 예: `tools/tileSelection.mjs`로 빼고 테스트에서 import한다.

### 3.3 출처표와 라이선스 테스트

- `assets/tiles/SOURCES.json`을 만든다. 손으로 고른 층의 모든 png에 대해 출처를 적는다.
  - 형식: `{ "mon/goblin": { "from": "crawl", "path": "mon/humanoids/goblin.png" } }`
  - 2010 배포본에서 온 것: `{ "from": "ancient-2010", "path": "dc-mon/animals/rat.png" }`
  - 직접 만들거나 고친 것: `{ "from": "own", "note": "..." }`. 현재 `player/*` 일부 등이 해당하는지 확인한다.
  - 지금 파일들의 출처는 `docs/TILES.md` 표와 원본 대조(바이트 비교)로 채운다. 바이트가 원본과 다르면 note에 적는다.
- 새 단위 테스트 `tests/unit/tileLicense.test.ts`
  1. `assets/tiles`의 모든 png가 SOURCES.json에 있다. 반대 방향도 확인한다.
  2. `from: "crawl"`인 출처 경로가 2.3 규칙으로 제외되지 않는다. 규칙 판정은 `assets/dcss/unknown-license.txt`를 파싱하는 공용 함수로 하고, import 스크립트와 같은 코드를 쓴다.
  3. `assets/dcss/index.json`의 모든 이름이 제외 규칙에 걸리지 않는다.
  - 판정 함수는 `tools/tileLicense.mjs`에 두고, 스크립트와 테스트가 같이 쓴다. TS 테스트에서 .mjs import가 되는지 확인한다.

### 3.4 몬스터 대역을 제 타일로

`monsters.json`의 `tile`을 아래처럼 바꾼다. 모두 2.3 규칙 통과를 확인했다.

| id | 새 tile |
| --- | --- |
| lair_wolf | `dcss/mon/animals/wolf` |
| lair_yak | `dcss/mon/animals/yak` |
| hydra | `dcss/mon/dragons/hydra1` (머리 수 변형 hydra1–5가 있다. 지금은 1만 쓴다) |
| naga | `dcss/mon/demihumanoids/naga/naga` |
| naga_mage | `dcss/mon/demihumanoids/naga/naga_mage` |
| salamander | `dcss/mon/demihumanoids/salamander` |
| wolf_spider | `dcss/mon/animals/wolf_spider` |
| orb_spider | `dcss/mon/animals/orb_spider` |
| swamp_drake | 현행 판은 제외 대상이다. 2010 배포본 `dc-mon/swamp_drake.png`를 `assets/tiles/mon/swamp_drake.png`로 들이고 `mon/swamp_drake`를 쓴다. 32×32가 아니면 보고한다 |
| bog_body | `dcss/mon/undead/bog_body` |
| merfolk | `dcss/mon/demihumanoids/merfolk/merfolk` |
| merfolk_javelineer | `dcss/mon/demihumanoids/merfolk/merfolk_javelineer` |
| merfolk_aquamancer | `dcss/mon/demihumanoids/merfolk/merfolk_aquamancer` |

- 3D 타일 모드의 키 보정(`tileFigures.ts`의 `BIG`)에 hydra, lair_yak 등 큰 몬스터가 필요하면 추가한다(기존 ogre 기준을 참고).
- 3D **모델** 모드(`bestiary.ts`/`models.ts`)에서 이 몬스터들이 무엇으로 그려지는지는 바꾸지 않는다.

### 3.5 개발용 타일 둘러보기 페이지

- `tiles.html` + `src/dev/tileBrowser.ts`를 만든다. 개발 서버에서만 쓴다. **빌드 입력에 넣지 않는다**(vite.config의 input에 추가하지 않음).
- `assets/dcss/index.json`을 fetch해서 격자로 보여 준다. 각 칸의 그림은 `/assets/dcss/<path>.png`를 `<img>` lazy 로딩으로 띄운다(vite dev는 루트 파일을 서빙한다. 안 되면 `server.fs.allow`를 확인한다).
- 위쪽에 검색창(부분 문자열)과 폴더 필터(mon, item, dngn, player, effect, gui, misc, UNUSED)를 둔다. 그림을 누르면 이름(`dcss/...`)을 클립보드에 복사한다.
- 이미 시트에 들어간 이름은 테두리로 표시한다(`TILE_NAMES` import).
- 2배 확대(`image-rendering: pixelated`, 64px)로 보여 준다.

### 3.6 문서

- `docs/TILES.md`를 갱신한다.
  - 두 층 구조(`assets/tiles` 손으로 고른 층, `assets/dcss` 전체 라이브러리)를 설명한다.
  - 제외 규칙 2.3을 적는다.
  - 2.4의 교체 사실과 이유를 적는다.
  - 새 타일 쓰는 법을 적는다: 이름 찾기(`tiles.html`) → 코드나 데이터에 `dcss/...` → `npm run tiles`.
  - 다시 들여오는 법을 적는다(`npm run tiles:import ...`).
  - CC0 전문 링크는 유지한다.
- `docs/IMPLEMENTATION_2RUNE.md`에 기존 형식으로 항목을 추가한다.

### 3.7 브랜치별 바닥·벽 타일 적용 (사용자 추가 요청)

> 각 브랜치 던전들 타일 재적용하고 살펴볼 수 있는 데모 페이지가 있으면 좋겠어.

**현재**

- 2D(`src/view/look.ts`): 모든 브랜치가 `LOOK.dcss` 하나를 쓴다(`floor/grey_dirt` + `wall/brick_brown`).
- 3D(`world3d.ts:275`): `branch === 'Dungeon'`일 때만 DCSS 타일 바닥(`TileGround`)을 쓴다. 다른 브랜치는 KayKit 모델 바닥(`dungeon.ts`의 THEMES)을 쓴다.
  - THEMES에는 Dungeon, Lair, Swamp만 있고 나머지는 Dungeon으로 떨어진다.

**DCSS 원본의 브랜치 기본 타일**

출처는 `crawl-ref/source/tileview.cc`의 `tile_default_flv`이다. 파일 목록은 `rltiles/dc-floor.txt`와 `dc-wall.txt`의 enum 정의(같은 줄의 별칭 포함)에서 찾았다. 2.3 규칙으로 Claude가 확인한 결과는 아래와 같다.

| 브랜치 | 바닥 (rltiles 경로 접두어, 장수) | 벽 | 라이선스 |
| --- | --- | --- | --- |
| Dungeon | `dngn/floor/grey_dirt*` (지금 것 유지) | 원본 `brick_dark_1_*`은 **전부 제외(96/96)**. 지금의 `brick_brown*` 유지 | 통과 |
| Lair | `dngn/floor/lair*` 16 | `dngn/wall/lair*` 8 | 통과 |
| Orc | `dngn/floor/orc*` 8 | `dngn/wall/orc*` 12 | 통과 |
| Temple | `dngn/floor/floor_vines*` 7 | `dngn/wall/wall_vines*` 7 | 통과 |
| Snake | `dngn/floor/mosaic*` 16 | `dngn/wall/snake*` 10 | 통과 |
| Spider | `dngn/floor/spider*` 12 | 원본 `dngn/wall/spider*`는 **전부 제외(Bloax)**. 대신 `dngn/wall/wall_stone_spider*` 4 | 대체 후 통과 |
| Swamp | `dngn/floor/swamp*` 4 | `dngn/wall/lab-rock*` 4 (DCSS의 WALL_SWAMP 별칭) | 통과 |
| Shoals | `dngn/floor/sand*` 8 | `dngn/wall/shoals_wall*` 4 | 통과 |
| Vaults | `dngn/floor/rect_gray*` 4 | `dngn/wall/vault*` 4 | 통과 |
| Zot | `dngn/floor/tomb*` 4 | DCSS는 `zot_blue*`를 `%hue 240 50`으로 노랗게 바꾼 WALL_ZOT_YELLOW를 쓴다. 아래 참고 | 통과 |

- 정확한 파일 목록은 enum 정의에서 가져온다. 접두어 glob(`lair*`)만으로는 `lair_*` 같은 다른 계열이 섞일 수 있다. 실제로 쓸 이름은 `assets/dcss-include.json`이나 코드 상수에 **명시적으로** 적는다.
  - 예: `tileSet('dcss/dngn/floor/lair')`가 `lair0`–`lair15`를 찾는 기존 숫자 규칙을 그대로 쓸 수 있으면 그것으로 충분하다.
  - 숫자 규칙이 맞지 않는 계열(`spider00` 두 자리, `sand1`부터 시작, `shoals_wall1`부터 시작 등)은 tileSet을 확장한다(0/1 시작, 두 자리 허용). 또는 이름 배열을 직접 적는다.
- Zot 벽: import 스크립트가 `zot_blue0–3`에 DCSS의 `%hue 240 50`을 적용해 `assets/dcss/derived/wall/zot_yellow0–3.png`를 만든다.
  - DCSS 규칙은 색상환에서 hue 240 근처의 픽셀을 50으로 옮기는 것이다. `rltiles/tool`의 구현을 읽고 따른다.
  - 원본이 CC0이므로 파생물도 쓸 수 있다. 출처는 index.json에 `derivedFrom`으로 적는다.
  - 이것이 복잡하면 `dngn/wall/wall_metal_zot*`(4장, 통과)로 대신하고 보고한다.

**적용**

- `src/view/look.ts`에 브랜치별 Look 표(`BRANCH_LOOK: Record<Branch, Look>`)를 만든다.
  - `back` 색은 브랜치 분위기에 맞춰 어둡게 정한다(예: Swamp 진녹갈, Shoals 진청).
  - 기존 `LOOKS`(dcss/bright 전환 스위치)는 Dungeon에만 적용한다.
- 2D `render.ts`와 3D `TileGround`가 현재 층의 브랜치(`w.dungeonGraph.nodes.get(w.depth)?.branch`)로 Look을 고른다. 층이 바뀌면 다시 만든다. TileGround는 `ensure()`에서 이미 층 변경을 감지하므로 Look을 바꿔 끼울 수 있게 한다.
- `world3d.ts:275`의 조건을 바꿔 **모든 브랜치**에서 타일 바닥을 쓴다(`ground === 'tiles'` 설정일 때). KayKit 바닥은 `ground` 설정이 models일 때만 쓴다.
- 브랜치 입구·출구 계단(`stairTile.ts`)과 물(`waterSurface`)은 그대로 둔다.

### 3.8 브랜치 데모 페이지 `branches.html`

- spells.html처럼 별도 페이지로 만들고, **빌드 입력에도 넣는다**(배포본에서 사용자가 볼 수 있게).
- 구성
  - 위쪽(가로 화면은 왼쪽)에 브랜치 버튼 10개(던전, 뱀굴, 오크 광산, 사원, 뱀 소굴, 거미 둥지, 늪, 해안, 금고, 조트)를 둔다. 이름은 기존 한국어 표기가 있으면 그것을 쓴다.
  - 가운데는 **실제 게임 생성기로 만든 그 브랜치의 층 하나**를 보여 준다.
    - `makeWorld`에 그 브랜치 노드의 depth를 주어 만들거나, 그 브랜치 첫 층으로 이동시킨다.
    - 몬스터는 그 브랜치 출현 몬스터를 배치하되 움직이지 않고 공격하지 않는다(spells 데모의 STILL과 무적 처리 참고).
  - 주인공은 키보드(WASD)와 터치 스틱으로 걸어 다니며 층을 둘러볼 수 있다. 시야는 전체 공개(또는 데모 스위치로 전체 공개 토글)이다.
  - 2D/3D 전환 버튼을 둔다.
  - 아래쪽(가로 화면은 오른쪽) 패널
    - 그 브랜치의 바닥 타일과 벽 타일 전 변형을 썸네일(64px)과 `dcss/...` 이름으로 보여 준다.
    - 그 브랜치 몬스터의 타일, 이름, 출처 경로를 보여 준다. 대체(2010판·대체 벽)인 것은 표시한다.
  - "다시 생성" 버튼(시드 변경)을 둔다.
- 코드는 `src/demo/branches.ts`에 둔다. 게임과 같은 렌더러(`World3D`, `drawWorld`)를 쓴다. 게임 코드를 데모 전용으로 바꾸지 않는다.
- 휴대폰 세로(390×844)에서도 쓸 수 있어야 한다. 버튼 높이는 44px 이상이다.
- 개발용 `tiles.html`(3.5)은 그대로 둔다. `branches.html`에서 링크해도 된다.

### 3.9 추가 테스트

- `BRANCH_LOOK`의 모든 브랜치가 floor·wall을 1장 이상 가지고, 모든 이름이 `hasTile`이다.
- Look에 쓰인 `dcss/...` 이름이 3.3 라이선스 판정을 통과한다.
- 몬스터 데이터의 모든 `tile`이 시트에 있다(`hasTile`).

## 4. 범위 밖

- 손으로 고른 층의 기존 이름을 `dcss/...`로 옮기는 일은 하지 않는다.
- 32×48 등 큰 타일을 시트에 넣는 일은 하지 않는다.
- 3D 모델 교체는 하지 않는다.

## 5. 수동 확인 (Claude가)

- `tiles.html`에서 검색·복사·표시가 되는지 본다.
- 게임에서 브랜치 몬스터 몇 종이 제 그림으로 나오는지 본다. 데모 스테이지나 디버그로 소환해서 확인한다.
- 교체된 2010 그림(주인공 미노타우로스, 쥐, 도끼, 계단, 반지, 사슬갑옷)을 화면에서 본다.
- 시트 크기(`public/tiles.png`)가 크게 늘지 않았는지 본다. 브랜치 타일 추가로 약 150장이 늘어나는 것은 예상 범위다.
- `branches.html`에서 10개 브랜치를 PC와 휴대폰 크기로 각각 2D/3D 스크린샷한다.

## 6. 완료 조건

- `branches.html`이 빌드 결과에 포함된다.
- `npm run tiles:import ...`(실행 결과 포함), `npm run tiles`, `npm run format`, `npm run check`, `npx vite build`가 통과한다.
- **git 커밋은 하지 말고 변경을 작업 트리에 남긴다.** `npm ci`는 실행하지 않는다.
- 계획과 다르게 판단한 부분, 2010 대체 파일 크기 문제, 추가로 걸린 타일은 마지막 메시지에 적는다.
