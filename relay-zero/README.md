# RELAY ZERO — Sector 07

## Facility art direction

The game uses a local procedural visual kit matched to the RELAY ZERO style guide: charcoal, matte concrete and steel-blue surfaces with restrained amber navigation; only robotic opponents use red identification lights. Shared PBR material profiles distinguish floor, concrete, metal, rubber, polymer and inset glass. `src/visual/FacilityProps.ts` builds control consoles, service generators and case fittings onto existing geometry, while `EnvironmentDetails.ts` batches decorative floor routes, wall panels, overhead cassettes and relay trim by material. The collision layout, navigation and weapon behavior are unchanged. Graphics presets retain FXAA and reserve restrained bloom for High. Decorative meshes do not take part in raycast or navigation; only major structures and selected robot parts cast shadows.

A single-player, browser-native arena FPS built with TypeScript, Babylon.js and Vite. Defend an industrial relay against five waves of robotic sentinels, or practice in the firing range. All game meshes, effects and sounds are generated locally. No paid asset or external game service is required.

## Run

Requires Node.js 22.12+ (Node 24 recommended), npm, and a hardware-accelerated desktop Chromium browser with WebGL.

```sh
npm install
npm run dev
```

Open the URL printed by Vite. Click **게임 시작** for survival or **사격 연습장** for targets. The click requests mouse capture and unlocks audio. Escape releases the mouse and opens the pause menu. Choose **게임으로 돌아가기**, **다시 시작**, or **메인 화면으로 나가기**. Exiting discards the current run and returns to the start screen.

```sh
npm run build
npm run preview
npm test
```

`build` runs strict TypeScript checks and produces the static `dist/` directory. `base: './'` supports deployment under a subdirectory. Upload `dist/` to a static host such as Netlify, Vercel, Cloudflare Pages or GitHub Pages. The included `.openai/hosting.json` identifies the private Sites deployment; it is not needed by other hosts. No server secrets or backend are used.

## Controls

| Action                  | Input                       |
| ----------------------- | --------------------------- |
| Move / look             | WASD / mouse                |
| Sprint                  | Left Shift + forward        |
| Jump                    | Space                       |
| Crouch                  | Left Ctrl or C              |
| Fire / ADS              | Left / right mouse          |
| Reload                  | R                           |
| Rifle / sidearm / melee | 1 / 2 / 3 or mouse wheel    |
| Pause                   | Escape                      |
| Debug HUD               | F3, development builds only |
| Fullscreen / mute       | Top-right buttons           |

## Project layout

- `src/core/`: game orchestration, state transitions, waves, settings and movement configuration.
- `src/player/`: pointer-lock input and kinematic first-person movement/camera.
- `src/weapons/`: weapon definitions, conserved magazine/reserve state, hitscan and procedural weapon presentation.
- `src/combat/`: shared `DamageInfo`, `IDamageable`, and health handling.
- `src/ai/`: targets, enemy state machine and lightweight grid A* navigation.
- `src/world/`: procedural industrial arena, lighting, shadows and line-of-sight checks.
- `src/effects/`: fixed-size tracer and impact pools.
- `src/audio/`: persistent Web Audio oscillator voices and noise buffer.
- `src/ui/`: HTML HUD, menus, feedback and responsive CSS.
- `src/assets/AssetLoader.ts`: lazy GLB/GLTF loader returning an AssetContainer with graceful failure.
- `public/assets/models`, `textures`, `audio`: asset replacement locations.
- `tests/`: executable system and Babylon NullEngine integration tests.

## Systems

**Movement.** Babylon's ellipsoid collision system supplies kinematic collision/sliding. Immediate ground movement, stopping and direction changes without inertia; reduced air control, sprint, crouch clearance, jump/gravity, walkable-normal ground detection and continuous ramps. This implementation does not use Havok or rigid-body physics. Camera input is direct; bob and landing kick are deliberately small.

**Combat.** Camera-based hitscan with a distinct head hitbox. Additional camera-to-muzzle and muzzle-to-impact world checks block shooting through cover. Rifle and semi-auto sidearm use independent magazines. Reload transfers exactly the missing rounds, and switching cancels unfinished reloads. Recoil combines a shot-count pattern, accumulation, slight variation, ADS/crouch reduction, recovery and player mouse compensation. Movement, air state and continuous fire alter spread and crosshair spacing.

**Presentation.** Camera-parented primitive weapons, procedural ADS, reload, fire kick, bounded mouse sway and movement bob. Pooled tracers/impact sparks and a reused muzzle flash. Distinct hit/headshot cues, directional damage feedback, kill notifications, health and ammunition UI. Sound is synthesized; it is functional placeholder audio, not recorded weapon audio.

