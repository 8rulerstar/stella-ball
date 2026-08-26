/* eslint-disable */
/* ──────────────────────────────────────────────────────────────────────────
   English localization map + overlay observer (feature/full-english-i18n).
   자동 생성: scripts/gen-i18n.mjs — 원천은 scripts/i18n-source-pairs.json.
   손으로 고치지 말 것(재생성 시 덮어씀). 문구를 고치려면 원천 JSON을 고치고
   node scripts/gen-i18n.mjs scripts/i18n-source-pairs.json prototypes/js/game-i18n.js.

   한국어가 원본이다. settings.language === "en" 일 때 #overlay 안 텍스트 노드를
   지역화한다: ① 노드 전체가 정확히 I18N_EN 키와 같으면 통째로 치환, ② 남은
   한글 노드는 I18N_FRAG(엄선된 안전 조각)로 부분 치환한다. 데이터 객체(별지기·
   자리·무기·도색·월드·스테이지)는 game-data.js의 applyDataLanguage가 스왑한다.
   ────────────────────────────────────────────────────────────────────────── */
const I18N_EN = {
  "프리즘 원석": "Prism Stone",
  "관측소 지급 기본 유성": "Standard meteor issued by the Observatory",
  "잔불의 유성": "Ember Meteor",
  "꺼지지 않은 별의 마지막 온기":
    "The last warmth of a star that never went out",
  "심연의 유성": "Abyss Meteor",
  "공허를 삼키고 돌아온 빛": "Light that swallowed the Void and returned",
  "이끼별 유성": "Mossfall Meteor",
  "오래 잠든 자리에 돋아난 색":
    "A color that sprouted where it lay long asleep",
  "본래 색": "True Color",
  "관측소 지급": "Issued by the Observatory",
  청군: "Deep Azure",
  "새벽 전 가장 짙은 파랑": "The deepest blue before dawn",
  홍옥: "Ruby",
  "식지 않은 화로의 색": "The color of a hearth still glowing",
  자수정: "Amethyst",
  "공허를 오래 본 자의 색": "The color of one who long gazed into the Void",
  청동: "Verdigris",
  "오래 걸린 관측기의 녹": "The patina of a long-hung observation glass",
  "별가루 검": "Stardust Blade",
  "정산 피해 +16%": "Settle Damage +16%",
  "별의 가루를 벼려 만든 보급형 검. 어느 별지기가 들어도 정산 공격이 조금 더 매섭습니다.":
    "A standard-issue blade forged from stardust. In any Starkeeper's hands, its settle attack bites a little sharper.",
  "달빛 장궁": "Moonlight Longbow",
  "정산 피해 +15%": "Settle Damage +15%",
  "달빛을 시위에 먹인 장궁. 멀고 가까움을 가리지 않고 정산 피해를 올립니다.":
    "A longbow whose string is steeped in moonlight. Near or far, it raises settle damage all the same.",
  "혜성 장창": "Comet Lance",
  "정산 피해 +18%": "Settle Damage +18%",
  "혜성의 궤적을 벼려 만든 장창. 일반 무기 중 가장 무겁게 내려칩니다.":
    "A lance forged from a comet's trail. It strikes down the heaviest of any common weapon.",
  "성령 구슬": "Astral Orb",
  "정산 피해 +12%": "Settle Damage +12%",
  "작은 별을 가둔 구슬. 값은 얌전하지만 누구의 손에나 익숙합니다.":
    "An orb that cages a tiny star. Modest in power, but it sits easy in any hand.",
  여명파검: "Dawnbreak Blade",
  "새벽을 가르는 검. 샛별이 들면 검기가 여명처럼 번져 정산 피해 +70%.":
    "A blade that cleaves the dawn. In Saetbyeol's hands its edge spreads like first light — Settle Damage +70%.",
  "은하 시위": "Galaxy String",
  "은하수를 당겨 만든 시위. 미리내가 들면 화살이 강을 건너 정산 피해 +70%.":
    "A bowstring drawn from the Milky Way. In Mirinae's hands the arrow crosses the river — Settle Damage +70%.",
  "쌍성 프리즘": "Twin Star Prism",
  "빛을 둘로 가르는 프리즘. 별하가 들면 분열체까지 벼려 정산 피해 +70%.":
    "A prism that splits light in two. In Byeolha's hands even the split forms are honed — Settle Damage +70%.",
  "혜성 꼬리": "Comet Tail",
  "길게 늘어진 혜성의 꼬리. 살별이 들면 중계가 벼락처럼 꽂혀 정산 피해 +70%.":
    "The long-trailing tail of a comet. In Salbyeol's hands the relay strikes like lightning — Settle Damage +70%.",
  "윤슬 부채": "Shimmer Fan",
  "회전 칼날 +15%": "Spinning Blade +15%",
  "물비늘을 접었다 펴는 부채. 윤슬이 들면 회전 칼날이 부서진 별빛처럼 흩날려 +70%.":
    "A fan that folds and unfolds ripples of light. In Yunseul's hands the spinning blades scatter like shattered starlight — +70%.",
  "달무리 고리": "Halo Ring",
  "달을 두른 빛의 고리. 달무리가 들면 공명이 궤도째 울려 정산 피해 +70%.":
    "A ring of light wreathing the moon. In Dalmuri's hands the Resonance rings along its whole orbit — Settle Damage +70%.",
  "별불 망치": "Starfire Hammer",
  "떨어진 별을 두드리는 망치. 모루가 들면 충격파가 대장간처럼 터져 정산 피해 +70%.":
    "A hammer that beats fallen stars. In Moru's hands the shockwave bursts like a forge — Settle Damage +70%.",
  "그믐 거울": "Dark Moon Mirror",
  "빛을 삼켜 되비추는 검은 거울. 그믐이 들면 모사한 능력까지 짙어져 정산 피해 +70%.":
    "A black mirror that swallows light and reflects it back. In Geumeum's hands even mimicked powers deepen — Settle Damage +70%.",
  양자리: "Aries",
  "세 별빛을 잇는 첫 관측 항로. 별빛 조준과 첫 별자리를 배운다.":
    "The first observation route, joining three starlights. Learn starlight aiming and your first constellation.",
  화살자리: "Sagitta",
  "네 점의 화살이 향하는 곳. 발사 뒤 궤도 전환을 익힌다.":
    "Where the four-point arrow is aimed. Master the mid-flight turn after launch.",
  까마귀자리: "Corvus",
  "네 점의 굽은 날개. 충돌 순서와 다음 샷의 자리를 읽는다.":
    "Four points of a bent wing. Read the order of impacts and where the next shot begins.",
  카시오페이아: "Cassiopeia",
  "다섯 별의 W. 어느 별지기를 먼저 공명할지 고른다.":
    "A W of five stars. Choose which Starkeeper to resonate first.",
  백조자리: "Cygnus",
  "다섯 점의 긴 날개. 한 샷 안에서 접점을 이어 간다.":
    "Five points of a long wing. Chain the contact points within a single shot.",
  오리온자리: "Orion",
  "여섯 별의 사냥꾼. 조향 한 번과 공명 접점을 함께 회수한다.":
    "The six-star hunter. Recover one steer and a resonance contact together.",
  북두칠성: "Big Dipper",
  "일곱 별의 국자. 모든 경로 판단을 묻는 마지막 관측.":
    "The ladle of seven stars. The final observation, testing every path you can read.",
  "관측되지 않은 점": "The Unobserved Point",
  "성도 밖의 좌표. 이름이 없고, 이미 이쪽을 보고 있다.":
    "A coordinate beyond the star chart. It has no name, and it is already watching you.",
  "두베 · 첫 관측": "Dubhe · First Observation",
  "루나의 안내를 따라 직격, 근접 각성, 별자리 배율을 차례로 관측하세요.":
    "Follow Luna's guidance and observe direct hits, close-range awakening, and constellation multipliers in turn.",
  "왼쪽 별지기": "Left Starkeeper",
  "오른쪽 별지기": "Right Starkeeper",
  "첫 관측점": "First Observation Point",
  "메라크 · 공명의 문": "Merak · Gate of Resonance",
  "두 공명 범퍼를 오가며 속도를 만들고, 범퍼 충돌 연계를 익히세요.":
    "Build speed by bouncing between two resonance bumpers, and learn to chain bumper impacts.",
  "좌측 중계점": "Left Relay",
  "우측 중계점": "Right Relay",
  "중앙 귀환점": "Center Return",
  "페크다 · 반사의 계단": "Phecda · Stair of Reflection",
  "반사 벽 두 개로 각을 만들어 거상의 약점까지 길을 그리세요.":
    "Use two reflecting walls to set your angle and trace a path to the Colossus's weak point.",
  "좌측 계단": "Left Stair",
  "우측 계단": "Right Stair",
  "하단 귀환점": "Lower Return",
  "메그레즈 · 잔재의 길목": "Megrez · Path of Remnants",
  "길을 막고 선 공허 잔재 두 기를 먼저 걷어내야 약점이 열립니다.":
    "Two Void remnants block the way — clear them first, and the weak point opens.",
  "좌측 길목": "Left Passage",
  "우측 길목": "Right Passage",
  "하단 대기점": "Lower Standby",
  "알리오트 · 굳은 껍질": "Alioth · Hardened Shell",
  "거상이 껍질을 세 겹 둘렀습니다. 약한 타격 세 번은 통째로 튕겨 나갑니다.":
    "The Colossus wears three layers of shell. Three weak strikes bounce off entirely.",
  "좌측 파쇄점": "Left Break Point",
  "우측 파쇄점": "Right Break Point",
  "중앙 파쇄점": "Center Break Point",
  "미자르 · 흐려지는 자리": "Mizar · Fading Ground",
  "흐린 발판을 밟고 지나가면 쌓아 둔 별자리 배율이 깎여 나갑니다.":
    "Cross a murky pad and it shaves away the constellation multiplier you've built up.",
  "좌측 흐린 자리": "Left Murky Ground",
  "우측 흐린 자리": "Right Murky Ground",
  "중앙 관측점": "Center Observation Point",
  "알카이드 · 도는 방벽": "Alkaid · Circling Barrier",
  "체력을 가진 방벽 두 개가 거상 주위를 돕니다. 틈을 노리세요.":
    "Two barriers with their own health circle the Colossus. Aim for the gap.",
  "좌측 틈": "Left Gap",
  "우측 틈": "Right Gap",
  "카프 · 밀려나는 밤": "Caph · The Night That Pushes Back",
  "거상의 체력이 꺾일 때마다 별지기 셋과 유성이 네 모서리로 밀려납니다.":
    "Each time the Colossus's health breaks, the three Starkeepers and the Meteor are pushed to the four corners.",
  "좌측 고정점": "Left Anchor",
  "우측 고정점": "Right Anchor",
  "중앙 고정점": "Center Anchor",
  "셰다르 · 다시 잠드는 별": "Schedar · The Star That Sleeps Again",
  "거상의 체력이 꺾일 때마다 별지기가 다시 잠듭니다. 두 번 부딪혀야 깨어납니다.":
    "Each time the Colossus's health breaks, a Starkeeper falls back asleep. It takes two impacts to wake.",
  "좌측 잠자리": "Left Slumber",
  "우측 잠자리": "Right Slumber",
  "하단 잠자리": "Lower Slumber",
  "감마 카스 · 가속의 등뼈": "Gamma Cas · Spine of Acceleration",
  "중앙 가속 발판이 유성의 운동량을 밀어 올립니다.":
    "The central boost pad drives the Meteor's momentum higher.",
  "좌측 등뼈": "Left Spine",
  "우측 등뼈": "Right Spine",
  "중앙 등뼈": "Center Spine",
  "루크바 · 겹친 궤도": "Ruchbah · Overlapping Orbits",
  "도는 방벽 하나와 반사 벽 두 개가 함께 길을 좁힙니다.":
    "One circling barrier and two reflecting walls narrow the path together.",
  "좌측 궤도": "Left Orbit",
  "우측 궤도": "Right Orbit",
  "하단 궤도": "Lower Orbit",
  "세긴 · 마지막 꼭짓점": "Segin · The Final Vertex",
  "껍질 두 겹과 공명 범퍼 둘. 배율을 쌓아 한 번에 뚫으세요.":
    "Two shell layers and two resonance bumpers. Stack your multiplier and break through in one blow.",
  "좌측 꼭짓점": "Left Vertex",
  "우측 꼭짓점": "Right Vertex",
  "중앙 꼭짓점": "Center Vertex",
  "무한 훈련장": "Endless Training Ground",
  "불멸의 거상과 자동 보충 유성으로 충돌·분열·배율을 제한 없이 시험합니다.":
    "With an immortal Colossus and auto-replenishing Meteors, test impacts, splits, and multipliers without limit.",
  "좌상 훈련 별지기": "Upper-Left Training Starkeeper",
  "우상 훈련 별지기": "Upper-Right Training Starkeeper",
  "좌하 훈련 별지기": "Lower-Left Training Starkeeper",
  "우하 훈련 별지기": "Lower-Right Training Starkeeper",
  하말: "Hamal",
  "첫 관측": "First Observation",
  "루나와 함께 별빛 조준과 첫 별자리를 관측하세요.":
    "Alongside Luna, observe starlight aiming and your first constellation.",
  셰라탄: "Sheratan",
  "갈라진 뿔": "The Split Horns",
  "첫 공명이 안내별 둘을 밝혀 첫 별자리를 돕습니다.":
    "Your first resonance lights two guide stars to help form the first constellation.",
  메사르팀: "Mesarthim",
  "세 점의 고리": "Ring of Three Points",
  "첫 공명이 안내별 둘을 밝혀 별자리 루프를 돕습니다.":
    "Your first resonance lights two guide stars to help close the constellation loop.",
  샴: "Sham",
  "첫 화살": "The First Arrow",
  "별지기를 먼저 맞힌 뒤 보스에게 향하는 한 줄을 만드세요.":
    "Strike a Starkeeper first, then draw a single line toward the boss.",
  "화살의 허리": "Arrow's Waist",
  "갈림 궤도": "The Forking Orbit",
  "발사당 한 번의 궤도 전환을 안전하게 써 보세요.":
    "Practice using your one orbit turn per launch safely.",
  화살촉: "Arrowhead",
  "먼저 꺾기": "Turn First",
  "보스보다 별지기를 먼저 맞히는 각을 찾으세요.":
    "Find the angle that hits a Starkeeper before the boss.",
  되돌림: "Recurve",
  "끝의 방향": "Direction at the End",
  "공명 이후 남은 방향으로 다음 접점을 이어 가세요.":
    "Carry the leftover direction after resonance into the next contact point.",
  알키바: "Alchiba",
  "검은 첫 점": "The First Black Point",
  "첫 충돌 순서를 바꿔 보스 진입을 설계하세요.":
    "Reorder the first impacts to plan your approach to the boss.",
  크라즈: "Kraz",
  "굽은 날개": "The Bent Wing",
  "멈춘 자리가 다음 샷의 출발점이 되는 것을 활용하세요.":
    "Use the fact that where you come to rest becomes the next shot's start.",
  기에나: "Gienah",
  "중계 깃": "Relay Feather",
  "두 별지기를 연달아 깨우는 경로를 만드세요.":
    "Draw a path that wakes two Starkeepers back to back.",
  알고라브: "Algorab",
  "돌아오는 그림자": "The Returning Shadow",
  "직격 대신 되돌아오는 공명 경로를 선택하세요.":
    "Choose a returning resonance path instead of a direct hit.",
  카프: "Caph",
  "W의 첫 점": "The First Point of the W",
  "분산된 시작 배치에서 첫 목표를 정하세요.":
    "From a scattered starting layout, pick your first target.",
  셰다르: "Schedar",
  "갈라진 왕관": "The Split Crown",
  "서로 먼 별지기를 한 발 안에서 연결하세요.":
    "Connect far-apart Starkeepers within a single shot.",
  "감마 카스": "Gamma Cas",
  "중앙의 틈": "The Central Gap",
  "가운데를 비워 둔 되돌아오는 경로를 확인하세요.":
    "Trace a returning path that leaves the center open.",
  루크바: "Ruchbah",
  "뒤집힌 W": "The Inverted W",
  "좌·우 전환 중 무엇을 남길지 판단하세요.":
    "Decide which of the left and right turns to save.",
  세긴: "Segin",
  "다섯 번째 점": "The Fifth Point",
  "다섯 발의 경로를 끊김 없이 완주하세요.":
    "Complete a five-shot path without a break.",
  데네브: "Deneb",
  "긴 날개": "The Long Wing",
  "먼 별지기까지 닿는 첫 경로를 만드세요.":
    "Draw your first path that reaches a distant Starkeeper.",
  사드르: "Sadr",
  교차점: "The Crossing",
  "두 공명 접점을 한 샷에 이어 보세요.":
    "Chain two resonance contacts in a single shot.",
  "중앙 깃": "Central Feather",
  "흐르는 선": "The Flowing Line",
  "멈추지 않는 유성에서 다음 충돌을 예측하세요.":
    "Predict the next impact from a Meteor that never stops.",
  "남쪽 날개": "Southern Wing",
  "백조의 턴": "The Swan's Turn",
  "조향 한 번으로 안전한 귀환선을 만드세요.":
    "Use a single steer to draw a safe return line.",
  알비레오: "Albireo",
  "두 빛의 끝": "The End of Two Lights",
  "별자리 후보를 남긴 채 보스 진입을 결정하세요.":
    "Decide your approach to the boss while leaving a constellation candidate open.",
  베텔게우스: "Betelgeuse",
  "어깨의 불꽃": "The Shoulder's Flame",
  "첫 샷에서 다음 샷의 자리를 확보하세요.":
    "Secure the next shot's position with your first shot.",
  벨라트릭스: "Bellatrix",
  "반대 어깨": "The Opposite Shoulder",
  "두 방향의 공명 중 더 긴 경로를 선택하세요.":
    "Between two resonance directions, choose the longer path.",
  알니타크: "Alnitak",
  "허리의 시작": "Start of the Belt",
  "공명 접점과 조향의 순서를 맞추세요.":
    "Line up the order of your resonance contact and your steer.",
  알니람: "Alnilam",
  "허리의 중심": "Center of the Belt",
  "별빛 셋을 남겨 별자리 발동을 노리세요.":
    "Leave three starlights to trigger a constellation.",
  민타카: "Mintaka",
  "허리의 끝": "End of the Belt",
  "보스 앞에서 유성의 운동량을 보존하세요.":
    "Preserve the Meteor's momentum right before the boss.",
  리겔: "Rigel",
  "사냥의 발": "The Hunter's Foot",
  "다섯 발 전체를 쓰는 안정적인 경로를 완성하세요.":
    "Complete a steady path that uses all five shots.",
  두베: "Dubhe",
  "국자의 시작": "Start of the Ladle",
  "마지막 월드의 첫 충돌 경로를 세우세요.":
    "Set the first impact path of the final world.",
  메라크: "Merak",
  "깊은 물": "Deep Water",
  "공명 뒤의 유성 방향을 끝까지 읽으세요.":
    "Read the Meteor's direction after resonance all the way through.",
  페크다: "Phecda",
  "굽은 손잡이": "The Bent Handle",
  "별지기 둘을 거쳐 보스에 닿으세요.":
    "Reach the boss by way of two Starkeepers.",
  메그레즈: "Megrez",
  "국자의 목": "Neck of the Ladle",
  "남길 별빛과 직접 피해의 우선순위를 고르세요.":
    "Choose between saving starlight and dealing direct damage.",
  알리오트: "Alioth",
  "기울어진 빛": "The Tilted Light",
  "조향 1회를 가장 가치 있는 접점에 쓰세요.":
    "Spend your one steer on the most valuable contact point.",
  미자르: "Mizar",
  "두 별의 선": "The Line of Two Stars",
  "짧은 접점 간격을 놓치지 않고 연쇄하세요.":
    "Chain the short-spaced contacts without missing one.",
  알카이드: "Alkaid",
  "마지막 꼭짓점": "The Final Vertex",
  "모은 모든 경로 판단으로 거상을 끝내세요.":
    "End the Colossus with every path-reading skill you've gathered.",
  "성도 밖": "Beyond the Star Chart",
  "이름 없는 좌표가 관측을 기다립니다. 이미 이쪽을 보고 있습니다.":
    "A nameless coordinate awaits observation. It is already watching you.",
  "좌측 항로": "Left Route",
  "우측 항로": "Right Route",
  "중앙 항로": "Center Route",
  수령: "Claim",
  보상: "Reward",
  골드: "Gold",
  수령하기: "Claim",
  "수령 완료": "Claimed",
  "조건 미달": "Not yet met",
  "관측 보상함": "Observation Rewards",
  "수령 대기 ": "Awaiting ",
  건: " pending",
  "쌓인 보상 없음": "No rewards waiting",
  "보상은 항목마다 직접 수령합니다.": "Claim each reward individually.",
  "스테이지를 클리어하면 보상이 여기에 쌓입니다.":
    "Clear a stage and rewards gather here.",
  "직접 수령할 보상": "Reward to claim",
  도서관: "Library",
  업적: "Achievements",
  "보유 ": "Held ",
  "업적 보상 · ": "Achievement Reward · ",
  별: "Star",
  달: "Moon",
  해: "Sun",
  하트: "Heart",
  달토끼: "Moon Rabbit",
  우주비행사: "Astronaut",
  망원경: "Telescope",
  나침반: "Compass",
  "도색장 오르": "Orr the Painter",
  "프로필 아이콘 선택": "Choose Profile Icon",
  "아이콘 선택": "Choose Icon",
  닫기: "Close",
  "수령 · ": "Claim · ",
  확인: "OK",
  "받은 우편이 없습니다.": "No mail received.",
  뒤로: "Back",
  "프로필 아이콘 바꾸기": "Change profile icon",
  "오늘의 관측 출석": "Today's Observation Check-in",
  "일째 · ": "day streak · ",
  "일째 · 오늘은 받았습니다": "day streak · Claimed for today",
  "하루 한 번 받을 수 있습니다. 하루를 건너뛰면 연속이 처음부터 시작합니다.":
    "Claimable once a day. Miss a day and the streak restarts.",
  "내일 다시 오면 연속 ": "Come back tomorrow for your day-",
  "일째 보상을 받습니다.": " streak reward.",
  "출석 보상 받기": "Claim Check-in Reward",
  "관측자 기록": "Observer Record",
  "되찾은 별": "Stars Reclaimed",
  "최단 시간": "Best Time",
  "최소 발사": "Fewest Shots",
  발: " shots",
  "보유 골드": "Gold Held",
  별지기: "Starkeepers",
  도색: "Skins",
  "오늘의 밤하늘 순위": "Tonight's Sky Rankings",
  관측자: "Observer",
  최단: "Best",
  최소: "Fewest",
  "현재는 이 브라우저에 저장된 <b>로컬 기록</b>입니다. Hive 리더보드 연동은 준비 중이며, 연동되면 같은 표에 다른 관측자의 기록이 함께 표시됩니다.":
    "These are <b>local records</b> saved in this browser for now. Hive leaderboard sync is in the works; once connected, other observers' records will appear in the same table.",
  우편함: "Mailbox",
  "출석 보상": "Check-in Reward",
  "우편 수령": "Mail Claimed",
  "골드가 모자라네. 별 하나 더 되찾아 오면 그때 얘기하지.":
    "Short on gold. Reclaim one more star, then we'll talk.",
  "빈손으로는 색을 못 내. 보상함부터 비우고 오게.":
    "No color comes from empty hands. Empty your reward box first.",
  "유성은 결국 자네 손에서 끝나. 색 정도는 마음에 들어야지.":
    "A meteor ends in your hands, after all. Its color ought to please you.",
  "밤하늘에 그을 선인데, 아무 색이나 쓸 텐가?":
    "It's a line drawn across the night sky. Would you use just any color?",
  "제법 모았군. 남은 건 자네가 어떤 밤을 좋아하느냐뿐이야.":
    "Quite a collection. All that's left is which kind of night you favor.",
  "이 정도면 관측소에서 제일 화려한 유성일세.":
    "This is the most dazzling meteor in the whole observatory.",
  "장착 중": "Equipped",
  장착하기: "Equip",
  구매하기: "Buy",
  "골드 부족": "Not enough gold",
  "기본 지급": "Granted by default",
  "구매 완료 · ": "Purchased · ",
  "관측소 상점": "Observatory Shop",
  "보유 골드 ": "Gold Held ",
  "도색장 · 오르": "Painter · Orr",
  "유성 도색": "Meteor Skins",
  "겉모습만 바뀝니다. 피해·속도·물리에는 영향이 없습니다.":
    "Appearance only. No effect on damage, speed, or physics.",
  "별지기 도색": "Starkeeper Skins",
  "보유한 별지기의 색만 바뀝니다. 전장 판정색과 이름표는 그대로입니다.":
    "Only the color of owned starkeepers changes. Battlefield tint and name tags stay the same.",
  "골드가 부족합니다. 스테이지를 클리어해 보세요.":
    "Not enough gold. Try clearing a stage.",
  "유성 도색 획득": "Meteor Skin Acquired",
  부름: "Call",
  관측: "Observation",
  응답: "Answer",
  현현: "Manifest",
  "새 별지기 해금": "New Starkeeper Unlocked",
  "소환 목록으로 돌아가기": "Back to Summon List",
  "아무 키나 눌러 건너뛰기": "Press any key to skip",
  "소환 갈래": "Summon Branches",
  무기: "Weapon",
  무기고: "Armory",
  "해금 완료": "Unlocked",
  "별빛 속에서 대기": "Waiting in starlight",
  "별빛 보관함": "Starlight Vault",
  "아직 만나지 못한 별지기를<br>관측하세요":
    "Observe a starkeeper<br>you haven't met yet",
  "별빛 소환": "Starlight Summon",
  "100 골드로 아직 만나지 못한 별지기 한 명을 확정으로 맞이합니다.":
    "For 100 gold, welcome one starkeeper you haven't met yet, guaranteed.",
  "소환 후보": "Summon Pool",
  "모든 별지기를 만났어요": "You've met every starkeeper",
  "별빛 소환 · ": "Starlight Summon · ",
  "골드 부족 · ": "Not enough gold · ",
  "골드 필요": " gold needed",
  전용: "Signature",
  일반: "Common",
  "별의 대장간에서<br>무기를 벼려 냅니다": "Forge a weapon<br>at the Starforge",
  "이미 보유한 무기 · ": "Already owned · ",
  "골드 환급": " gold refunded",
  " 전용 · ": " signature · ",
  "별의 대장간": "Starforge",
  "무기 소환": "Weapon Summon",
  " 골드로 별무기 한 자루를 벼립니다. 전용 무기는 낮은 확률(약 ":
    " gold forges one star-weapon. Signature weapons are mixed in at a low chance (about ",
  "%)로 섞여 나옵니다.": "%).",
  "보유 무기": "Weapons Owned",
  "보유 중": "Owned",
  "무기 소환 · ": "Weapon Summon · ",
  "골드를 돌려받았어요": " gold refunded",
  " · 전용 무기 획득!": " · Signature Weapon acquired!",
  " 획득!": " acquired!",
  "전용 발동 · ": "Signature active · ",
  "무기 없음": "No weapon",
  "탭해서 장착": "Tap to equip",
  "이 별지기 전용 · +70%": "Signature for this starkeeper · +70%",
  "아직 무기가 없어요. «무기» 탭에서 별무기를 뽑아 보세요.":
    "No weapons yet. Summon star-weapons from the «Weapon» tab.",
  "무기 해제": "Unequip",
  "별지기 무장": "Starkeeper Loadout",
  "별지기마다 무기를 끼워 정산 공격을 강화합니다. 전용 무기를 임자에게 끼우면 위력이 크게 오릅니다.":
    "Equip each starkeeper with a weapon to strengthen its settle attack. A signature weapon on its rightful owner boosts power sharply.",
  " 전용 발동!": " signature active!",
  " 장착": " equipped",
  "첫 관측자": "First Observer",
  "공허 거상": "Void Colossus",
  "앞선 관측을 마치면 열립니다.":
    "Opens once you finish the earlier observation.",
  "현재 출격 →": "Current Sortie →",
  "출격 →": "Sortie →",
  "스테이지 별자리 지도": "Stage Constellation Map",
  "튜토리얼 다시보기": "Replay Tutorial",
  "유성이 보스를 직격": "Meteor strikes the boss directly",
  "유성이 벽·쿠션에 튕김 (최대 2회)":
    "Meteor bounces off walls or cushions (up to 2x)",
  "파티 전원이 공명": "Entire party resonates",
  "흐린 발판을 지나감": "Passes over a dim platform",
  미보유: "Not owned",
  "관측 도서관": "Observation Library",
  "관측소가 확보한 별지기와, 별자리 배율이 움직이는 조건입니다.":
    "The starkeepers the observatory holds, and the conditions that move the constellation multiplier.",
  "별자리 배율 조건": "Constellation Multiplier Conditions",
  조건: "Condition",
  배율: "Multiplier",
  "배율은 한 발사 안에서만 쌓이고, 최대 ×9.9까지 오릅니다. 1.0 아래로는 내려가지 않습니다.":
    "The multiplier builds only within a single launch and rises up to ×9.9. It never drops below 1.0.",
  "게임 시작": "START",
  "별지기 편성": "STARKEEPERS",
  설정: "SETTINGS",
  "오늘의 밤하늘": "TODAY'S NIGHT SKY",
  "위기의 별자리에 도전하세요.": "Challenge the constellation in danger.",
  "현재 별지기": "CURRENT STARKEEPERS",
  시스템: "SYSTEM",
  언어: "LANGUAGE",
  "메뉴와 시스템 안내 언어를 바꿉니다.":
    "Changes the language of menus and system guidance.",
  오디오: "AUDIO",
  "전체 음량": "MASTER VOLUME",
  배경음: "BGM",
  효과음: "SFX",
  기본값으로: "RESET DEFAULTS",
  "첫 실행 상태로": "RESET TO FIRST RUN",
  "처음 켠 상태로 되돌릴까요?": "Reset to a fresh install?",
  "이 브라우저에 저장된 진행도·골드·해금·업적·출석이 모두 지워지고, 인트로와 온보딩 수업이 처음부터 다시 재생됩니다. 되돌릴 수 없습니다.":
    "Progress, gold, unlocks, achievements and attendance saved in this browser will all be erased, and the intro and onboarding lessons will play again from the start. This cannot be undone.",
  "지우고 다시 시작": "ERASE AND RESTART",
  "변경 사항은 이 브라우저에 자동 저장됩니다.":
    "Changes are saved automatically in this browser.",
  "관측 기록": "OBSERVATION RECORD",
  "최고 콤보": "BEST COMBO",
  "업적 도감": "ACHIEVEMENTS",
  "플레이 기록으로 해금되는 전투 이정표입니다.":
    "Combat milestones unlocked by your play record.",
  미해금: "LOCKED",
  "소리 켜기": "Sound on",
  "소리 끄기": "Sound off",
  "이 브라우저가 저장을 막고 있습니다 · 진행이 남지 않습니다":
    "This browser is blocking saves · progress will not be kept",
  "관측 보상": "Observation Reward",
  "이전 관측 보상": "Earlier Observation Reward",
  "스테이지 클리어": "Stage Clear",
  "업적 달성": "ACHIEVEMENT UNLOCKED",
  "업적 개 달성": "achievements unlocked",
  "보상 골드 · 업적 탭에서 수령": "reward gold · claim in the Achievements tab",
  "각 보상은 업적 탭에서 직접 수령":
    "Claim each reward yourself in the Achievements tab",
  "첫 별": "FIRST STAR",
  "보스를 한 번 처치하세요.": "Defeat a boss once.",
  "3연타": "TRIPLE HIT",
  "한 전투에서 3 HIT 콤보를 달성하세요.": "Reach a 3 HIT combo in one battle.",
  "한 발의 해답": "ONE SHOT",
  "유성 한 개만 사용해 클리어하세요.": "Clear using a single meteor.",
  "밤하늘의 단골": "NIGHT SKY REGULAR",
  "세 번의 전투를 클리어하세요.": "Clear three battles.",
  "유성이 별지기와 부딪히면 그 자리에 별빛이 남습니다. 조준에 고르지 않고 남겨 둔 별빛이 세 개 이상이면 별자리가 완성됩니다.":
    "When a meteor strikes a Starkeeper, starlight is left at that spot. Leave three or more starlights unpicked in your aim and a constellation is completed.",
  "지금 — <b>좌클릭</b>이나 <b>우클릭</b>으로 유성의 길을 한 번 꺾어요":
    "Now — <b>left-click</b> or <b>right-click</b> to bend the meteor's path once.",
  안내별: "Guide Star",
  "오리온 자리별": "Orion Star",
  "도우미 루나 · 유성을 끌어 앞의 별지기에게 부딪혀 보세요.":
    "Luna, your helper · Drag the meteor and strike the Starkeeper ahead.",
  "도우미 루나 · 별지기 위의 빛 세 곳을 골라 조준해 발사하세요.":
    "Luna, your helper · Pick three lights above the Starkeepers to aim, then fire.",
  "도우미 루나 · 거상 둘레의 별빛 일곱은 잠겨 있어요. 별지기 머리 위의 빛만 고르세요.":
    "Luna, your helper · The seven starlights around the Colossus are locked. Pick only the lights above the Starkeepers' heads.",
  "실전 · 별지기와 부딪혀 별빛을 만들고, 남긴 별빛으로 별자리를 완성하세요.":
    "Real battle · Strike Starkeepers to make starlight, and complete a constellation with what you leave behind.",
  "안녕하세요, 관측자님. 루나예요.": "Hello, Observer. I'm Luna.",
  "아래의 작은 빛이 유성이에요. 잡고 아래로 당겼다 놓으면 위로 날아가요. 이번엔 제가 앞의 별지기 쪽으로 겨눠 둘게요. 한번 부딪혀 볼까요?":
    "That little light below is a meteor. Grab it, pull down, and release — it flies upward. This time I'll aim it toward the Starkeeper ahead for you. Shall we give it a strike?",
  "유성 굴리기": "Roll the Meteor",
  "별지기가 깨어났어요!": "The Starkeeper awakened!",
  "다시 해볼까요?": "Shall we try again?",
  "유성이 부딪히자 별지기가 깨어났어요. 모두 멈추면 깨어난 별지기가 자기 공격을 한 번 씁니다. 그리고 부딪힌 자리에 작은 별빛이 남았죠 — 이게 다음에 쓸 재료예요.":
    "The meteor struck and the Starkeeper awakened. Once everything settles, the awakened Starkeeper makes one attack of its own. And a small starlight was left where it hit — that's your material for next time.",
  "괜찮아요. 아래로 길게 끌었다 놓으면 유성이 별지기에게 날아가 부딪혀요. 한 번 더 해볼까요?":
    "It's alright. Pull down far and release, and the meteor flies into the Starkeeper. Shall we try once more?",
  "다음 · 별빛으로 조준": "Next · Aim with Starlight",
  "괜찮아요, 다음으로": "It's fine, move on",
  "다시 시도": "Try Again",
  "별지기의 빛 세 곳을 눌러요.": "Tap three of the Starkeepers' lights.",
  "별지기마다 머리 위에 빛이 하나씩 켜져 있어요. 셋을 차례로 누르면 1·2·3 번호가 붙고 금빛 선이 생깁니다.":
    "Each Starkeeper has one light glowing above its head. Tap three in turn and they're numbered 1·2·3 with golden lines drawn between them.",
  "다음 · 유성 항로": "Next · Meteor's Path",
  "유성은 고른 셋의 한가운데로 가요.":
    "The meteor heads for the center of your three.",
  "유성은 고른 세 빛의 한가운데로 날아가요. 어디를 고르느냐가 곧 어디로 갈지예요.":
    "The meteor flies to the center of the three lights you pick. Where you pick is where it goes.",
  "다음 · 벌림": "Next · Spread",
  "멀리 벌릴수록 강해요.": "The wider you spread, the stronger.",
  "서로 멀리 떨어진 빛을 고를수록 세게 날아가요. 잘못 눌렀으면 같은 곳을 다시 누르면 됩니다. 셋을 고르고 Space나 오른쪽 «발사» 버튼을 눌러 보세요.":
    "The farther apart the lights you pick, the harder it flies. Picked wrong? Just tap the same spot again. Pick three and press Space or the «Fire» button on the right.",
  "조준해서 발사": "Aim and Fire",
  "조준해서 발사했어요!": "You aimed and fired!",
  "아직 셋을 못 골랐어요.": "You haven't picked three yet.",
  "길을 꺾었네요 — 날아가는 중에 좌·우클릭은 한 발에 한 번뿐이라, 어디서 쓸지가 곧 실력이에요. ":
    "You bent its path — in flight, a left- or right-click comes only once per shot, so where you use it is the whole skill. ",
  "날아가는 중에 좌클릭·우클릭으로 유성의 길을 한 번 꺾을 수 있어요. 한 발에 한 번뿐입니다. ":
    "While it flies, a left- or right-click can bend the meteor's path once. Only once per shot. ",
  "유성은 고른 세 빛의 한가운데로 날아갔고, 부딪힌 별지기는 깨어나 자기 공격을 썼어요. 그 자리엔 작은 별빛이 남았죠. 이제 남긴 별빛으로 별자리를 만들어 볼게요.":
    "The meteor flew to the center of the three lights, and the Starkeeper it hit awakened and used its own attack. A small starlight was left there. Now let's make a constellation from what you left behind.",
  "별지기 위의 빛 세 곳을 차례로 누른 뒤 Space로 발사해 보세요.":
    "Tap three lights above the Starkeepers in turn, then press Space to fire.",
  "다음 · 별자리": "Next · Constellation",
  "거상 둘레에 별빛 일곱을 놓아 뒀어요.":
    "I've placed seven starlights around the Colossus.",
  "이번엔 별자리를 바로 볼 수 있게, 거상 둘레에 별빛 일곱 개를 미리 놓아 뒀어요. 이 일곱은 지금 잠겨 있어서 눌러도 안 골라집니다 — 그냥 두면 돼요.":
    "So you can see a constellation right away, I've placed seven starlights around the Colossus in advance. These seven are locked for now — tapping won't pick them, so just leave them be.",
  "다음 · 별지기 빛": "Next · Starkeeper Lights",
  "별지기 머리 위 빛 셋만 고르세요.":
    "Pick only the three lights above the Starkeepers' heads.",
  "조준에는 별지기 머리 위의 빛 셋만 쓰세요. 놓아 둔 일곱은 잠겨 있으니 편하게 눌러 보셔도 됩니다.":
    "For aiming, use only the three lights above the Starkeepers' heads. The seven I placed are locked, so feel free to tap them.",
  "다음 · 완성": "Next · Completion",
  "쏘면 북두칠성이 완성돼요.": "Fire, and the Big Dipper is completed.",
  "발사하면 남은 일곱 개가 선으로 이어져 북두칠성이 돼요. 진짜 전투에서는 별지기에 부딪혀 이 작은 별빛을 직접 모읍니다.":
    "When you fire, the remaining seven link into the Big Dipper. In a real battle you gather these little starlights yourself by striking Starkeepers.",
  "안내별을 남기고 발사": "Leave the Guide Stars and Fire",
  "북두칠성이 완성됐어요!": "The Big Dipper is complete!",
  "별자리를 완성할 별빛이 부족했어요.":
    "There wasn't enough starlight to complete the constellation.",
  "남겨 둔 안내별 일곱이 국자 모양의 북두칠성으로 이어졌어요. 고른 빛은 유성의 방향을 정하고, 고르지 않은 작은 별빛은 별자리를 만듭니다. 북두칠성은 유성을 한 발 되찾아 줘요. 마지막으로 실전의 전체 순서를 확인할게요.":
    "The seven Guide Stars you left behind linked into the ladle-shaped Big Dipper. The lights you pick set the meteor's direction; the little starlights you don't pick form the constellation. The Big Dipper returns one meteor to you. Finally, let's go over the full order of a real battle.",
  "보스 주위의 안내별까지 조준에 골라 버리면 북두칠성을 만들 일곱 점이 부족해져요. 안내별은 누르지 말고, 별지기 위의 빛 세 곳만 골라 다시 발사해 보세요.":
    "If you pick the Guide Stars around the boss into your aim too, there aren't seven points left to make the Big Dipper. Don't tap the Guide Stars — pick only the three lights above the Starkeepers and fire again.",
  "다음 · 실전 순서": "Next · Battle Order",
  "순서 ①② 고르고 쏘기 → 부딪혀 깨우기":
    "Steps ①② Pick and fire → Strike to awaken",
  "① 빛 세 곳을 고르고 발사합니다. ② 별지기에 부딪히면 그 별지기가 깨어나고, 부딪힌 자리에 작은 별빛이 남아요.":
    "① Pick three lights and fire. ② When it hits a Starkeeper, that Starkeeper awakens and a small starlight is left where it struck.",
  "다음 · ③④": "Next · ③④",
  "순서 ③④ 깨어난 공격 → 별자리": "Steps ③④ Awakened attack → Constellation",
  "③ 다 멈추면 깨어난 별지기가 자기 공격을 씁니다. ④ 다음에 쏠 때 안 고른 별빛이 세 개 이상 남아 있으면, 유성이 떠나기 전에 그것들이 별자리가 되어 먼저 때려요.":
    "③ Once everything settles, the awakened Starkeepers make their own attacks. ④ On your next shot, if three or more unpicked starlights remain, they form a constellation and strike first, before the meteor leaves.",
  "다음 · 목표": "Next · Goal",
  "목표는 하나 — 거상을 눕히는 것.": "One goal — bring the Colossus down.",
  "위에 있는 거상의 체력을 0으로 만들면 이깁니다. 유성으로 직접 때리는 것보다 깨어난 별지기의 공격과 별자리가 훨씬 아파요. 거상 둘레의 밝은 알을 맞히면 더 크게 들어갑니다. 진짜 전투에서는 유성이 다섯 개뿐이라 한 발씩이 아깝지만, 이번 판은 개수 제한이 없으니 편하게 해 보세요.":
    "Reduce the Colossus above to 0 health and you win. Awakened Starkeeper attacks and constellations hurt far more than striking with the meteor directly. Hit the bright cores around the Colossus for even bigger damage. In a real battle you have only five meteors, so every shot counts — but this round has no limit, so take your time.",
  "거상을 눕히러 간다": "Go bring the Colossus down",
  "관측 수업 안내": "Observation lesson guide",
  "관측 수업 · 1-1": "Observation Lesson · 1-1",
  "루나 · 관측 보조": "Luna · Observation Aide",
  "관측 수업 완료": "Observation Lesson Complete",
  "첫 관측을 마쳤어요": "You've finished your first observation",
  "발사 · 각성 · 조준 · 별자리까지 익혔어요. 이제 실전 관측으로 나가 볼까요?":
    "You've learned firing, awakening, aiming, and constellations. Ready to head out to a real observation?",
  "다음 관측": "Next Observation",
  관측소로: "To the Observatory",
  "어느 밤부터, <b>별</b>이 하나씩 꺼졌다.":
    "From one night on, the <b>stars</b> went out one by one.",
  '이야기가 잊힐 때마다 별이 지고,<br>그 자리에 <b class="void">공허</b>가 고였다.':
    'Each time a story is forgotten, a star sets,<br>and the <b class="void">Void</b> pools in its place.',
  "땅에 떨어져 잠든 <b>별지기</b>를 깨우는 방법은<br>단 하나 — <b>부딪히는 것</b>.":
    "There is only one way to wake a <b>Starkeeper</b> fallen to earth and sleeping<br>— only one — to <b>strike it</b>.",
  "관측자여, 유성을 굴려라.<br><b>별자리</b>가 기억을 되찾을 것이다.":
    "Observer, roll the meteor.<br>The <b>constellations</b> will reclaim their memory.",
  "잊힌 별의 관측자 프롤로그": "Prologue: Observer of the Forgotten Stars",
  "클릭하여 계속": "Click to continue",
  "루나의 관측 수업": "Luna's Observation Lesson",
  "무기믹 전장 · 거상 HP ": "No-gimmick battle · Colossus HP ",
  "오늘의 밤하늘 관측 중": "Observing tonight's sky",
  "수령 ": "Claim ",
  "최단 기록": "Best Time",
  "타이틀 화면으로 나가기": "Exit to title screen",
  타이틀: "Title",
  "이전 별자리": "Previous constellation",
  "다음 별자리": "Next constellation",
  "별자리 스테이지 지도": "Constellation stage map",
  잠김: "Locked",
  완료: "Cleared",
  선택됨: "Selected",
  선택: "Select",
  "별지기는 관측 시작 후 고릅니다":
    "Choose your Starkeepers after the observation begins",
  "무한<br>훈련장": "Endless<br>Training",
  "수업 다시 보기": "Replay Lesson",
  "게임 시작!": "Start Game!",
  "관측소 메뉴": "Observatory menu",
  프로필: "Profile",
  소환: "Summon",
  상점: "Shop",
  "타이틀 화면으로 나갈까요?": "Exit to the title screen?",
  "진행한 기록은 저장되어 있습니다. 타이틀에서 다시 이어서 관측할 수 있습니다.":
    "Your progress is saved. You can resume observing from the title anytime.",
  "타이틀로 나가기": "Exit to Title",
  "무한 훈련장 · 유성은 자동 보충됩니다. 충돌과 별자리 배율을 마음껏 시험하세요. R 키로 나가기.":
    "Endless Training · Meteors refill automatically. Test collisions and constellation multipliers to your heart's content. Press R to leave.",
  "1-1 · 유성을 끌어 발사하고, 별빛 세 곳을 골라 Space로 쏜 뒤, 남긴 별빛으로 별자리를 완성하세요.":
    "1-1 · Drag a meteor to fire, pick three starlights and shoot with Space, then complete a constellation with what you leave behind.",
  " · 별빛 세 곳을 골라 Space로 쏘고, 남긴 별빛으로 별자리를 완성하세요.":
    " · Pick three starlights and shoot with Space, then complete a constellation with what you leave behind.",
  "다음 유성을 준비하세요. 공명 접점과 남은 배치에서 항로를 다시 설계하세요.":
    "Ready your next meteor. Redesign your path from the resonance contacts and the formation that remains.",
  "별자리 완성": "Constellation Complete",
  "관측 보상함에 적립": "Added to your observation reward box",
  " 골드": " Gold",
  "업적 탭에서 수령하세요": "Claim it in the Achievements tab",
  " 클리어 보상": " clear reward",
  "별 해방": "Star Freed",
  "별이 하늘로 돌아갔습니다.": "The star has returned to the sky.",
  "밤하늘에 별이 하나 켜졌습니다 — 오늘의 별자리: ":
    "A star has lit in the night sky — today's constellation: ",
  "1-1 · 유성을 아래로 끌어 미리내에게 부딪혀 보세요.":
    "1-1 · Drag a meteor downward and crash it into Mirinae.",
  " · 첫 공명이 안내별 둘을 밝혀 별자리를 돕습니다.":
    " · The first resonance lights two guide stars to aid the constellation.",
  " · 별빛 세 곳을 고르고 Space로 발사하세요. 남겨 둔 작은 별빛이 별자리가 됩니다.":
    " · Pick three starlights and press Space to fire. The small starlight you leave behind becomes a constellation.",
  "훈련 시작 · ": "Training begins · ",
  "1-1 · 첫 관측 시작": "1-1 · First observation begins",
  "관측 잔광 · 별지기와 부딪혀 안내별을 밝히세요":
    "Observation afterglow · Crash into Starkeepers to light the guide stars",
  "이(가) 관측을 시작한다": " begins the observation",
  "STELLA BALL 시작 화면": "STELLA BALL start screen",
  " 관측 항로": " observation route",
  "관측 시작": "Begin Observation",
  "처음인가요? <b>1분 튜토리얼</b>": "First time? <b>1-minute tutorial</b>",
  "인트로 다시 보기": "Replay intro",
  "별지기 ": "Station ",
  "명을 자리에 세우세요": " Starkeepers in their seats",
  "명을 자리에 세우세요</h2><p>아래 별지기를 자리로 끌어 놓으세요. 위쪽 자리는 거상과 가깝고, 아래쪽 자리는 멉니다.":
    " Starkeepers in their seats</h2><p>Drag the Starkeepers below onto the seats. Upper seats are close to the Colossus, lower seats are far away.",
  "전장 배치": "Battlefield deployment",
  보스: "Boss",
  발사석: "Launch stone",
  "보유 별지기": "Starkeepers owned",
  시작: "Start",
  " · 자리에서 뺐습니다": " · Removed from seat",
  "번 자리 · ": " · Seat ",
  "대기 중<i>자리로 끌어 놓으세요</i>": "Standby<i>Drag onto a seat</i>",
  "비어 있음": "Empty",
  " · 더블클릭하면 뺍니다": " · Double-click to remove",
  "더블클릭하면 자리에서 뺍니다": "Double-click to remove from seat",
  " · 대기": " · Standby",
  "명을 모두 자리에 세워주세요.": " Starkeepers must all be seated.",
  "다른 별빛 조합으로 첫 충돌 경로를 바꿔보세요.":
    "Try a different starlight combination to change your first collision path.",
  "약점 명중이 없었습니다. 거상 둘레의 밝은 핵을 먼저 노리세요.":
    "No weak-point hits. Aim first at the bright core around the Colossus.",
  "도는 방벽에 ": "Blocked by the spinning barrier ",
  "회 막혔습니다. 잔상이 비운 틈으로 발사하세요.":
    " times. Fire through the gap the afterimage leaves open.",
  "평균 조준 위력 ": "Average aim power ",
  "%였습니다. 서로 멀리 떨어진 별빛을 골라보세요.":
    "%. Pick starlights spaced far apart from each other.",
  "반사벽에 ": "Grazed the reflecting wall ",
  "회 닿았습니다. 점선 반사 경로를 이용해 약점 각도를 만드세요.":
    " times. Use the dotted reflection path to line up a weak-point angle.",
  "약점 명중 ": "Weak-point hits: ",
  "회. 남은 별빛을 감싸는 조합으로 별자리 피해를 더하세요.":
    ". Wrap the remaining starlight in your combination to add constellation damage.",
  "전투 메달": "Battle medal",
  클리어: "Clear",
  "사용 유성": "Meteors used",
  "처치 피해": "Kill damage",
  "관측 종료": "Observation ended",
  "다시, 그 점을 마주 보았습니다.": "Once again, you faced that point.",
  "관측되지 않은 점을 관측했습니다.": "You observed the unobserved point.",
  "개의 별자리가 제자리로 돌아갔습니다.":
    " constellations have returned to their places.",
  "성도 밖에서 이쪽을 보고 있던 것은, 이제 성도 안에 기록되었습니다.":
    "What had been watching this way from beyond the star chart is now recorded within it.",
  "이름은 끝내 알 수 없었습니다. 좌표만 남깁니다 — <b>∅</b>":
    "Its name was never learned. Only coordinates remain — <b>∅</b>",
  "마지막 관측": "Final observation",
  "관측소로 돌아가기": "Return to the Observatory",
  "다른 별지기와 다른 궤적으로 다시 관측하세요.":
    "Observe again with different Starkeepers and a different trajectory.",
  "관측 실패": "Observation failed",
  "별빛이 흩어졌다 — ": "The starlight scattered — ",
  "가한 피해": "Damage dealt",
  "다시 관측": "Observe again",
  타이틀로: "To title",
  "별이 하늘로 돌아갑니다.": "The star returns to the sky.",
  "골드 보상 ": "Gold reward ",
  "클리어 보상": "Clear reward",
  "관측 성공": "Observation successful",
  " · 별빛을 회수했습니다": " · Starlight reclaimed",
  "남은 유성": "Meteors remaining",
  "관측 시간": "Observation time",
  "최대 피해": "Max damage",
  "다시 보기": "Replay",
  "공허 잔재 처치!": "Void remnant destroyed!",
  " · 전 적 광역 피해": " · Area damage to all enemies",
  "체력 ∞": "HP ∞",
  "체력 ": "HP ",
  "체력 —": "HP —",
  "관측 결과를 확인하세요": "Check the observation results",
  "별자리가 끝나면 각성한 별지기가 고유 공격을 사용합니다":
    "When the constellation completes, the Awakened Starkeepers unleash their signature attacks",
  "별지기와 부딪히면 공명하고 각성을 준비하며 별빛이 남습니다":
    "Crashing into Starkeepers resonates them, builds Awakening, and leaves starlight behind",
  "유성을 끌어 발사 방향을 정하세요":
    "Drag the meteor to set the launch direction",
  "별빛 ": "Starlight ",
  " · 서로 멀리 고를수록 강해집니다":
    " · The farther apart your picks, the stronger it grows",
  강함: "Strong",
  보통: "Normal",
  약함: "Weak",
  " · Space로 발사": " · Space to fire",
  "전투를 준비합니다": "Preparing for battle",
  "∞ · 관측 유성": "∞ · Observation meteors",
  "관측 유성 · 무제한": "Observation meteors · Unlimited",
  "사용 가능": "Available",
  "사용 완료": "Used",
  "훈련 · ": "Training · ",
  "관측 수업 · ": "Observation lesson · ",
  "전투 · ": "Battle · ",
  "전투 준비": "Battle ready",
  일시정지: "Pause",
  "관측을 잠시 멈췄습니다": "Observation paused for a moment",
  "전장은 그대로 남아 있습니다. 준비되면 이어서 관측하세요.":
    "The battlefield remains as it was. Resume observing when you're ready.",
  계속하기: "Continue",
  "관측소로 나가기": "Exit to the Observatory",
  "ESC 키로도 열고 닫을 수 있습니다":
    "You can also open and close this with the ESC key",
  "앞은 내가 연다.": "I'll open the way ahead.",
  "베어 낼 자리가 보여.": "I can see where to cut.",
  "가까울수록 잘 든다.": "The closer I get, the sharper I cut.",
  "아직 서 있어.": "It's still standing.",
  "한 번 더 온다.": "Here comes another.",
  "끊었다!": "Severed!",
  "결이 갈라졌어.": "The grain split open.",
  "거리, 좋아.": "Good distance.",
  "멀수록 잘 보여.": "The farther out, the clearer I see.",
  "숨 참고 — 지금.": "Hold your breath — now.",
  "각도 재는 중.": "Measuring the angle.",
  "조금만 더 벌려.": "Spread it a little wider.",
  "관통.": "Pierced through.",
  "가운데 맞았어.": "Right through the center.",
  "둘로 갈게.": "I'll split in two.",
  "혼자보다 둘이 낫지.": "Two beats one.",
  "나눠서 덮자.": "Let's split and cover it.",
  "반쪽이 아직 남았어.": "The other half's still left.",
  "다시 붙을 시간.": "Time to rejoin.",
  "양쪽 다 들어갔어!": "Both sides landed!",
  "두 번 셌지?": "Counted twice, right?",
  "중계 잡았어.": "Relay locked.",
  "여기서 이어 줄게.": "I'll link it from here.",
  "길을 만들어 둘게.": "I'll lay out a path.",
  "선이 끊겼어.": "The line broke.",
  "다시 이어 볼게.": "I'll reconnect it.",
  "연결 성공!": "Connection made!",
  "그대로 흘러가.": "Let it flow through.",
  "바람 탄다.": "Riding the wind.",
  "빠른 게 제일이야.": "Fast is best.",
  "따라올 수 있겠어?": "Think you can keep up?",
  "아직 안 멈췄어.": "Not stopped yet.",
  "속도가 죽었네.": "Speed's gone flat.",
  "스쳤는데 깊지?": "Just a graze — but deep, right?",
  "칼날 지나갔다.": "The blade passed through.",
  "방향을 바꾸자.": "Let's change direction.",
  "여기서 틀면 돼.": "Turn it right here.",
  "판이 달라 보이지.": "The board looks different now, doesn't it?",
  "다시 읽어 볼게.": "Let me read it again.",
  "각을 바꿔야 해.": "We need to change the angle.",
  "돌려세웠어.": "Turned it around.",
  "흐름이 넘어왔다.": "The tide's come over to us.",
  "부딪히면 내 몫이지.": "If it comes to a clash, that's my part.",
  "단단한 건 자신 있어.": "I'm good with the hard stuff.",
  "정면으로 가.": "Straight ahead.",
  "아직 버텨.": "Still holding.",
  "한 번 더 박아 보자.": "Let's ram it once more.",
  "울렸다!": "It rang out!",
  "금 갔어, 봤지?": "Cracked it, see?",
  "마지막은 내가 볼게.": "I'll watch the last one.",
  "조용히 따라갈게.": "I'll follow quietly.",
  "본 대로 따라 한다.": "I mirror what I see.",
  "기억해 뒀어.": "I've kept it in mind.",
  "아직 안 끝났어.": "It's not over yet.",
  "똑같이 돌려줬어.": "Gave it back in kind.",
  "그대로 베꼈지.": "Copied it exactly.",
  "뿔을 세운다. 지나갈 자리는 없다.": "The horns rise. There is no way past.",
  "뿔이 하나 부러졌다 — 그래서?": "One horn broke — and so?",
  "문은 아직 닫혀 있다.": "The gate is still shut.",
  "겨눈 것은 이쪽이다.": "It is you who are in my sights.",
  "시위가 한 번 울었다.": "The bowstring sang once.",
  "화살은 아직 손에 있다.": "The arrow is still in hand.",
  "떼가 먼저 본다.": "The flock sees first.",
  "한 마리가 떨어졌을 뿐이다.": "Only one has fallen.",
  "그래도 하늘은 검다.": "Still the sky is black.",
  "왕좌는 기울어도 왕좌다.": "A tilted throne is a throne still.",
  "금이 가도 왕좌는 무너지지 않는다.": "Cracked, the throne does not fall.",
  "앉은 자리는 바뀌지 않는다.": "The seat does not change.",
  "물결은 되돌아온다.": "The waves always return.",
  "여울이 한 번 뒤집혔다.": "The shallows turned over once.",
  "흐름은 멈추지 않는다.": "The current does not stop.",
  "사냥은 이미 시작됐다.": "The hunt has already begun.",
  "띠가 한 칸 어긋났다.": "The belt slipped one notch.",
  "잔영은 사라지지 않는다.": "The afterimage does not fade.",
  "국자를 끌어 내린 것이 나다.": "It was I who dragged the dipper down.",
  "포효 — 자리를 지워 주마.": "A roar — I'll erase your place.",
  "북쪽은 여전히 내 것이다.": "The north is still mine.",
  "관측되지 않은 것이 관측한다.": "The unobserved observes.",
  "너희가 세는 것을 나는 세지 않는다.": "What you count, I do not.",
  "여기서부터는 이름이 없다.": "From here on, there are no names.",
  "별지기든 별빛이든 — 셋을 찍어 봐.":
    "Starkeeper or starlight — tap three of them.",
  "하나 더! 셋이 모여야 방향이 생겨.":
    "One more! It takes three to make a direction.",
  "반대편이야! 빈 곳을 다시 누르면 돌아와.":
    "Wrong side! Tap the empty space again to come back.",
  "넓게 벌렸네 — 세게 나간다!": "Spread it wide — this one flies hard!",
  "판이 되받아쳤다.": "The board struck back.",
  "벽을 타고 각이 바뀐다.": "Off the wall, the angle shifts.",
  "부딪힌 만큼 빨라졌다.": "Faster for every impact.",
  "여섯 점이 이어졌다 — 하늘이 밝다.": "Six points joined — the sky is bright.",
  "선이 닫혔다.": "The line has closed.",
  "별자리가 판을 덮는다.": "The constellation spreads across the board.",
  "그린 대로 내려온다.": "It descends just as drawn.",
  "마지막 하나야. 넓게 벌려 봐.": "This is the last one. Spread it wide.",
  "한 발 남았어 — 가운데로 모으지 마.":
    "One shot left — don't bunch it in the middle.",
  "여기서 끝내자.": "Let's end it here.",
  "판이 서 있어. 정면이 막히면 튕겨서 돌아가게 해 봐.":
    "Walls are up. If the way ahead is blocked, bounce it back around.",
  "저 발판을 밟고 가면 빨라져 — 좁게 겨눠도 세게 나가.":
    "Cross that pad and you'll speed up — even a narrow aim flies hard.",
  "흐린 자리는 별자리 배율을 깎아. 빠른 길이 꼭 싼 길은 아니야.":
    "The dim patches cut your constellation multiplier. The fast path isn't always the cheap one.",
  "잔재가 길을 막고 있어. 먼저 치울지, 지나칠지는 네 선택이야.":
    "Debris is blocking the path. Clear it first or slip past — your call.",
  "방벽이 돌고 있어 — 틈이 열리는 때를 세어 봐.":
    "The barriers are spinning — count for the moment a gap opens.",
  "껍질이 몇 겹 있어. 처음 몇 대는 껍질이 먹을 거야.":
    "There are a few layers of shell. The first few hits will just feed the shell.",
  "체력이 내려가면 거상이 판을 흔들어. 자리를 미리 믿지 마.":
    "As its health drops, the Colossus shakes the board. Don't trust your positions in advance.",
  "이 버텼습니다. 다른 별빛 조합으로 항로를 바꿔보세요. 서로 멀리 떨어진 별빛을 고를수록 세게 나갑니다.":
    " held on. Try a different starlight combination to change your route. The farther apart the starlights you pick, the harder your shot flies.",
  "다음 샷 · 멈춘 자리에서 이어 갑니다. 별빛을 세 곳 이상 고르고 Space로 발사하세요.":
    "Next shot · resuming from where it stopped. Pick three or more starlights and press Space to fire.",
  "다음 샷 · 현재 위치에서 재개": "Next shot · resuming from current position",
  "훈련 유성 자동 보충": "Training meteor auto-refilled",
  "첫 직격": "First Strike",
  "치명 약점": "Critical Weakpoint",
  약점: "Weakpoint",
  직격: "Direct Hit",
  몸체: "Body",
  "미리내 표식 폭발": "Mirinae Mark Burst",
  피해: "damage",
  "공명 가속": "Resonance Boost",
  "공명 범퍼 · 속도 상승": "Resonance Bumper · speed up",
  "좌측 궤도 전환": "Left Course Change",
  "우측 궤도 전환": "Right Course Change",
  "좌측으로 유성 전환": "Meteor turned left",
  "우측으로 유성 전환": "Meteor turned right",
  "별지기·별빛을 셋 이상 찍고 Space로 발사하세요":
    "Pick three or more Starkeepers and starlights, then press Space to fire",
  반대편: "Opposite Side",
  "가운데 쪽": "Center Side",
  "루나의 설명을 읽고 아래 버튼을 눌러 주세요.":
    "Read Luna's explanation, then press the button below.",
  "유성을 끌어서 놓아 주세요 — 누르기만으로는 나가지 않아요.":
    "Drag and release the meteor — a simple tap won't launch it.",
  "유성을 더 멀리 끌어 당겨보세요.": "Pull the meteor back a little farther.",
  "겨눔 ": "Aim ",
  "도, 세기 ": " degrees, power ",
  퍼센트: " percent",
  "유성 발사 · 키보드 조준": "Meteor launched · keyboard aim",
  "키보드로도 조준할 수 있습니다. 좌우 화살표로 별빛 사이를 옮기고, Enter로 고르거나 취소하고, F로 반대편을 고르고, Backspace로 전부 취소하고, Space로 발사합니다.":
    "You can also aim with the keyboard. Use the left and right arrows to move between starlights, Enter to pick or unpick, F to choose the opposite side, Backspace to clear all, and Space to fire.",
  별빛: "Starlight",
  "번으로 고름": " picked",
  "안 고름": "not picked",
  "고른 별빛 ": "Starlights picked ",
  "위력 ": "Power ",
  "겨눔을 처음으로": "Aim reset to start",
  " · 밝게 빛나는 곳을 세 군데 이상 고르세요":
    " · pick three or more of the brightly glowing spots",
  "이 조합으로는 조준할 수 없습니다 · 다른 별빛을 골라보세요":
    "You can't aim with this combination · try picking different starlights",
  "별빛 조준 · 위력 ": "Starlight aim · power ",
  쿠션: "Cushion",
  "별빛 없음 · 별지기 셋을 찍어 조준하세요":
    "No starlights · pick three Starkeepers to aim",
  " · 별지기와 합쳐 셋 이상 조준 · 안 찍은 별빛은 별자리로":
    " · combine with Starkeepers to aim three or more · unpicked starlights become a constellation",
  "유성 발사! 별지기 충돌은 직접 보스 공격과 가속을 함께 만듭니다.":
    "Meteor launched! Colliding with Starkeepers both strikes the Colossus directly and builds speed.",
  "항로 보정 · 연쇄 진입": "Course corrected · entering chain",
  "유성 발사 · 위력 ": "Meteor launched · power ",
  "별자리 배율 대기": "Awaiting constellation multiplier",
  "별지기 공명 ": "Starkeeper Resonance ",
  "전원 공명 +3.0": "Full-party Resonance +3.0",
  "유성 보스 직격 +1.0": "Meteor Colossus Direct Hit +1.0",
  "벽 반사 +0.2": "Wall Bounce +0.2",
  "별이 하늘로 돌아갑니다": "The star returns to the sky",
  "샛별 근접 베기": "Saetbyeol Close Slash",
  "미리내 거리 저격": "Mirinae Long-range Shot",
  "모루 충돌 충격파": "Moru Impact Shockwave",
  " 각성": " Awakening",
  " 충돌": " hits",
  " · 충격파 폭발": " · shockwave burst",
  "유성 분열!": "Meteor Split!",
  " · 두 번째 유성 생성": " · second meteor created",
  "의 분열체도 별지기를 굴리고 고유 능력을 발동합니다.":
    "'s split meteor also rolls Starkeepers and triggers their unique abilities.",
  "에게 강제 중계": " · forced relay to ",
  " · 가장 가까운 ": " · to the nearest ",
  "에게 유성을 재발사합니다.": " · relaunching the meteor toward ",
  "질풍 칼날!": "Gale Blades!",
  " · 이동 속도로 회전 칼날 강화":
    " · spin blades powered up by movement speed",
  " 회전 칼날": " Spinning Blades",
  " 질풍 칼날 ": " Gale Blades ",
  "회전 베기": "Spin Slash",
  "별하 · 분열체 추가 분열!": "Byeolha · split meteor splits again!",
  "살별 · 분열체 강제 중계!": "Salbyeol · split meteor forced relay!",
  " 분열체 연계": " Split Meteor Combo",
  "분열 약점": "Split Weakpoint",
  분열체: "Split Meteor",
  "분열 연계!": "Split Combo!",
  "분열체 직격": "Split Meteor Direct Hit",
  " 아직 잠듦 ": " still asleep ",
  공명했다: "Resonated",
  깨어났다: "Awakened",
  " 공명 깨어남": " Resonance Awakening",
  " 깨어남!": " Awakening!",
  "가속!": "Speed up!",
  "운동량 상승!": "Momentum up!",
  "가속 발판 · 유성 운동량 상승": "Boost pad · Meteor momentum up",
  "껍질이 막았다": "The shell blocked it",
  "굳은 껍질 · 남은 ": "Hardened shell · ",
  겹: " layers left",
  "껍질이 모두 깨졌습니다": "The shell is fully shattered",
  "거상의 포효 · 모두 모서리로 밀려납니다":
    "Colossus's roar · everyone is thrown to the corners",
  "별지기가 다시 잠들었습니다 · ":
    "The Starkeepers have fallen asleep again · ",
  "회 충돌 필요": " collisions needed",
  "흐린 발판 통과": "Passed through a fading pad",
  "방벽 -": "Barrier -",
  "도는 방벽 하나를 부쉈습니다": "Shattered one circling barrier",
  "방벽 재점화": "Barrier reignited",
  "도는 방벽이 최대 내구도로 돌아왔습니다":
    "The circling barrier is back to full durability",
  "그믐 · ": "Geumeum · ",
  " 근접 베기": " close slash",
  " 거리 저격": " ranged snipe",
  " 충격파": " shockwave",
  "모사 대상 없음": "No copy target",
  "그믐 · 아직 모사한 아군이 없습니다.":
    "Geumeum · No ally has been copied yet.",
  " 각성! 멈춘 자리에서 보스 공격을 시작합니다.":
    " awaken! The attack on the boss begins from where they stopped.",
  "의 이동 공격이 끝났습니다. 정산 공격은 없습니다.":
    "'s moving attack has ended. There is no settle attack.",
  "명 각성 · 다음 샷은 현재 배치에서":
    " awakened · Next shot from the current formation",
  "질풍 칼날 종료 · 정산 공격 없음": "Gale blades ended · No settle attack",
  "아무 별지기도 깨우지 못했습니다. 다음 샷은 현재 위치에서 다시 설계하세요.":
    "No Starkeeper was awakened. Plan the next shot again from the current position.",
  "별지기 미각성 · 다음 샷 준비":
    "No Starkeeper awakened · Preparing next shot",
  "공명 충돌!": "Resonance impact!",
  " 충돌 · 유성과 별지기 동시 가속!":
    " impact · Meteor and Starkeeper accelerate together!",
  " 굴림": " roll",
  "별지기 이동선까지 예측": "Prediction reaches the Starkeeper's path",
  "궤도 전환 완료": "Orbit shift complete",
  "반사 벽": "Bounce wall",
  "가속 발판": "Boost pad",
  "흐린 발판": "Fading pad",
  "공허 잔재": "Void remnant",
  "도는 방벽": "Circling barrier",
  "굳은 껍질": "Hardened shell",
  재수면: "Resleep",
  포효: "Roar",
  "남은 ✦ ": "Remaining ✦ ",
  " → 별자리": " → Constellation",
  " 빈 곳 클릭 = 반대편": " Click empty space = opposite side",
  "↷ 빈 곳 클릭 = 반대편": "↷ Click empty space = opposite side",
  "반대편 · ": "Opposite · ",
  "별지기 위 별빛 · 조준 전용": "Starlight above a Starkeeper · Aim only",
  "작은 별빛 · 남기면 별자리 완성":
    "Small starlight · Leave it to complete a Constellation",
  "별지기 위 빛 — 조준에만 사용": "Light above a Starkeeper — for aiming only",
  "작은 별빛 — 남기면 별자리": "Small starlight — leave it for a Constellation",
  "SPACE 발사   ·   우클릭 / Backspace 선택 취소":
    "SPACE to fire   ·   Right-click / Backspace to cancel selection",
  "   ·   밝게 빛나는 곳을 고르세요":
    "   ·   Choose the brightly shining spots",
  "연타!": "Combo!",
  "공명!": "Resonance!",
  " · 각성": " · Awakening",
  별자리: "Constellation",
  "체 타격": "targets hit",
  "피해 없음": "No damage",
  "까마귀의 표식 · 이번 샷의 약점 명중이 강해집니다":
    "Corvus's Mark · this shot's weak-point hits strike harder",
  "백조의 비행 · 이번 샷은 유성이 오래 굽니다":
    "Cygnus's Flight · this shot's meteor coasts longer",
  "북두의 길잡이 · 이번 샷은 항로가 끝까지 보입니다":
    "The Dipper's Guide · this shot's course stays visible to the very end",
  "관통 -": "Pierce -",
  관통: "Pierce",
  "체 관통": "pierced",
  "화살은 빗나감": "The arrow missed",
  까마귀: "Corvus",
  "체 타격 · 다음 샷 표식": "targets hit · next shot marked",
  "다음 샷 표식": "Next shot marked",
  "껍질 ": "Shell ",
  "겹 파괴": " layers shattered",
  "깨뜨릴 껍질 없음": "No shell to break",
  백조: "Cygnus",
  "체 타격 · 다음 샷 비행": "targets hit · next shot glides",
  "다음 샷 비행": "Next shot glides",
  오망성: "Pentagram",
  "명 각성": " awakened",
  "체 타격 · 전원 이미 각성": "targets hit · all already awakened",
  "전원 이미 각성": "All already awakened",
  오리온: "Orion",
  "사냥할 표적 없음": "No prey to hunt",
  "삼연격 -": "Triple Strike -",
  "체 타격 · 되돌릴 발사 없음": "targets hit · no launch to reclaim",
  "되돌릴 발사 없음": "No launch to reclaim",
  "유성 +1": "Meteor +1",
  "유성 +1 · 다음 샷 항로": "Meteor +1 · next shot charted",
  "별자리 선 · ": "Constellation line · ",
  "루나의 별 · ": "Luna's Star · ",
  "안내별 넷을 얹었어요. 오망성 항로가 완성됩니다.":
    "I've set down four guide stars. The Pentagram's course is complete.",
  "첫 공명에 별을 둘 얹어 뒀어요. 궤적을 이어 보세요.":
    "On your first resonance I've placed two stars. Trace the line between them.",
  "루나의 안내별 넷 · 오망성 항로 완성":
    "Luna's four guide stars · Pentagram course complete",
  "관측 잔광 · 안내별 둘이 첫 별자리를 돕습니다":
    "Observation afterglow · two guide stars aid your first constellation",
  "공명 놓침": "Resonance missed",
  "공명 놓침 · 다시 이어 보세요": "Resonance missed · trace it again",
  "공명이 끊겼습니다 · 모은 별빛이 흩어졌습니다":
    "The resonance broke · the starlight you gathered has scattered",
  "공명 비움 · 다음 접점을 기다리세요":
    "Resonance whiffed · wait for the next contact",
  "충격 반동!": "Shockwave recoil!",
  " 지원 -": " support -",
  " 지원 명중 ": " support hit ",
  "연타 · ": "Chain · ",
  "연타! 연속 명중 ": "Chain! Consecutive hits ",
  회: " in a row",
  "비행 중 · 궤도 전환": "In flight · Redirect Orbit",
  "진행 방향 왼쪽으로": "Bank left of travel",
  "진행 방향 오른쪽으로": "Bank right of travel",
  "별빛 조준 ": "Starlight aim ",
  "별빛 고르기 · 빈 곳은 반대편": "Pick starlight · empty space flips the side",
  "전부 무르기": "Undo all",
  발사: "Fire",
  개부터: " starlight",
  "끌어서 발사": "Drag to fire",
  "끌어 조준·세기 · 놓으면 발사": "Drag to aim & set power · release to fire",
  "궤도 전환 가능": "Redirect ready",
  "궤도 전환 사용함": "Redirect spent",
  "반대편으로 · 넓게 벌릴수록 세게":
    "To the far side · wider spread hits harder",
  "넓게 벌릴수록 세게": "Wider spread hits harder",
  "별빛을 ": "Pick at least ",
  "개 이상 고르세요": " starlight",
  "놓으면 발사": "Release to fire",
  "유성을 아래로 끌어 보세요": "Try dragging the meteor downward",
  "공허 잔재 재생성": "Void Remnant respawns",
  " 깨어남": " Awakes",
  "인 일제 사격": "-Starkeeper volley",
  "판정: 긴 프레임 없음 - 더 플레이해 주세요":
    "Verdict: no long frames - please keep playing",
  "판정: 긴프레임 ": "Verdict: long frames ",
  "만 JS 탓 -> 합성기 문제": " are on JS -> compositor problem",
  "가 JS 탓 -> ": " are on JS -> ",
  "WebGL 없음": "No WebGL",
  "확인 실패": "Check failed",
  "[!] 소프트웨어 렌더링 - 그래픽 가속 꺼짐 ":
    "[!] Software rendering - graphics acceleration off ",
  "[F10 기록]  F7 하늘  F8 흐림  F6 화면반응":
    "[F10 log]  F7 Sky  F8 Blur  F6 Screen react",
  돌아가기: "Go back",
  "아직 만나지 못한 별지기를": "Observe the Starkeepers you",
  관측하세요: "have yet to meet",
  "별의 대장간에서": "At the Starforge, weapons",
  "무기를 벼려 냅니다": "are forged",
  "80 골드로 별무기 한 자루를 벼립니다. 전용 무기는 낮은 확률(약 12%)로 섞여 나옵니다.":
    "Forge one starweapon for 80 gold. Signature weapons are mixed in at a low chance (about 12%).",
  "처음인가요?": "First time?",
  "1분 튜토리얼": "1-Minute Tutorial",
  "전략 당구 × 파티 조합 / 수직 슬라이스":
    "Strategic Billiards × Party Comp / Vertical Slice",
  메인: "Main",
  조작: "Controls",
  좌클릭: "Left-click",
  "끌어 조준·세기": "Drag: aim & power",
  우클릭: "Right-click",
  "약점 위력": "Weak-point Power",
  "별빛 연계": "Starlight Chain",
  운동량: "Momentum",
  "별빛 선택": "Select Starlight",
  공명: "Resonance",
  "각성 공격": "Awaken Attack",
  "밤의 관측자": "Night Observer",
  루나: "Luna",
  "발사 세기": "Fire Power",
  "유성을 끌어 보세요": "Try dragging the meteor",
  "별지기 3명을 자리에 세우세요": "Place 3 Starkeepers in their seats",
  "아래 별지기를 자리로 끌어 놓으세요. 위쪽 자리는 거상과 가깝고, 아래쪽 자리는 멉니다.":
    "Drag the Starkeepers below into their seats. Upper seats begin near the Colossus; lower seats, far.",
};

