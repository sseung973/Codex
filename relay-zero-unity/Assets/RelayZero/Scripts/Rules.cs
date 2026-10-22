// Engine-independent game rules, directly testable with dotnet run --project Tests.
using System;
using System.Collections.Generic;

namespace RelayZero
{
    [Serializable]
    public class WeaponSpec
    {
        public string id, name, weaponType;
        public float damage, headshotMultiplier, fireRate, range, reloadTime, baseSpread, movementSpread, airSpread, adsSpread, verticalRecoil, horizontalRecoil, recoilRecovery, adsRecoilMultiplier, cameraKick;
        public int magazineSize, reserveAmmo, price;
        public bool automatic;
        public WeaponSpec Copy()
        {
            return (WeaponSpec)MemberwiseClone();
        }
    }

    [Serializable]
    public class DifficultySpec
    {
        public string id, label, description;
        public int[] waves;
        public float health, damage, accuracy, reaction, speed, fireRate, burstPause, recovery, rest, scoreMultiplier;
        public int extraBurst, eliteFrom, eliteCount, resupplyMagazines;
    }

    public class Magazine
    {
        public WeaponSpec Spec;
        public int Ammo, Reserve;
        public float Reload;
        public readonly HashSet<string> Attachments = new HashSet<string>();
        public Magazine(WeaponSpec s)
        {
            Spec = s.Copy();
            Reset();
        }

        public void Reset()
        {
            Ammo = Spec.magazineSize;
            Reserve = Spec.reserveAmmo;
            Reload = 0;
        }

        public bool StartReload()
        {
            if (Reload > 0 || Ammo >= Spec.magazineSize || Reserve <= 0)
                return false;
            Reload = Spec.reloadTime;
            return true;
        }

        public bool Tick(float dt)
        {
            if (Reload <= 0)
                return false;
            Reload = Math.Max(0, Reload - dt);
            if (Reload > 0)
                return false;
            int n = Math.Min(Spec.magazineSize - Ammo, Reserve);
            Ammo += n;
            Reserve -= n;
            return true;
        }

        public bool Upgrade(string id)
        {
            if (Attachments.Count >= 2 || Attachments.Contains(id))
                return false;
            switch (id)
            {
                case "magazine":
                    Spec.magazineSize = (int)Math.Ceiling(Spec.magazineSize * 1.5);
                    break;
                case "stabilizer":
                    Spec.verticalRecoil *= .72f;
                    Spec.horizontalRecoil *= .72f;
                    break;
                case "loader":
                    Spec.reloadTime *= .78f;
                    break;
                default:
                    return false;
            }

            Attachments.Add(id);
            return true;
        }

        public void Resupply(int magazines)
        {
            Reserve = Math.Min(Spec.reserveAmmo, Reserve + Spec.magazineSize * magazines);
        }
    }

    public class Mission
    {
        public string Kind = "eliminate";
        public int Stage;
        public float Progress;
        public bool Done = true, Inside, Contested;
        public float Duration
        {
            get
            {
                return Kind == "capture" ? 12 : Kind == "defend" ? 20 : 3;
            }
        }

        public float Radius
        {
            get
            {
                return Kind == "activate" ? 2.2f : 3;
            }
        }

        public void Reset(int wave)
        {
            Kind = new[]
            {
                "eliminate",
                "capture",
                "activate",
                "defend",
                "eliminate"
            }[(wave - 1) % 5];
            Stage = 0;
            Progress = 0;
            Done = Kind == "eliminate";
            Inside = Contested = false;
        }

        public bool Tick(float dt, bool inside, bool contested, bool interact)
        {
            Inside = inside;
            Contested = contested;
            if (Done)
                return false;
            if (inside && !contested && (Kind != "activate" || interact))
                Progress = Math.Min(Duration, Progress + dt);
            else if (Kind == "activate")
                Progress = 0;
            else if (Kind == "defend")
                Progress = Math.Max(0, Progress - 2 * dt);
            if (Progress < Duration)
                return false;
            if (Kind == "activate" && Stage == 0)
            {
                Stage = 1;
                Progress = 0;
                return false;
            }

            Done = true;
            return true;
        }
    }

    public class WaveDirector
    {
        public int Wave, Remaining, Spawned, Total;
        public float Wait;
        public bool Complete, Endless, ObjectiveDone = true;
        int killed, next;
        float reinforcement;
        int[] batches, counts;
        float rest;
        public Action<int, int, int> Spawn;
        public Action Cleared, Victory;
        public int Pending
        {
            get
            {
                return Math.Max(0, Total - Spawned);
            }
        }

