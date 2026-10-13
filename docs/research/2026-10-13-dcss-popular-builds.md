# DCSS 인기 빌드 조사: 우선 구현할 종족·직업·주문

작성일: 2026-10-13
목적: 실제 플레이 기록을 근거로, 이 게임에 먼저 넣을 종족·직업·주문을 고른다. 타겟은 DCSS 입문자이고, 실패율 없음, 주요 주문 위주라는 방향이다.

## 1. 자료

| 자료 | 내용 | 한계 |
| --- | --- | --- |
| CAO 서버 0.34 로그 (`crawl.akrasiac.org/logfile34`) | 156,600판, 3,200명. 판마다 종족·직업·XL·승리 여부·주 기술·신 | CAO 한 서버뿐이다. 다른 공식 서버는 넣지 않았다. 주 기술은 끝날 때 가장 높은 기술이다 |
| CAO 모그 파일 130개 | 0.34에서 XL 12 이상, 주 기술이 마법인 판을 무작위로 뽑았다. 끝날 때 외우고 있던 주문 | 표본이 작다. 같은 사람이 여러 번 뽑혔을 수 있다 |
| CrawlWiki "Background and race combinations for beginners" (0.34) | 입문자 추천 조합 | 위키 편집자의 의견이다 |
| 디시 로그라이크 갤러리 공략 모음(공지 76481, 입문 51365, 스킬트리 75771·25634, 반신족 452839, 던전 순서 149282) | 국내 입문 추천 빌드와 스킬 비중 | 오래된 버전 기준이 많다 |

"플레이 수"는 XL 5 이상(곧바로 포기한 판 제외)인 판을 셌다. 89,845판이다.

## 2. 결과

### 2.1 종족 (XL 5 이상 플레이 수, 승률)

| 순위 | 종족 | 플레이 | 승률 | 비고 |
| --- | --- | --- | --- | --- |
| 1 | Minotaur | 15,162 | 0.9% | 압도적 1위. **이미 있음** |
| 2 | Mountain Dwarf | 6,028 | 1.0% | 근접, 대장장이 |
| 3 | Demonspawn | 5,988 | 0.9% | 돌연변이 중심이라 구현 비용이 크다 |
| 4 | Deep Elf | 5,815 | 0.6% | 순수 마법사. **이미 있음** |
| 5 | Troll | 5,582 | 0.7% | 근접 괴력, 위키 입문 추천 |
| 6 | Octopode | 5,401 | 0.7% | 촉수와 갑옷 제한 특수 |
| 7 | Coglin | 5,110 | 0.9% | 쌍수 원거리(CoHu) |
| 8 | Gnoll | 4,898 | 0.9% | 모든 기술 동시 훈련. 위키 입문 추천 |
| 9 | Gargoyle | 4,311 | 1.3% | 근접과 대지 마법 모두 강함. 위키 입문 추천 |
| 12 | Djinni | 2,726 | **2.4%** | 주문을 고르지 않는 마법사. 위키 입문 추천 |
| 24 | Barachi | 900 | 2.2% | 도약. **이미 있음** |

### 2.2 직업

| 순위 | 직업 | 플레이 | 승률 | 지금 게임 |
| --- | --- | --- | --- | --- |
| 1 | Fighter | 19,718 | 0.8% | 없음 |
| 2 | Berserker | 9,667 | 1.4% | **있음** |
| 3 | Shapeshifter | 8,063 | 0.8% | 없음(변신 계통이라 구현 비용이 큼) |
| 4 | Hunter | 5,810 | 1.2% | **있음** |
| 5 | Conjurer | 5,612 | 0.9% | 없음 |
| 6 | Gladiator | 4,784 | 1.1% | 없음 |
| 7 | Monk | 4,637 | 0.9% | 없음 |
| 8 | Fire Elementalist | 3,668 | 1.2% | fire_mage |
| 9 | Earth Elementalist | 3,621 | 1.2% | earth_mage |
| 14 | Ice Elementalist | 1,604 | 2.2% | ice_mage |
| 19 | Air Elementalist | 1,136 | 2.3% | air_mage |
| 13 | Summoner | 2,000 | 1.7% | summoner |
| 12 | Enchanter | 2,194 | 1.4% | (hexer와 가까움) |
| 21 | Necromancer | 1,075 | 0.8% | necromancer |

### 2.3 조합

