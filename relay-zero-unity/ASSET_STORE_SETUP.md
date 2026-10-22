# 그래픽 교체 — Asset Store 연결

**현재 상태:** 에셋 교체 기능과 기본 메시의 둥근 모서리 처리를 구현했습니다. 이 환경에는 Unity ID에 로그인한 Editor가 없어 **Asset Store 패키지 다운로드·임포트·실제 모델 교체는 수행하지 않았습니다.** 아래 상품은 확인한 무료 후보이며 설치된 목록이 아닙니다.

## 교체할 후보

2026-10-22 상품 페이지 기준입니다. 무료 상품도 같은 Unity ID로 **Add to My Assets → Unity Package Manager / My Assets → Download → Import**가 필요합니다. [Unity 공식 안내](https://docs.unity.com/en-us/asset-store/downloads/purchase-asset-packages).

| 대상 | 무료 후보 | 적용 방향 / 확인할 부분 |
|---|---|---|
| 공장·연구소 소품 | [Sci-Fi Construction Kit (Modular), Sickhead Games](https://assetstore.unity.com/packages/3d/environments/sci-fi/sci-fi-construction-kit-modular-159280) | PBR 패널·기둥·상자·시설 소품. 2018.4용 원본이므로 Unity 6에서 재질·프리팹을 점검. 전체 예제 장면으로 덮어쓰지 않음. |
| 화물 전장 | [Free Shipping Containers, Calvin Weibel](https://assetstore.unity.com/packages/3d/environments/industrial/free-shipping-containers-18315) | 컨테이너와 화물 소품. 표면 디테일과 손잡이·문 구조를 개선. 2016년 배포본이므로 임포트 후 확인 필요. |
| 총기 | [Sci Fi Gun, MASH Virtual](https://assetstore.unity.com/packages/3d/props/guns/sci-fi-gun-162872) | PBR 총기 외형 후보. 한 패키지가 모든 피스톨·SMG·저격총 형태를 제공한다고 가정하지 말고 알맞은 슬롯에만 연결. |
| 로봇 | [Animated Low Poly Robot Free, Juanpmh](https://assetstore.unity.com/packages/3d/characters/robots/animated-low-poly-robot-free-stylized-sci-fi-character-318201) | 실제 스켈레톤·애니메이션 로봇 후보. 스타일화된 low-poly이고 **URP 전용**으로 표시되어 있으므로 현재 Built-in 프로젝트에는 재질 변환이 필요. 실사 로봇으로 소개하지 않음. |

`Robot Kyle | URP`(4696)는 현재 판매 중단으로 표시되어 신규 도입 후보에서 제외했습니다. 별도 유료 에셋 구매는 수행하지 않았습니다.

## 사용 순서

1. Unity Hub에서 `relay-zero-unity`를 열고 위 패키지를 로그인한 계정으로 받아 Import합니다. 완성 프로젝트의 ProjectSettings는 덮어쓰지 않습니다.
2. Play 모드를 멈추고 **RELAY ZERO → Asset Store Visual Setup**을 엽니다. 메뉴 안에 상품 페이지 링크와 로컬 `.unitypackage` 가져오기 기능이 있습니다.
3. Project 창에서 사용할 프리팹 또는 FBX 모델을 선택하고 **선택한 프리팹 준비**를 누릅니다. 새 시각 요소 전용 프리팹을 `Assets/RelayZeroLocal/Prefabs`에 저장합니다.
4. 준비 과정은 외부 조작·AI 스크립트와 충돌체·오디오·조명 등을 제거한 복사본을 만듭니다. 원본 파일은 수정하지 않습니다. Animator·스켈레톤·메시·재질을 유지하며 루트 모션과 애니메이션 이벤트는 끕니다. 외부 게임 스크립트가 남은 프리팹은 런타임에서 사용하지 않습니다.
5. 일반적인 URP/HDRP 재질은 텍스처·노멀·색·금속성·발광을 가능한 범위에서 Built-in Standard 재질 복사본으로 옮깁니다. 복잡한 Shader Graph의 효과까지 완전히 변환하는 도구는 아니므로 핑크색, 투명도와 조명을 확인합니다.
6. **로컬 교체 프로필 만들기**를 누르고 준비한 프리팹을 각 `prefab` 칸에 연결합니다. `rotation`, `offset`, `scale`로 시점을 맞춥니다. 총기·캐릭터는 비율을 유지하고, 소품은 필요한 경우에만 `stretchToBounds`를 사용합니다.
7. **프로필 저장 / 점검**을 누른 뒤 Play로 확인합니다. `.unitypackage` Import만 해서는 임의로 프리팹이 선택되거나 적용되지 않습니다.

프로필은 `Assets/RelayZeroLocal/Resources/VisualOverrides.asset`에 저장합니다. 이 경로는 공개 GitHub 커밋에서 제외됩니다. 패키지 파일이 이 작업 공간에 전달되면 실제 프리팹에 맞춘 연결·정렬 작업을 이어갈 수 있습니다.

## 연결 키

- 총기: `weapon-ar7`, `weapon-p12`, `weapon-p6`, `weapon-s24`, `weapon-r20`, `weapon-l5`, `weapon-arc`.
- 적: `robot-assault`, `robot-defender`, `robot-support`, `robot-sniper`, `robot-bomber`, `robot-commander`.
- 친구: `operative-friendly`, `operative-rival`.
- 환경: 원본 파트의 정확한 이름. 예: `cargo container`, `supply crate`, `cover`, `server column`, `lab chamber`.
- 환경 `map`: `foundry`, `cargo`, `nexus`, 전체 맵은 `*`.

환경 파트 위치·크기에 맞춰 외형을 놓으며, 기존 이동 동선과 충돌 메시를 사용합니다. 원본의 보조 리브·지붕·발광선은 별도 파트이므로 큰 프리팹으로 교체할 때 겹침을 점검하고 해당 파트도 따로 매핑하거나 정리해야 합니다. 전체 실내 장면 하나를 작은 상자 슬롯에 연결하지 않습니다.

모델 교체 후에도 원본의 머리·몸통 판정과 방패·보스 약점은 게임이 관리합니다. 방패와 약점 외형은 읽을 수 있도록 남깁니다. 새 로봇 머리·가슴 위치가 판정과 일치하는지 꼭 확인합니다. 총구의 시각 위치도 조준·벽 검사 위치와 대조합니다.

Animator Controller를 포함한 프리팹에는 기본적으로 `Speed`(float, m/s), `Dead`(bool), `Attack`(trigger)를 전달합니다. 프로필에서 이름을 변경할 수 있고 해당 파라미터가 없는 경우에는 쓰지 않습니다. 애니메이션이 없는 모델에 자동으로 동작을 생성하지는 않습니다.

## 기본 모델에서 바로 바뀐 부분

프로필이나 패키지가 없어도 `SoftMesh`가 박스 구조를 찾아 렌더 메시의 모서리를 둥글게 만듭니다. 총기·로봇·시설의 빛 반사가 날카로운 직각에서 완만하게 이어지도록 실제 정점과 노멀을 생성합니다. 이는 **Asset Store 에셋을 적용한 것과 별개의 기본 모델 개선**입니다.

처리는 로드할 때 한 번 하고 재사용합니다. 바닥 이음새 같은 얇은 요소는 유지하고 충돌·피해 판정에는 원래 메시를 사용합니다. 기본 모서리 처리는 교체 프로필의 `softenOriginalMeshes`로 끌 수 있습니다. 플레이 중에는 캐시를 다시 만들지 않으므로 변경 뒤 Play를 재시작합니다.

## 검증 범위

- 새 런타임 C#은 실제 Unity 참조 어셈블리로 컴파일 검사했습니다.
- 기존 독립 게임 규칙·데이터 검사는 유지합니다.
- Unity의 `Run Play Mode Smoke Check`에 둥근 메시의 경계·노멀·삼각형과 시각 프리팹의 충돌 분리 검사를 추가했습니다. 이 환경에서는 Editor가 없어 해당 엔진 검사를 실행하지 못했습니다.
- 실제 상품 프리팹·텍스처·애니메이션·배치와 성능 검증은 패키지를 가져온 후 수행해야 합니다.
