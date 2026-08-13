# Stella Ball — 아트 에셋 계획

## 아트 방향

**정교한 픽셀 캐릭터를 작은 전술판 위에 크게 배치하고, 어두운 보랏빛 유적과 강한 원색 이펙트로 한 발의 궤적을 읽히게 한다.**

핵심은 배경 장식이 아니라, 발사체·반사·룬 통과·약점 명중이 한눈에 읽히는 것이다. 모든 래스터 스프라이트는 최근접 보간(`imageSmoothingEnabled = false`)으로 렌더링한다.

## 이번 수직 슬라이스에 사용하는 에셋

| 게임 역할            | 프로젝트 파일                                                             | 원본                                        | 사용 방식                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 샛별 · 근접 베기     | `assets/characters/gaon-warrior-idle.png`                                 | 프로젝트 오너 제작 (2026-08-13)             | 멈춘 자리에서 근거리 고위력 검격                                                                                                                                                                                                |
| 미리내 · 거리 저격   | `assets/characters/biyeon-archer-idle.png`                                | 프로젝트 오너 제작 (2026-08-13)             | 멀수록 강해지는 보스 저격                                                                                                                                                                                                       |
| 별하 · 이중 분열     | `assets/characters/lumi-shaman-idle.png`                                  | 프로젝트 오너 제작 (2026-08-13)             | 이번 샷에 한 번 룬볼을 둘로 복제                                                                                                                                                                                                |
| 살별 · 강제 중계     | `assets/characters/haru-lancer-idle.png`                                  | 프로젝트 오너 제작 (2026-08-13)             | 가장 가까운 다른 유닛에게 룬볼 재발사                                                                                                                                                                                           |
| 윤슬 · 질풍 칼날     | `assets/characters/ria-bladewheel-idle.png`                               | 프로젝트 오너 제작 (2026-08-13)             | 이동 속도 비례 회전 칼날, 정산 공격 없음                                                                                                                                                                                        |
| 달무리 · 전환 명령   | `assets/characters/sera-monk-idle.png`                                    | 프로젝트 오너 제작 (2026-08-13)             | 새 충돌 발동 조건 재설계 중; 현재는 기본 충돌 반응만 유지                                                                                                                                                                       |
| 모루 · 충돌 충격파   | `assets/characters/taeo-orc-idle.png`                                     | 프로젝트 오너 제작 (2026-08-13)             | 모든 충돌 수에 비례한 주변 충격파. 파일명의 orc는 교체 전 시트 잔재                                                                                                                                                             |
| 그믐 · 마지막 모사   | `assets/characters/nyx-oracle-idle.png`                                   | 프로젝트 오너 제작 (2026-08-13)             | 마지막으로 충돌한 아군의 능력을 복제                                                                                                                                                                                            |
| Stella Ball 워드마크 | `assets/original/stella-ball-wordmark.svg`                                | 프로젝트 오리지널 벡터                      | 타이틀·메타·튜토리얼의 공식 게임명 표기                                                                                                                                                                                         |
| 공허 거상            | `assets/library/boss2/void-colossus.png`                                  | Stella Ball 오리지널 픽셀 에셋              | 4프레임 idle/hit 시트와 전용 약점 젬. 보스는 화면에서 가장 크게                                                                                                                                                                 |
| 명중/연쇄/클리어     | `assets/fx/*.png`                                                         | brackeys_vfx_bundle / predrawn (CC0)        | 명중, 전기 연쇄, 클리어 폭발                                                                                                                                                                                                    |
| 전장 장식            | `assets/terrain/rock-*.png`                                               | Tiny Swords Free Pack                       | 플레이 영역 바깥의 가장자리 장식만 사용                                                                                                                                                                                         |
| 유성·별지기·약점     | `assets/original/*.svg`, `assets/library/boss2/void-colossus-weakgem.png` | Stella Ball 오리지널                        | 게임 고유 식별자. 유성/별지기는 SVG, 공허 거상 약점은 픽셀 젬                                                                                                                                                                   |
| 별지기 액션 시트     | `assets/characters/anim/*-roll.png`, `*-attack.png`                       | 프로젝트 오너 제작 (2026-08-13)             | 구르기 4프레임 + 각성 공격 4프레임, 768×192. `scripts/generate_unit_action_sheets.py`는 교체 전 시트를 다시 만드니 실행 금지                                                                                                    |
| 능력 버스트 시트     | `assets/library/anim/fx/fx-*-burst.png`                                   | Stella Ball 오리지널 절차 생성              | 능력 종류별 4프레임 버스트. 재생성: `scripts/generate_ability_bursts.py`                                                                                                                                                        |
| 월드 보스 7종        | `assets/library/boss10/{aries-horngate,sagitta-archon,corvus-swarm,cassiopeia-throne,cygnus-drifter,orion-hunter,dipper-crawler}.png` | 프로젝트 오너 발주 · 절차 생성 (2026-08-13) | 별자리 월드 1~7의 거상. idle/hit/attack/death 4상태 × 4프레임, 전용 약점 젬. 규격은 아래 「보스 팩 10종 규약」 참조 |
| 특수 보스 3종        | `assets/library/boss10/{training-effigy,pentacle-core,erosion-warden}.png` | 동일 | 무한 훈련장 표적, 오망성 발동체, 1-3 침식의 계단 파수 |
| 보스 상태 시트       | `assets/library/anim/boss10/*-{idle,hit,attack,death}.png`                | 동일 | 1536×384 가로 4프레임. 재생성 `node scripts/generate_boss_pack_10.mjs` |
| 보스 약점 젬 10종    | `assets/library/boss10/*-weakgem.png`                                     | 동일 | 보스별 유효타 1~5개소 표시. 256×256 |
| 별자리 실루엣 7종    | `assets/library/constellations/*.png`                                     | 프로젝트 오너 발주 · 절차 생성 (2026-08-13) | 모든 전투의 성공 패링 접점 별빛 노드가 완성한 별자리 뒤에 희미하게 겹치는 그림. 양자리·화살자리·까마귀자리·카시오페이아(왕좌)·백조자리, 6점 오리온자리(사냥꾼 전신·사이프 암시), 7점 북두칠성(국자). 오망성은 기존 전용 연출을 쓰므로 실루엣 없음. 규격은 아래 「별자리 실루엣 규약」 참조 |