**AI.** Idle → Patrol → Investigate / Chase → Attack → Search → Dead. Detection combines range, a view cone and world occlusion. Gunfire and movement can reveal position. Enemies investigate their last known target location, use a precomputed occupancy grid for obstacle routes, and attack with a reaction delay, bursts and imperfect accuracy. Higher waves improve reaction and movement as well as health; final waves include elites. Perception runs around 8 Hz; routes refresh around once per second.

**Run.** Five waves of 3 / 5 / 7 / 9 / 11 opponents, nine-second intermissions, partial health recovery and ammo resupply, score, victory/defeat and restart. The 5–10 minute duration is a design target, not a measured or guaranteed playtime. Firing range targets reset and reserves replenish automatically.

**Settings.** Sensitivity, master/effects volume, FOV, graphics quality, head bob and crosshair scale persist to localStorage with validation and blocked-storage handling. Low quality lowers render resolution and removes shadows/bloom; high adds subtle bloom. All tiers use FXAA. Materials are primarily lightweight StandardMaterial, not photorealistic PBR.

**Optimization.** Fixed effect pools, persistent audio nodes, bounded visual-effect counts, 1024px shadows, limited AI tick frequency, static navigation occupancy, and HUD text updates capped at 20 Hz. No per-frame full DOM rebuild or gameplay setInterval. The baseline 60 FPS target remains unbenchmarked on a physical mid-range PC.

## Verification and limits

Automated tests cover reload conservation/guards, one-time death, separate head hits, foreground occlusion, five-wave progression and restart, grounding, movement/braking/jump/landing/crouch/wall sliding, all arena spawn routes, integrated weapon damage/feedback/ammo, and enemy wall occlusion.

The development server and production build were exercised in the implementation environment. Its remote Chrome browser reports **WebGL not supported**, so complete live mouse/pointer-lock combat, GPU rendering, sound perception, 60 FPS performance and a full survival playthrough could not be certified there. UI menus and the explicit unsupported-graphics state were inspected. NullEngine tests validate geometry/game logic but do not replace GPU or human playtesting.

Before calling this release production-polished, verify the following on a hardware-accelerated desktop browser: pointer lock and focus loss, mouse feel and ADS alignment, all movement states and ramp traversal, full-auto/semi-auto inputs, near-wall muzzle behavior, audio levels, enemy pathing/attacks, all waves, pause/resume, defeat/victory/restart, and fullscreen at 16:9 and ultrawide resolutions.

## Extension points / next improvements

Replace procedural meshes with GLB containers returned by `AssetLoader.model()`, preserving hitboxes and weapon root/muzzle transforms. Add animation clips and recorded licensed sound assets. Tune combat pacing with human playtests. Add capsule sweeps/Havok if more complex stair/slope geometry is introduced. Broader maps, additional enemy behaviors, accessibility options and a reduced Babylon import graph are future improvements; this build has three arenas and three weapons.

## References and licenses

