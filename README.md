# Focus — 할 일 관리 PWA

iPhone과 PC에서 사용할 수 있는 오프라인 지원 할 일 관리 웹앱.

## 기능
- 할 일 추가, 완료, 수정, 삭제 및 되돌리기
- 우선순위, 마감일, 검색, 필터와 정렬
- 진행률 통계, 다크 모드
- localStorage 자동 저장, JSON 백업/복원
- 홈 화면 설치(PWA), 오프라인 캐시

## Render 배포
- **서비스 유형:** Static Site
- **저장소:** `sseung973/Codex`
- **브랜치:** `main`
- **빌드 명령:** `echo Focus ready`
- **Publish Directory:** `public`

## 데이터 이전 안내
Railway에 배포됐던 버전의 할 일 데이터는 원래 사이트의 localStorage에 저장돼 있어.
새 Render 주소는 출처(origin)가 달라 자동으로 데이터가 이전되지 않아.
기존 주소에서 설정 → JSON 내보내기로 백업한 뒤 새 주소에서 JSON 가져오기를 선택해.
기존 서버나 기존 데이터를 삭제하기 전에 반드시 이 절차를 완료해야 해.

## RELAY ZERO

- [Unity 6 데스크톱 프로젝트](relay-zero-unity/README.md): Unity Hub에서 `relay-zero-unity` 폴더를 열면 됩니다.
- [웹 게임 소스](relay-zero/README.md) · [플레이](https://relay-zero-arena.sseung973.chatgpt.site)
- Unity 이식판은 C#·PhysX·uGUI를 사용합니다. 검증 범위와 Editor 실행 방법은 프로젝트 README에 있습니다.
