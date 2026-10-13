# 1차 a: Fighter 직업과 Gargoyle·Troll·Mountain Dwarf 종족 구현계획서

작성일: 2026-10-13
대상: Codex 구현, Claude 검토
근거: `docs/research/2026-10-13-dcss-popular-builds.md`
- Fighter는 플레이 수 1위 직업인데 아직 없다.
- 세 종족은 인기와 입문 추천이 겹친다.

라이선스: 코드는 GPL-3.0-or-later라서 DCSS 데이터를 그대로 참고해도 된다(`docs/CREDITS.md`).

## 1. 원본 자료 (읽기 전용, 네트워크 불필요)

- DCSS 소스: `/mnt/d/PROJ_SV/reference/dcss-source/`
  - 종족: `dat/species/{gargoyle,troll,mountain-dwarf,minotaur,barachi,deep-elf}.yaml`
  - 직업: `dat/jobs/{fighter,berserker,hunter,fire-elementalist}.yaml`
- crawl/tiles 저장소(2010 CC0 배포본 포함): `/mnt/d/PROJ_SV/reference/crawl-tiles/`
  - 2010 배포본: `releases/Ancient/Oct-5-2010/`

## 2. 지금 게임의 데이터 규칙 (기존 3종족과 원본을 비교해 정한 것)

- **적성**: `species.json`의 `aptitudes`는 `good | normal | bad`이고 기술 20개를 쓴다.
  - DCSS 숫자에서 바꾸는 규칙: **+2 이상은 good, -1~+1은 normal, -2 이하는 bad**. 미노타우로스로 확인했다. 예: fighting 2 → good, dodging 1 → normal, earth -2 → bad.
  - 우리 기술과 DCSS 기술의 대응
    - blade: long_blades와 short_blades 중 높은 쪽
    - axe: axes
    - mace: maces_and_flails
    - polearm: polearms
    - unarmed: unarmed_combat (없으면 0)
    - ranged: ranged weapons
    - throwing, fighting, armour, dodging, shield(shields), stealth, spellcasting: 같은 이름
    - fire, ice, air, earth: `*_magic`
    - summoning, hexes, necromancy: 같은 이름
  - 먼저 기존 3종족(minotaur, barachi, deep_elf)에 이 규칙을 적용해 지금 값과 같은지 확인한다. 다르면 기존 값을 바꾸지 말고, 다른 점을 마지막 메시지에 보고한다.
- **시작 기술**: 우리 값은 DCSS 직업 YAML의 대략 1/3이다(광전사: DCSS fighting 3, dodging 2, weapon 3 → 우리 1, 1, 1). Fighter도 같은 비율로 정한다.
- **HP**: 지금 미노타우로스 60은 DCSS hp 적성 +1이다. 다른 종족도 이 기준에서 적성 1당 약 ±5로 정한다. 기존 종족 값과 비교해 근거를 적는다.
- **이동 속도, 반지름, 시야, 재생 등**: 기존 종족의 값을 기준으로 DCSS 특징을 반영한다.
  - 트롤은 size large라 반지름이 조금 크다.
  - 원본에 없는 수치를 새로 만들 때는 기존 종족과의 차이를 주석이나 note로 설명한다.

## 3. Fighter (`jobs.json`)

- id `fighter`, 이름 "전사"
- 원본(`fighter.yaml`): 비늘 갑옷(scale mail), 버클러, 힘의 물약 2개, 무기 선택, 기술 fighting 3·armour 3·shields 3·weapon 2
- 우리 게임
  - 시작 무기: `hand_axe`(도끼가 무기 기술 1위다)
  - 시작 갑옷: `scale_mail`(새 아이템, 3.1)
  - 방패: `buckler`
  - 시작 아이템: `potion_might` 2개
  - 시작 기술: fighting 1, armour 1, shield 1, axe 1
  - 투척물: 광전사와 같은 기본값
- 캐릭터 선택 화면에 나오게 한다. 종족과 직업 카드 순서에서 Fighter를 직업 맨 앞에 둔다.

### 3.1 비늘 갑옷 아이템

- `items.json`에 `scale_mail`을 추가한다. kind armour, 몸 부위.
- AC와 회피 패널티는 DCSS 원본 표의 비율로 가죽 갑옷과 사슬 갑옷 사이에 둔다. 기존 두 갑옷의 우리 값과 DCSS 값의 비율을 맞춘다.
- 아이템 그림: `dcss/item/armour/scale_mail1`(라이브러리에 있고 사용 가능)
- 입은 모습(doll 몸 레이어): `assets/dcss/player/body/` 아래에서 비늘 갑옷에 맞는 사용 가능 타일을 찾는다.
  - 없으면 2010 배포본(`player/body/`)에서 찾아 `assets/tiles/player/body/`에 들이고 `SOURCES.json`에 적는다.
  - 둘 다 없으면 사슬 갑옷 그림을 쓰고 보고한다.
- 아이템 설명(lore)은 DCSS `dat/descript/items.txt`와 `ko/items.txt`의 scale mail 항목을 기존 `lore.json` 형식대로 넣는다.

