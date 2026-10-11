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

파일 이름과 그림은 원본 그대로다.

## 타일을 더하는 법

1. 원본에서 32×32 PNG를 `assets/tiles/<폴더>/`에 넣는다.
2. 위의 목록과 대조하고, 이 문서의 표에 적는다.
3. `npm run tiles`를 돌린다. `public/tiles.png`(한 장으로 묶은 것)와 `src/data/tiles.gen.ts`(이름 목록)가 다시 만들어진다.