/* 값-혼합·조각 노드용 부분 치환(순서대로, 긴 것 먼저). */
const I18N_FRAG = [
  [
    "유성을 굴려 별빛을 만들고, 빛나는 곳을 세 군데 골라 조준하세요.",
    "Roll the meteor to make starlight, then aim at three glowing spots.",
  ],
  [
    "고르지 않고 남겨 둔 별빛이 별자리가 됩니다.",
    "Starlight left unpicked becomes a constellation.",
  ],
  ["루나의 관측 수업", "Luna's Observation Lesson"],
  ["불멸의 허수아비", "Immortal Scarecrow"],
  ["훈련 시작", "Start Training"],
  ["관측 항로", "Observation Route"],
  ["보유 골드", "Gold Held"],
  ["보유 무기", "Weapons Owned"],
  ["골드 부족", "Not enough gold"],
  ["관측 잔광", "Guide Star"],
  ["반사 벽", "Bounce Wall"],
  ["훈련장", "Training Ground"],
  ["1번 자리", "Seat 1"],
  ["2번 자리", "Seat 2"],
  ["3번 자리", "Seat 3"],
  ["3명", "3"],
  ["골드 필요", "gold needed"],
  ["보상", "Reward"],
  ["무한", "Endless"],
  ["훈련", "Training"],
  ["골드", "Gold"],
];

