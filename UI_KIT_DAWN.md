# Stella Ball — 새벽 관측소 UI 킷 (Dawn Observatory v1)

작성: 2026-08-12. 이 문서가 `UI_REDESIGN_HANDOFF.md`(Ink & Brass v2)를 대체하는 새 테마 기준이다.
확정 시안: 디자인 프로젝트의 `새벽 관측소 시안.dc.html` 7턴(7a 허브 / 7b 전투 / 7c 백로그).
런타임 킷: [`prototypes/stella-ball-pixel-ui.js`](prototypes/stella-ball-pixel-ui.js).

## 결정 이력

1. Ink & Brass의 네이비·골드 톤이 "AI풍"이라는 판단으로 폐기. → **새벽 관측소**: 청록-잿빛 밤 + 살구빛 여명.
2. 평평한 CSS 사각 버튼도 폐기. → **픽셀 스텝 실루엣**(캡슐·라운드·별·초승달) + 디더 그라디언트.
3. 마우스 패럴랙스는 검토 후 제외. 나머지 배경 상호작용은 채택.
4. 캔버스 판정색, `heroes[].col` 유닛 고유색은 절대 변경하지 않는다 (기존 원칙 유지).

## 팔레트

- 밤 표면: `dawn-0 #0a0f12`, `dawn-1 #101a1e`, `dawn-2 #16242a`, `raised #1d2e34`
- 글·선: 본문 `#cfdad7`, 밝은 제목 `#f3ede2`, 보조 `#8ba39f`, 흐림 `#5f7a77`, 선 `#34494d` / `#24363a`
- 여명(주 행동·보상·별빛 사건 전용): 별빛 `#ffd2a0`, 살구 `#eea56f`, 깊은 살구 `#b06a3d`
- 청록(정보·가이드·기믹 전용): `#7cc6bb`, 어두운 `#47837c`
- 하드 픽셀 섀도: `#04080a` (버튼 4px, 탭 3px, 눌림 1px)
- 배경 하늘: `linear-gradient(180deg,#0a1216,#0e1a1f 38%,#152528 70%,#1f322f)` + 하단 여명 글로우 `#e8955f2e`

## 버튼·패널 (data-pbtn)

`stella-ball-pixel-ui.js`가 `[data-pbtn]` 요소 크기를 측정해 픽셀 실루엣 캔버스를 생성, `background-image`로 붙인다.
DOM을 다시 그린 뒤에는 `StellaPixelUI.apply()`를 재호출한다.

| kind | 실루엣 | 용도 |
| --- | --- | --- |
| `cta` | 캡슐(살구, 반짝 픽셀) | 화면당 1개의 주 행동 |
| `sub` | 라운드(청록 림) | 보조 행동 (메인, 스테이지 변경 등) |
| `tab` / `tabActive` | 알약 | 하단 탭. 활성은 살구 + `✦` + `data-lift="translateY(-4px)"` |
| `chip` | 알약(무광) | HUD 수치, 정보 라벨 |
| `star` | 별(금빛) | 별빛 소환 진입 |
| `moon` | 초승달(크림) | 관측 일지/기록 진입 |
| `panel` / `panelWarm` | 큰 라운드 | 카드·패널 표면. Warm은 살구 림(오늘의 관측, CONSTELLATION) |

공통 마감: 픽셀 유닛 3px 스텝 실루엣, 1px 외곽선, 상단 하이라이트/하단 베벨 림, 5단 밴드 + 체커 디더링.
그림자는 `filter: drop-shadow(0 4px 0 #04080a)` (실루엣을 따라감). 눌림 = press 프레임 + `translateY(3px)` + 그림자 1px.
글자 대비: 어두운 면 위 `#eaf4f1`/`#c3d6d2` + `text-shadow: 0 2px 0 #04080a`, 살구 면 위 크림 `#fff6e6` + 4방향 `#6e3616` 외곽선.

전투 전장 벽만 9-slice 사각 프레임(청록)을 유지한다 — 전장은 직사각형이 자연스럽다.

## 배경 데코 (데스크톱 여백)

게임 `main` 뒤 body 배경을 장식하는 레이어. 시안 7a 기준.

