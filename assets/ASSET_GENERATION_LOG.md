# Codex 에셋 제작 기록

> 제출·피치에서 Codex가 코드뿐 아니라 에셋 제작과 정리에도 사용됐다는 사실을 짧고 검증 가능하게 설명하기 위한 기록이다.

## 목적

코드로 그린 원형 적과 기존 픽셀 캐릭터 사이의 이질감을 줄이고, 이후 스테이지·기믹에 재사용할 수 있는 통일된 공허 프리즘 에셋을 확보했다.

## 사람이 정한 기준

- 어두운 판타지 프리즘, 보라·마젠타·라벤더 제한 팔레트
- 16비트 하드 픽셀 윤곽, 이미지 보간 없음
- 에셋 수보다 전투 역할과 화면 가독성을 우선
- 생성된 후보는 모두 즉시 전투에 넣지 않고, 검증한 에셋만 반입

## Codex 작업과 산출물

1. 공허 잔재 적을 생성하고 균일한 크로마키 배경을 투명 처리했다.
   - 산출물: `assets/enemies/void-wisp.png`
   - 반입: `prototypes/prism-breakers.html`의 공허 잔재 3체 렌더링
   - 검증: 알파 채널, 코드 참조, 에셋 매니페스트 검사
2. 같은 화풍의 재사용 후보 10종을 만들었다.
   - 적 3종: shardling, orbiter, skitter
   - 효과 3종: impact, shockwave, comet
   - 소품 4종: rune pillar, amethyst cluster, broken arch, void lantern
   - 저장: `assets/library/`, 상세 목록: `assets/ASSET_LIBRARY.md`
3. 다른 프로젝트에서도 쓸 수 있도록 별도 패키지와 애니메이션 시트를 만들었다.
   - 위치: `/Users/8rulerstar/Assets/Prism-Breakers-Pixel-Asset-Pack/`
   - 원본 11개, 4프레임 시트 23개
   - 유닛 4종은 `idle`, `move`, `attack`, `hit` 상태별 시트 제공

## 재현·검증 흔적

- 생성 이미지는 균일한 크로마키 배경으로 만든 뒤 로컬에서 투명 PNG로 변환했다.
- `assets/ATTRIBUTION.md`에 출처를 기록했다.
- 재사용 패키지의 `tools/build_animations.py`가 상태별 시트와 `manifest.json`을 다시 생성한다.
- 관련 커밋: `13476a6`(전투 잔재 반입), `4c98b6a`(라이브러리 10종), `91e05ae`·`72b65eb`(재사용 패키지 및 상태 애니메이션 기록).

## 제출용 한 문장

Codex로 전투 코드뿐 아니라 기존 픽셀 화풍에 맞는 공허 적·효과·전장 소품을 제작하고, 투명 처리·애니메이션 시트·재사용 패키지까지 정리했습니다. 사람은 팔레트, 전투 역할, 실제 반입 범위를 결정했습니다.