별자리 실루엣의 출처는 프로젝트 오너 발주 절차 생성이고, 라이선스는 **프로젝트 오너 원본 에셋(제3자 재배포 조건 미정)**으로 기록한다. 경로는 `assets/library/constellations/`, 런타임 연결점은 `prototypes/js/game-figure.js`의 `FIGURE_SHAPES[].art`와 `drawFigure`다.

## 보스 팩 10종 규약

- 384×384, 셀 4px, 논리 격자 48유닛. 중심 x=24, 접지선 y=44
- 상태 4종(idle/hit/attack/death) × 4프레임 가로 시트(1536×384), 약점 젬은 256×256 별도
- 색 계층 4종(공허 보라 / 관측 청록 / 여명 살구 / 창백 달빛). 본체는 저채도 어두운 셸, 강조색은 림·첨탑·핵·약점에만 쓴다
- 도트 정의는 `scripts/boss-pack-core.js` 하나뿐. 아트를 손으로 고치지 말고 이 파일을 고친 뒤 `node scripts/generate_boss_pack_10.mjs`로 60개를 다시 만든다
- 런타임 조회는 `game-data.js`의 `bossArtFor(slug)`. 없는 슬러그는 기존 공허 거상으로 폴백한다

## 별자리 실루엣 규약

이 7장은 **좌표계가 코드와 묶여 있다.** 규격을 바꾸면 그림이 별자리에서 어긋난다.

- 384 × 384, 배경 투명, 픽셀 아트(확대 금지 · 축소만)
- 128 그리드에 그린 뒤 ×3 확대. **스켈레톤 원점이 이미지 정중앙**, 스켈레톤 1단위 = 138px
- 이 두 값은 `game-figure.js`의 `FIGURE_ART_SIZE`(384) · `FIGURE_ART_UNIT`(138)과 **반드시 일치**해야 한다
- 각 그림의 뼈대는 `FIGURE_SHAPES[n][].points`와 같은 좌표계다. 뼈대 좌표를 고치면 그림도 다시 그려야 한다
- 사양서: [FIGURE_ART_SPEC.md](FIGURE_ART_SPEC.md), 6·7점은 [FIGURE_ART_SPEC_6_7.md](FIGURE_ART_SPEC_6_7.md)
- 재생성: `scripts/generate_constellation_art_6_7.mjs` (6·7점 두 장만. 나머지 5종은 건드리지 않는다)

