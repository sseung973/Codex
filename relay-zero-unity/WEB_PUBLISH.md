# Unity 버전의 플레이 링크 배포

현재 저장소에는 Unity 프로젝트와 웹 빌드 준비 코드가 있습니다. **Unity WebGL 플레이어를 실제로 빌드·배포한 상태는 아닙니다.** 기존 `relay-zero-arena.sseung973.chatgpt.site`의 루트는 원본 Babylon.js 게임입니다.

## 기존 프로젝트에서 한 번 눌러 ZIP 만들기

1. [웹 배포 준비 패키지 다운로드](https://github.com/sseung973/Codex/raw/refs/heads/main/relay-zero-unity/Updates/RelayZero-Web-Deploy.unitypackage).
2. Unity에서 Play를 정지하고 작업을 저장합니다. **Assets → Import Package → Custom Package…**로 패키지를 Import합니다. C#·셰이더·WebGL 소켓 플러그인·웹 템플릿을 갱신합니다. 프로젝트 설정이나 개인 Store 에셋 파일은 포함하지 않습니다.
3. **RELAY ZERO → Build WebGL + ZIP**을 누릅니다. Web 플랫폼으로 전환한 뒤 스크립트 재컴파일이 끝나면 자동으로 빌드합니다. 처음에는 오래 걸릴 수 있습니다.
4. `Web Build Support 필요`가 나오면 **Unity Hub → Installs → 해당 Unity Editor의 Manage → Add modules → Web Build Support**를 설치하고 3번을 다시 실행합니다. 사용 중인 Editor와 같은 버전의 모듈이 필요합니다.
5. 성공하면 Explorer/Finder에서 **`Builds/RelayZero-Unity-WebGL.zip`**이 선택됩니다. **이 ZIP을 대화에 첨부**하면 실제 플레이어를 검사하고 배포할 수 있습니다. 프로젝트 ZIP이나 `.unitypackage`는 실행 가능한 웹 빌드 파일을 대신할 수 없습니다.

## 포함된 웹 대응

- WebGL 플레이어는 `ClientWebSocket` 대신 `.jslib`의 브라우저 WebSocket을 사용합니다. 원래 대전·협동 메시지 형식을 유지합니다. Editor/데스크톱은 기존 소켓을 계속 사용합니다.
- 프레임 속도는 Web에서 `-1`로 두어 브라우저의 `requestAnimationFrame`에 맞춥니다. 캔버스 해상도는 기기의 실제 픽셀 비율을 유지합니다.
- 전체 화면 캔버스, 로딩 진행률·오류 안내가 있는 Unity 웹 템플릿을 사용합니다.
- Gzip와 Unity decompression fallback을 사용해 압축 응답 헤더를 별도로 설정하지 않는 정적 호스트에서도 로딩하도록 준비했습니다. 코드는 Medium stripping, 엔진 코드는 stripping, 데이터 캐싱을 사용합니다.
- `relay-build.json`에 실제 빌드 시각과 Unity 버전, `LICENSES.txt`에 제공 폰트 라이선스를 기록합니다. Wasm·data·index 파일이 생성되고 Unity가 빌드 성공을 보고한 경우에만 ZIP을 만듭니다.

## 호스팅 경로

기존 Sites 배포를 보존하면서 **동일한 사이트의 `/unity/` 하위 경로**에 실제 WebGL 결과물을 추가할 계획입니다. **이 경로는 아직 배포되지 않았습니다.** 같은 origin을 유지하면 기존 Render 방 서버가 허용하는 브라우저 Origin을 사용할 수 있습니다. 별도 도메인에 올릴 때는 방 서버의 `ALLOWED_ORIGINS`에 그 origin을 명시적으로 추가해야 합니다.

ZIP을 받은 뒤에는 기존 Sites의 최신 소스를 열고 `public/unity/`에 결과물을 넣어 기존 웹 앱과 함께 빌드·배포합니다. WASM·loader·data의 실제 존재와 응답 경로를 확인한 뒤 성공한 배포 URL을 안내합니다. Unity 실행과 브라우저 플레이를 확인하기 전에는 완료로 표시하지 않습니다.

## CI 또는 터미널 빌드

라이선스가 활성화되어 있고 같은 버전의 Web Build Support가 설치된 Editor에서:

```powershell
& 'C:\Program Files\Unity\Hub\Editor\6000.3.23f1\Editor\Unity.exe' `
  -batchmode -quit -buildTarget WebGL `
  -projectPath 'C:\path\to\relay-zero-unity' `
  -executeMethod RelayZero.Editor.RelayWebBuild.CI `
  -logFile 'C:\path\to\relay-web-build.log'
```

실제 설치된 Editor와 프로젝트 경로로 바꿉니다. 서버 쪽 호스팅은 C# 프로젝트를 Unity 없이 WebAssembly로 변환해 주지 않습니다.

## 검증 상태

이 작업공간에는 Unity Editor/활성화된 빌드 라이선스가 없습니다. 공식 Unity CLI 설치기는 버전 manifest에서 HTTP 404로 실패했습니다. GitHub에도 기존 빌드 릴리스나 Actions 실행 결과가 없습니다. **실제 WebGL 빌드와 Unity→JavaScript P/Invoke, 셰이더, 브라우저 플레이 검증은 아직 하지 못했습니다.**

웹 소켓 JavaScript 단위 검사는 별도로 실행할 수 있습니다:

```sh
node --test --test-isolation=none Tests/web-socket.test.mjs
```

이 검사는 연결 시작, 한글 UTF-8, 닫힘·재접속, 오류·타임아웃, 큐 한도와 C# 네이티브 함수 이름 연결을 검사합니다. 실제 브라우저나 Unity 실행을 대신하지 않습니다.