- 플레이 수 상위: MiFi 7,053, MiBe 6,070, OpSh 3,010, DECj 2,991, CoHu 2,960, MDFi 2,652, TrFi 2,364, GrEE 1,664, GrFi 1,543, FoFi 1,517
- 승리 수 상위: MiFi 67, FeBe 66, MiBe 41, OpSh 25, CoHu 24, MDFi 21, DjCj 20, DgHu 18, DrEE 17, GrEE 17, GrFi 17

### 2.4 신 (XL 10 이상, 판 수)

Trog 5,166 · Okawaru 3,801 · Gozag 3,213 · Vehumet 2,889 · Wu Jian 2,355 · Makhleb 1,872 · 무신 1,753

### 2.5 주 기술 (XL 12 이상, 끝날 때 가장 높은 기술)

- 근접: Fighting 3,017 · Axes 2,693 · Unarmed 1,581 · Maces 793 · Polearms 490 · Long Blades 353
- 원거리: Ranged Weapons 758
- 마법: Spellcasting 1,773 · Conjurations 438 · Earth 432 · Summonings 228 · Fire 220 · Ice 211 · Hexes 186 · Necromancy 129 · Air 121 · Alchemy 101
- **도끼가 무기 기술 1위**다. 지금 게임이 도끼 중심인 것과 맞다.

### 2.6 주문 (마법사 모그 130개에 외워져 있던 주문 수)

| 주문 | 수 | 학파 |
| --- | --- | --- |
| Blink | 43 | 전이 |
| Iskenderun's Mystic Blast | 41 | 원소탄 |
| Mephitic Cloud | 34 | 원소탄/연금/대기 |
| Searing Ray | 33 | 원소탄 |
| Magic Dart | 32 | 원소탄 |
| Stone Arrow | 32 | 원소탄/대지 |
| Fulminant Prism | 30 | 원소탄/연금 |
| Olgreb's Toxic Radiance | 27 | 연금 |
| Scorch | 25 | 화염 |
| Foxfire | 24 | 원소탄/화염 |
| Fireball | 24 | 원소탄/화염 |
| Sandblast | 22 | 대지 |
| Inner Flame | 22 | 화염/주술 |
| Brom's Barrelling Boulder | 17 | 원소탄/대지 |
| Ignition | 17 | 화염 |
| Flame Wave | 17 | 원소탄/화염 |
| Forge Lightning Spire | 16 | 단조/대기 |
| Poisonous Vapours | 16 | 연금/대기 |
| Frozen Ramparts | 16 | 빙결 |
| Mercury Arrow | 16 | 원소탄/연금 |
| Sticky Flame | 16 | 화염 |

그 밖에 Ozocubu's Armour, Summon Ice Beast, Orb of Destruction, Static Discharge, Airstrike, Call Canine Familiar, Freeze, Shock, Freezing Cloud가 10~13번 나왔다.

학파 등장 횟수(복수 학파는 각각 셈): 원소탄 427, 화염 213, 연금 195, 대지 160, 전이 154, 대기 150, 단조 109, 소환 107, 주술 107, 빙결 106, 강령 78.

## 2.7 국내 커뮤니티 공략 (디시 로그라이크 갤러리)

공지 공략 모음과 입문자 공략 모음에서 추천하는 순서다. 글이 대부분 0.14–0.28 버전 기준이라 세부 수치는 낡았지만, "사람들이 어떤 캐릭터로 게임을 배우는지"는 그대로 참고할 만하다.

| 단계 | 추천 | 내용 |
| --- | --- | --- |
| 입문 | **미노광**(미노타우로스 광전사, MiBe) | "돌죽 입문은 닥치고 미노광". 트로그 신앙, 한손 도끼 + 중갑 + 방패 + **투척**. 도끼를 최소 공속(브로드액스 기준 18)까지 먼저 올리고, 전투·갑옷·방패·투척을 그 절반 비중으로 따라 올린다 |
| 첫 마법사 | **딥엘 화법**(딥엘프 화염술사, DEFE) | "법사 처음이면 딥엘 화법이 최고". 원소탄 + 화염 두 학파를 같은 비중으로, 주문 시전은 그 절반으로 |
| 변형 | 트롤 석상폼 / 변이술사 | 변신 계열이라 이 게임에서는 뒤로 미룬다 |
| 은신 | 스프리건 인챈터, 코볼트 | 은신과 기습이라 실시간 자동전투와 맞지 않는다. 뒤로 미룬다 |
| 기타 | 반신족: 냉기술사로 시작해 **얼음 갑옷 + 프로즌 램파트**로 초반을 버티거나, 헌터로 원거리 견제 | 빙결 학파 초반 핵심 주문이 무엇인지 보여 준다 |

