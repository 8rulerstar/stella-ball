# Prism Breakers — 아트 에셋 계획

## 아트 방향

**정교한 픽셀 캐릭터를 작은 전술판 위에 크게 배치하고, 어두운 보랏빛 유적과 강한 원색 이펙트로 한 발의 궤적을 읽히게 한다.**

핵심은 배경 장식이 아니라, 발사체·반사·룬 통과·약점 명중이 한눈에 읽히는 것이다. 모든 래스터 스프라이트는 최근접 보간(`imageSmoothingEnabled = false`)으로 렌더링한다.

## 이번 수직 슬라이스에 사용하는 에셋

| 게임 역할 | 프로젝트 파일 | 원본 | 사용 방식 |
| --- | --- | --- | --- |
| 가온 · 근접 베기 | `assets/characters/gaon-warrior-idle.png` | Tiny Swords Free Pack / Blue Warrior | 멈춘 자리에서 근거리 고위력 검격 |
| 비연 · 거리 저격 | `assets/characters/biyeon-archer-idle.png` | Tiny Swords Free Pack / Yellow Archer | 멀수록 강해지는 보스 저격 |
| 루미 · 이중 분열 | `assets/characters/lumi-shaman-idle.png` | Tiny Swords Enemy Pack / Hex Shaman | 이번 샷에 한 번 룬볼을 둘로 복제 |
| 하루 · 강제 중계 | `assets/characters/haru-lancer-idle.png` | Tiny Swords Free Pack / Purple Lancer | 가장 가까운 다른 유닛에게 룬볼 재발사 |
| 세라 · 전환 명령 | `assets/characters/sera-monk-idle.png` | Tiny Swords Free Pack / Blue Monk | 클릭 한 번으로 90° 전환 및 에너지 획득 |
| 태오 · 충돌 충격파 | `assets/characters/taeo-miner-idle.png` | Tiny Swords Free Pack / Yellow Pawn (Pickaxe) | 모든 충돌 수에 비례한 주변 충격파 |
| 닉스 · 마지막 모사 | `assets/characters/nyx-oracle-idle.png` | Tiny Swords Free Pack / Purple Warrior | 마지막으로 충돌한 아군의 능력을 복제 |
| 리오 · 우회전 명령 | `assets/characters/rio-compass-idle.png` | Tiny Swords Free Pack / Red Lancer | 12프레임 대기. 클릭 한 번으로 90° 우회전 |
| 공허의 왕 | `assets/bosses/void-troll-idle.png` | Tiny Swords Enemy Pack / Troll | 12프레임 대기. 보스는 화면에서 가장 크게 |
| 명중/연쇄/클리어 | `assets/fx/*.png` | brackeys_vfx_bundle / predrawn (CC0) | 명중, 전기 연쇄, 클리어 폭발 |
| 전장 장식 | `assets/terrain/rock-*.png` | Tiny Swords Free Pack | 플레이 영역 바깥의 가장자리 장식만 사용 |
| 유물탄·룬·약점 | `assets/original/*.svg` | Prism Breakers 오리지널 | 게임 고유 식별자. 픽셀 격자 SVG |

## 사용하지 않는 에셋

- **Retro Lines 16×16**: CC0이지만 네온 아케이드 감도가 현재 캐릭터 스프라이트와 다르다. 추후 메뉴/미니게임이 필요할 때만 재검토한다.
- **Tiny RPG Soldier & Orc**: 완성도는 좋지만 100px 프레임의 외곽선·비율이 Tiny Swords와 달라, 파티 화면에 섞지 않는다.
- 기존 프로젝트의 대형 UI 팩: 지금은 자체적으로 단순한 픽셀 UI를 만들고, 출처 표기가 필요한 UI 팩은 MVP에 넣지 않는다.

## 구현 규칙

1. 모든 캐릭터는 현재 사용하는 프레임만 로드한다. 팩 전체를 게임에 넣지 않는다.
2. 보스·캐릭터·발사체가 겹치는 영역에는 지형 장식을 놓지 않는다.
3. 룬은 캐릭터 초상화가 아니라 별도의 고유 기호로 표시한다. 능력은 색 + 형태 + 짧은 이름으로 구분한다.
4. 캐릭터 스프라이트는 화려한 장식이 아니라 “어떤 룬을 통과했는지”를 보조하는 역할이다.
5. 새 래스터 에셋이 필요하면 먼저 이 문서에 역할·출처·프레임 규격을 추가한다.

## 다음 제작 후보

현재 코어 데모에는 필요한 에셋이 모두 있다. 다음 구현에서만 추가한다.

- 보스 실드 페이즈용 3단계 균열 오버레이
- 캐릭터 선택 카드용 64×64 초상화 크롭
- 발사 횟수와 쿨다운을 읽히는 작은 픽셀 아이콘

각 항목은 게임 규칙이 확정된 뒤에만 만든다. 지금은 아트 양을 늘리지 않는다.
