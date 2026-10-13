# 아이템 데이터 확장 구조

아이템 정의는 `src/data/json/items.json`에 모으고, 공통 정보는 `src/data/itemCatalog.ts`에서 검사한다.
기존 무기·부메랑·돌·속성·아티팩트 규칙은 `src/data/items.ts` 및 `src/sim/equipment.ts`에 그대로 둔다.

## 종류

`weapon`, `throw`, `missile`, `book`, `potion`, `scroll`, `wand`, `jewellery`, `armour`, `shield`, `misc`

`brand`, `randartOption`, `artefact`, `config`, `names`는 기존 전용 데이터로 계속 처리한다.

## 공통 필드

| 필드 | 의미 |
| --- | --- |
| `id`, `kind`, `name` | 고유 ID, 분류, 표시 이름 |
| `enabled` | 실제 콘텐츠로 활성화되었는가. 기본값 `true` |
| `tile` | 기존 타일 아틀라스의 타일 ID. 활성 아이템은 필수 |
| `useMode` | `equip` / `store` / `choose` / `on_step` / `learn` / `automatic` |
| `stackable`, `maxStack` | 중첩 가능 여부와 최대 묶음 수 |
| `depthWeights` | 드롭 등급 0~2(`lootTier`, 현재 던전 노드의 difficulty로 정함)별 가중치. 기본값 `[0, 0, 0]` |
| `effects` | `{ id, power?, duration?, radius? }` 배열. 효과 ID로 실제 동작을 연결할 예정 |

`parseItemDefinition`, `itemDefinition`, `ITEM_DEFINITIONS`로 공통 데이터를 읽는다.
효과가 있는 미구현 아이템은 반드시 **`enabled: false`**, 드롭 가중치 0으로 두어야 한다.
실행기와 타일을 구현하기 전에는 활성화할 수 없도록 검사한다.

## 11단계를 위한 초안 (당시 기록)

> 이후 물약·두루마리·완드 일부가 드롭, 가방, 사용 효과, 감정까지 연결됐다(`src/sim/consumables.ts`, `itemEffects.ts`, `identification.ts`). 아래는 처음 넣을 때의 기록이고, 활성 여부는 `items.json`의 `enabled`를 본다.

`potion_healing`, `scroll_blink`를 비롯해 완드·반지·갑옷·방패 샘플 여섯 개를
`items.json`에 **비활성 설계 데이터**로 넣었다. 아직 드롭, 획득, 인벤토리, 사용 효과, 식별 기능은 없다.

새 아이템을 실제로 출시할 때는 다음 연결이 필요하다.

1. 타일을 라이선스 확인 후 추가하고 `npm run tiles` 실행.
2. 효과 ID의 실제 동작을 `src/sim`에 구현하고 활성 효과 목록에 연결.
3. 바닥 아이템 종류 및 생성/획득/소지/사용 로직을 연결.
4. UI에 표시 및 사용 버튼 추가, 테스트 작성.
5. 연결 후 `enabled: true`로 변경.

**아이템을 JSON에 추가하는 행위와 실제 플레이 콘텐츠로 활성화하는 행위를 분리**한 구조다.

## 장비 기반 마법 무기와 보조손 (2026-10-12)

- 주손: 일반 무기, 양손 **지팡이**(staff), 한손 **마법봉**(rod). 공격 경로는 주손으로 결정한다.
- 보조손(offhand): 방패 또는 **마법서**(spellbook). 양손 주손에는 보조손을 장착할 수 없으며 자동으로 가방으로 돌아간다.
- 마법 장비는 하나의 학파와 입문/숙련/대가 0~2티어를 가진다. 각각 학파의 최대 3/6/9레벨 마법을 제공한다.
- 지팡이는 자동 공격과 마법 버튼을, 마법봉은 약한 자동 공격만을, 마법서는 마법 버튼만을 제공한다.
- 기존 소모품 wand와 새로운 주손 rod는 별개 종류다. 신규 아트는 추후 교체할 임시 타일이다.
- 일반 물리 무기는 레벨업 카드에서도 랜다트가 나올 수 있다. 마법 장비에는 랜다트를 적용하지 않는다.

## 부위 강화와 획득 (2026-10-13)

- 레벨 2~27의 각 레벨업은 아이템이 아니라 영구 부위 강화 1회를 준다. 강화 단계는 장착 아이템과 분리되어 빈 부위에도 적용되고 장비를 바꿔도 유지된다.
- 10개 부위의 단계당 효과와 상한은 `src/data/json/slots.json`에 있다. 반지 두 칸은 처음 강화할 때 각각 저항을 하나 정한다.
- 9·18·27레벨에는 부위 강화 뒤에 획득이 이어진다. 무기·방어구·장신구·보조손 중 종류를 고르면 현재 `lootTier`의 아이템 하나가 가방에 들어간다.
- 양손 주손을 사용하면 보조손 종류 카드는 나오지 않는다. 물리 무기 획득의 랜다트 확률은 `dungeon.json.acquireRandartChance`이고, 바닥 무기의 티어별 확률과는 별개다.
- 획득은 회복이나 금화로 건너뛸 수 있지만 부위 강화는 건너뛸 수 없다. 고유 아티팩트와 아이템 자체의 `enchantment`는 이 시스템과 분리되어 있다.
