# Prism Breakers

탑다운 당구 전장에서 룬볼과 3인 파티 유닛을 함께 굴리고, 멈춘 유닛의 각성 공격으로 공허 거상을 공략하는 브라우저 액션 전략 프로토타입입니다.

## 플레이

GitHub Pages 배포 후 아래 경로에서 로그인·설치 없이 실행됩니다.

`https://8rulerstar.github.io/prism-breakers/prototypes/prism-breakers.html`

1. 7명 로스터 중 3명의 유닛을 고릅니다.
2. 첫 룬볼을 하단 발사석에서 아래로 당겼다가 놓아 반대 방향으로 발사합니다.
3. 룬볼로 유닛을 굴리고, 모든 공이 멈춘 뒤 유닛의 각성 공격과 약점 피해를 연결합니다.
4. 기본 5발을 모두 쓰기 전 보스를 처치합니다. 다음 샷은 직전 룬볼이 멈춘 위치에서 이어집니다.

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

## 로컬 확인

```sh
node scripts/verify-evidence.mjs
python3 -m http.server 4173 --directory .
```

그 뒤 `http://127.0.0.1:4173/prototypes/prism-breakers.html`을 엽니다.

## 범위 원칙

현재는 코어 플레이 프로토타입입니다. 실제 가챠, 재화, 실시간 멀티플레이, Hive 실통신은 아직 구현되지 않았으며 완료된 것처럼 표현하지 않습니다. `무한 훈련장`은 기록 제출용이 아닌 물리·능력 QA용 전장입니다.
