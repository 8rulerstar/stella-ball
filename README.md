# Stella Ball

탑다운 당구 전장에서 룬볼과 3인 파티 유닛을 함께 굴리고, 멈춘 유닛의 각성 공격으로 공허 거상을 공략하는 브라우저 액션 전략 프로토타입입니다.

## 플레이

GitHub Pages 배포 후 아래 경로에서 로그인·설치 없이 실행됩니다.

`https://8rulerstar.github.io/prism-breakers/prototypes/prism-breakers.html`

1. 7명 로스터 중 3명의 유닛을 고릅니다.
2. 첫 룬볼을 하단 발사석에서 아래로 당겼다가 놓아 반대 방향으로 발사합니다.
3. 룬볼로 유닛을 굴리고, 모든 공이 멈춘 뒤 유닛의 각성 공격과 약점 피해를 연결합니다.
4. 기본 5발을 모두 쓰기 전 보스를 처치합니다. 현재 각 샷은 하단 발사석에서 시작합니다.

## 개발 과정과 검증 기록

- [게임 전략](GAME_DIRECTION.md)
- [아트 에셋 계획](ASSET_PLAN.md)
- [에셋 매니페스트](assets/ASSET_MANIFEST.json)
- [에셋 출처](assets/ATTRIBUTION.md)
- [지속 인수인계 메모](PROJECT_CONTEXT.md)
- [최신 진행 보고 / 다음 세션 인수인계](PROGRESS_REPORT.md)
- [Codex 협업 기록 / 제출 원본](CODEX_COLLABORATION.md)
- [일일 개발 로그](DEVLOG.md)
- [개발 이력 및 검증 운영 규칙](EVIDENCE_PROTOCOL.md)

`main` 브랜치에 푸시될 때마다 GitHub Actions가 정적 검증 및 기능 표식 검사를 실행하고, 커밋 SHA와 UTC 시각을 담은 검증 리포트를 Actions artifact로 보관합니다. GitHub Pages 배포도 같은 커밋에서 실행됩니다.

## 한 번에 실행

- **macOS**: `RUN_STELLA_BALL.command`을 더블 클릭합니다.
- **Windows**: `RUN_STELLA_BALL.bat`을 더블 클릭합니다.

둘 다 설치나 서버 실행 없이 기본 브라우저로 Stella Ball을 엽니다. 저장소 루트의 `index.html`도 같은 게임으로 바로 이동합니다.

## 개발용 로컬 확인

```sh
node scripts/verify-evidence.mjs
python3 -m http.server 4173 --directory .
```

그 뒤 `http://127.0.0.1:4173/prototypes/prism-breakers.html`을 엽니다. 자동 검증만 할 때는 첫 번째 명령만 실행하면 됩니다.

Windows·macOS·Linux에서 같은 저장소를 이어 작업하는 규칙과 Windows 실행 명령은 [크로스플랫폼 작업 안내](CROSS_PLATFORM.md)를 따른다.

## 범위 원칙

현재는 코어 플레이 프로토타입입니다. 첫 실행은 프롤로그 뒤 `1-1 별빛의 첫 충돌` 온보딩으로 바로 이어지고, 이후 별자리 지도를 연다. 실제 가챠, 재화, 실시간 멀티플레이, Hive 실통신은 아직 구현되지 않았으며 완료된 것처럼 표현하지 않습니다. 기존 전투 시안은 다음 별자리로 잠금 보류했으며, `무한 훈련장`은 기록 제출용이 아닌 물리·능력 QA용 전장입니다.
