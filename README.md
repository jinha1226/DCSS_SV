# DCSS_SV

DCSS식 던전에서 떼를 상대하는 실시간 2D 게임 (가칭 던전 뱀서).
종족과 직업을 고르고, 층을 내려가며 스킬은 적성에 따라 자동으로 훈련되고, 레벨업마다 아이템 세 가지 중 하나를 고른다.

- 해 보기: <https://jinha1226.github.io/DCSS_SV/>
- 만드는 순서: [docs/PLAN.md](docs/PLAN.md)
- 자동 숙련도·아이템 선택 설계: [docs/AUTOMATIC_GROWTH.md](docs/AUTOMATIC_GROWTH.md)
- 타일의 출처와 라이선스: [docs/TILES.md](docs/TILES.md)

## 개발

```
npm install
npm run dev      # 개발 서버
npm run format   # 코드 모양 맞추기 (올리기 전에 꼭)
npm run check    # 린트(모양 검사 포함), 타입 검사, 테스트
npm run build    # 배포용 빌드
npm run tiles    # 타일을 더하거나 뺀 뒤 한 장으로 다시 묶기
npm run bench    # 봇이 여러 판을 돌려 난이도를 잰다
```

주소 스위치: `?zoom=15` 한 화면 가로에 보이는 칸 수(기본 17), `?speed=5.5` 1초에 걷는 칸 수(기본 6.5), `?look=bright` 바닥과 벽 타일, `?seed=` 같은 판 다시 보기, `?floor=2` 2층에서 시작, `?debug` 안쪽 상태(`window.__sv`).
