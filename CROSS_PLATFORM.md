# Windows · macOS · Linux 작업 규칙

이 저장소는 설치 과정 없이 정적 웹 게임을 실행한다. 운영체제에 따라 달라지는 경로, 심볼릭 링크, 파일명 대소문자, 줄바꿈에 의존하지 않는다.

## 바로 실행

저장소를 받은 뒤 별도 설치 없이 다음 파일을 더블클릭한다.

- **Windows**: `PLAY_WINDOWS.cmd`
- **macOS**: `RUN_STELLA_BALL.command`

두 실행 파일은 프로젝트 내부 상대 경로만 사용해 기본 브라우저에서 공식 게임을 연다. macOS에서 실행 권한이 사라졌다면 터미널에서 `chmod +x RUN_STELLA_BALL.command`를 한 번 실행한다.

## Windows에서 개발 시작

Node.js 20 이상과 Git을 준비한 뒤 아래 명령을 사용한다.

```powershell
git clone https://github.com/8rulerstar/prism-breakers.git
cd prism-breakers
npm run verify
npm run smoke
npm run serve
```

브라우저에서 `http://127.0.0.1:4173/`을 연다.

## macOS에서 이어서 작업

외부 npm 패키지 설치 없이 바로 이어갈 수 있다.

```sh
git pull --ff-only
node --version
npm run verify
npm run smoke
npm run serve
```

브라우저에서 `http://127.0.0.1:4173/`을 연다. 첫 확인은 메인 CTA → 온보딩 모달 잠금/실습 전환 → `1-2 균열 회랑`의 공명 범퍼 → 별지기 정산 연출 순서로 한다. 작업 뒤에는 `git status --short`로 새 에셋이 Git 추적 상태인지 확인한다.

## 저장소 규칙

- `.gitattributes`가 텍스트는 UTF-8/LF, PNG·글꼴 등 바이너리는 원본 바이트로 유지한다. 각자 `core.autocrlf`를 따로 맞출 필요가 없다.
- 런타임 파일은 `/Users/...`, `C:\\...`, `file://` 같은 컴퓨터 절대 경로를 쓰지 않는다. 프로젝트 내부 파일은 항상 상대 경로로 참조한다.
- 파일명은 영문 소문자·숫자·하이픈을 쓴다. 대소문자만 다른 파일 두 개를 만들지 않는다.
- 게임에서 참조하는 에셋은 코드와 **같은 커밋에 Git 추적 상태**로 넣는다. 로컬에만 있는 에셋을 참조하지 않는다.
- 생성용 원본이나 개인 실험 파일은 게임 런타임에서 참조하지 않는다. 반입할 최종 PNG만 추적한다.
- `.claude/`와 `node_modules/`는 개인 설정·로컬 캐시이므로 커밋하지 않는다.

## 자동 확인

`node scripts/check-portability.mjs`는 다음을 검사한다.

1. 런타임 코드의 macOS/Windows 절대 경로
2. HTML·JS·CSS가 참조하지만 Git에 없는 로컬 에셋
3. Windows에서 충돌하는 대소문자 중복 경로와 예약 파일명

`node scripts/verify-evidence.mjs`는 이 검사를 함께 실행한다. GitHub Actions도 Ubuntu와 Windows에서 같은 검사를 수행한다.
