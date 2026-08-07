# Prism Breakers

한 발의 유물탄을 당겨 발사해 벽 반사와 3인 파티 룬을 연결하고, 움직이는 보스 약점을 공략하는 브라우저 액션 전략 프로토타입입니다.

## 플레이

GitHub Pages 배포 후 아래 경로에서 로그인·설치 없이 실행됩니다.

`https://8rulerstar.github.io/prism-breakers/prototypes/prism-breakers.html`

1. 8명 중 3명의 캐릭터를 고릅니다.
2. 유물탄을 뒤로 당겼다가 놓아 발사합니다.
3. 벽 반사와 캐릭터 룬을 이용해 보스 약점을 맞힙니다.

## 개발 과정과 검증 기록

- [게임 전략](GAME_DIRECTION.md)
- [아트 에셋 계획](ASSET_PLAN.md)
- [에셋 매니페스트](assets/ASSET_MANIFEST.json)
- [에셋 출처](assets/ATTRIBUTION.md)
- [지속 인수인계 메모](PROJECT_CONTEXT.md)
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

현재는 코어 플레이 프로토타입입니다. 실제 가챠, 재화, 실시간 멀티플레이, Hive 연동은 아직 구현되지 않았으며 완료된 것처럼 표현하지 않습니다.