- 요소: 크레이터 달(절차 캔버스 44px) + **달토끼**, 붉은 행성, 고리 행성, 은하수 띠, 오로라 2겹, 성운, 별 3층(트윙클), **우주비행사**, 망원경·나침반 소품, 유성
- 상호작용: 달토끼 클릭→떡방아 프레임 스왑 + 토스트 / 우주비행사 호버→손 흔들기 / 망원경·나침반 포인터 드래그 / 빈 하늘 클릭→✦ 팝 + 파문 링 / 유성 클릭→소원 토스트. 패럴랙스는 없음.
- 스프라이트는 `StellaPixelUI.sprite('rabbitUp'|'rabbitDown'|'astroIdle'|'astroWave'|'tele'|'compass'|'coin'|'orr'|'emblem'|'rank'|'mail')` dataURL로 생성 (PNG 파일 불필요, `image-rendering: pixelated` 필수)
- 별은 원형이 아닌 **정사각 픽셀**(2–3px), 15%만 살구색
- 유성 주기 기본 8초, 성능: 장식은 전부 CSS 애니메이션/단발 DOM, 서브스텝·렌더 루프에 관여하지 않음

## 스프라이트 시트 주의

`assets/characters/*-idle.png`, `bosses/*.png`, `enemies/*-idle.png`는 가로 시트(프레임=정사각, 한 변=naturalHeight).
UI에 정지 이미지로 쓸 때는 `StellaPixelUI.cropSheets(selector)`로 첫 프레임만 크롭한다. `ria-bladewheel-idle.png`만 단일 프레임.

## 반입 체크리스트

1. **완료** — `prototypes/prism-breakers.html`이 `stella-ball-pixel-ui.js`를 로드하고, `stella-ball-theme.css` 색 변수를 위 팔레트로 교체했다.
2. **완료(방식 변경)** — `showMeta()/showRoster()/showGacha()/showShop()/showProfile()` 마크업은 건드리지 않았다. 대신 `stella-ball-dawn.js`의 `MAP` 셀렉터 목록 + `MutationObserver`가 렌더 직후 `data-pbtn`을 붙이고 `StellaPixelUI.apply()`를 호출한다. **새 버튼을 추가할 때는 게임 코드가 아니라 `stella-ball-dawn.js`의 `MAP`에 셀렉터를 넣는다.**
3. **완료** — `#dawn-sky` 배경 데코 레이어. `main`이 `z-index: 1`, `#dawn-sky`가 `z-index: 0`이라 게임 입력을 가로채지 않는다.
4. **미완료** — `ASSET_BACKLOG.md`의 소환·상점·프로필·별자리 점등 항목을 이 킷 팔레트로 반입 처리.
5. **완료** — `npm run verify`, `npm run smoke`, 로컬 서버 브라우저 검수.

## 로드 순서 고정

`scripts/smoke-runtime.mjs`의 `expectedStyles`/`expectedScripts`가 순서를 정확히 일치 검사한다.
`stella-ball-dawn.css`는 **마지막 스타일시트**여야 하고(테마의 `!important` 버튼 표면을 덮어써야 하므로),
두 dawn 스크립트는 `js/game-bootstrap.js` 뒤에 온다. 순서를 바꾸면 같은 커밋에서 이 목록도 고쳐야 smoke가 통과한다.

## 반입 현황 (2026-08-12)

- `stella-ball-theme.css`: Ink & Brass 색을 새벽 관측소 팔레트로 전면 매핑 (v3 "Dawn Observatory"). 유닛 고유색 `--sb-*`와 캔버스 판정색은 제외.
- `stella-ball-dawn.css` + `stella-ball-dawn.js` 추가: 게임 버튼/탭/칩에 `data-pbtn`을 자동 부여(MutationObserver)하고 픽셀 실루엣을 입힌다. 일시정지 버튼은 초승달. body 뒤에 `#dawn-sky` 배경 데코(달+달토끼·행성·오로라·유성·우주비행사·드래그 소품).
- 남은 것: 전투 캔버스 바닥 톤(`game-core-render.js`의 스테이지 아트 캐시 색)은 미변경 — 판정 가독성 검증 후 별도 패스. 별 모양 버튼은 킷에만 있고 게임 자동 매핑에는 미사용(탭 그리드 레이아웃 확인 후 적용).
