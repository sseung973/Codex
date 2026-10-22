using System;
using System.Collections.Generic;
using UnityEngine;

namespace RelayZero
{
    public class RelayGame : MonoBehaviour
    {
        public static RelayGame Instance;
        public GameSettings Settings;
        public ArenaData Arena;
        public GridNavigation Navigation;
        public FirstPerson Player;
        public Arsenal Guns;
        public TacticalUI UI;
        public GameAudio Audio;
        public Effects Fx;
        public OnlineSession Online;
        public readonly List<Bot> Bots = new List<Bot>();
        public readonly WaveDirector Waves = new WaveDirector();
        public readonly Mission Mission = new Mission();
        public DifficultySpec Difficulty;
        public bool Started, Paused, Finished, Practice, Shopping, Won;
        public int Coins, Score, Kills, Shots, Hits, Heads;
        public float Elapsed, DamageTaken;
        public string MapId = "foundry", Pistol = "p12", ResultDetail = "";
        public GameObject World;
        public LineRenderer ObjectiveRing;
        readonly List<EMPProjectile> grenades = new List<EMPProjectile>();
        readonly Queue<Blast> blasts = new Queue<Blast>();
        int pendingDeaths;
        float damageCooldown, empCooldown, hudClock, frameWindow, frameSum;
        int frameCount, healthy, actualQuality = 1;
        public int EMP = 2;
        struct Blast
        {
            public Vector3 Point;
            public float Radius, Damage, PlayerDamage;
            public int Shooter;
        }

        public bool Controls
        {
            get
            {
                return Started && !Finished && !Paused && !Shopping && Cursor.lockState == CursorLockMode.Locked && Player.Health > 0 && (!Online.Active || Online.Begun);
            }
        }

        public int LocalIndex
        {
            get
            {
                return Online.Active ? Online.Self : 0;
            }
        }

        public bool HasMission
        {
            get
            {
                return Started && !Practice && !Online.Active && !Mission.Done;
            }
        }

