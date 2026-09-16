# Stella Ball — itch.io 페이지 키트

itch.io에 브라우저 게임으로 올릴 때 그대로 복붙/참고할 자료 모음.
(대회 후원사 브랜딩 OpenAI·Hive·컴투스는 전부 제외했다.)

---

## 1. 기본 정보 (itch 프로젝트 설정)

| 항목 | 값 |
|---|---|
| **Title** | Stella Ball |
| **Project URL (slug)** | `stella-ball` (또는 `prism-breakers`) |
| **Kind of project** | HTML |
| **Release status** | Prototype (또는 Released) |
| **Pricing** | No payments (무료) — 원하면 "Donation" 허용 |
| **Genre** | Action (2차: Strategy / Puzzle) |
| **Tags** | `pixel-art` `top-down` `physics` `strategy` `singleplayer` `boss-battle` `bullet` `roguel-ish` `korean` `2d` |
| **Inputs** | Mouse, Keyboard (키보드만으로도 완주 가능) |
| **Average session** | A few minutes ~ 30 min |
| **Languages** | English, Korean |

### 짧은 태그라인 (Short description / 리스트 카드용)
- **EN**: A top-down billiards battler where every shot is a choice — spend your starlight to aim, or leave it to form a constellation.
- **KO**: 유성과 세 별지기를 굴려 별빛을 만들고, 그 별빛을 조준에 쓸지 별자리로 남길지 매 샷 고르는 탑다운 당구 전략.

---

## 2. 상세 설명 (Details 본문 — 복붙용)

### English

**Stella Ball** is a top-down billiards battler about light and choice.

Pull a meteor back and let it fly. As it rolls, it knocks your three **starkeepers** across the board — and wherever a starkeeper is struck, it *resonates* and leaves a mote of **starlight** behind. Then comes the decision that drives every shot:

**Spend your starlight to aim, or leave it to become a constellation.**

Picked starlight sets your next shot's direction (the centroid of what you choose) and its power (the wider you spread your picks, the harder it hits). Starlight you *leave behind* — three or more — snaps into a 3-to-7-point constellation when the shot ends, firing one of eight powers: area damage, pierce, weak-point mark, shell-break, flight, awaken-all, triple-strike, or an extra meteor. **One choice, two consequences.**

Roll, resonate, awaken, and read the board to bring down the Void Colossi across seven constellation worlds — from Aries to the Big Dipper, 34 stages and a final showdown.

