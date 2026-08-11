# Prism Breakers 추가 에셋 라이브러리

현재 전투에 직접 사용 중인 에셋은 `ASSET_MANIFEST.json`에서 관리한다. 이 문서는 이후 적·효과·스테이지 기믹에 사용할 수 있도록 제작해 둔 미사용 픽셀 에셋의 목록이다.

모든 에셋은 OpenAI ImageGen으로 생성한 뒤, 균일한 크로마키 배경을 로컬에서 투명 처리한 PNG다. 공통 방향은 어두운 판타지 프리즘, 보라·마젠타·라벤더 제한 팔레트, 하드 픽셀 윤곽이다.

## 적

- `library/enemies/void-shardling.png` — 단일 눈을 가진 다이아몬드형 공허 적.
- `library/enemies/void-orbiter.png` — 수정 파편이 회전하는 공허 구체.
- `library/enemies/void-skitter.png` — 결정 껍질을 가진 소형 공허 기어 적.

## 전투 효과

- `library/fx/prism-impact.png` — 프리즘 직격 폭발.
- `library/fx/rune-shockwave.png` — 룬 충격파 고리.
- `library/fx/prism-comet.png` — 대각선 프리즘 돌진/베기.

## 전장 소품

- `library/props/rune-pillar.png` — 마젠타 수정이 박힌 룬 기둥.
- `library/props/amethyst-cluster.png` — 자수정 결정 군집.
- `library/props/broken-prism-arch.png` — 부서진 프리즘 관문.
- `library/props/void-lantern.png` — 공허 수정 등불.

게임에 채택할 때는 기존 캔버스 좌표와 충돌 반경에 맞춰 표시 크기를 별도로 정하고, 이미지 보간은 끈다.

## 재사용 패키지

다른 프로젝트에서 쓸 원본과 4프레임 애니메이션 시트는 `/Users/8rulerstar/Assets/Prism-Breakers-Pixel-Asset-Pack/`에 별도로 보관한다. 유닛 4종은 각각 `idle`, `move`, `attack`, `hit` 시트를 갖고, 효과·소품은 전용 펄스/발광 시트를 갖는다. 패키지의 `manifest.json`에는 프레임 규격·FPS·애니메이션 모드가, `tools/build_animations.py`에는 재생성 절차가 있다.

## 관측소 후보 팩 01

`candidates/observatory-pack-01/`에는 중앙 온보딩용 루나 제스처, 망원경 소품, 성좌 인장 원본/투명화 시도본, 절차 합성 SFX 6종이 있다. 이 팩은 **현재 런타임에 미적용**이며 `ASSET_MANIFEST.json`에도 등록하지 않는다. 채택 전에는 실제 표시 크기의 픽셀 화풍, 성좌 인장의 초록 키 가장자리, 오디오 cue 역할을 먼저 검수한다. 세부 규격과 재생성 방법은 팩 내부 `README.md`와 `audio/manifest.json`을 따른다.
