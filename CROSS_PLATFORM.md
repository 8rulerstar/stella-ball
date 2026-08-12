# Windows · macOS · Linux 작업 규칙

이 저장소는 설치 과정 없이 정적 웹 게임을 실행한다. 운영체제에 따라 달라지는 경로, 심볼릭 링크, 파일명 대소문자, 줄바꿈에 의존하지 않는다.

## 바로 실행

저장소를 받은 뒤 별도 설치 없이 다음 파일을 더블 클릭한다.

- **Windows**: `RUN_STELLA_BALL.bat`
- **macOS**: `RUN_STELLA_BALL.command`

두 실행 파일은 프로젝트 내부의 상대 경로만 사용해 기본 브라우저에서 `prototypes/prism-breakers.html`을 연다.

## Windows에서 개발 시작

```powershell
git clone https://github.com/8rulerstar/prism-breakers.git
cd prism-breakers
node scripts/verify-evidence.mjs
py -m http.server 4173 --directory .
```

브라우저에서 `http://127.0.0.1:4173/prototypes/prism-breakers.html`을 연다. `py`가 없으면 Python 설치 뒤 같은 명령을 실행하거나, 정적 서버 확장을 사용하면 된다. 단순 플레이만 할 때는 위의 `RUN_STELLA_BALL.bat`이면 충분하다.

## 저장소 규칙

- `.gitattributes`가 텍스트는 UTF-8/LF, PNG·글꼴 등 바이너리는 원본 바이트로 유지한다. 각자 `core.autocrlf`를 따로 맞출 필요가 없다.
- 런타임 파일은 `/Users/...`, `C:\\...`, `file://` 같은 컴퓨터 절대 경로를 쓰지 않는다. 프로젝트 내부 파일은 항상 상대 경로로 참조한다.
- 파일명은 영문 소문자·숫자·하이픈을 쓴다. 대소문자만 다른 파일 두 개를 만들지 않는다.
- 게임에서 참조하는 에셋은 코드와 **같은 커밋에 Git 추적 상태**로 넣는다. 로컬에만 있는 에셋을 참조하지 않는다.
- 생성용 원본이나 개인 실험 파일은 게임 런타임에서 참조하지 않는다. 반입할 최종 PNG만 추적한다.

## 자동 확인

`node scripts/check-portability.mjs`는 다음을 검사한다.

1. 런타임 코드의 macOS/Windows 절대 경로
2. HTML·JS·CSS가 참조하지만 Git에 없는 로컬 에셋
3. Windows에서 충돌하는 대소문자 중복 경로와 예약 파일명

`node scripts/verify-evidence.mjs`는 이 검사를 함께 실행한다. GitHub Actions도 Ubuntu와 Windows에서 같은 검사를 수행한다.
