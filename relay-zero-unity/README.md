# RELAY ZERO — Unity 이식판

기존 웹 게임 **RELAY ZERO 3.2.0**을 Unity의 C# 게임 로직, CharacterController, PhysX, 메시 렌더러, uGUI로 옮긴 독립 프로젝트입니다. Unity 6 LTS **6000.0.23f1**을 기준으로 작성했습니다. 브라우저 화면을 띄우는 WebView 방식이 아닙니다.

## 그래픽 교체

각진 기본 메시의 모서리를 부드럽게 처리하고, 가져온 Asset Store 프리팹으로 총기·로봇·전장 소품을 교체할 수 있게 했습니다. **실제 Store 패키지는 이 환경에서 다운로드·임포트하지 못했습니다.** 무료 후보와 적용 방법은 [Asset Store 그래픽 교체 안내](ASSET_STORE_SETUP.md)를 확인하세요. Unity 메뉴는 **RELAY ZERO → Asset Store Visual Setup**입니다.

## 바로 실행하기

1. 저장소를 내려받고 **Unity Hub → Add → Add project from disk**에서 `relay-zero-unity` 폴더를 선택합니다. 저장소 최상위 폴더가 아니라 `Assets`, `Packages`, `ProjectSettings`가 있는 이 폴더입니다.
2. Unity 6 LTS로 열고 패키지와 폰트 가져오기가 끝날 때까지 기다립니다. 외부 유료 에셋은 필요하지 않습니다.
3. 상단 **RELAY ZERO → Open Game Scene**을 누른 뒤 **Play**를 누릅니다. 직접 열려면 `Assets/Scenes/RelayZero.unity`를 선택합니다.
4. 맵·난이도·피스톨을 선택한 뒤 **게임 시작**을 누릅니다. 마우스 입력은 Game 창에 포커스가 있어야 동작합니다.

기본 설정은 Built-in Render Pipeline과 기존 Input Manager입니다. 이 프로젝트에는 `InputManager.asset`이 포함되어 있습니다. 다른 프로젝트로 복사할 때는 Player Settings의 **Active Input Handling**을 **Input Manager (Old)** 또는 **Both**로 설정해야 합니다. URP/HDRP 프로젝트로 스크립트만 복사하면 함께 제공한 Built-in 셰이더를 바꿔야 합니다.

사용자 요청에 따라 폭발 전력통과 E로 작동하는 차단문·전개 엄폐물은 웹 버전과 이 이식판에서 제거했습니다. E 길게 누르기는 목표 장치 작동과 협동 소생에 사용합니다.

## 옮긴 콘텐츠와 기능

- 원본 생성 코드에서 추출한 주조 공장·화물 터미널·넥서스 연구소의 실제 메시, 색상, 조명, 표지판, 시작·적 등장·목표 위치.
- 피스톨 2종, 구매 총기 4종, 충격봉. 원본의 실제 무기 메시와 피해·탄창·연사·재장전·반동·퍼짐 수치.
- 걷기, 달리기, 점프, 앉기, ADS, 대시, 무기 교체, 벽에 막히는 사격·근접 공격.
- 난이도 4종, 5개 웨이브와 분할 증원, 점령·장치 2개·방어 목표, 최종 지휘 로봇의 경고 원과 약점 노출.
- 돌격·방어·지원·저격·자폭 로봇, 정예 개체, 시야·소음 감지, 경로 탐색, 지원형 수리, 방패 파괴.
- 코인, 상점, 무기별 탄약 보관, 부착물 3종 중 최대 2개, EMP, 사격 연습, 승리 후 무한 웨이브.
- 최근 전투 HUD를 uGUI로 재구성: 원형 미니맵, 상단 전투 정보·타이머, 하단 체력·탄약, 우측 무기·능력, 명중·피격 방향·붉은 화면 가장자리.
- 설정, 개인 최고 점수와 승리 최단 시간은 Unity의 PlayerPrefs에 저장됩니다. 기존 브라우저 localStorage 기록은 별도이며 자동으로 복사되지 않습니다.
- 원본 합성 효과음의 파형·주파수·감쇠를 AudioClip으로 생성합니다.

