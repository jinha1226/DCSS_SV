# 타일의 출처

`assets/tiles` 아래의 그림은 전부 Dungeon Crawl Stone Soup의 타일이다. 이 저장소는 DCSS에서 **타일만** 가져오고, 코드와 볼트 파일과 설명문은 가져오지 않는다.

- 가져온 곳: <https://github.com/crawl/crawl> 의 `crawl-ref/source/rltiles`
- 가져온 시점: 커밋 `bbeaa5dcc028ffe82a8bc0c96db5f3266cd00bd3` (2026-10-10)
- 라이선스: CC0 1.0. 전문은 [CC0.txt](CC0.txt)에 있다.

## 라이선스를 확인한 방법

DCSS의 `LICENSE`는 타일 대부분이 CC0라고 밝히면서, 오래된 타일은 사정이 복잡할 수 있으니 <https://github.com/crawl/tiles> 를 보라고 한다. 그 저장소의 `TILES_UNDER_UNKNOWN_LICENSE.md`가 권리가 불분명해 재사용할 수 없는 타일의 목록이다.

아래 타일은 가져올 때 그 목록과 이름을 대조했고, 겹치는 것이 없었다. 목록은 2010년 기준이라는 점은 알아 둔다. **타일을 더 가져올 때마다 같은 대조를 한다.** 예를 들어 투창(`javelin`) 타일은 전부 그 목록에 있어서 쓰지 않고, 던지는 무기는 부메랑 타일로 했다.

## 가져온 타일

| 폴더 | 원본 위치 | 타일 |
| --- | --- | --- |
| `floor` | `dngn/floor` | `grey_dirt0`–`7`, `limestone0`–`9` |
| `wall` | `dngn/wall` | `brick_brown0`–`7`, `brick_gray0`–`3` |
| `feat` | `dngn/gateways` | `stone_stairs_down`, `stone_stairs_up` |
| `hero` | `mon/demihumanoids` | `minotaur`, `barachi` |
| `mon` | `mon/animals`, `mon/humanoids` | `rat`, `bat`, `jackal`, `adder`, `goblin`, `kobold`, `gnoll`, `ogre` |
| `item` | `item/weapon` | `hand_axe1`, `war_axe1`, `broad_axe1`, `battle_axe1`, `executioner_axe1` |
| `item` | `item/weapon/ranged` | `stone`, `boomerang1`, `shortbow1`, `orcbow1`, `longbow1`, `longbow2` |
| `misc/blood` | `misc/blood` | `blood_red00`–`09`, `blood_puddle_red`, `blood_puddle_red1`–`4` |
| `dngn/gateways` | `dngn/gateways` | `enter_lair`, `enter_orc`, `enter_snake`, `enter_spider`, `enter_vaults_open`, `enter_vaults_closed`, `enter_zot_open`, `enter_zot_closed`, `return_zot` |
| `item` | `item/gold` | `10` (`gold.png`로 저장) |

`enter_shoals`, `enter_swamp`, `enter_temple`과 `exit_*` 타일은 알 수 없는 라이선스 목록에 있어서 쓰지 않는다(2010 배포본에도 없다). 입구는 라이브러리의 자유 타일로 대신한다(`src/view/stairTile.ts`의 `ENTRANCE_STAND_INS`): 사원은 `dcss/dngn/gateways/enter_depths`, 늪은 `dcss/dngn/gateways/slimy_stairs_down`, 해안은 `dcss/dngn/gateways/portal`. 브랜치에서 나가는 계단(출구)은 원본 `exit_*`을 쓸 수 없어서 그 브랜치의 입구 관문 그림을 같이 쓴다. 3D에서는 입구와 출구 관문이 모두 서 있다.

파일 이름과 그림은 원본 그대로다.

## DCSS 타일 라이브러리 (`assets/dcss`)

2026-10-13부터 DCSS에서 재사용할 수 있는 타일을 **전부** `assets/dcss/` 아래에 들여 두었다. 폴더와 파일 이름은 원본 `rltiles` 그대로이고, 게임에서의 이름은 `dcss/` + 경로(확장자 없음)다. 예: `dcss/mon/animals/wolf`.

- 가져온 곳: crawl/crawl `871aabe2082cb5819a4ec044ea8f840388598ff4` (2026-10-13)의 `crawl-ref/source/rltiles` 전체, `UNUSED/` 포함
- 라이선스 목록: crawl/tiles `a6ea1655db5c044829d9eea19a232fa6fcac87b0`의 `TILES_UNDER_UNKNOWN_LICENSE.md` (사본: `assets/dcss/unknown-license.txt`)
- 결과: 7,810장(+파생 4장)을 들였고, 937장은 뺐다(`assets/dcss/excluded.json`에 이유와 함께). `assets/dcss/index.json`에 이름과 크기가 있다.

### 빼는 규칙 (`tools/tileLicense.mjs`)

rltiles 기준 경로가 다음 중 하나면 쓰지 않는다.

1. 목록의 경로와 같다(작가별 "연락이 될 때까지 제외" 목록, nethack 유래 목록).
2. 파일 이름이 2010년 목록(경로 없이 이름만 있는 부분)에 있다.
3. 파일 이름이 목록의 옛 `dc-*` 폴더 항목의 이름과 같다(지금 폴더 구조로 대응시킬 수 없어 보수적으로 막는다).

`tests/unit/tileLicense.test.ts`가 라이브러리와 시트의 모든 `dcss/` 타일이 이 규칙을 통과하는지 검사한다.

### 파생 타일

- `dcss/derived/wall/zot_yellow0`–`3`: DCSS가 빌드할 때 `zot_blue`에 `%hue 240 50`을 걸어 만드는 노란 조트 벽. 들여올 때 같은 계산으로 만든다.

