# DEVLOG — Prism Breakers

> 하루를 마칠 때 5~10분만 기록한다. 좋은 결과뿐 아니라 **막힌 지점, 버린 가설, 사람이 개입한 판단**을 남긴다.

## 작성 형식

```md
## YYYY-MM-DD — 짧은 제목

- Codex에게 시킨 일:
- 결과:
- 막힌 점 / 우회:
- 사람이 직접 결정·수정한 점:
- 증거: 커밋, 파일, 스크린샷, 봇 결과 링크
```

## 2026-08-07 — 방향 전환과 발사형 코어 선택

- Codex에게 시킨 일: 행사 기준과 Hive·컴투스·OpenAI/Codex의 기대를 분석하고, 여러 조작 코어의 브라우저 프로토타입을 제작.
- 결과: 초기 Echo Run, 보드/블록형 시안, 그리고 발사 물리 기반의 Prism Breakers 프로토타입을 비교했다. 현재 `prototypes/prism-breakers.html`에는 6인 중 3인 파티 편성, 드래그 발사, 반사, 움직이는 보스 약점, 캐릭터별 물리 능력이 있다.
- 막힌 점 / 우회: 유저 사망 기록을 전 세계 난이도에 누적하는 구조는 유저가 많을수록 난해해지고, 감소하면 더 재미없어지는 하향 나선 위험이 있었다. 온라인 데이터를 코어에서 제거하고, 싱글 플레이를 완결한 뒤 기록·랭킹만 추가하는 구조로 전환했다.
- 사람이 직접 결정·수정한 점: 보드형 조작은 직관적이지 않다고 판단해 폐기. World Flipper에서 참조한 것은 핀볼 자체가 아니라 ‘즉시 이해되는 물리 장난감과 수집형 능력의 결합’이며, 최종적으로 당겨 쏘는 반사 유물탄으로 변형했다.
- 증거: [기준선 커밋 `76a8a3d`](https://github.com/8rulerstar/prism-breakers/commit/76a8a3da7f6c9f80d8edfb944e8f15804048c5fe), [자동 검증 리포트](https://github.com/8rulerstar/prism-breakers/actions/runs/31156765698), [첫 GitHub Pages 배포](https://github.com/8rulerstar/prism-breakers/actions/runs/31156820634), `GAME_DIRECTION.md`, `PROJECT_CONTEXT.md`, `CODEX_COLLABORATION.md`, `prototypes/prism-breakers.html`

## 다음 작업일에 기록할 것

- 제한 발사 수 / 보스 실드·페이즈 / 스킬 쿨다운을 어떤 순서로 넣었는가
- 캐릭터 능력이 단순 수치 상승이 되지 않도록 무엇을 제거하거나 바꿨는가
- 헤드리스 봇의 수치 결과와 그에 따른 사람의 밸런싱 판단

## 2026-08-07 — 픽셀 아트 자산 선별

- Codex에게 시킨 일: 제공된 에셋 팩과 기존 프로젝트를 조사해 화풍·프레임 규격·출처를 비교하고, Prism Breakers에 필요한 최소 에셋만 선별·정리.
- 결과: Tiny Swords 계열의 6인 파티 스프라이트, 트롤 보스, CC0 VFX, 가장자리 지형 장식을 `assets/`에 반입했다. 프리즘 탄·6종 룬·보스 약점은 게임 전용 픽셀 SVG로 새로 제작했다.
- 막힌 점 / 우회: 서로 다른 16×16·100px·192px 팩을 동시에 쓰면 인상이 분산된다. 캐릭터와 보스는 Tiny Swords 계열로 통일하고, 기존 UI 팩은 이번 MVP에서 제외했다.
- 사람이 직접 결정·수정한 점: 아트 볼륨을 늘리기보다, 한 발의 궤적과 룬 능력을 명확히 읽히게 하는 데 필요한 에셋만 채택했다.
- 증거: `ASSET_PLAN.md`, `assets/ASSET_MANIFEST.json`, `assets/ATTRIBUTION.md`, `assets/original/`