원본 모델 메시와 게임 수치는 추출했지만, Babylon.js와 Unity의 조명·글꼴·물리·음향 구현이 달라 화면 픽셀과 조작 감각까지 완전히 같다고 보장하지는 않습니다. 로봇의 사망 자세와 저격 조준경 같은 연출은 Unity용으로 다시 구현했습니다.

## 조작

| 입력 | 동작 |
|---|---|
| WASD / 마우스 | 이동 / 시점 |
| 좌클릭 / 우클릭 | 사격·근접 / ADS |
| Shift / Space / Ctrl 또는 C | 달리기 / 점프 / 앉기 |
| Alt / G | 대시 / EMP |
| R / 1·2·3 / 휠 | 재장전 / 무기 선택 |
| E 길게 | 목표 장치 작동 / 협동 친구 소생 |
| B / ESC | 웨이브 사이 상점 / 메뉴 |

## 친구와 대전·협동

메인 메뉴에서 **친구와 1vs1** 또는 **2인 협동**을 선택합니다. 한 명은 방을 만들고, 다른 한 명은 10자리 방 코드를 입력합니다. 둘 다 준비하면 같은 맵으로 진입합니다.

- 기본 서버: `wss://relay-zero-rooms.onrender.com/rooms` — 기존 Render 서버를 그대로 사용합니다. 첫 연결은 서버 기동 때문에 약 1분 걸릴 수 있습니다.
- 대기실 아래에서 서버 주소를 변경할 수 있습니다. 로컬 개발 서버는 `ws://localhost:3001/rooms`입니다.
- 1vs1: 같은 AR-7·P-12·충격봉, 5킬 선승, 3초 재투입, 2초 보호.
- 협동: 5개 생존 웨이브, 동시에 최대 6기, 아군 사격 피해 없음, 가까운 친구를 E 2초로 소생. 둘 다 쓰러지면 패배합니다. 캠페인의 보스·점령 목표·상점·EMP는 온라인 규칙에 포함하지 않습니다.
- **온라인에서 ESC 메뉴를 열어도 전투는 계속됩니다.** 방장이 나가면 방이 종료됩니다. 방장 컴퓨터에서 전투를 판정하는 기존 구조이며 서버는 방·메시지를 중계합니다.
- 기존 서버 프로토콜을 유지했습니다. 웹 클라이언트와의 실제 상호 접속 검증은 아직 수행하지 않았습니다.

목표 플랫폼은 **Windows / macOS / Linux 데스크톱**입니다. 네트워크는 `ClientWebSocket`을 사용합니다. Unity WebGL은 이 .NET 소켓을 지원하지 않으므로 WebGL 빌드용 포팅은 포함하지 않습니다. 기존 웹 버전은 `../relay-zero`에 있습니다.

## 실행 파일 만들기

Unity Hub에서 해당 플랫폼의 Build Support를 설치한 뒤 다음 메뉴를 사용합니다.

- **RELAY ZERO → Build Windows x64** → `Builds/Windows/RelayZero.exe`
- **RELAY ZERO → Build Linux x64** → `Builds/Linux/RelayZero.x86_64`
- **RELAY ZERO → Build macOS** → `Builds/macOS/RelayZero.app`

라이선스가 활성화된 Unity Editor의 배치 빌드도 지원합니다.

```sh
RELAY_BUILD_TARGET=linux /path/to/Unity \
  -batchmode -nographics -quit \
  -projectPath /absolute/path/to/relay-zero-unity \
  -executeMethod RelayZero.Editor.RelayBuild.CI \
  -logFile /tmp/relay-unity-build.log
```

이 저장소에는 완성된 `.exe`나 Unity Editor 라이선스가 포함되지 않습니다.

## 검증 상태

이 작업 환경에는 Unity Editor가 설치되어 있지 않아 Editor에서 Play, PhysX 충돌·그래픽·글꼴·셰이더 컴파일, 실행 파일 빌드 및 두 클라이언트의 실제 접속은 검증하지 못했습니다.