- 🎯 **Aim by choosing** — both direction and power come from *what* you pick
- ✨ **Every shot forks** — aim now, or bank a constellation for later
- 🌟 **Three starkeepers** that awaken and finish with signature attacks
- ⌨️ Fully playable with **mouse or keyboard**
- 🌏 **Full Korean & English**
- 🕹️ Runs in the **browser** — no install, no login
- 🎓 A gentle first-run tutorial (Luna's observation lessons)

### 한국어

**Stella Ball**은 빛과 «선택»에 관한 탑다운 당구 전투 게임입니다.

유성을 아래로 당겼다 놓으면, 굴러가며 세 **별지기**를 판 위로 쳐냅니다. 별지기가 부딪힌 자리마다 **공명**이 일어나 그 자리에 **별빛**이 남죠. 그리고 매 샷을 지배하는 결정이 옵니다:

**이 별빛을 조준에 쓸 것인가, 남겨 별자리로 만들 것인가.**

고른 별빛은 다음 샷의 방향(고른 노드들의 무게중심)과 세기(넓게 벌릴수록 강하게)를 정합니다. 쓰지 않고 **남긴** 별빛이 셋 이상이면 샷이 끝날 때 3~7점 별자리가 되어 여덟 능력 중 하나를 냅니다 — 포위 피해·관통·약점 표식·껍질 파괴·비행·전원 각성·삼연격·유성 +1. **한 번의 선택이 두 결과를 냅니다.**

굴리고, 공명시키고, 각성시키며 판을 읽어 일곱 별자리 월드의 공허 거상들을 무너뜨리세요 — 양자리부터 북두칠성까지, 34개 스테이지와 최종전.

- 🎯 **노드를 «골라» 조준** — 방향도 세기도 무엇을 고르느냐에서 나옵니다
- ✨ **매 샷이 갈림길** — 지금 조준할까, 별자리로 남길까
- 🌟 각성해 고유 정산 공격을 내는 **세 별지기**
- ⌨️ **마우스 또는 키보드**만으로 완주 가능
- 🌏 **한국어·영어 완전 지원**
- 🕹️ **브라우저**에서 바로 — 설치·로그인 없음
- 🎓 첫 실행 튜토리얼(루나의 관측 수업)

---

## 3. 브라우저 플레이용 업로드 방법 (HTML5)

### 3-1. 빌드 zip 구조
게임 진입점은 `prototypes/prism-breakers.html`이고, 이건 `prototypes/js/*`, `prototypes/*.css`, 그리고 `../assets/**`를 불러온다. 저장소 루트의 `index.html`이 이미 그리로 리다이렉트한다. 그래서 브라우저 빌드는:

```
(zip 루트)
├── index.html        ← 저장소 루트 index.html (prototypes/…로 리다이렉트)
├── prototypes/       ← 폴더 통째로
└── assets/           ← 폴더 통째로
```

> **중요:** itch는 zip **루트에 index.html**이 있어야 한다. 폴더를 통째로 zip하지 말고 **내용물**을 zip해서 index.html이 최상단에 오게 할 것.

### 3-2. Windows에서 빌드 zip 만들기 (PowerShell)
저장소 루트에서:

```bash
$stage = "$env:TEMP\stella-ball-itch"
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory $stage | Out-Null
Copy-Item index.html $stage
Copy-Item prototypes $stage\prototypes -Recurse
Copy-Item assets $stage\assets -Recurse
Compress-Archive -Path "$stage\*" -DestinationPath "$env:USERPROFILE\Desktop\stella-ball-itch.zip" -Force
```
→ 바탕화면에 `stella-ball-itch.zip` 생성. (원하면 내가 대신 만들어서 파일로 줄게.)

### 3-3. itch 설정
1. Dashboard → **Create new project**
2. **Kind of project: HTML**
3. 위 zip 업로드 → **"This file will be played in the browser"** 체크
4. Embed options:
   - **Viewport dimensions: 1280 × 720** (16:9)
   - ✅ **Click to launch in fullscreen** (전체화면 버튼)
   - Mobile friendly: 이 게임은 마우스+키보드 기준이라 **끄기** 권장(터치 테스트 안 했으면)
5. Genre / Tags / 스크린샷 / 커버 채우고 저장

---

## 4. 커버 & 스크린샷
- **커버 이미지**: 630 × 500 px (itch 권장). 타이틀 화면 또는 전투 한 컷.
- **스크린샷 3~5장** 추천:
  1. 타이틀 화면 (새벽 관측소)
  2. 전투 — 조준 중(노드 고른 상태 + 세기 게이지)
  3. 별자리 발동 순간
  4. 별지기 각성 정산 공격
  5. 별자리 지도(캠페인 진행)
- 라이브에서 캡처: `https://8rulerstar.github.io/prism-breakers/prototypes/prism-breakers.html`

---

## 5. 크레딧 (복붙용)

```
Stella Ball

Design · code · original pixel art · SFX — (제작자 본인)
  Starkeeper & boss sheets, constellation art, sound effects: original.

Third-party assets
- Tiny Swords (Free / Enemy Pack) — Pixel Frog  (boss & terrain selections)
- Orc token from Tiny RPG Character Asset Pack — Zerie  (recoloured)
- Pixel VFX — brackeys_vfx_bundle / predrawn  (CC0)
- Font — Galmuri (see assets/fonts/galmuri/NOTICE.md)
- Title music — "Week 10 - Mischief MELODY" (loop bundle)   ← ⚠️ 아래 6번 확인
- Hub / battle music — original (from the author's WCF project)

Built with AI coding assistants.   ← (선택. 넣기 싫으면 빼도 됨)
```

---

## 6. ⚠️ 공개 배포 전 반드시 확인 (라이선스)

`assets/ATTRIBUTION.md` 기준, **공개 전에 짚어야 할 것들**:

1. **🔴 타이틀 BGM `title.ogg` — "Week 10 - Mischief MELODY"**
   다운로드한 loop bundle(`~/Downloads/music-loop-bundle-2026-q1`)에서 가져온 곡.
   ATTRIBUTION.md에 **"재배포 조건은 그 번들 라이선스를 따르며, 공개 배포 전 반드시 소유자가 확인할 것"**이라고 명시돼 있음.
   → **번들 라이선스가 «공개 배포·2차 저작물»을 허용하는지 확인**하거나, 안 되면 **다른 곡으로 교체**(hub/battle처럼 본인 소유 곡으로). 이게 제일 중요.

2. **🟡 Tiny Swords (Pixel Frog) / Tiny RPG (Zerie) 팩**
   ATTRIBUTION.md: "commercial release·redistribution 전에 소스팩 약관 확인." 둘 다 보통 «무료+크레딧» 계열이라 위 크레딧 표기로 대개 충분하지만, 각 팩 페이지 약관 한 번 확인 권장. (무료 배포면 리스크 낮음.)

3. **🟢 나머지**
   VFX(CC0), SFX(본인 스크립트 합성 + WCF 본인 곡), 별지기·보스·별자리 아트(본인 제작), Galmuri 폰트(OFL 계열, NOTICE.md 확인) — 문제 없음.

> 요약: **1번(타이틀 곡)만 확실히 처리하면** 무료 공개 배포는 안전한 편. 상용/유료면 2번까지 팩 약관을 더 꼼꼼히.
