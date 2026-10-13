# 크레딧과 라이선스

## 이 게임의 코드

이 저장소의 프로그램 코드는 **GNU General Public License 버전 3 또는 그 이후 버전**(GPL-3.0-or-later)으로 배포한다. 전문은 [LICENSE](../LICENSE)에 있다.

이 게임은 Dungeon Crawl Stone Soup(DCSS)의 규칙, 수치, 설명문을 바탕으로 만든다. DCSS의 코드와 텍스트는 GPL 버전 2 또는 그 이후 버전(GPL-2.0-or-later)이고, 이 게임은 그 "이후 버전" 조항에 따라 GPL 3 이후 버전으로 함께 배포한다. "Dungeon Crawl Stone Soup"은 이 게임의 이름이 아니다. 이 게임은 DCSS 개발팀이 만들거나 승인한 게임이 아니다.

## 가져온 것

| 무엇 | 어디서 | 라이선스 | 위치 |
| --- | --- | --- | --- |
| 아이템 설명문(영어 원문과 한국어 번역) | DCSS `crawl-ref/source/dat/descript/items.txt`, `ko/items.txt` | GPL-2.0-or-later, © DCSS 개발팀과 번역자 | `src/data/json/lore.json` |
| 게임 규칙과 수치(속도, 공격 간격, 무기 지연, 브랜치 구성, 브랜치별 바닥·벽 등) | DCSS 소스와 데이터 | GPL-2.0-or-later | `src/data`, `src/sim`의 해당 주석 |
| 타일 그림 | DCSS `rltiles`(crawl/crawl), crawl/tiles의 2010 CC0 배포본 | CC0 1.0 | `assets/dcss`, `assets/tiles`, 자세한 출처는 [TILES.md](TILES.md)와 `assets/tiles/SOURCES.json` |
| 3D 캐릭터·던전 모델 | KayKit(Kay Lousberg): Adventurers, Dungeon, Skeletons | CC0 1.0 | `public/models` |
| 3D 몬스터·동물·무기 모델 | Quaternius: Animals, Monsters, Medieval Weapons, RPG 팩 | CC0 1.0 | `public/models` |
| 3D 렌더링 | three.js | MIT | npm 패키지 `three` |
| PNG 처리(개발 도구) | UPNG.js | MIT | npm 패키지 `upng-js`, `tools/`에서만 사용 |
| 글꼴 | 나눔고딕코딩(Naver), 고운바탕 | SIL Open Font License 1.1 | Google Fonts에서 불러옴 |

DCSS 타일은 CC0라 표기 의무가 없지만, 그림을 그린 DCSS 타일 작가들(crawl/tiles의 `ARTISTS.md`)에게 감사를 표한다.

## 직접 만든 것

- `public/sprites/haven`의 주인공 스프라이트와 `art3d`의 원본 모델·스크립트는 이 프로젝트에서 직접 만들었다. 이 그림들은 GPL 코드와 별개의 저작물이다. 별도 라이선스를 정하기 전까지 모든 권리는 저작자에게 있다.
