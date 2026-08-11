# Stella Ball — 아트 에셋 계획

## 아트 방향

**정교한 픽셀 캐릭터를 작은 전술판 위에 크게 배치하고, 어두운 보랏빛 유적과 강한 원색 이펙트로 한 발의 궤적을 읽히게 한다.**

핵심은 배경 장식이 아니라, 발사체·반사·룬 통과·약점 명중이 한눈에 읽히는 것이다. 모든 래스터 스프라이트는 최근접 보간(`imageSmoothingEnabled = false`)으로 렌더링한다.

## 이번 수직 슬라이스에 사용하는 에셋

| 게임 역할            | 프로젝트 파일                                                             | 원본                                          | 사용 방식                                                       |
| -------------------- | ------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------- |
| 가온 · 근접 베기     | `assets/characters/gaon-warrior-idle.png`                                 | Tiny Swords Free Pack / Blue Warrior          | 멈춘 자리에서 근거리 고위력 검격                                |
| 비연 · 거리 저격     | `assets/characters/biyeon-archer-idle.png`                                | Tiny Swords Free Pack / Yellow Archer         | 멀수록 강해지는 보스 저격                                       |
| 루미 · 이중 분열     | `assets/characters/lumi-shaman-idle.png`                                  | Tiny Swords Enemy Pack / Hex Shaman           | 이번 샷에 한 번 룬볼을 둘로 복제                                |
| 하루 · 강제 중계     | `assets/characters/haru-lancer-idle.png`                                  | Tiny Swords Free Pack / Purple Lancer         | 가장 가까운 다른 유닛에게 룬볼 재발사                           |
| 리아 · 질풍 칼날     | `assets/characters/ria-bladewheel-idle.png`                               | Stella Ball 신규 생성 픽셀 에셋               | 이동 속도 비례 회전 칼날, 정산 공격 없음                        |
| 세라 · 전환 명령     | `assets/characters/sera-monk-idle.png`                                    | Tiny Swords Free Pack / Blue Monk             | 클릭 한 번으로 90° 전환 및 에너지 획득                          |
| 태오 · 충돌 충격파   | `assets/characters/taeo-miner-idle.png`                                   | Tiny Swords Free Pack / Yellow Pawn (Pickaxe) | 모든 충돌 수에 비례한 주변 충격파                               |
| 닉스 · 마지막 모사   | `assets/characters/nyx-oracle-idle.png`                                   | Tiny Swords Free Pack / Purple Warrior        | 마지막으로 충돌한 아군의 능력을 복제                            |
| Stella Ball 워드마크 | `assets/original/stella-ball-wordmark.svg`                                | 프로젝트 오리지널 벡터                        | 타이틀·메타·튜토리얼의 공식 게임명 표기                         |
| 공허 거상            | `assets/library/boss2/void-colossus.png`                                  | Stella Ball 오리지널 픽셀 에셋                | 4프레임 idle/hit 시트와 전용 약점 젬. 보스는 화면에서 가장 크게 |
| 명중/연쇄/클리어     | `assets/fx/*.png`                                                         | brackeys_vfx_bundle / predrawn (CC0)          | 명중, 전기 연쇄, 클리어 폭발                                    |
| 전장 장식            | `assets/terrain/rock-*.png`                                               | Tiny Swords Free Pack                         | 플레이 영역 바깥의 가장자리 장식만 사용                         |
| 유성·별지기·약점     | `assets/original/*.svg`, `assets/library/boss2/void-colossus-weakgem.png` | Stella Ball 오리지널                          | 게임 고유 식별자. 유성/별지기는 SVG, 공허 거상 약점은 픽셀 젬   |

## 유닛 전용 이펙트

| 유닛 | 이펙트 파일                                   | 전투 타이밍                    |
| ---- | --------------------------------------------- | ------------------------------ |
| 가온 | `assets/library/restyle/fx/gaon-slash.png`    | 멈춘 뒤 근접 베기              |
| 비연 | `assets/library/restyle/fx/biyeon-volley.png` | 멈춘 뒤 거리 저격              |
| 루미 | `assets/library/restyle/fx/lumi-wave.png`     | 룬볼 분열                      |
| 하루 | `assets/library/restyle/fx/haru-dash.png`     | 가장 가까운 유닛으로 강제 중계 |
| 리아 | 런타임 회전 칼날 링                           | 이동 속도 비례 지속 피해       |
| 세라 | `assets/library/restyle/fx/rio-turn.png`      | 전환 준비 및 클릭 90° 전환     |
| 태오 | `assets/library/restyle/fx/taeo-quake.png`    | 충돌 수 기반 충격파            |
| 닉스 | `assets/library/restyle/fx/nyx-lock.png`      | 마지막 충돌 아군 능력 모사     |

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
5. 새 래스터 에셋이 필요하면 먼저 이 문서에 역할·출처·프레임 규격을 추가한다.

## 다음 제작 후보

현재 코어 데모에는 필요한 에셋이 모두 있다. 다음 구현에서만 추가한다.

- 캐릭터 선택 카드용 64×64 초상화 크롭
- 발사 횟수와 쿨다운을 읽히는 작은 픽셀 아이콘

각 항목은 게임 규칙이 확정된 뒤에만 만든다. 지금은 아트 양을 늘리지 않는다.