        public static int[] Batches(int total, int wave)
        {
            if (wave <= 1 || total < 4)
                return new[]
                {
                    total
                };
            int first = (int)Math.Ceiling(total * (wave == 2 ? .6 : .46));
            if (wave == 2)
                return new[]
                {
                    first,
                    total - first
                };
            int second = (int)Math.Ceiling((total - first) / 2.0);
            return total - first - second > 0 ? new[]
            {
                first,
                second,
                total - first - second
            }

            : new[]
            {
                first,
                second
            };
        }

        public void Reset(int[] values, float pause)
        {
            counts = (int[])values.Clone();
            rest = pause;
            Wave = Remaining = Spawned = Total = killed = 0;
            Wait = 3;
            Complete = Endless = false;
            ObjectiveDone = true;
        }

        public void Tick(float dt)
        {
            if (Complete)
                return;
            if (Wait > 0)
            {
                Wait = Math.Max(0, Wait - dt);
                if (Wait == 0)
                {
                    Wave++;
                    Total = Endless ? Math.Min(60, counts[counts.Length - 1] + (Wave - counts.Length) * 3) : counts[Wave - 1];
                    Remaining = Total;
                    killed = 0;
                    ObjectiveDone = true;
                    if (Endless)
                    {
                        var b = new List<int>();
                        for (int i = 0; i < Total; i += 6)
                            b.Add(Math.Min(6, Total - i));
                        batches = b.ToArray();
                    }
                    else
                        batches = Batches(Total, Wave);
                    Spawned = batches[0];
                    next = 1;
                    reinforcement = 7;
                    Spawn?.Invoke(Wave, Spawned, 0);
                }

                return;
            }

            if (next >= batches.Length)
                return;
            reinforcement -= dt;
            int active = Spawned - killed, cap = Math.Min(12, Math.Max(4, (int)Math.Ceiling(Total * .65)));
            if (active + batches[next] > cap)
                return;
            if (active > Math.Max(1, (int)Math.Ceiling(Spawned * .4)) && reinforcement > 0)
                return;
            int n = batches[next++], offset = Spawned;
            Spawned += n;
            reinforcement = 7;
            Spawn?.Invoke(Wave, n, offset);
        }

        public void Kill()
        {
            if (Complete || Remaining <= 0)
                return;
            Remaining--;
            killed++;
            Check();
        }

        public void FinishObjective()
        {
            ObjectiveDone = true;
            Check();
        }

        void Check()
        {
            if (Complete || Wave == 0 || Remaining != 0 || !ObjectiveDone || Wait > 0)
                return;
            if (!Endless && Wave >= counts.Length)
            {
                Complete = true;
                Victory?.Invoke();
            }
            else
            {
                Wait = rest;
                Cleared?.Invoke();
            }
        }

        public bool Continue()
        {
            if (!Complete || Endless || Wave != counts.Length)
                return false;
            Endless = true;
            Complete = false;
            Wait = rest;
            Cleared?.Invoke();
            return true;
        }
    }

    public class ShotGate
    {
        int sequence = -1;
        float last = float.NegativeInfinity;
        public bool Accept(int seq, float time, float rate)
        {
            if (seq <= sequence || rate <= 0 || time - last < 1 / rate - .025f)
                return false;
            sequence = seq;
            last = time;
            return true;
        }
    }

    public static class CombatRules
    {
        static readonly float[] Sweep =
        {
            0,
            .2f,
            .35f,
            .5f,
            .6f,
            .4f,
            .1f,
            -.3f,
            -.6f,
            -.7f,
            -.4f,
            .1f
        };
        public static float RecoilYaw(int shot)
        {
            return Sweep[Math.Max(0, shot - 1) % Sweep.Length];
        }

        public static float RayBox(float[] o, float[] d, float[] min, float[] max, float range)
        {
            float lo = 0, hi = range;
            for (int i = 0; i < 3; i++)
            {
                if (Math.Abs(d[i]) < 1e-8)
                {
                    if (o[i] < min[i] || o[i] > max[i])
                        return -1;
                }
                else
                {
                    float a = (min[i] - o[i]) / d[i], b = (max[i] - o[i]) / d[i];
                    if (a > b)
                    {
                        float t = a;
                        a = b;
                        b = t;
                    }

                    lo = Math.Max(lo, a);
                    hi = Math.Min(hi, b);
                    if (hi < lo)
                        return -1;
                }
            }

            return lo;
        }

        public static bool FiniteVector(float[] p)
        {
            if (p == null || p.Length != 3)
                return false;
            foreach (float n in p)
                if (float.IsNaN(n) || float.IsInfinity(n) || Math.Abs(n) > 150)
                    return false;
            return true;
        }
    }
}