        public Vector3 MissionPoint
        {
            get
            {
                return Data.V(Arena.mission[Mission.Kind == "defend" ? 1 : Mission.Stage].p);
            }
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Bootstrap()
        {
            if (!FindObjectOfType<RelayGame>())
                new GameObject("RELAY ZERO / Native Unity").AddComponent<RelayGame>();
        }

        void Awake()
        {
            Instance = this;
            Data.Load();
            Settings = JsonUtility.FromJson<GameSettings>(PlayerPrefs.GetString("relay-unity-settings", JsonUtility.ToJson(new GameSettings())));
            Difficulty = Data.Balance.difficulties[Mathf.Clamp(PlayerPrefs.GetInt("relay-difficulty", 1), 0, 3)];
            MapId = PlayerPrefs.GetString("relay-map", "foundry");
            if (MapId != "foundry" && MapId != "cargo" && MapId != "nexus")
                MapId = "foundry";
            Application.runInBackground = true;
            Application.targetFrameRate = 144;
            QualitySettings.vSyncCount = 0;
            Time.fixedDeltaTime = 1f / 60;
            Physics.IgnoreLayerCollision(Geometry.TargetLayer, Geometry.PlayerLayer);
            Physics.IgnoreLayerCollision(Geometry.TargetLayer, Geometry.BotLayer);
            Physics.IgnoreLayerCollision(Geometry.BotLayer, Geometry.BotLayer);
            Player = new GameObject("Operator").AddComponent<FirstPerson>();
            Player.Create();
            Fx = new Effects();
            Audio = new GameAudio(this);
            Online = new OnlineSession(this);
            Guns = new Arsenal(this);
            UI = new TacticalUI(this);
            Waves.Spawn = SpawnBatch;
            Waves.Cleared = WaveCleared;
            Waves.Victory = () => Finish(true);
            LoadArena(MapId);
            Menu();
        }

        public void LoadArena(string id)
        {
            ClearBots();
            if (World)
            {
                World.SetActive(false);
                Destroy(World);
            }

            foreach (var l in FindObjectsOfType<Light>())
                Destroy(l.gameObject);
            MapId = id;
            Arena = Data.Read<ArenaData>(id);
            World = Geometry.Arena(id);
            Player.Camera.backgroundColor = Data.ColorOf(Arena.clear);
            Player.Camera.clearFlags = CameraClearFlags.SolidColor;
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogColor = Player.Camera.backgroundColor;
            RenderSettings.fogDensity = id == "cargo" ? .003f : id == "nexus" ? .004f : .009f;
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(.63f, .7f, .76f) * (id == "cargo" ? 1.05f : id == "nexus" ? .95f : .8f);
            RenderSettings.ambientEquatorColor = new Color(.38f, .43f, .47f);
            RenderSettings.ambientGroundColor = new Color(.12f, .15f, .16f);
            foreach (var source in Arena.lights)
            {
                if (source.type == 3)
                    continue;
                var l = new GameObject("Arena light").AddComponent<Light>();
                l.transform.SetParent(World.transform, false);
                l.color = Data.C(source.color);
                l.intensity = source.intensity;
                if (source.type == 1)
                {
                    l.type = LightType.Directional;
                    l.transform.rotation = Quaternion.LookRotation(Data.V(source.direction));
                    l.shadows = LightShadows.None;
                }
                else
                {
                    l.type = LightType.Point;
                    l.transform.position = Data.V(source.p);
                    l.range = Mathf.Min(source.range, 20);
                }
            }

            foreach (var s in Arena.signs)
            {
                var go = new GameObject("Sign / " + s.text);
                go.transform.SetParent(World.transform, false);
                go.transform.position = Data.V(s.p);
                go.transform.rotation = Quaternion.Euler(s.ground ? 90 : 0, s.yaw * Mathf.Rad2Deg, 0);
                go.AddComponent<WorldSign>().Configure(s);
            }

            Navigation = new GridNavigation();
            if (ObjectiveRing)
                Destroy(ObjectiveRing.gameObject);
            ObjectiveRing = Fx.MakeRing(World.transform, 3, Data.ColorOf("#87efd1"));
            ObjectiveRing.gameObject.SetActive(false);
            UI.ConfigureMap(Arena);
            ApplySettings();
            PlayerPrefs.SetString("relay-map", id);
        }

        public void Menu()
        {
            if (Online.Active || Online.Connected)
                Online.Leave();
            Started = Finished = Paused = Shopping = Practice = false;
            ClearBots();
            ResetEquipment();
            Elapsed = 0;
            Guns.View.gameObject.SetActive(false);
            Player.Body.enabled = false;
            Player.transform.position = Vector3.zero;
            Player.Camera.transform.position = new Vector3(10, 5.4f, -15);
            Player.Camera.transform.LookAt(new Vector3(-1, 2.2f, 7));
            Player.Camera.fieldOfView = Settings.fov;
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
            ObjectiveRing.gameObject.SetActive(false);
            UI.Show("menu");
        }

        public void StartRun(bool practice = false)
        {
            ClearBots();
            Started = true;
            Finished = Shopping = Paused = false;
            Practice = practice;
            Won = false;
            Coins = Score = Kills = Shots = Hits = Heads = 0;
            Elapsed = DamageTaken = 0;
            pendingDeaths = 0;
            blasts.Clear();
            EMP = 2;
            damageCooldown = empCooldown = 0;
            ResetEquipment();
            Player.ResetAt(Data.V(Arena.spawn));
            Guns.Start(Pistol, practice);
            Guns.View.gameObject.SetActive(true);
            Mission.Reset(1);
            Waves.Reset(Difficulty.waves, Difficulty.rest);
            if (practice)
            {
                int i = 0;
                foreach (var p in new[]
                {
                    new Vector3(0, 0, -9),
                    new Vector3(-5, 0, -3),
                    new Vector3(5, 0, 1)
                }

                )
                    CreateBot("target-" + i++, "assault", Navigation.Spawn(p, Player.Feet, Bots), 1, false, false, true);
            }

            Resume();
            UI.Toast(practice ? "FIRING RANGE · 무기 1/2/3 · 탄약 자동 보충" : "RELAY ONLINE · 첫 웨이브 3초");
        }

        public void Resume()
        {
            Paused = Shopping = false;
            Guns.SuppressTrigger();
            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = false;
            UI.Show("playing");
        }

        public void Pause()
        {
            if (!Started || Finished)
                return;
            Paused = true;
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
            UI.Show("pause");
        }

        public void OpenShop()
        {
            if (!Started || Finished || Practice || Online.Active || Waves.Wait <= 0)
            {
                UI.Toast("상점은 웨이브 사이에 열 수 있어");
                return;
            }

            Shopping = true;
            Paused = false;
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
            UI.Show("shop");
        }

        public void Buy(string id)
        {
            var s = Data.Weapon(id);
            if (!Guns.Inventory.ContainsKey(id))
            {
                if (Coins < s.price)
                    return;
                Coins -= s.price;
            }

            Guns.Equip(id);
            UI.RefreshShop();
        }

        public void Upgrade(string id)
        {
            if (Guns.Melee)
            {
                UI.Toast("총기를 선택한 뒤 부착물을 구매해줘");
                return;
            }

            int price = id == "stabilizer" ? 250 : 200;
            if (Coins < price)
                return;
            if (Guns.Current.Upgrade(id))
            {
                Coins -= price;
                UI.RefreshShop();
            }
        }

        public void BuyEMP()
        {
            if (Coins >= 100 && EMP < 3)
            {
                Coins -= 100;
                EMP++;
                UI.RefreshShop();
            }
        }

        public void ContinueEndless()
        {
            if (!Waves.Continue())
                return;
            Finished = false;
            Won = false;
            Score = Kills = Shots = Hits = Heads = 0;
            Elapsed = DamageTaken = 0;
            blasts.Clear();
            ResetEquipment();
            Guns.View.gameObject.SetActive(true);
            Resume();
        }

        public void Finish(bool won, string detail = "")
        {
            if (Finished)
                return;
            Finished = true;
            Won = won;
            ResultDetail = detail;
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
            Guns.View.gameObject.SetActive(false);
            ObjectiveRing.gameObject.SetActive(false);
            if (!Online.Active && !Practice)
            {
                string key = "relay-record:" + MapId + ":" + Difficulty.id + (Waves.Endless ? ":endless" : "");
                PlayerPrefs.SetInt(key, Mathf.Max(Score, PlayerPrefs.GetInt(key)));
                if (won && !Waves.Endless)
                    PlayerPrefs.SetFloat(key + ":time", Mathf.Min(Elapsed, PlayerPrefs.GetFloat(key + ":time", float.MaxValue)));
                PlayerPrefs.Save();
            }

            UI.Show("result");
        }

        void Update()
        {
            Online.Pump();
            float dt = Mathf.Min(Time.unscaledDeltaTime, .05f);
            if (Input.GetKeyDown(KeyCode.Escape) && Started && !Finished)
            {
                if (Shopping || Paused)
                    Resume();
                else
                    Pause();
            }

            if (Cursor.lockState != CursorLockMode.Locked && Started && !Paused && !Shopping && !Finished)
                Pause();
            if (Started && !Finished)
            {
                if (Online.Active)
                    Online.Tick(dt);
                else if (!Paused && !Shopping)
                {
                    Elapsed += dt;
                    damageCooldown = Mathf.Max(0, damageCooldown - dt);
                    Player.Tick(dt, this, Controls);
                    Guns.Tick(dt, Controls);
                    if (Controls && Input.GetKeyDown(KeyCode.B))
                        OpenShop();
                    if (Controls && Input.GetKeyDown(KeyCode.G) && EMP > 0 && empCooldown <= 0)
                    {
                        EMP--;
                        empCooldown = .6f;
                        grenades.Add(new EMPProjectile(this, Player.Eye, Player.Camera.transform.forward));
                    }

                    empCooldown = Mathf.Max(0, empCooldown - dt);
                    for (int i = grenades.Count - 1; i >= 0; i--)
                        if (grenades[i].Tick(dt))
                            grenades.RemoveAt(i);
                    foreach (var bot in Bots)
                        bot.Tick(dt);
                    ResolveBlasts();
                    if (!Practice && !Finished)
                    {
                        UpdateObjective(dt);
                        Waves.Tick(dt);
                    }
                    else if (Practice)
                    {
                        Guns.FullAmmo();
                    }
                }
            }

            Fx.Tick(dt);
            UI.Tick(dt);
            hudClock += dt;
            if (hudClock >= .05f)
            {
                hudClock = 0;
                UI.Paint();
            }

            SampleGraphics(Time.unscaledDeltaTime);
        }

        void UpdateObjective(float dt)
        {
            if (!HasMission)
            {
                ObjectiveRing.gameObject.SetActive(false);
                return;
            }

            var p = MissionPoint;
            bool inside = (Player.Feet - p).sqrMagnitude <= Mission.Radius * Mission.Radius && Geometry.Clear(Player.Eye, p + Vector3.up * .5f);
            bool contested = false;
            foreach (var b in Bots)
                if (b.Alive && (b.transform.position - p).sqrMagnitude < Mission.Radius * Mission.Radius)
                {
                    contested = true;
                    break;
                }

            bool interact = Player.Grounded && Input.GetKey(KeyCode.E) && !Input.GetMouseButton(0);
            if (Mission.Tick(dt, inside, contested, interact))
            {
                Waves.FinishObjective();
                UI.Toast("목표 완료 · 남은 적을 처치해");
            }

            ObjectiveRing.gameObject.SetActive(!Mission.Done);
            ObjectiveRing.transform.position = MissionPoint;
            ObjectiveRing.transform.localScale = Vector3.one * (Mission.Radius / 3);
            ObjectiveRing.startColor = ObjectiveRing.endColor = contested ? new Color(1, .4f, .15f) : new Color(.25f, .9f, .7f);
        }

        void SpawnBatch(int wave, int count, int offset)
        {
            if (offset == 0)
            {
                ClearBots();
                Mission.Reset(wave);
                Waves.ObjectiveDone = Mission.Done;
                UI.Toast("WAVE " + wave + " · " + Waves.Total + " HOSTILES");
                Audio.Play("alert");
            }

            for (int i = offset; i < offset + count; i++)
            {
                var preferred = Data.V(Arena.spawns[(i + (offset > 0 ? wave * 2 : 0)) % Arena.spawns.Length].p);
                var p = Navigation.Spawn(preferred, Player.Feet, Bots);
                bool elite = wave >= Difficulty.eliteFrom && i < Difficulty.eliteCount + wave - Difficulty.eliteFrom;
                string role = wave >= 2 && i % 7 == 3 ? "bomber" : wave >= 3 && i % 7 == 4 ? "sniper" : new[]
                {
                    "assault",
                    "defender",
                    "support",
                    "assault"
                }[i % 4];
                bool boss = (wave == 5 || Waves.Endless && wave % 5 == 0) && i == Waves.Total - 1;
                CreateBot("w" + wave + "-" + i, role, p, wave, elite, boss);
            }
        }

        public Bot CreateBot(string id, string role, Vector3 p, int wave, bool elite = false, bool boss = false, bool practice = false)
        {
            var bot = new GameObject(id).AddComponent<Bot>();
            bot.Create(this, id, role, p, wave, elite, boss, practice);
            Bots.Add(bot);
            return bot;
        }

        public void ClearBots()
        {
            foreach (var b in Bots)
                if (b)
                {
                    b.gameObject.SetActive(false);
                    Destroy(b.gameObject);
                }

            Bots.Clear();
        }

        void WaveCleared()
        {
            Player.Health = Mathf.Min(100, Player.Health + Difficulty.recovery);
            Guns.Resupply(Difficulty.resupplyMagazines);
            UI.Toast("웨이브 완료 · B 무기 상점");
        }

        public void Hear(Vector3 p, float radius)
        {
            foreach (var b in Bots)
                b.Hear(p, radius);
        }

        public Vector3 TargetFeet(int index)
        {
            return Online.Active && index != Online.Self ? Data.V(Online.Remote.p) : Player.Feet;
        }

        public Vector3 TargetEye(int index)
        {
            return Online.Active && index != Online.Self ? TargetFeet(index) + Vector3.up * (Online.Remote.crouch ? 1.15f : 1.65f) : Player.Eye;
        }

        public bool TargetAlive(int index)
        {
            return Online.Active ? Online.HP[index] > 0 : Player.Health > 0;
        }

        public void Hurt(int index, float amount, Vector3 origin)
        {
            if (Online.Active)
            {
                Online.Damage(index, amount, origin);
                return;
            }

            if (Finished || Practice || Player.Health <= 0 || damageCooldown > 0)
                return;
            damageCooldown = .12f;
            float loss = Mathf.Min(Player.Health, Mathf.Max(0, amount));
            Player.Health -= loss;
            DamageTaken += loss;
            UI.Damage(origin, loss);
            if (Player.Health <= 0)
                Finish(false);
        }

        public void EnemyPulse(Bot b, Vector3 p, float radius, float damage)
        {
            Fx.Pulse(p, radius, new Color(1, .4f, .2f));
            if ((TargetFeet(b.TargetIndex) - p).sqrMagnitude <= radius * radius && Geometry.Clear(b.Eye, TargetEye(b.TargetIndex)))
                Hurt(b.TargetIndex, damage, b.transform.position);
        }

        public void Tracer(Vector3 a, Vector3 b)
        {
            Fx.Tracer(a, b);
            if (Online.Active && Online.Host)
                Online.SendTracer(a, b);
        }

        public void Shoot(Vector3 origin, Vector3 direction, WeaponSpec w, bool melee, int shooter)
        {
            Physics.SyncTransforms();
            RaycastHit best = new RaycastHit();
            HitZone zone = null;
            bool hit = false;
            float distance = w.range;
            float[] fan = melee ? new[]
            {
                0f,
                -.18f,
                .18f,
                -.36f,
                .36f,
                -.55f,
                .55f,
                -.7f,
                .7f
            }

            : new[]
            {
                0f
            };
            Vector3 right = Vector3.Cross(Vector3.up, direction).normalized;
            foreach (float offset in fan)
            {
                var d = (direction + right * offset).normalized;
                if (Physics.Raycast(origin, d, out var test, w.range, Geometry.ShotMask, QueryTriggerInteraction.Collide))
                {
                    var z = test.collider.GetComponent<HitZone>();
                    if (!melee && (!hit || test.distance < distance) || melee && z && test.distance < distance)
                    {
                        best = test;
                        zone = z;
                        hit = true;
                        distance = test.distance;
                    }
                }
            }

            Vector3 impact = hit ? best.point : origin + direction * w.range;
            if (!melee)
                Tracer(origin, impact);
            if (zone)
            {
                if (zone.Bot)
                {
                    bool head = !melee && zone.Head;
                    bool shield = zone.Shield && zone.Bot.Shield > 0;
                    bool killed = zone.Bot.Hit(w.damage * (head ? w.headshotMultiplier : 1), head, shield, zone.Weak, shooter, !melee);
                    if (!shield)
                    {
                        if (!melee)
                        {
                            Hits++;
                            if (head)
                                Heads++;
                        }

                        if (Online.Active)
                            Online.Confirm(shooter, head, killed);
                        else
                        {
                            UI.Hit(head, killed);
                            Audio.Play(head ? "headshot" : "hit");
                        }
                    }
                }
            }
        }

        public void BotKilled(Bot bot, bool head, int shooter)
        {
            if (Practice)
            {
                Kills++;
                return;
            }

            if (Online.Active)
            {
                if (shooter >= 0)
                    Online.Scores[shooter]++;
                return;
            }

            if (shooter >= 0)
            {
                Kills++;
                Coins += (bot.Elite ? 150 : 100) + (head ? 25 : 0);
                int points = Mathf.RoundToInt((head ? 150 : 100) * Difficulty.scoreMultiplier);
                Score += points;
                UI.Toast((bot.Commander ? "COMMAND UNIT" : "SENTINEL") + " OFFLINE +" + points, 1.2f);
            }

            pendingDeaths++;
            if (bot.Role == "bomber")
                blasts.Enqueue(new Blast { Point = bot.transform.position + Vector3.up * .9f, Radius = 4.2f, Damage = 110, PlayerDamage = 28 * Difficulty.damage, Shooter = shooter });
        }

        void ResolveBlasts()
        {
            int budget = 100;
            while (blasts.Count > 0 && budget-- > 0)
            {
                var blast = blasts.Dequeue();
                Fx.Pulse(blast.Point, blast.Radius, new Color(1, .7f, .3f));
                if ((Player.Eye - blast.Point).sqrMagnitude <= blast.Radius * blast.Radius && Geometry.Clear(blast.Point, Player.Eye))
                    Hurt(0, blast.PlayerDamage, blast.Point);
                foreach (var b in Bots)
                    if (b.Alive && (b.Eye - blast.Point).sqrMagnitude <= blast.Radius * blast.Radius && Geometry.Clear(blast.Point, b.Eye))
                        b.Hit(blast.Damage, false, false, false, blast.Shooter, false);
            }

            int deaths = pendingDeaths;
            pendingDeaths = 0;
            if (!Finished)
                for (int i = 0; i < deaths; i++)
                    Waves.Kill();
        }

        void ResetEquipment()
        {
            Fx.Clear();
            UI.ResetFeedback();
            foreach (var p in grenades)
                p.Destroy();
            grenades.Clear();
            EMP = 2;
            Navigation?.Rebuild();
        }

        public void SaveSettings()
        {
            Settings.sensitivity = Mathf.Clamp(Settings.sensitivity, .15f, 3);
            Settings.fov = Mathf.Clamp(Settings.fov, 70, 110);
            PlayerPrefs.SetString("relay-unity-settings", JsonUtility.ToJson(Settings));
            PlayerPrefs.Save();
            ApplySettings();
        }

        public void ApplySettings()
        {
            actualQuality = Settings.quality;
            healthy = 0;
            ApplyGraphics();
        }

        void ApplyGraphics()
        {
            QualitySettings.antiAliasing = actualQuality == 0 ? 2 : 4;
            QualitySettings.shadows = actualQuality == 2 ? ShadowQuality.All : ShadowQuality.Disable;
            QualitySettings.shadowDistance = 45;
            QualitySettings.shadowResolution = ShadowResolution.Medium;
            QualitySettings.pixelLightCount = actualQuality == 2 ? 4 : 1;
            foreach (var l in FindObjectsOfType<Light>())
            {
                if (l.type == LightType.Point)
                    l.enabled = actualQuality == 2;
                if (l.type == LightType.Directional)
                    l.shadows = actualQuality == 2 ? LightShadows.Soft : LightShadows.None;
            }
        }

        void SampleGraphics(float dt)
        {
            if (!Settings.autoGraphics || !Started || Paused || Finished || dt > 2)
                return;
            frameWindow += dt;
            frameSum += Mathf.Min(dt, .25f);
            frameCount++;
            if (frameWindow < 2 || frameCount < 8)
                return;
            float average = frameSum / frameCount;
            frameWindow = frameSum = frameCount = 0;
            if (average > .023f)
            {
                healthy = 0;
                if (actualQuality > 0)
                {
                    actualQuality--;
                    ApplyGraphics();
                }
            }
            else if (average < .018f && ++healthy >= 5)
            {
                healthy = 0;
                if (actualQuality < Settings.quality)
                {
                    actualQuality++;
                    ApplyGraphics();
                }
            }
        }

        void OnApplicationQuit()
        {
            Online?.Leave();
            PlayerPrefs.Save();
            Geometry.ClearCache();
        }

        void OnDestroy()
        {
            if (Instance == this)
            {
                Online?.Leave();
                Instance = null;
            }
        }
    }

