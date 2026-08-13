# Stella Ball 문서 안내

> 기준일: 2026-08-13
>
> 현재 코드와 제출 자료를 헷갈리지 않기 위한 문서별 역할 안내다. 같은 사실을 여러 문서에서 고쳐야 할 때는 이 문서의 우선순위를 따른다.

## 먼저 읽을 문서

1. [README.md](README.md) — 실행 링크와 5분 안의 로컬 실행 방법
2. [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) — **현재 구현의 기준선**, 범위 원칙, 다음 우선순위
3. [PROGRESS_REPORT.md](PROGRESS_REPORT.md) — 지금 플레이 가능한 내용, 알려진 위험, 다음 세션 시작점
4. [prototypes/ARCHITECTURE.md](prototypes/ARCHITECTURE.md) — 코드 소유 경계와 스크립트 로드 순서
5. [prototypes/MAINTENANCE.md](prototypes/MAINTENANCE.md) — 기믹·성능·검증 변경 절차
6. [UI_KIT_DAWN.md](UI_KIT_DAWN.md) — **UI 테마의 단일 기준**(Dawn Observatory v3). 팔레트, `data-pbtn` 버튼 킷, 배경 데코 규칙. [UI_REDESIGN_HANDOFF.md](UI_REDESIGN_HANDOFF.md)(Ink & Brass v2)를 대체했다.

## 제출과 이력 문서

- [CODEX_COLLABORATION.md](CODEX_COLLABORATION.md): 제출·발표용 원본. **실제 구현·검증이 끝난 항목만** 완료로 쓴다.
- [DEVLOG.md](DEVLOG.md): 날짜별 요청, 결과, 막힌 점, 사람의 판단을 남기는 변경 이력이다. 과거 시안의 용어는 당시 기록이므로 소급해 고치지 않는다.
- [EVIDENCE_PROTOCOL.md](EVIDENCE_PROTOCOL.md): 커밋·push·Actions·Pages·DEVLOG를 연결하는 증거 운영 규칙이다.
- [GAME_DIRECTION.md](GAME_DIRECTION.md): 해커톤 전략, 채택/폐기 이유, 서비스 확장 원칙이다. 현재 수치의 단일 기준은 `PROJECT_CONTEXT.md`다.

## 에셋과 외부 연동 문서

- [ASSET_BACKLOG.md](ASSET_BACKLOG.md): 기능 작업 중 발견한 신규 디자인·애니메이션·SFX 필요사항의 단일 접수처
- [ASSET_PLAN.md](ASSET_PLAN.md), [assets/ASSET_MANIFEST.json](assets/ASSET_MANIFEST.json), [assets/ATTRIBUTION.md](assets/ATTRIBUTION.md): 실제 반입 에셋의 계획·목록·출처
- [HIVE_SETUP.md](HIVE_SETUP.md): 실제 Hive Console 스파이크 절차와 완료 판정

## 현재 사실 기준선

- 공식 표시명은 **Stella Ball**. 실행 대상은 `prototypes/prism-breakers.html`이다.
- 캠페인은 별자리 월드 구조다. `북두칠성` 7 스테이지와 `카시오페이아` 5 스테이지가 있고, 각 스테이지 이름은 실제 별 이름이다. **새 기믹을 소개하는 스테이지에는 그 기믹만 두고, 그 외에도 최대 두 종류까지만 둔다.** 무한 훈련장은 기믹을 하나도 두지 않은 빈 판이다.
- 로스터는 8명이며 시작 보유는 샛별·미리내·윤슬 3명이다. 기본 전투는 유성 5개, 일반 보스 체력 260, 단일 체력 전투다. 캠페인 파티는 3명, 무한 훈련장만 4명이다.
- 별지기 스프라이트는 8종 모두 같은 규격이다. idle 192×192 6프레임, 구르기·각성 공격 각 4프레임. 출처는 프로젝트 오너 제작이다.
- 실제 Hive Console 로그인·데이터 저장·리더보드 왕복과 현재 당구 물리용 헤드리스 봇 리포트는 아직 완료되지 않았다. 이전 봇 결과는 탐색 이력일 뿐 제출용 밸런스 수치가 아니다.

## 문서 갱신 규칙

1. 게임 규칙·로스터·스테이지·수치가 바뀌면 먼저 `PROJECT_CONTEXT.md`와 `PROGRESS_REPORT.md`를 코드와 함께 갱신한다.
2. 제출에서 말할 수 있는 실제 구현 범위가 바뀌었을 때만 `CODEX_COLLABORATION.md`를 갱신한다.
3. 방향·범위의 결정은 `GAME_DIRECTION.md`, 날짜별 판단은 `DEVLOG.md`에 한 번만 기록한다.
4. 코드 구조 또는 검증 절차가 바뀌면 `prototypes/ARCHITECTURE.md` 또는 `prototypes/MAINTENANCE.md`를 같은 커밋에서 갱신한다.
5. 완료 전 Hive·봇·외부 플레이 검증을 "완료" 또는 "연동됨"으로 표현하지 않는다.