- [Babylon.js documentation](https://doc.babylonjs.com/) — rendering, collisions, raycasts and model loading; Apache-2.0.
- [Vite documentation](https://vite.dev/guide/) — development and static builds; MIT.
- [Pointer Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API).
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API).
- [Barlow / Fontsource](https://fontsource.org/fonts/barlow) and Barlow Condensed — bundled fonts, SIL Open Font License.

No commercial game models, maps, UI artwork or recordings are included.

## Difficulty selection

Select **쉬움 / 보통 / 어려움 / 악몽** above the start button. The choice is saved on this device, captured for the run, displayed in the HUD/results and retained by Restart. To change an active run's difficulty, exit to the main menu and start a new run. Practice is unaffected.

| Difficulty | Five wave counts     | Intermission | Health recovery | Magazine reserves added | Score multiplier |
| ---------- | -------------------- | ------------ | --------------- | ----------------------- | ---------------- |
| 쉬움       | 3 / 5 / 7 / 9 / 11   | 10 s         | +40             | 3 per weapon            | ×1               |
| 보통       | 4 / 6 / 8 / 10 / 12  | 8 s          | +25             | 3 per weapon            | ×1.25            |
| 어려움     | 5 / 7 / 10 / 13 / 15 | 6 s          | +10             | 2 per weapon            | ×1.75            |
| 악몽       | 6 / 9 / 12 / 15 / 18 | 4 s          | none            | 1 per weapon            | ×2.5             |

Health/reserves remain capped. Higher difficulty increases damage, accuracy, speed and burst pressure, shortens reaction time and introduces elites earlier. Normal is tougher than the original release. Accuracy is capped below perfect and reaction never drops below 220 ms. These are authored balance settings; live difficulty and performance at 18 enemies still require desktop playtesting.

## Arenas, redesigned weapons and melee

The start screen now has a persistent **전장 선택** control: **주조 공장 (Foundry)**, **화물 터미널 (Cargo Terminal)**, and **넥서스 연구소 (Nexus Lab)**. Each uses a distinct obstacle layout, lighting palette and sightlines. Both survival and practice use the chosen map. Exit to the menu to choose another map; switching disposes the previous map's meshes, lights, textures and shadow generator and rebuilds navigation. All four difficulty levels work with all maps.

The rifle and pistol now have independent stylized ceramic/titanium models and cyan/amber detailing. Switching disables the entire old model. The fictional **ARC-3 충격봉** is selected with **3** or the mouse wheel and attacks with left click. It has a 3.5-unit reach, 110 damage, no ammo or ADS, a short swing windup and at most one target per attack. Obstacles block it; switching away cancels pending swings. Robotic targets use sparks only.

Rendering hardening includes separated floor-marking heights to reduce depth fighting, alpha-tested signs with depth offset, conservative shadow depth/bias, exclusion of the ground from shadow casters, lowering/retracting the viewmodel near cover, ignoring disabled hitboxes, and guarding zero-length tracers. Automated coverage now includes all three maps' finite vertex/normal data, spawn connectivity, resource disposal, independent weapon models, melee range/occlusion and one-hit timing. These checks do not certify GPU rendering: the available remote browser still reports WebGL unsupported. Map menu interactions and button bounds were checked there; live 3D artifacts need a hardware-accelerated desktop playtest.

### 적 역할과 전투 기록
- 주황 돌격형: 빠르게 접근하여 가까운 거리에서 공격합니다.
- 파랑 방어형: 전방 방패(내구도 120)가 공격을 막습니다. 방패를 파괴하거나 노출된 머리·측면을 공격할 수 있습니다.
- 초록 지원형: 1.5초마다 8m 이내 시야가 확보된 아군 하나를 12 HP 수리합니다. 자기 자신, 파괴된 적, 벽 뒤 적은 수리하지 않습니다.
- 승리/패배 화면: 점수, 처치, 총기 명중률, 헤드샷 비율, 실제 받은 피해, 플레이 시간을 표시합니다. 일시정지는 시간에서 제외합니다.
- 명중률은 피해를 준 총탄 수 / 발사 수, 헤드샷 비율은 헤드샷 수 / 피해를 준 총탄 수입니다. 근접 공격과 방패 차단은 명중 수에서 제외합니다.
- 맵·난이도별 최고 점수와 승리한 판의 최단 클리어 시간을 이 브라우저에 저장합니다. 연습·중도 퇴장은 저장하지 않습니다. 저장소가 차단되면 결과 화면에서 알려줍니다.
- 자동 테스트는 Babylon NullEngine 기반입니다. 실제 GPU 렌더링과 조작감 검증을 대체하지 않습니다.

### 목표전
- 웨이브 1/5: 적 전멸. 웨이브 2: 원 안에서 12초 점령. 웨이브 3: 서로 다른 장치 두 곳에서 E를 각각 3초간 유지. 웨이브 4: 구역에서 20초 방어.
- 모든 목표 웨이브는 목표 완료와 적 전멸을 모두 요구합니다. 경합 시 목표 진행이 멈춥니다. 점령 진행은 보존되지만 방어는 이탈·경합 시 초당 2초 감소합니다. 장치 작동은 E 해제·사격·이탈 시 초기화됩니다.
- 목표 위치는 맵별 이동 가능한 경로에서 선택됩니다. HUD의 화살표·거리·진행률과 실제 전장의 빛나는 표식을 따라 이동합니다.
- 목표전은 이전 규칙의 기록과 별도(v4)로 저장합니다. 이전 기록 데이터는 삭제하지 않습니다.

- 웨이브 종료 후 기본 체력·탄약 보급과 휴식 뒤 자동 진행합니다. 업그레이드 선택·누적 강화는 제거했습니다.
- 사격 반동은 반복 가능한 좌우 패턴과 수직 누적을 사용합니다. 마지막 사격 0.18초 뒤 복귀하며, 0.32초 쉬면 연사 패턴이 초기화됩니다.


### 시작 무기와 코인 상점
- 시작 화면에서 P-12(12발, 균형형) 또는 P-6(6발, 고위력형)를 선택합니다. 전투는 피스톨과 충격봉만 가지고 시작합니다.
- 일반 적 처치 +100 코인, 정예 +150, 헤드샷 처치 +25 추가. 실제 결제는 없으며 코인·구매 내역은 새 판에서 초기화됩니다.
- 웨이브 사이 B 또는 일시정지 메뉴의 상점 버튼을 누릅니다. 상점 중에는 시간이 멈춥니다. 구매 후 돌아가기 버튼으로 재개합니다.
- S-24 SMG 300 / AR-7 소총 600 / R-20 중형 소총 850 / L-5 저격총 1000 코인. 보유 무기는 무료로 재장착하며 남은 탄약을 유지합니다.
- 1 주무기(구매 후), 2 피스톨, 3 근접. 미구매 주무기는 휠 순환에서도 건너뜁니다.
- 조준 표시는 고대비 원·중앙점이며 저격총은 별도 십자선과 32도 FOV를 사용합니다.
- 무기 역할 참고: https://playvalorant.com/en-us/arsenal/ . 이름·수치·메시·UI는 이 게임용으로 제작했습니다.

### 로봇 래그돌
- 12개 입자와 6개 강체 구간을 거리 관절로 연결한 위치 기반 동역학 솔버입니다. 60Hz 고정 스텝, 중력·감쇠·지형 충돌을 계산합니다.
- 지형 충돌은 확대된 월드 AABB 근사입니다. 복잡한 경사/모서리의 정밀 메시 충돌이나 잔해끼리의 충돌은 지원하지 않습니다.
- 2.5초 후 시뮬레이션을 정지하고 5초 후 정리합니다. 실제 GPU 화면에서의 시각 품질은 별도 확인이 필요합니다.


## Facility art direction refresh

- `src/visual/GameTheme.ts`: shared charcoal/concrete, steel blue and amber palette; PBR surface cache; restrained exposure, fog and bloom.
- `src/visual/EnvironmentDetails.ts`: three existing arenas retain colliders and navigation. Wall service panels, vents, overhead trusses, entry frame, relay antenna, cover trim, floor markings and signs form a training facility. Static dressing is merged into six material batches and excluded from picking, collision and shadow casting.
- Entry and relay fill lights switch off on Low. Existing 1024px selective shadows and quality settings remain. No external textures or model downloads added.
- Menu separates identity from loadout. HUD uses a shared palette, smaller reserve count, subtle panels and independent short elimination feedback, so kills no longer replace wave messages.
- Weapon surfaces distinguish matte polymer from metal. Shorter/smaller muzzle flash, thinner short-lived tracers, different pooled wall/robot impacts, and pooled arrival rings keep feedback restrained.
- Robots retain their role shapes, hitboxes, combat and shutdown ragdolls. Muted armor and red/amber status lights communicate hostility; alert brightness and blue repair cues communicate state.

Validation: production build and 37 automated tests pass, including geometry/navigation/disposal for every map, weapon switching, recoil, ammunition, objectives, difficulty, roles, ragdolls and effect-pool reuse. Browser menu/settings/controls and settings persistence were checked. The available QA browser has no WebGL: rendered 3D appearance, full pointer-lock gameplay, GPU artifacts and FPS are **not verified**. Check these in hardware-accelerated desktop Chrome/Edge before treating the visual/performance pass as fully playtested. Existing large Babylon bundle warning remains.


## Weapon feedback pass

WeaponMotion owns separate pose, sway, bob and recoil transform nodes. Visual recoil has a bounded shot impulse, short hold and quick recovery; camera recoil/damage/spread data stay unchanged. Sprint pose eases, ADS suppresses sway/bob, and landing adds a small visual offset. Switching and restarting clear motion and flash. The fictional rifle adds a matte receiver, rubber pad/grip detail, rail and inset accent while retaining its existing silhouette and optics. A single weapon-only muzzle light is reused on High; Low/Medium keep the small flash without this light. Hit flash now starts immediately on damage, critical/kill markers differ, and empty/reload ammo feedback uses existing timing.

39 automated tests pass (including motion bounds/recovery/reset, stable resource counts, existing combat, maps, roles and objectives). Production build passes. No SSAO/SSR or Ultra preset was enabled without GPU performance evidence. The QA browser still lacks WebGL, so 3D visual quality, pointer-lock gameplay and FPS remain unverified on real GPU hardware.
