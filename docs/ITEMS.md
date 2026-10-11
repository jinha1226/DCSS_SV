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
| `depthWeights` | 1~3층의 드롭 가중치. 기본값 `[0, 0, 0]` |
| `effects` | `{ id, power?, duration?, radius? }` 배열. 효과 ID로 실제 동작을 연결할 예정 |

`parseItemDefinition`, `itemDefinition`, `ITEM_DEFINITIONS`로 공통 데이터를 읽는다.
효과가 있는 미구현 아이템은 반드시 **`enabled: false`**, 드롭 가중치 0으로 두어야 한다.
실행기와 타일을 구현하기 전에는 활성화할 수 없도록 검사한다.

## 11단계를 위한 초안

`potion_healing`, `scroll_blink`를 비롯해 완드·반지·갑옷·방패 샘플 여섯 개를
`items.json`에 **비활성 설계 데이터**로 넣었다. 아직 드롭, 획득, 인벤토리, 사용 효과, 식별 기능은 없다.

새 아이템을 실제로 출시할 때는 다음 연결이 필요하다.

1. 타일을 라이선스 확인 후 추가하고 `npm run tiles` 실행.
2. 효과 ID의 실제 동작을 `src/sim`에 구현하고 활성 효과 목록에 연결.
3. 바닥 아이템 종류 및 생성/획득/소지/사용 로직을 연결.
4. UI에 표시 및 사용 버튼 추가, 테스트 작성.
5. 연결 후 `enabled: true`로 변경.

**아이템을 JSON에 추가하는 행위와 실제 플레이 콘텐츠로 활성화하는 행위를 분리**한 구조다.