수행한 검증:

- 런타임 C# 전체를 Roslyn으로 컴파일했습니다. 임의의 가짜 Unity API가 아닌 `UnityEngine.Modules 2021.3.33` 및 `UnityEngine.UI 2018.3.5.1` 참조 어셈블리를 사용했습니다. 이는 C# 타입·API 검증이며 **Unity 6 Editor 빌드 성공을 뜻하지 않습니다**.
- 독립 C# 게임 규칙·원본 콘텐츠 검사 **62개 통과**: 탄약 보존, 부착물 제한, 목표 진행·초기화·감소, 모든 난이도의 총 적 수, 증원, 목표 완료 조건, 무한 웨이브, 네트워크 사격 중복 방지, 대전 판정, 메시 인덱스와 목표 위치.
- 서버 단위 테스트 및 실제 로컬 WebSocket 두 클라이언트의 준비·시작·상태·사격 전달 검사. 자세한 결과는 `VALIDATION.md`를 확인하세요.

독립 규칙 검사는 .NET 8 SDK로 실행할 수 있습니다.

```sh
dotnet run --project Tests/Rules.Tests.csproj
```

로컬 방 서버를 실행한 뒤 `dotnet run --project Tests/Socket.Tests.csproj`로 실제 네이티브 소켓의 대전·협동 연결을 검사할 수 있습니다. 기본 주소는 `ws://127.0.0.1:3001/rooms`이며 `RELAY_ROOM_TEST_URL`로 바꿀 수 있습니다.

Unity에서는 **RELAY ZERO → Validate Exported Content**로 리소스를 검사하고, **Run Play Mode Smoke Check**로 실제 엔진에서 기본 동작을 검사할 수 있습니다. 이 Unity 검사는 제공했으나 이 환경에서 실행하지 못했습니다.

## 코드 위치와 원본 갱신

| 위치 | 내용 |
|---|---|
| `Assets/RelayZero/Scripts/RelayGame.cs` | 게임 흐름·상점·웨이브·목표·승패 |
| `Rules.cs` | 엔진에 의존하지 않는 탄약·목표·웨이브·네트워크 규칙 |
| `FirstPerson.cs` | CharacterController 이동·시점·무기 |
| `Bot.cs` | AI·방패·지원 수리·지휘 로봇 |
| `OnlineSession.cs` | Render 방 서버 프로토콜·호스트 판정·협동 |
| `TacticalUI.cs` | 메인 메뉴·HUD·상점·설정·대기실·결과 |
| `Geometry.cs` | 추출 메시 로딩·재질 배칭·충돌·경로 탐색 |
| `Resources/Data/*.json` | 원본에서 추출한 메시·재질·게임 수치 |
| `Resources/UI/*.png` | 원본 SVG에서 변환한 HUD 아이콘·초상 |
| `Editor/RelayBuild.cs` | 에디터 메뉴·빌드·데이터 검사 |

장면은 가벼운 시작 장면이고 실제 맵·무기·로봇·UI는 Play 시 생성됩니다. Play 중 Hierarchy에서 구조를 확인할 수 있습니다. 변경하려면 C#과 `Resources/Data`를 수정합니다. 플레이 모드에서 오브젝트를 편집한 내용은 정지 시 저장되지 않습니다.

원본 웹 게임에서 메시와 수치를 다시 추출하려면 저장소 최상위에서:

```sh
cd relay-zero
npm ci
node --import tsx scripts/export-unity.ts ../relay-zero-unity/Assets/RelayZero/Resources/Data
```

원본 웹 소스 기준: `b980d3996fd13efdf135e99494cb5f9c262bb189` (웹 v3.2.0). 셰이더·물리·게임 로직은 C# 포트이므로 수치를 바꾼 뒤에는 Unity에서도 검사해야 합니다.

폰트: Noto Sans CJK KR의 한국어·라틴 문자 부분집합과 Barlow Condensed Bold. SIL Open Font License 및 출처는 `Resources/Fonts`와 `THIRD_PARTY_NOTICES.md`에 포함합니다.