- 중갑 전사도 중후반에 보조 마법(투사체 반사, 전이, 소환 몇 개)을 배운다. 전사용 "유틸 주문"이라는 범주가 있다는 뜻이다.
- 던전 순서 추천: 짐승굴 → 오크 광산 → 짐승굴 서브 던전 → 금고 → … 이 게임의 브랜치 구성과 거의 같다.

## 3. 해석

1. **미노타우로스 근접(MiFi, MiBe)이 DCSS의 대표 경험이다.** 지금 게임의 기본 캐릭터 선택과 맞다.
2. **Fighter가 압도적 1위 직업인데 지금 게임에 없다.** 장비와 기술 선택이 단순한 정석 근접 직업이라 입문자 타겟에 가장 잘 맞는다. 가장 먼저 넣을 직업이다.
3. **입문자 위키 추천과 인기가 겹치는 종족**: Gargoyle(근접·마법 둘 다), Troll(근접), Mountain Dwarf(근접), Djinni(주문을 고르지 않는 마법사). Djinni는 "실패율 없음, 단순한 마법" 방향과 특히 잘 맞는다.
4. **원소탄(Conjurations)이 마법의 중심이다.** 지금 게임에는 학파로 없다. Magic Dart, Searing Ray, Iskenderun's Mystic Blast, Fulminant Prism이 입문 마법사의 기본기다.
5. **Blink가 가장 많이 외워진 주문이다.** 탈출기가 핵심이라는 뜻이고, 이번 교전 감속 규칙에서 빠져나가는 수단으로 그대로 쓸 수 있다.
6. 강령, 소환, 주술은 상대적으로 덜 쓰인다. 실시간 변환 비용도 크다. 뒤로 미룬다.
7. **국내 커뮤니티도 같은 결론이다.** 입문은 미노광, 첫 마법사는 딥엘 화염술사다. 둘 다 이미 이 게임에 있는 종족이다. 미노광 정석 빌드에 투척이 들어간다는 점은 지금 게임의 투척 시스템과 잘 맞는다.
8. 구현 비용이 큰 인기 요소(Demonspawn 돌연변이, Octopode, Shapeshifter 변신, 신 체계)는 뒤로 미룬다.

## 4. 우선순위 제안

### 1차 (지금 엔진으로 바로)

- **직업**: Fighter 추가. 지금 Berserker, Hunter, 원소 마법사 4종은 유지한다.
- **종족**: Gargoyle, Troll, Mountain Dwarf 추가. 지금 Minotaur, Deep Elf, Barachi는 유지한다.
- **주문**: 원소탄 학파를 새로 만든다(Conjurer 직업 포함). 지금의 자작 주문을 DCSS 대표 주문으로 바꾼다.
  - 원소탄: Magic Dart, Searing Ray, Iskenderun's Mystic Blast, Fulminant Prism, Orb of Destruction
  - 화염: Foxfire, Scorch, Sticky Flame, Inner Flame, Fireball, Flame Wave, Ignition
  - 대지: Sandblast, Stone Arrow, Brom's Barrelling Boulder, Lee's Rapid Deconstruction
  - 빙결: Freeze, Frozen Ramparts, Ozocubu's Armour, Freezing Cloud, Summon Ice Beast
  - 대기: Shock, Static Discharge, Airstrike, Mephitic Cloud
  - 전이: Blink (모든 마법사 공통 탈출기 후보)

### 2차

- Djinni(주문 선택 없는 마법사), Gnoll(모든 기술 동시 훈련), Coglin Hunter
- Gladiator, Monk, Conjurer 외 마법 직업 정리
- 연금(독) 학파: Mephitic Cloud, Poisonous Vapours, Mercury Arrow, Olgreb's Toxic Radiance

### 3차

- 신: Trog, Okawaru, Vehumet, Makhleb 정도부터
- 소환, 주술, 강령 재정비

## 5. 다음 단계

- 1차 범위로 구현계획서를 쓴다.
  - 주문은 DCSS의 위력 공식, 피해 주사위, 사거리, MP 비용을 가져온다.
  - 실패율은 없앤다.
  - 턴 단위는 지금 몬스터 속도 변환과 같은 방식으로 초 단위로 바꾼다.
- 출처는 GPL 고지 문서에 DCSS 파일명과 함께 남긴다.