function i18nActive() {
  return (
    typeof settings !== "undefined" && settings && settings.language === "en"
  );
}

function i18nApplyFragments(s) {
  let out = s;
  for (const [ko, en] of I18N_FRAG) {
    if (out.indexOf(ko) !== -1) out = out.split(ko).join(en);
  }
  return out;
}

/* 텍스트 노드 지역화. 전체 정확 일치 우선, 남은 한글은 조각 치환. 앞뒤 공백
   보존. aria-label/placeholder/title도 같은 규칙. */
function i18nLocalize(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  for (const t of nodes) {
    const rawv = t.nodeValue;
    const key = rawv.trim();
    if (!key || !/[가-힣]/.test(key)) continue;
    const en = I18N_EN[key];
    if (en != null && en !== key) {
      t.nodeValue = rawv.replace(key, en);
      continue;
    }
    const frag = i18nApplyFragments(key);
    if (frag !== key) t.nodeValue = rawv.replace(key, frag);
  }
  if (root.querySelectorAll) {
    for (const el of root.querySelectorAll(
      "[aria-label],[placeholder],[title]",
    )) {
      for (const attr of ["aria-label", "placeholder", "title"]) {
        const v = el.getAttribute(attr);
        if (!v || !/[가-힣]/.test(v)) continue;
        const key = v.trim();
        const en =
          I18N_EN[key] != null ? I18N_EN[key] : i18nApplyFragments(key);
        if (en !== key) el.setAttribute(attr, v.replace(key, en));
      }
    }
  }
}

