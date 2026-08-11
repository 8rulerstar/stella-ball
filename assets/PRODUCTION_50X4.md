# Prism Breakers Production Library 50×4

전투를 무겁게 만들지 않도록, 이 팩은 **후보 라이브러리**다. 게임 런타임에는 그중 읽기 쉬운 효과와 대표 SFX만 반입한다.

- 정적 에셋 50종 — 적·투사체·UI·배경·소품. 현재 코어와 모순되는 폐기된 보스 방어 페이즈 후보는 제외.
- 애니메이션 50종 — 4프레임 시트, 적 idle/move/attack/hit과 전장 반응 중심.
- 시각 효과 50종 — 충돌·약점·연계·투사체·각성·처치에 사용할 수 있는 픽셀 VFX. `core-break-signature-512.png`은 Codex ImageGen 원본을 크로마키 투명 처리·웹용 축소한 시그니처 효과다.
- SFX 50종 — 외부 샘플 없이 절차 합성한 22.05 kHz mono PCM WAV. 발사·벽·유닛·약점·RIPOSTE·능력·배율·UI·승리·실패로 분류한다.

`node scripts/build_50x4_manifest.mjs`를 실행하면 `assets/library/PRODUCTION_50X4_MANIFEST.json`을 다시 만들고, 네 묶음이 정확히 50종이며 모든 파일이 존재하는지 확인한다.

현재 반입한 것:

- VFX: 프리즘 직격, 룬 충격파, 프리즘 혜성, 시그니처 코어 브레이크.
- SFX: 벽·유닛·일반 명중·약점·RIPOSTE·각성·배율의 대표 큐 7개.

나머지는 다음 스테이지 기믹·적·보스 패턴이 실제로 정해질 때만 선택적으로 사용한다.
