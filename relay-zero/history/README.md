# RELAY ZERO 소스 및 전체 개발 이력

이 폴더의 게임 소스는 현재 배포본의 원본 54개 파일입니다.

- 원본 최신 커밋: `09504f1d1a49205280f5fb2278a43242316c1ff8`
- 원본 개발 이력: 총 16개 커밋
- 플레이 주소: https://relay-zero-arena.sseung973.chatgpt.site
- Node.js 프로젝트: TypeScript + Babylon.js + Vite

## 현재 소스 실행

저장소를 내려받은 뒤 `relay-zero` 폴더에서 실행하세요.

```bash
npm install
npm run dev
```

```bash
npm test
npm run build
```

최신 소스의 프로덕션 빌드와 자동 테스트 44개는 통과했습니다. 실제 GPU의 3D 화면, 조작감과 FPS는 별도 하드웨어 가속 브라우저에서 확인해야 합니다.

최신 버전에는 단계별 증원, 목표 지점에 반응하는 방어/지원 로봇, 일반 적의 공격 예고, 마지막 웨이브 지휘 로봇의 바닥 경고 및 약점 노출이 포함되어 있습니다. 현재 게임에는 웨이브 사이 업그레이드 선택 시스템이 없습니다.

## 이전 버전 전부 복원하기

`relay-zero-history.bundle`은 원본 Git 저장소의 전체 16개 커밋을 포함하는 독립적인 Git bundle입니다. GitHub의 이 가져오기 커밋과 원본 게임 개발 이력은 구분됩니다. 과거에 추가했다가 제거한 기능도 원본 커밋에서 확인할 수 있습니다.

현재 `relay-zero` 폴더에서 다음을 실행하면 별도 폴더에 원본 저장소를 복원할 수 있습니다.

```bash
git clone history/relay-zero-history.bundle ../relay-zero-full-history
cd ../relay-zero-full-history
git log --oneline --all
npm install
npm run dev
```

과거 버전을 열 때는 `git log`에서 원하는 커밋을 확인한 후 해당 복원 폴더에서 `git switch --detach <커밋 SHA>`를 실행하세요. 이전 버전마다 의존성 잠금 파일이 다를 수 있으므로 `npm install`도 다시 실행하세요.

## 함께 보관한 자료

- `commits.txt`: 원본 16개 커밋 목록
- `source-manifest.json`: 원본 소스 파일별 SHA-256
- `relay-zero-history.bundle`: 원본 소스와 전체 Git 이력

`node_modules`, 재생성 가능한 `dist`, 로컬 캐시와 비밀 환경 변수 파일은 업로드하지 않습니다. 잠금 파일, 테스트와 실행 설정은 원본 그대로 포함합니다.