/* <main>을 감시한다 — 메뉴(#overlay)와 전투 HUD(발사·남은 유성·조작 안내·
   별자리 배율 등)가 모두 그 안에 있다. 화면이 바뀔 때마다(그리고 로드 시)
   영어면 다시 지역화한다. childList+subtree 만 본다: 전투 중 숫자(체력·콤보·
   운동량)는 characterData 로 초당 여러 번 갱신되는데, 그건 지역화할 필요가
   없고 감시하면 부하만 준다. 라벨의 최초 렌더는 innerHTML(=childList)이라
   이걸로 다 잡힌다. 자기 치환이 옵저버를 다시 안 깨우게 치환 동안 끊는다. */
const I18N_OBS_OPTS = { childList: true, subtree: true };
let _i18nObserver = null;
function i18nRun(root) {
  if (!i18nActive()) return;
  if (_i18nObserver) _i18nObserver.disconnect();
  i18nLocalize(root);
  if (_i18nObserver) _i18nObserver.observe(root, I18N_OBS_OPTS);
}
function startI18n() {
  const root = document.querySelector("main") || document.body;
  if (!root) {
    setTimeout(startI18n, 100);
    return;
  }
  _i18nObserver = new MutationObserver(() => i18nRun(root));
  i18nRun(root);
  if (i18nActive()) _i18nObserver.observe(root, I18N_OBS_OPTS);
  window.__i18nApply = () => i18nRun(root);
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", startI18n);
else startI18n();