    public class EMPProjectile
    {
        readonly RelayGame game;
        GameObject mesh;
        Vector3 velocity;
        float fuse = 1.1f;
        public EMPProjectile(RelayGame g, Vector3 origin, Vector3 direction)
        {
            game = g;
            mesh = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            mesh.name = "EMP grenade";
            mesh.transform.position = origin;
            mesh.transform.localScale = Vector3.one * .18f;
            UnityEngine.Object.Destroy(mesh.GetComponent<Collider>());
            var mat = new Material(Resources.Load<Shader>("RelayUnlit"));
            mat.color = new Color(.5f, .8f, 1);
            mesh.GetComponent<Renderer>().material = mat;
            velocity = direction.normalized * 15 + Vector3.up * 3;
        }

        public bool Tick(float dt)
        {
            for (int i = 0; i < 4; i++)
            {
                velocity.y -= 10 * dt / 4;
                Vector3 delta = velocity * dt / 4;
                if (Physics.SphereCast(mesh.transform.position, .09f, delta.normalized, out var hit, delta.magnitude, Geometry.WorldMask, QueryTriggerInteraction.Ignore))
                {
                    mesh.transform.position = hit.point + hit.normal * .12f;
                    velocity = Vector3.Reflect(velocity, hit.normal) * .65f;
                }
                else
                    mesh.transform.position += delta;
            }

            fuse -= dt;
            if (fuse > 0)
                return false;
            Vector3 p = mesh.transform.position;
            foreach (var b in game.Bots)
                if (b.Alive && (b.Eye - p).sqrMagnitude <= 36 && Geometry.Clear(p, b.Eye))
                    b.Disable(3);
            game.Fx.Pulse(p, 6, new Color(.5f, .85f, 1));
            Destroy();
            return true;
        }

        public void Destroy()
        {
            if (mesh)
            {
                UnityEngine.Object.Destroy(mesh.GetComponent<Renderer>().material);
                UnityEngine.Object.Destroy(mesh);
            }
        }
    }
}
