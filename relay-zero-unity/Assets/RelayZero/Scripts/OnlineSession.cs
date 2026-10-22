using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace RelayZero
{
    [Serializable]
    public class NetPlayer
    {
        public string role;
        public bool ready;
    }

    [Serializable]
    public class NetBot
    {
        public string id, role;
        public float[] p;
        public float y, hp, max, shield, animation;
        public bool elite;
    }

    [Serializable]
    public class NetState
    {
        public float[] hp, respawn, protect;
        public int[] scores, epochs;
        public int wave, pending;
        public float wait, revive, time;
        public NetBot[] enemies;
    }

    [Serializable]
    public class NetMessage
    {
        public string type, mode, map, code, role, message, @event, detail, weapon, from;
        public bool value, crouch, revive, head, kill, won;
        public int seq;
        public long time;
        public float[] p, o, d, origin, a, b;
        public float y, pitch, amount;
        public NetPlayer[] players;
        public NetState state;
    }

    [Serializable]
    public class Pose
    {
        public float[] p =
        {
            0,
            0,
            18
        };
        public float y = Mathf.PI, pitch;
        public bool crouch, revive;
    }

    public class OnlineSession
    {
        public const string DefaultURL = "wss://relay-zero-rooms.onrender.com/rooms";
        readonly RelayGame game;
        readonly RoomSocket client = new RoomSocket();
        public bool Active, Begun, Ended, Ready;
        public bool Host = true;
        public int Self
        {
            get
            {
                return Host ? 0 : 1;
            }
        }

        public bool Connected
        {
            get
            {
                return client.Connected;
            }
        }

        public string Mode = "duel", Code = "", Status = "방을 만들거나 10자리 코드로 입장해줘.", Roster = "", ServerURL = DefaultURL;
        public Pose Remote = new Pose();
        public float[] HP =
        {
            100,
            100
        }, Respawn =
        {
            0,
            0
        }, Protect =
        {
            0,
            0
        };
        public int[] Scores =
        {
            0,
            0
        }, Epochs =
        {
            0,
            0
        };
        public int Wave, Pending;
        public float Wait = 3, Revive, Clock;
        public int Ping;
        GameObject avatar;
        Vector3 avatarTarget;
        float heartbeat, networkClock, lastMessage;
        int sequence, localEpoch, serial;
        ShotGate[] gates =
        {
            new ShotGate(),
            new ShotGate()
        };
        readonly Dictionary<string, Bot> replicas = new Dictionary<string, Bot>();
        string lastPose = "";
        float lastPoseTime;
        public string Hint
        {
            get
            {
                int other = 1 - Self;
                if (HP[Self] <= 0)
                    return Mode == "duel" ? Mathf.CeilToInt(Respawn[Self]) + "초 후 재투입" : "쓰러졌어 · 친구가 E로 소생할 수 있어";
                if (HP[other] <= 0 && Mode == "coop")
                    return "친구 근처에서 E 2초 · " + Mathf.FloorToInt(Revive / 2 * 100) + "%";
                return Protect[Self] > 0 ? "재투입 보호 중" : "";
            }
        }

        public OnlineSession(RelayGame owner)
        {
            game = owner;
            ServerURL = PlayerPrefs.GetString("relay-rooms-url", DefaultURL);
        }

        public void Create(string mode)
        {
            Leave();
            Mode = mode;
            Status = "Render 서버에 연결 중… 첫 연결은 약 1분 걸릴 수 있어.";
            client.Connect(ServerURL, JsonUtility.ToJson(new NetMessage { type = "create", mode = mode, map = game.MapId }));
            lastMessage = Time.realtimeSinceStartup;
        }

        public void Join(string code)
        {
            Leave();
            code = code.Trim().ToUpperInvariant();
            if (code.Length != 10)
            {
                Status = "10자리 방 코드를 입력해줘.";
                return;
            }

            foreach (char c in code)
                if (!Uri.IsHexDigit(c))
                {
                    Status = "방 코드는 0–9, A–F 10자리야.";
                    return;
                }

            Status = "방에 연결 중…";
            client.Connect(ServerURL, JsonUtility.ToJson(new NetMessage { type = "join", code = code }));
            lastMessage = Time.realtimeSinceStartup;
        }

        public void SetReady()
        {
            Ready = !Ready;
            Send(new NetMessage { type = "ready", value = Ready });
        }

        public void Send(NetMessage m)
        {
            client.Send(JsonUtility.ToJson(m));
        }

        public void Pump()
        {
            while (client.Messages.TryDequeue(out var json))
            {
                try
                {
                    var m = JsonUtility.FromJson<NetMessage>(json);
                    if (m != null)
                        Message(m);
                }
                catch (Exception e)
                {
                    Status = "서버 응답 오류: " + e.Message;
                }
            }

            if (Connected)
            {
                heartbeat += Time.unscaledDeltaTime;
                if (heartbeat >= 5)
                {
                    heartbeat = 0;
                    Send(new NetMessage { type = "ping", time = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() });
                }

                if (Active && Begun && !Ended && Time.realtimeSinceStartup - lastMessage > 20)
                {
                    game.Finish(false, "친구의 응답이 없어 경기를 종료했어.");
                    Ended = true;
                    client.Close();
                }
            }
        }

        void Message(NetMessage m)
        {
            lastMessage = Time.realtimeSinceStartup;
            switch (m.type)
            {
                case "pong":
                    Ping = (int)Math.Max(0, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - m.time);
                    break;
                case "joined":
                    Host = m.role == "host";
                    break;
                case "error":
                    Status = m.message;
                    break;
                case "room":
                    Code = m.code;
                    Mode = m.mode;
                    Roster = "";
                    if (game.MapId != m.map)
                        game.LoadArena(m.map);
                    if (m.players != null)
                        foreach (var p in m.players)
                            Roster += (p.role == (Host ? "host" : "guest") ? "나" : "친구") + " · " + (p.ready ? "준비 완료" : "준비 중") + "   ";
                    Status = "둘 다 준비하면 시작해 · " + game.Arena.name;
                    game.UI.RefreshLobby();
                    break;
                case "start":
                    Start(m.mode, m.map);
                    break;
                case "begin":
                    Begun = true;
                    Protect = new[]
                    {
                        2f,
                        2f
                    };
                    game.UI.Toast("연결 완료 · 전투 시작");
                    break;
                case "closed":
                    Status = m.message;
                    Code = "";
                    if (Active && !Ended)
                    {
                        Ended = true;
                        game.Finish(false, m.message);
                    }

                    client.Close();
                    game.UI.RefreshLobby();
                    break;
                case "pose":
                    if (Active && CombatRules.FiniteVector(m.p))
                    {
                        Remote = new Pose
                        {
                            p = m.p,
                            y = m.y,
                            pitch = m.pitch,
                            crouch = m.crouch,
                            revive = m.revive
                        };
                        avatarTarget = Data.V(m.p);
                    }

                    break;
                case "shot":
                    if (Host && Active && !Ended)
                        HostShot(1, m);
                    break;
                case "state":
                    if (!Host && Active && !Ended)
                        Apply(m.state);
                    break;
                case "event":
                    if (!Host && Active && !Ended)
                    {
                        if (m.@event == "end")
                        {
                            Ended = true;
                            game.Finish(m.won, m.detail);
                        }
                        else if (m.@event == "hit")
                        {
                            game.UI.Hit(m.head, m.kill);
                            game.Audio.Play(m.head ? "headshot" : "hit");
                        }
                        else if (m.@event == "damage" && CombatRules.FiniteVector(m.origin))
                            game.UI.Damage(Data.V(m.origin), m.amount);
                        else if (m.@event == "tracer" && CombatRules.FiniteVector(m.a) && CombatRules.FiniteVector(m.b))
                            game.Fx.Tracer(Data.V(m.a), Data.V(m.b));
                    }

                    break;
            }
        }

        void Start(string mode, string map)
        {
            if (game.MapId != map)
                game.LoadArena(map);
            game.ClearBots();
            Active = true;
            Begun = Ended = false;
            Mode = mode;
            HP = new[]
            {
                100f,
                100f
            };
            Scores = new[]
            {
                0,
                0
            };
            Respawn = new float[2];
            Epochs = new int[2];
            Protect = new[]
            {
                2f,
                2f
            };
            Clock = 0;
            Wave = Pending = serial = sequence = localEpoch = 0;
            Wait = 3;
            Revive = networkClock = 0;
            gates = new[]
            {
                new ShotGate(),
                new ShotGate()
            };
            replicas.Clear();
            game.Started = true;
            game.Finished = game.Practice = game.Paused = game.Shopping = false;
            game.Score = game.Kills = game.Shots = game.Hits = game.Heads = 0;
            game.Elapsed = 0;
            ResetLocal();
            Remote = new Pose
            {
                p = Data.A(Spawn(1 - Self)),
                y = Self == 0 ? Mathf.PI : 0
            };
            avatar = Geometry.Model(Mode == "coop" ? "operative-friendly" : "operative-rival", null);
            avatar.transform.position = avatarTarget = Data.V(Remote.p);
            game.Guns.View.gameObject.SetActive(true);
            game.Resume();
            Send(new NetMessage { type = "loaded" });
        }

        Vector3 Spawn(int i)
        {
            return new Vector3(i == 0 ? -2 : 2, 0, i == 0 ? -17 : 18);
        }

        void ResetLocal()
        {
            game.Player.ResetAt(Spawn(Self), Self == 1 ? 180 : 0);
            game.Guns.Start("p12", true);
            localEpoch = Epochs[Self];
        }

        public void Fire(Vector3 o, Vector3 d, WeaponSpec w)
        {
            if (!Begun || Ended || HP[Self] <= 0 || Protect[Self] > 0)
                return;
            var m = new NetMessage
            {
                type = "shot",
                o = Data.A(o),
                d = new[]
                {
                    d.x,
                    d.y,
                    d.z
                },
                weapon = w.id,
                seq = ++sequence
            };
            if (Host)
                HostShot(0, m);
            else
                Send(m);
        }

        void HostShot(int index, NetMessage m)
        {
            if (!Begun || Ended || HP[index] <= 0 || Protect[index] > 0 || !CombatRules.FiniteVector(m.o) || !CombatRules.FiniteVector(m.d))
                return;
            if (m.weapon != "ar7" && m.weapon != "p12" && m.weapon != "arc")
                return;
            var w = Data.Weapon(m.weapon);
            var origin = Data.V(m.o);
            var direction = Data.V(m.d);
            if ((origin - game.TargetEye(index)).sqrMagnitude > 4 || Mathf.Abs(direction.magnitude - 1) > .02f || !gates[index].Accept(m.seq, Clock, w.fireRate))
                return;
            game.Hear(game.TargetFeet(index), 34);
            if (Mode == "coop")
            {
                game.Shoot(origin, direction, w, w.weaponType == "melee", index);
                return;
            }

            float distance = w.range;
            if (Physics.Raycast(origin, direction, out var wall, w.range, Geometry.WorldMask, QueryTriggerInteraction.Ignore))
                distance = wall.distance;
            int target = 1 - index;
            var p = game.TargetFeet(target);
            bool crouch = target == Self ? game.Player.Crouched : Remote.crouch;
            float height = crouch ? 1.32f : 1.9f, extra = w.weaponType == "melee" ? .25f : 0;
            float t = CombatRules.RayBox(m.o, m.d, new[] { p.x - .4f - extra, p.y, p.z - .32f - extra }, new[] { p.x + .4f + extra, p.y + height, p.z + .32f + extra }, w.range);
            if (t >= 0 && t < distance && HP[target] > 0 && Protect[target] <= 0)
            {
                distance = t;
                bool head = w.weaponType != "melee" && origin.y + direction.y * t > p.y + height - .4f;
                Damage(target, w.damage * (head ? w.headshotMultiplier : 1), origin);
                Confirm(index, head, HP[target] <= 0);
            }

            Vector3 impact = origin + direction * distance;
            game.Fx.Tracer(origin, impact);
            SendTracer(origin, impact);
        }

        public void SendTracer(Vector3 a, Vector3 b)
        {
            Send(new NetMessage { type = "event", @event = "tracer", a = Data.A(a), b = Data.A(b) });
        }

        public void Confirm(int index, bool head, bool kill)
        {
            if (index == Self)
            {
                game.UI.Hit(head, kill);
                game.Audio.Play(head ? "headshot" : "hit");
            }
            else
                Send(new NetMessage { type = "event", @event = "hit", head = head, kill = kill });
        }

        public void Damage(int index, float amount, Vector3 origin)
        {
            if (!Host || Ended || HP[index] <= 0 || Protect[index] > 0)
                return;
            float loss = Mathf.Min(HP[index], Mathf.Max(0, amount));
            HP[index] -= loss;
            if (index == Self)
            {
                game.Player.Health = HP[index];
                game.UI.Damage(origin, loss);
            }
            else
                Send(new NetMessage { type = "event", @event = "damage", origin = Data.A(origin), amount = loss });
            if (HP[index] <= 0)
            {
                if (Mode == "duel")
                {
                    Scores[1 - index]++;
                    Respawn[index] = 3;
                    if (Scores[1 - index] >= 5)
                        End(1 - index, "5킬 선승 · 결투 종료");
                }
                else if (HP[0] <= 0 && HP[1] <= 0)
                    End(-1, "둘 다 쓰러졌어. 다시 도전해봐.");
            }
        }

        void End(int winner, string detail)
        {
            if (Ended)
                return;
            SendState();
            Send(new NetMessage { type = "event", @event = "end", won = Mode == "coop" ? winner == 0 : winner == 1, detail = detail });
            Ended = true;
            game.Finish(Mode == "coop" ? winner == 0 : winner == 0, detail);
        }

        public int Target(Bot bot)
        {
            if (HP[0] <= 0)
                return 1;
            if (HP[1] <= 0)
                return 0;
            var eye = bot.Eye;
            float a = (game.TargetEye(0) - eye).sqrMagnitude + (Geometry.Clear(eye, game.TargetEye(0)) ? 0 : 1000), b = (game.TargetEye(1) - eye).sqrMagnitude + (Geometry.Clear(eye, game.TargetEye(1)) ? 0 : 1000);
            return a <= b ? 0 : 1;
        }

        public void Tick(float dt)
        {
            if (Ended)
                return;
            if (Begun)
            {
                Clock += dt;
                game.Elapsed = Clock;
                game.Player.Health = HP[Self];
                game.Player.Tick(dt, game, game.Controls && HP[Self] > 0);
                game.Guns.Tick(dt, game.Controls && HP[Self] > 0 && Protect[Self] <= 0);
                if (Host)
                    HostTick(dt);
                else
                    foreach (var b in game.Bots)
                        b.Replica(dt);
            }

            if (avatar)
            {
                avatar.transform.position = Vector3.Lerp(avatar.transform.position, avatarTarget + (HP[1 - Self] <= 0 ? Vector3.up * .55f : Vector3.zero), 1 - Mathf.Exp(-18 * dt));
                avatar.transform.rotation = Quaternion.Slerp(avatar.transform.rotation, Quaternion.Euler(0, Remote.y * Mathf.Rad2Deg, HP[1 - Self] <= 0 ? 90 : 0), 1 - Mathf.Exp(-12 * dt));
                avatar.transform.localScale = new Vector3(1, Remote.crouch && HP[1 - Self] > 0 ? .72f : 1, 1);
            }

            networkClock += dt;
            if (networkClock >= 1f / 15)
            {
                networkClock = 0;
                var m = new NetMessage
                {
                    type = "pose",
                    p = Data.A(new Vector3(Mathf.Clamp(game.Player.Feet.x, -21, 21), game.Player.Feet.y, Mathf.Clamp(game.Player.Feet.z, -21, 21))),
                    y = (float)Math.Round(game.Player.Yaw * Mathf.Deg2Rad, 4),
                    pitch = (float)Math.Round(game.Player.Pitch * Mathf.Deg2Rad, 4),
                    crouch = game.Player.Crouched,
                    revive = game.Controls && Input.GetKey(KeyCode.E) && !Input.GetMouseButton(0)
                };
                string pose = JsonUtility.ToJson(m);
                if (pose != lastPose || Clock - lastPoseTime >= 1)
                {
                    client.Send(pose);
                    lastPose = pose;
                    lastPoseTime = Clock;
                }

                if (Host && Begun)
                    SendState();
            }
        }

        void HostTick(float dt)
        {
            for (int i = 0; i < 2; i++)
            {
                Protect[i] = Mathf.Max(0, Protect[i] - dt);
                if (Respawn[i] > 0)
                {
                    Respawn[i] = Mathf.Max(0, Respawn[i] - dt);
                    if (Respawn[i] == 0)
                        RespawnPlayer(i);
                }
            }

            if (Mode == "duel")
                return;
            if (Wait > 0)
            {
                Wait = Mathf.Max(0, Wait - dt);
                if (Wait == 0)
                    NextWave();
                return;
            }

            int alive = 0;
            foreach (var b in game.Bots)
                if (b.Alive)
                    alive++;
            if (Pending > 0 && alive < 6)
                SpawnBot();
            foreach (var bot in game.Bots)
            {
                if (Ended)
                    break;
                bot.Tick(dt);
            }

            int down = HP[0] <= 0 ? 0 : HP[1] <= 0 ? 1 : -1;
            if (down >= 0)
            {
                int rescuer = 1 - down;
                bool holding = rescuer == Self ? game.Controls && Input.GetKey(KeyCode.E) && !Input.GetMouseButton(0) : Remote.revive;
                if (holding && (game.Player.Feet - Data.V(Remote.p)).sqrMagnitude < 9 && Geometry.Clear(game.Player.Eye, Data.V(Remote.p) + Vector3.up))
                {
                    Revive += dt;
                    if (Revive >= 2)
                    {
                        HP[down] = 50;
                        Protect[down] = 1;
                        Revive = 0;
                    }
                }
                else
                    Revive = 0;
            }
            else
                Revive = 0;
            alive = 0;
            foreach (var b in game.Bots)
                if (b.Alive)
                    alive++;
            if (Pending == 0 && alive == 0 && !Ended)
                Wait = 8;
            game.Player.Health = HP[Self];
        }

        void RespawnPlayer(int i)
        {
            HP[i] = 100;
            Respawn[i] = 0;
            Protect[i] = 2;
            Epochs[i]++;
            if (i == Self)
                ResetLocal();
        }

        void NextWave()
        {
            game.ClearBots();
            if (Wave >= 5)
            {
                End(0, "두 명이 함께 5개 웨이브를 돌파했어!");
                return;
            }

            Wave++;
            Pending = 4 + Wave * 2;
            Wait = 0;
            for (int i = 0; i < 2; i++)
            {
                if (HP[i] <= 0)
                    RespawnPlayer(i);
                else
                    HP[i] = Mathf.Min(100, HP[i] + 25);
            }

            game.Guns.FullAmmo();
            game.UI.Toast("CO-OP · WAVE " + Wave + " / 5");
        }

        void SpawnBot()
        {
            string role = new[]
            {
                "assault",
                "defender",
                "support",
                "assault"
            }[serial % 4];
            Vector3 preferred = Data.V(game.Arena.spawns[serial % game.Arena.spawns.Length].p);
            var p = game.Navigation.Spawn(preferred, game.Player.Feet, game.Bots, Data.V(Remote.p));
            bool elite = Wave >= 4 && serial % 4 == 0;
            game.CreateBot("coop-" + (++serial), role, p, Wave, elite);
            Pending--;
        }

        void SendState()
        {
            var bots = new List<NetBot>();
            foreach (var b in game.Bots)
                bots.Add(new NetBot { id = b.Id, p = Data.A(b.transform.position), y = (float)Math.Round(b.transform.eulerAngles.y * Mathf.Deg2Rad, 4), hp = b.Health, max = b.MaxHealth, role = b.Role, elite = b.Elite, shield = b.Shield, animation = (float)Math.Round(b.Animation, 3) });
            Send(new NetMessage { type = "state", state = new NetState { hp = HP, scores = Scores, respawn = Respawn, epochs = Epochs, protect = Protect, wave = Wave, pending = Pending, wait = Wait, revive = Revive, time = Clock, enemies = bots.ToArray() } });
        }

        void Apply(NetState s)
        {
            if (s == null || s.hp == null || s.hp.Length != 2 || s.scores == null || s.scores.Length != 2 || s.epochs == null || s.epochs.Length != 2 || s.protect == null || s.protect.Length != 2 || s.respawn == null || s.respawn.Length != 2 || s.enemies == null || s.enemies.Length > 20)
                return;
            foreach (float hp in s.hp)
                if (float.IsNaN(hp) || float.IsInfinity(hp) || hp < 0 || hp > 100)
                    return;
            int oldWave = Wave;
            HP = s.hp;
            Scores = s.scores;
            Respawn = s.respawn;
            Epochs = s.epochs;
            Protect = s.protect;
            Wave = s.wave;
            Pending = s.pending;
            Wait = s.wait;
            Revive = s.revive;
            Clock = s.time;
            if (Epochs[Self] != localEpoch)
                ResetLocal();
            if (Wave != oldWave)
            {
                game.ClearBots();
                replicas.Clear();
                game.Guns.FullAmmo();
            }

            var seen = new HashSet<string>();
            foreach (var b in s.enemies)
            {
                if (b == null || !CombatRules.FiniteVector(b.p) || string.IsNullOrEmpty(b.id))
                    continue;
                seen.Add(b.id);
                Bot bot;
                if (!replicas.TryGetValue(b.id, out bot))
                {
                    bot = game.CreateBot(b.id, b.role, Data.V(b.p), Wave, b.elite);
                    replicas[b.id] = bot;
                }

                bot.ReplicaTarget = Data.V(b.p);
                bot.ReplicaYaw = b.y;
                bot.Health = b.hp;
                bot.MaxHealth = b.max;
                bot.Shield = b.shield;
                bot.Animation = b.animation;
                foreach (var z in bot.GetComponentsInChildren<HitZone>(true))
                    if (z.Shield)
                        z.gameObject.SetActive(b.shield > 0);
            }

            game.Player.Health = HP[Self];
        }

        public void Leave()
        {
            client.Close();
            Active = Begun = Ended = Ready = false;
            Code = "";
            if (avatar)
                UnityEngine.Object.Destroy(avatar);
            avatar = null;
            replicas.Clear();
            lastPose = "";
        }
    }
}