## 4. 새 종족 세 개 (`species.json` 등)

공통 작업
- 이름
  - gargoyle: 가고일
  - troll: 트롤
  - mountain_dwarf: 마운틴 드워프
- 적성: 2장 규칙으로 원본 YAML에서 바꾼다.
- 캐릭터 그림(doll 바탕 레이어, `src/view/doll.ts`의 종족→바탕 표)
  - 가고일: `dcss/player/base/gargoyle_m`
  - 마운틴 드워프: `dcss/player/base/dwarf_m`
  - 트롤: 현행 `player/base/troll_m`은 **재사용 불가 목록**이다. 2010 배포본 `releases/Ancient/Oct-5-2010/player/base/troll_m.png`를 `assets/tiles/player/base/troll_m.png`로 들이고 `assets/tiles/SOURCES.json`에 `ancient-2010` 출처와 SHA-1을 적는다(라이선스 테스트가 검사한다).
- 종족의 `tile`(초상과 기본 그림)은 기존 종족이 쓰는 방식을 따른다. 위 바탕 그림이나 그에 대응하는 사용 가능 타일을 쓴다.
- 모든 새 `dcss/...` 이름은 코드나 데이터에 따옴표로 적고 `npm run tiles`로 시트에 넣는다.
- 3D 캐릭터 모델 모드(`figures=models`)에서 이 종족이 무엇으로 그려지는지는 기존 종족의 대체 규칙을 따른다. 새 모델은 만들지 않는다.

종족별 특징. **새 시스템을 만들지 말고 기존 traits와 effect 구조 안에서** 한다. 맞는 구조가 없으면 그 특징은 빼고 보고한다.
- **가고일**: 원본은 돌 몸(AC 보너스, 레벨에 따라), 전기 저항, 음에너지 저항, 고문 저항이다. 우리 게임에서는 다음을 한다.
  - AC 보너스(레벨 비례)
  - 전기 저항: 기존 resists 구조가 있으면
  - 독 면역: 원본에 독 면역이 없으면 넣지 않는다
  - 근접과 대지 마법이 good이다.
- **트롤**
  - HP가 높다(hp +3).
  - 빠른 재생: 기존 `regen` 값을 크게 한다.
  - 발톱: 맨손이나 추가 근접 피해. 기존 unarmed 구조가 있으면 쓴다.
  - 대부분 적성이 bad다(원본 그대로).
  - 반지름이 조금 크다.
- **마운틴 드워프**
  - 도끼·둔기·갑옷·방패가 good이다.
  - 원본의 아티팩트 강화 특성은 우리 게임에 대응 시스템이 없으니 넣지 않는다.

## 5. 입문 추천 표시

- 국내외 공략이 공통으로 추천하는 조합을 캐릭터 선택 화면에 "추천" 배지로 표시한다.
  - 미노타우로스 광전사(미노광): **입문 추천**
  - 딥엘프 화염술사(딥엘 화법): **첫 마법사 추천**
  - 미노타우로스 전사, 가고일 전사, 트롤 전사: 추천
- 데이터: `jobs.json`이나 별도 작은 JSON에 `recommended: [{species, job, label}]`를 둔다. UI는 해당 직업 카드에 작은 배지를 단다.

## 6. 테스트

- 새 종족과 직업이 데이터 검증(`validate.ts`)을 통과하고, 모든 조합으로 `makeWorld`가 만들어진다.
- 적성 대응 규칙: 원본 YAML 일부를 테스트 안에 상수로 옮겨 두고, 변환 함수(만들었다면)의 결과가 `species.json` 값과 같은지 검사한다. 함수가 없으면 대표 몇 개(가고일 earth good, 트롤 spellcasting bad, 드워프 axe good)만 검사한다.
- 전사 시작 장비: 비늘 갑옷, 버클러, 힘의 물약 2개, 손도끼.
- 트롤 재생이 미노타우로스보다 빠르고, 가고일 AC가 레벨에 따라 오른다.
- 라이선스 테스트가 새 타일(트롤 바탕 그림 포함)로 통과한다.
- 봇 측정(`tests/bench`): 가고일 전사, 트롤 전사, 마운틴 드워프 전사 30판 묶음을 하나 추가한다. 하나씩 실행하고 결과를 보고한다.

## 7. 문서

- `docs/TILES.md`: 새로 들인 2010 타일을 적는다.
- `docs/IMPLEMENTATION_2RUNE.md`: 기존 형식으로 항목을 추가한다.

## 8. 완료 조건

- `npm run tiles`, `npm run format`, `npm run check`, `npx vite build`가 통과한다.
- **git 커밋과 git stash는 하지 말고 변경을 작업 트리에 남긴다.** `npm ci`는 실행하지 않는다.
- 마지막 메시지(한국어)에 다음을 적는다.
  - 바꾼 파일
  - 적성 규칙을 기존 종족에 맞춰 본 결과
  - 빼거나 바꾼 종족 특징과 이유
  - 봇 측정 결과
  - 계획과 다르게 판단한 점
