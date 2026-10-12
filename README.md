# DCSS_SV

DCSS식 던전에서 떼를 상대하는 실시간 2D 게임 (가칭 던전 뱀서).
종족과 직업을 고르고, 층을 내려가며 스킬은 적성에 따라 자동으로 훈련되고, 레벨업마다 아이템 세 가지 중 하나를 고른다.

- 해 보기: <https://jinha1226.github.io/DCSS_SV/>
- 문서 안내(지금 기준과 지난 기록): [docs/README.md](docs/README.md)
- 로드맵: [docs/IMPLEMENTATION_2RUNE.md](docs/IMPLEMENTATION_2RUNE.md)
- 스킬·장비·성장 기획: [docs/SKILL_TRAINING.md](docs/SKILL_TRAINING.md)
- 타일의 출처와 라이선스: [docs/TILES.md](docs/TILES.md)
- 마법 연습장: <https://jinha1226.github.io/DCSS_SV/spells.html> (개발 서버에서는 `/DCSS_SV/spells.html`). `?school=ice&spell=cold_fan`으로 마법 하나를 바로 연다.

## 개발

화면 오른쪽 위의 **PC 가로화면** 버튼으로 왼쪽 던전·아래 게임 로그·오른쪽 상태와 미니맵 구성을 켤 수 있다.
**세로화면** 버튼으로 돌아가며, 선택한 구성은 다음 접속에도 유지된다. 진행 중인 게임에서도 전환할 수 있다.
게임 화면에서 **두 손가락 핀치** 또는 **마우스 휠**로 확대·축소할 수 있다. 휠을 아래로 돌리거나 두 손가락을 모으면 더 넓게 보인다. UI 크기와 캐릭터 시야 범위는 유지된다.

```
npm install
npm run dev      # 개발 서버
npm run format   # 코드 모양 맞추기 (올리기 전에 꼭)
npm run check    # 린트(모양 검사 포함), 타입 검사, 테스트
npm run build    # 배포용 빌드
npm run tiles    # 타일을 더하거나 뺀 뒤 한 장으로 다시 묶기
npm run bench    # 봇이 여러 판을 돌려 난이도를 잰다
```

주소 스위치: `?speed=5.5` 1초에 걷는 칸 수(기본 6.5), `?look=bright` 바닥과 벽 타일, `?seed=` 같은 판 다시 보기, `?floor=2` 2층에서 시작, `?debug` 안쪽 상태(`window.__sv`). 게임 화면 줌은 핀치와 휠로 조절한다.
