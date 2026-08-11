# Observatory Pack 01 — 후보 에셋

이 폴더의 파일은 **후보 전용**이다. 게임 HTML·JavaScript·CSS·기존 에셋 매니페스트에는 연결하지 않았으며, 현재 실행 결과에 영향을 주지 않는다.

## 구성

| 파일                                | 용도 후보                                      | 규격                             |
| ----------------------------------- | ---------------------------------------------- | -------------------------------- |
| `art/luna-gesture.png`              | 중앙 온보딩에서 다음 행동을 가리키는 루나 포즈 | 투명 PNG, 1254×1254              |
| `art/observatory-telescope.png`     | 전투 화면 밖 관측소·튜토리얼 장면 소품         | 투명 PNG, 1254×1254              |
| `art/constellation-seal-source.png` | 성좌 완성 연출 원본 후보                       | 크로마키 PNG, 1254×1254          |
| `art/constellation-seal.png`        | 성좌 완성 연출용 투명 처리 시도본              | 투명 PNG, 1254×1254              |
| `audio/*.wav`                       | 루나/튜토리얼/성좌/약점 전용 효과음            | WAV, mono, PCM 16-bit, 22.05 kHz |

## 사용 전 확인

1. 게임에 등록하기 전에 캔버스 축소 크기에서 가독성과 초록 키 가장자리를 검수한다.
2. `constellation-seal.png`은 생성 배경이 완전히 균일하지 않아 가장자리 검수가 특히 필요하다. 필요하면 `*-source.png`를 기준으로 다시 키잉하거나 재생성한다.
3. 효과음은 `audio/manifest.json`의 cue 이름을 채택한 뒤에만 사운드 라우터에 연결한다.

## 생성/권리

- 래스터 후보: OpenAI Image Generation으로 생성하고 로컬 크로마키 제거 도구로 알파를 만들었다.
- 오디오 후보: `audio/generate_sfx.py`로 만든 프로젝트 오리지널 절차 합성음이다.
- 이 팩은 채택 전까지 기존 `assets/ASSET_MANIFEST.json` 및 `assets/audio/SFX50_MANIFEST.json`과 독립적이다.