## 유닛 전용 이펙트

| 유닛   | 이펙트 파일                                   | 전투 타이밍                      |
| ------ | --------------------------------------------- | -------------------------------- |
| 샛별   | `assets/library/restyle/fx/gaon-slash.png`    | 멈춘 뒤 근접 베기                |
| 미리내 | `assets/library/restyle/fx/biyeon-volley.png` | 멈춘 뒤 거리 저격                |
| 별하   | `assets/library/restyle/fx/lumi-wave.png`     | 룬볼 분열                        |
| 살별   | `assets/library/restyle/fx/haru-dash.png`     | 가장 가까운 유닛으로 강제 중계   |
| 윤슬   | 런타임 회전 칼날 링                           | 이동 속도 비례 지속 피해         |
| 달무리 | `assets/library/restyle/fx/rio-turn.png`      | 다음 발동 규칙 설계 후 연결 예정 |
| 모루   | `assets/library/restyle/fx/taeo-quake.png`    | 충돌 수 기반 충격파              |
| 그믐   | `assets/library/restyle/fx/nyx-lock.png`      | 마지막 충돌 아군 능력 모사       |

위 이펙트는 프로젝트 라이브러리의 오리지널 픽셀 VFX를 재사용하며, 능력 발동 순간에만 짧게 확대·페이드한다.

## 오디오와 미사용 후보

- 실제 전투는 `assets/audio/ability-01.wav`~`ability-08.wav`, 50종 SFX 라이브러리의 채택 샘플, 런타임 절차 합성 저음을 함께 사용한다. 정산은 충전·해방·명중을 별도 큐로 재생한다.
- `assets/candidates/observatory-pack-01/`은 루나 제스처·망원경·성좌 인장·6개 절차 합성 SFX 후보 묶음이다. 현재 HTML·JS·CSS와 `ASSET_MANIFEST.json`에는 연결하지 않는다.

## 사용하지 않는 에셋

- **Retro Lines 16×16**: CC0이지만 네온 아케이드 감도가 현재 캐릭터 스프라이트와 다르다. 추후 메뉴/미니게임이 필요할 때만 재검토한다.
- **Tiny RPG Soldier & Orc**: 완성도는 좋지만 100px 프레임의 외곽선·비율이 Tiny Swords와 달라, 파티 화면에 섞지 않는다.
- 기존 프로젝트의 대형 UI 팩: 지금은 자체적으로 단순한 픽셀 UI를 만들고, 출처 표기가 필요한 UI 팩은 MVP에 넣지 않는다.
- `assets/candidates/observatory-pack-01/`: 화풍·축소 가독성·크로마키 가장자리를 검수하기 전까지 후보로만 둔다.

## 구현 규칙

1. 모든 캐릭터는 현재 사용하는 프레임만 로드한다. 팩 전체를 게임에 넣지 않는다.
2. 보스·캐릭터·발사체가 겹치는 영역에는 지형 장식을 놓지 않는다.
3. 룬은 캐릭터 초상화가 아니라 별도의 고유 기호로 표시한다. 능력은 색 + 형태 + 짧은 이름으로 구분한다.
4. 캐릭터 스프라이트는 화려한 장식이 아니라 “어떤 룬을 통과했는지”를 보조하는 역할이다.
5. 새 래스터 에셋이 필요하면 먼저 `ASSET_BACKLOG.md`에 역할·화면·플레이 목적·후보 상태를 기록한다. 일괄 제작이 승인되고 실제 파일이 반입될 때 이 문서에 출처·프레임 규격·사용 경로를 확정한다.

## 다음 제작 후보

현재 코어 데모에는 필요한 에셋이 모두 있다. 다음 구현에서만 추가한다.

- 캐릭터 선택 카드용 64×64 초상화 크롭
- 발사 횟수와 쿨다운을 읽히는 작은 픽셀 아이콘

각 항목은 게임 규칙이 확정된 뒤에만 만든다. 지금은 아트 양을 늘리지 않는다.
