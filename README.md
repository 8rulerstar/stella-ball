# Stella Ball

탑다운 당구 전장에서 유성과 3명의 별지기를 함께 굴리고, 이동 중 능력과 멈춘 뒤의 각성 공격으로 공허 거상을 공략하는 브라우저 액션 전략 프로토타입입니다.

## 플레이

GitHub Pages 배포 후 아래 경로에서 로그인·설치 없이 실행됩니다.

`https://8rulerstar.github.io/prism-breakers/prototypes/prism-breakers.html`

1. 메인 화면에서 현재 임무와 별자리 진행도를 확인하고 `별자리 관측 시작`을 누릅니다.
2. 8명 로스터 중 3명의 별지기를 고릅니다.
3. 유성을 하단 발사석에서 아래로 당겼다가 놓아 반대 방향으로 발사합니다.
4. 유성으로 별지기를 굴리고, 이동 중 능력·정지 후 각성·약점 피해를 연결해 기본 5발 안에 보스를 처치합니다.

## 개발 과정과 검증 기록

- [게임 전략](GAME_DIRECTION.md)
- [아트 에셋 계획](ASSET_PLAN.md)
- [에셋 매니페스트](assets/ASSET_MANIFEST.json)
- [에셋 출처](assets/ATTRIBUTION.md)
- [지속 인수인계 메모](PROJECT_CONTEXT.md)
- [최신 진행 보고 / 다음 세션 인수인계](PROGRESS_REPORT.md)
- [런타임 구조와 파일별 수정 위치](prototypes/ARCHITECTURE.md)
- [Codex 협업 기록 / 제출 원본](CODEX_COLLABORATION.md)
- [일일 개발 로그](DEVLOG.md)
- [개발 이력 및 검증 운영 규칙](EVIDENCE_PROTOCOL.md)

`main` 브랜치에 푸시될 때마다 GitHub Actions가 정적 검증 및 기능 표식 검사를 실행하고, 커밋 SHA와 UTC 시각을 담은 검증 리포트를 Actions artifact로 보관합니다. GitHub Pages 배포도 같은 커밋에서 실행됩니다.

## 로컬 확인

Windows에서는 저장소 루트의 `PLAY_WINDOWS.cmd`를 더블클릭하면 현재 게임이 열린다. 또는 `index.html`을 직접 열어도 된다.

macOS에서는 Node.js 20 이상을 준비한 뒤 터미널에서 다음 순서로 시작한다. 이 프로젝트는 외부 npm 의존성이 없어 `npm install`이 필요하지 않다.

```sh
git pull --ff-only
npm run verify
npm run smoke
npm run serve
```

로컬 서버와 정적 검증이 필요한 개발 환경에서는 아래 명령을 사용한다.

```sh
npm run verify
npm run smoke
npm run serve
```

그 뒤 `http://127.0.0.1:4173/`을 엽니다. `npm run format:check`은 포맷 검사, `npm run format`은 포맷 적용 명령이다.

Windows·macOS·Linux에서 같은 저장소를 이어 작업하는 규칙과 운영체제별 시작 명령은 [크로스플랫폼 작업 안내](CROSS_PLATFORM.md)를 따른다.

## 범위 원칙

현재는 코어 플레이 프로토타입입니다. `1-1 별빛의 첫 충돌`은 첫 실행 온보딩이고, `1-2 균열 회랑`은 공명 범퍼 한 종류만 추가한 첫 일반 전투입니다. 이후 노드는 잠금 상태이며 스테이지마다 새 기믹을 하나씩만 더합니다. 실제 가챠, 재화, 실시간 멀티플레이, Hive 실통신은 아직 구현되지 않았으며 완료된 것처럼 표현하지 않습니다. `무한 훈련장`은 기록 제출용이 아닌 물리·능력 QA용 전장입니다.
