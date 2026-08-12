# Stella Ball

탑다운 당구 전장에서 유성과 3명의 별지기를 함께 굴리고, 이동 중 능력과 멈춘 뒤의 각성 공격으로 공허 거상을 공략하는 브라우저 액션 전략 프로토타입입니다.

## 플레이

GitHub Pages 배포 후 아래 경로에서 로그인·설치 없이 실행됩니다.

`https://8rulerstar.github.io/prism-breakers/prototypes/prism-breakers.html`

1. 메인 화면에서 현재 임무와 별자리 진행도를 확인하고 `별자리 관측 시작`을 누릅니다.
2. 시작 별지기 가온·비연·리아로 파티를 편성합니다. 일반 스테이지 클리어 보상 골드로 `별빛 소환`을 하면 나머지 별지기를 한 명씩 확정 해금할 수 있습니다.
3. 유성을 하단 발사석에서 아래로 당겼다가 놓아 반대 방향으로 발사합니다.
4. 유성으로 별지기를 굴리고, 이동 중 능력·정지 후 각성·약점 피해를 연결해 기본 5발 안에 보스를 처치합니다.
5. 전투 중에는 `ESC` 키나 전장 좌측 상단의 정지 버튼으로 언제든 멈추고 설정을 열 수 있습니다.

첫 실행에서는 루나의 6단계 관측 수업이 먼저 열립니다. 모든 카드는 버튼을 눌러야 넘어가며, 마지막 단계는 설명이 아니라 거상을 직접 처치하는 실전입니다.

## 개발 과정과 검증 기록

- [문서 안내 / 읽는 순서](DOCUMENTATION_INDEX.md)
- [게임 전략](GAME_DIRECTION.md)
- [아트 에셋 계획](ASSET_PLAN.md)
- [디자인·에셋 제작 백로그](ASSET_BACKLOG.md)
- [에셋 매니페스트](assets/ASSET_MANIFEST.json)
- [에셋 출처](assets/ATTRIBUTION.md)
- [지속 인수인계 메모](PROJECT_CONTEXT.md)
- [최신 진행 보고 / 다음 세션 인수인계](PROGRESS_REPORT.md)
- [런타임 구조와 파일별 수정 위치](prototypes/ARCHITECTURE.md)
- [Ink & Brass UI 테마 인수인계](UI_REDESIGN_HANDOFF.md)
- [Codex 협업 기록 / 제출 원본](CODEX_COLLABORATION.md)
- [일일 개발 로그](DEVLOG.md)
- [개발 이력 및 검증 운영 규칙](EVIDENCE_PROTOCOL.md)

`main` 브랜치에 푸시될 때마다 GitHub Actions가 정적 검증 및 기능 표식 검사를 실행하고, 커밋 SHA와 UTC 시각을 담은 검증 리포트를 Actions artifact로 보관합니다. GitHub Pages 배포도 같은 커밋에서 실행됩니다.

## 한 번에 실행

- **macOS**: `RUN_STELLA_BALL.command`를 더블클릭합니다.
- **Windows**: `RUN_STELLA_BALL.bat` 또는 `PLAY_WINDOWS.cmd`를 더블클릭합니다.

모두 설치나 서버 실행 없이 기본 브라우저로 Stella Ball을 엽니다. 저장소 루트의 `index.html`도 같은 게임으로 바로 이동합니다.

## 개발용 로컬 확인

macOS와 Windows 모두 Node.js 20 이상을 준비합니다. 이 프로젝트는 외부 npm 의존성이 없어 `npm install`이 필요하지 않습니다.

```sh
git pull --ff-only
npm run check
npm run serve
```

그 뒤 `http://127.0.0.1:4173/`을 엽니다. `npm run check`은 정적 검증과 런타임 계약 검사를 함께 실행합니다. `npm run format:check`은 포맷 검사, `npm run format`은 포맷 적용 명령입니다.

Windows·macOS·Linux에서 같은 저장소를 이어 작업하는 규칙과 운영체제별 시작 명령은 [크로스플랫폼 작업 안내](CROSS_PLATFORM.md)를 따릅니다.

## 범위 원칙

현재는 코어 플레이 프로토타입입니다. `1-1 별빛의 첫 충돌`은 첫 실행 온보딩이고, `1-2 균열 회랑`은 공명 범퍼 한 종류만 추가한 첫 일반 전투입니다. 이후 노드는 잠금 상태이며 스테이지마다 새 기믹을 하나씩만 더합니다. 일반 스테이지 클리어는 고정 100골드를 주며, `별빛 소환`은 100골드로 미보유 별지기 한 명을 확정 해금합니다. 유료 재화·확률형 중복 뽑기·상점, 실시간 멀티플레이와 Hive 실통신은 구현하지 않습니다. `무한 훈련장`은 기록 제출용이 아닌 물리·능력 QA용 전장이고, 벽·가속 발판·잡몹의 데이터 기반 검증 전장입니다.