### 시트에는 쓰는 것만

7,800장을 한 장에 묶으면 너무 무겁다. `npm run tiles`는 `assets/tiles` 전부와 함께, 아래에 해당하는 `dcss/` 타일만 시트에 넣는다(`tools/tileSelection.mjs`).

- `src/**/*.ts`, `src/**/*.json`에 따옴표로 적힌 `dcss/...` 이름
- `assets/dcss-include.json`의 항목. `#`으로 끝나면 번호 변형 전부(`dcss/dngn/floor/lair#` → `lair0`–`lair15`)

없는 이름을 적거나 32×32가 아닌 타일을 적으면 `npm run tiles`가 멈춘다.

### 브랜치별 바닥·벽 (`src/view/look.ts`의 `BRANCH_LOOK`)

DCSS `tileview.cc`의 `tile_default_flv`를 따른다.

| 브랜치 | 바닥 | 벽 |
| --- | --- | --- |
| Dungeon | `floor/grey_dirt` (손으로 고른 층) | `wall/brick_brown`. DCSS 원본 `brick_dark_1`은 전부 제외라 쓰지 않는다 |
| Lair | `dngn/floor/lair` 16 | `dngn/wall/lair` 8 |
| Orc | `dngn/floor/orc` 8 | `dngn/wall/orc` 12 |
| Temple | `dngn/floor/floor_vines` 7 | `dngn/wall/wall_vines` 7 |
| Snake | `dngn/floor/mosaic` 16 | `dngn/wall/snake` 10 |
| Spider | `dngn/floor/spider` 12 | `dngn/wall/wall_stone_spider` 4. 원본 `dngn/wall/spider`는 전부 제외(Bloax) |
| Swamp | `dngn/floor/swamp` 4 | `dngn/wall/lab-rock` 4 |
| Shoals | `dngn/floor/sand` 8 | `dngn/wall/shoals_wall` 4 |
| Vaults | `dngn/floor/rect_gray` 4 | `dngn/wall/vault` 4 |
| Zot | `dngn/floor/tomb` 4 | `derived/wall/zot_yellow` 4 |

`branches.html`(브랜치 둘러보기)에서 브랜치마다 실제로 생성된 층과 쓰인 타일을 볼 수 있다.

### 브랜치 몬스터

브랜치 전용 몬스터 13종은 각자의 DCSS 타일을 쓴다(`src/data/json/monsters.json`). 늪 비룡은 현행 타일이 제외 목록(Bloax)에 있어서, 2010 배포본(`releases/Ancient/Oct-5-2010/dc-mon/swamp_drake.png`)의 그림을 `assets/tiles/mon/swamp_drake.png`로 들였다.

### 이미 쓰던 타일 중 제외 목록에 걸린 것: 2010판으로 교체 (2026-10-13)

예전 도입 때는 2010년 이름 목록하고만 대조해서, 아래 손으로 고른 타일이 지금 판 기준으로 제외 목록에 걸렸다. 모두 같은 이름을 유지한 채 crawl/tiles의 2010 CC0 배포본(`releases/Ancient/Oct-5-2010/`)의 이전 그림으로 바꿨다.

`hero/minotaur`, `player/base/minotaur_m`, `player/head/iron1`, `item/war_axe1`, `item/battle_axe1`, `item/broad_axe1`, `item/executioner_axe1`, `item/armour/chain_mail1`, `mon/rat`, `player/body/chainmail`, `player/body/leather_armour`, `feat/stone_stairs_down`, `feat/stone_stairs_up`, `item/ring/diamond`, `item/ring/silver`, `mon/swamp_drake`(새로 들임)

`assets/tiles/SOURCES.json`에 손으로 고른 타일 하나하나의 출처(현행 DCSS 경로 또는 2010 배포본 경로)와 SHA-1이 있다. `tests/unit/tileLicense.test.ts`가 파일과 출처가 바이트 단위로 맞는지, 현행 DCSS 출처가 제외 규칙을 통과하는지 검사한다. 타일을 더하거나 바꾸면 이 파일도 고친다.

### 다시 들여오기

DCSS와 crawl/tiles를 받은 뒤:

```
npm run tiles:import -- <crawl>/crawl-ref/source/rltiles <crawl/tiles> <crawl 커밋> <tiles 커밋>
npm run tiles
```

## 타일을 더하는 법

- 라이브러리에 있는 타일: 코드나 데이터에 `dcss/...` 이름을 적고 `npm run tiles`를 돌린다. 이름은 `branches.html`의 목록이나 `assets/dcss/index.json`에서 찾는다.
- 그림을 고치거나 이름을 바꿔 쓰려면:
1. 원본에서 32×32 PNG를 `assets/tiles/<폴더>/`에 넣는다.
2. 위의 규칙으로 대조하고, 이 문서의 표에 적는다.
3. `npm run tiles`를 돌린다. `public/tiles.png`(한 장으로 묶은 것)와 `src/data/tiles.gen.ts`(이름 목록)가 다시 만들어진다.

- `player/base/troll_m.png`: 트롤 플레이어 바탕. crawl-tiles `releases/Ancient/Oct-5-2010/player/base/troll_m.png` (CC0 2010 배포본), SHA-1 `7092878e990650f59cfc06630948db4590f6f939`.
- `player/body/scalemail.png`: 비늘 갑옷 착용 레이어. crawl-tiles `releases/Ancient/Oct-5-2010/player/body/scalemail.png` (CC0 2010 배포본), SHA-1 `578d5954d9477c974307a46b7802f4dc12f764c0`.
