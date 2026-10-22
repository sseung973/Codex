using System.Collections.Generic;
using UnityEngine;

namespace RelayZero
{
    public class Bot : MonoBehaviour
    {
        public string Id, Role, State = "Idle";
        public bool Elite, Commander, Practice;
        public float Health, MaxHealth, Shield = 120, Stun, Animation, WeakWindow, Windup, Cue;
        public int TargetIndex;
        public GameObject Model;
        public Vector3 ReplicaTarget;
        public float ReplicaYaw;
        public bool Alive
        {
            get
            {
                return Health > 0;
            }
        }

        public Vector3 Eye
        {
            get
            {
                return transform.position + Vector3.up * 1.7f;
            }
        }

        RelayGame game;
        CharacterController body;
        HitZone[] zones;
        Renderer[] renderers;
        MaterialPropertyBlock properties;
        Color[] baseEmission, baseColor;
        LineRenderer warning, laser;
        Vector3 home, lastKnown, lockedAim;
        List<Vector3> path = new List<Vector3>();
        float think, pathClock, fireClock, reaction, repairClock, lost, search, stagger, deathAge, flash;
        int burst;
        bool attackReady;
        float damage, accuracy, speed, range, rate, pause, reactionTime;
        int burstCount;
        public void Create(RelayGame owner, string id, string role, Vector3 position, int wave, bool elite = false, bool commander = false, bool practice = false)
        {
            game = owner;
            Id = id;
            Role = role = commander ? "commander" : role;
            Elite = elite;
            Commander = commander;
            Practice = practice;
            gameObject.name = id;
            gameObject.layer = Geometry.BotLayer;
            transform.position = home = lastKnown = ReplicaTarget = position;
            transform.rotation = Quaternion.Euler(0, Mathf.Atan2(-position.x, -17 - position.z) * Mathf.Rad2Deg, 0);
            var d = game.Online.Active ? Data.Balance.difficulties[1] : game.Difficulty;
            float pressure = 1 + Mathf.Max(0, wave - 5) * .025f;
            int w = Mathf.Min(wave, 30);
            MaxHealth = Health = Mathf.Round((elite ? 155 : 78 + w * 7) * d.health * pressure);
            damage = (elite ? 10 : 5 + w * .65f) * d.damage * pressure * (role == "sniper" ? 3 : 1);
            accuracy = Mathf.Min(.82f, (elite ? .48f : .24f + w * .025f) * d.accuracy);
            reactionTime = Mathf.Max(.22f, (elite ? .5f : 1.1f - w * .07f) * d.reaction);
            speed = (elite ? 3.9f : 2.8f + w * .15f) * d.speed * (role == "bomber" ? 1.6f : role == "sniper" ? .65f : role == "assault" ? 1.3f : role == "defender" ? .75f : .95f);
            rate = (elite ? 3.5f : 2.3f) * d.fireRate;
            range = role == "bomber" ? 3 : role == "sniper" ? 28 : role == "assault" ? 9 : role == "defender" ? 17 : 22;
            burstCount = role == "sniper" || role == "bomber" ? 1 : (elite ? 4 : 3) + d.extraBurst;
            pause = role == "sniper" ? 3 : d.burstPause;
            if (commander)
            {
                Health = MaxHealth = Mathf.Round(300 * d.health * (1 + Mathf.Max(0, wave - 5) * .08f));
                speed *= .78f;
                damage = 12 * d.damage;
                range = 22;
                burstCount = 1;
                pause = 3.3f;
                reactionTime = Mathf.Max(.45f, reactionTime);
            }

            Model = Geometry.Model("robot-" + (commander ? "commander" : role), transform, true);
            zones = Model.GetComponentsInChildren<HitZone>(true);
            foreach (var z in zones)
                z.Bot = this;
            renderers = Model.GetComponentsInChildren<Renderer>(true);
            properties = new MaterialPropertyBlock();
            baseEmission = new Color[renderers.Length];
            baseColor = new Color[renderers.Length];
            for (int i = 0; i < renderers.Length; i++)
            {
                var mat = renderers[i].sharedMaterial;
                baseEmission[i] = mat && mat.HasProperty("_EmissionColor") ? mat.GetColor("_EmissionColor") : Color.black;
                baseColor[i] = mat ? mat.color : Color.white;
            }

            body = gameObject.AddComponent<CharacterController>();
            body.height = 1.7f;
            body.center = Vector3.up * .85f;
            body.radius = .4f;
            body.stepOffset = .25f;
            body.skinWidth = .02f;
            body.slopeLimit = 60;
            if (Commander || Role == "bomber")
            {
                // Commander strikes lock to a world position, independent of the moving robot.
                warning = game.Fx.MakeRing(game.World.transform, Commander ? 2.45f : 4.2f, Data.ColorOf("#e56561"));
                warning.gameObject.SetActive(false);
            }

            if (Role == "sniper")
            {
                laser = game.Fx.MakeLine(transform, Data.ColorOf("#e56561"), .018f);
                laser.gameObject.SetActive(false);
            }

            think = Random.Range(0, .12f);
        }

        public void Hear(Vector3 p, float radius)
        {
            if (!Alive || (p - transform.position).sqrMagnitude > radius * radius || State == "Attack" || State == "Chase")
                return;
            lastKnown = p;
            State = "Investigate";
            pathClock = 0;
        }

        public bool Hit(float amount, bool head, bool shield, bool weak, int shooter, bool gun = true)
        {
            if (!Alive)
                return false;
            if (shield && Shield > 0)
            {
                Shield = Mathf.Max(0, Shield - amount);
                if (Shield == 0)
                    foreach (var z in zones)
                        if (z.Shield || z.name.Contains("shield"))
                            z.gameObject.SetActive(false);
                return false;
            }

            if (Commander)
                amount *= weak && WeakWindow > 0 ? 1.55f : .68f;
            Health = Mathf.Max(0, Health - amount);
            flash = .09f;
            stagger = .12f;
            Hear(game.Player.Feet, 100);
            if (!Alive)
            {
                State = "Dead";
                body.enabled = false;
                foreach (var z in zones)
                    z.GetComponent<Collider>().enabled = false;
                if (warning)
                    warning.gameObject.SetActive(false);
                if (laser)
                    laser.gameObject.SetActive(false);
                game.BotKilled(this, head, shooter);
                return true;
            }

            return false;
        }

        public void Disable(float duration)
        {
            if (!Alive)
                return;
            Stun = Mathf.Max(Stun, Commander ? duration * .5f : duration);
            Cue = Windup = 0;
            attackReady = false;
            burst = 0;
            fireClock = Mathf.Max(.4f, fireClock);
            if (warning)
                warning.gameObject.SetActive(false);
        }

        void AnimateLegs(bool moving)
        {
            foreach (var zone in zones)
            {
                if (zone.name != "leg")
                    continue;
                float side = zone.GetComponent<MeshFilter>().sharedMesh.bounds.center.x;
                float a = moving ? Mathf.Sin(Animation * 9 + (side > 0 ? 0 : Mathf.PI)) * .24f : 0;
                var rotation = Quaternion.Euler(a * Mathf.Rad2Deg, 0, 0);
                var pivot = new Vector3(side, .8f, 0);
                zone.transform.localRotation = rotation;
                zone.transform.localPosition = pivot - rotation * pivot;
            }
        }

        public void Replica(float dt)
        {
            if (body.enabled)
                body.enabled = false;
            if ((transform.position - ReplicaTarget).sqrMagnitude > 64)
                transform.position = ReplicaTarget;
            else
                transform.position = Vector3.Lerp(transform.position, ReplicaTarget, 1 - Mathf.Exp(-18 * dt));
            transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.Euler(0, ReplicaYaw * Mathf.Rad2Deg, Alive ? 0 : 90), 1 - Mathf.Exp(-12 * dt));
            AnimateLegs(Alive && (transform.position - ReplicaTarget).sqrMagnitude > .004f);
            foreach (var z in zones)
                z.GetComponent<Collider>().enabled = Alive;
        }

        public void Tick(float dt)
        {
            Animation += dt;
            flash = Mathf.Max(0, flash - dt);
            if (!Alive)
            {
                deathAge += dt;
                Model.transform.localRotation = Quaternion.Euler(0, 0, Mathf.Lerp(0, 84, Mathf.Clamp01(deathAge / .6f)));
                Model.transform.localPosition = Vector3.down * Mathf.Lerp(0, .2f, Mathf.Clamp01(deathAge / .6f));
                if (Practice && deathAge > 2.5f)
                {
                    Health = MaxHealth;
                    deathAge = 0;
                    State = "Idle";
                    Model.transform.localRotation = Quaternion.identity;
                    Model.transform.localPosition = Vector3.zero;
                    body.enabled = true;
                    foreach (var z in zones)
                        z.GetComponent<Collider>().enabled = true;
                }

                return;
            }

            if (!Practice && body.enabled)
                body.Move(Vector3.down * 4 * dt);
            if (Stun > 0)
            {
                Stun = Mathf.Max(0, Stun - dt);
                Glow(new Color(.05f, .25f, .45f));
                return;
            }

            Glow(flash > 0 ? new Color(.7f, .32f, .1f) : Cue > 0 ? new Color(.6f, .25f, .02f) : Color.black);
            if (Practice)
                return;
            if (Commander)
            {
                WeakWindow = Mathf.Max(0, WeakWindow - dt);
                foreach (var z in zones)
                    if (z.Weak)
                        z.gameObject.SetActive(WeakWindow > 0);
                if (Windup > 0)
                {
                    Windup = Mathf.Max(0, Windup - dt);
                    if (Windup == 0)
                    {
                        warning.gameObject.SetActive(false);
                        WeakWindow = 2.1f;
                        game.EnemyPulse(this, lockedAim, 2.45f, damage);
                    }
                }
            }

            Cue = Mathf.Max(0, Cue - dt);
            reaction -= dt;
            fireClock -= dt;
            pathClock -= dt;
            think -= dt;
            repairClock -= dt;
            stagger = Mathf.Max(0, stagger - dt);
            if (Role == "support" && repairClock <= 0)
            {
                repairClock = 1.5f;
                Bot best = null;
                float priority = float.NegativeInfinity;
                foreach (var e in game.Bots)
                {
                    if (e == this || !e.Alive || e.Health >= e.MaxHealth || (e.Eye - Eye).sqrMagnitude > 64 || !Geometry.Clear(Eye, e.Eye))
                        continue;
                    float p = e.MaxHealth - e.Health + (game.HasMission && e.Role == "defender" ? 1000 : 0);
                    if (p > priority)
                    {
                        best = e;
                        priority = p;
                    }
                }

                if (best)
                {
                    best.Health = Mathf.Min(best.MaxHealth, best.Health + 12);
                    game.Fx.Tracer(Eye, best.Eye, new Color(.5f, .9f, 1));
                }
            }

            if (think <= 0)
            {
                think = .12f;
                TargetIndex = game.Online.Active ? game.Online.Target(this) : 0;
                var feet = game.TargetFeet(TargetIndex);
                var eye = game.TargetEye(TargetIndex);
                var delta = eye - Eye;
                float distance = delta.magnitude;
                bool alerted = State == "Attack" || State == "Chase";
                bool visible = game.TargetAlive(TargetIndex) && distance < 30 && (alerted || Vector3.Dot(transform.forward, delta.normalized) > Mathf.Cos(Mathf.PI * .36f)) && Geometry.Clear(Eye, eye);
                if (visible)
                {
                    if (!alerted)
                    {
                        reaction = reactionTime;
                        game.Audio.Play("alert", .15f);
                    }

                    lastKnown = feet;
                    lost = 0;
                    State = distance < range ? "Attack" : "Chase";
                    if (game.HasMission && (Role == "defender" || Role == "support") && (transform.position - game.MissionPoint).sqrMagnitude > (Role == "defender" ? 9 : 22))
                        State = "Chase";
                }
                else
                {
                    lost += .12f;
                    if (State == "Attack")
                        State = "Chase";
                    if (State == "Chase" && lost > 1.1f)
                        State = "Search";
                    if (State == "Idle" && (search += .12f) > .8f)
                        State = "Patrol";
                }

                if (!visible || State != "Attack")
                {
                    Cue = 0;
                    attackReady = false;
                }

                if (State == "Attack" && reaction <= 0 && fireClock <= 0 && stagger <= 0 && visible && Windup <= 0 && WeakWindow <= 0)
                {
                    if (burst == 0 && !attackReady)
                    {
                        attackReady = true;
                        Cue = Role == "sniper" ? 1.2f : Role == "bomber" ? 1 : Mathf.Clamp(reactionTime * .7f, .4f, .65f);
                        lockedAim = eye;
                        game.Audio.Play("alert", .12f);
                    }
                    else if (Cue <= 0)
                    {
                        Attack(feet, eye);
                        attackReady = false;
                        burst++;
                        fireClock = burst >= burstCount ? pause : 1 / rate;
                        if (burst >= burstCount)
                            burst = 0;
                    }
                }
            }

            if (laser)
            {
                laser.gameObject.SetActive(Cue > 0);
                laser.SetPosition(0, Eye);
                laser.SetPosition(1, lockedAim);
            }

            if (Role == "bomber" && warning)
            {
                warning.gameObject.SetActive(Cue > 0);
                warning.transform.position = transform.position + Vector3.up * .06f;
            }

            Vector3 goal = lastKnown;
            if (game.HasMission && (Role == "defender" || Role == "support") && (transform.position - game.MissionPoint).sqrMagnitude > (Role == "defender" ? 9 : 22))
                goal = game.MissionPoint;
            if (State == "Patrol")
                goal = home + new Vector3(Mathf.Sin(Animation * .12f) * 4, 0, Mathf.Cos(Animation * .12f) * 3);
            if (State == "Attack")
            {
                AnimateLegs(false);
                var d = game.TargetFeet(TargetIndex) - transform.position;
                if (d.sqrMagnitude > .01f)
                    transform.rotation = Quaternion.Euler(0, Mathf.Atan2(d.x, d.z) * Mathf.Rad2Deg, 0);
                return;
            }

            if (State == "Idle")
                return;
            if ((transform.position - goal).sqrMagnitude < 1.8f)
            {
                if (State == "Search" || State == "Investigate")
                {
                    search += dt;
                    transform.Rotate(0, dt * 51, 0);
                    if (search > 4)
                    {
                        State = "Patrol";
                        search = 0;
                    }
                }

                return;
            }

            if (pathClock <= 0)
            {
                pathClock = .9f + Random.value * .25f;
                path = game.Navigation.Route(transform.position, goal);
            }

            while (path.Count > 0 && HorizontalDistanceSquared(transform.position, path[0]) < .5f)
                path.RemoveAt(0);
            if (path.Count == 0)
                return;
            var direction = path[0] - transform.position;
            direction.y = 0;
            direction.Normalize();
            foreach (var other in game.Bots)
                if (other != this && other.Alive)
                {
                    var sep = transform.position - other.transform.position;
                    float d = sep.magnitude;
                    if (d < 1.1f && d > .01f)
                        direction += sep * ((1.1f - d) * .8f / d);
                }

            direction.Normalize();
            float move = speed * (State == "Patrol" ? .55f : 1) * (stagger > 0 ? .2f : 1);
            body.Move(direction * move * dt);
            AnimateLegs(true);
            if (direction.sqrMagnitude > .01f)
                transform.rotation = Quaternion.Euler(0, Mathf.Atan2(direction.x, direction.z) * Mathf.Rad2Deg, 0);
        }

        void Attack(Vector3 feet, Vector3 eye)
        {
            if (Commander)
            {
                lockedAim = feet;
                Windup = 1.15f;
                warning.transform.position = feet + Vector3.up * .07f;
                warning.gameObject.SetActive(true);
                return;
            }

            if (Role == "bomber")
            {
                Hit(99999, false, false, false, -1, false);
                return;
            }

            if (!Geometry.Clear(Eye, eye))
                return;
            bool hit = Role == "sniper" ? (eye - lockedAim).sqrMagnitude <= .4225f : Random.value < accuracy * (TargetIndex == game.LocalIndex && game.Player.Sprinting ? .65f : 1);
            var impact = Role == "sniper" ? lockedAim : eye;
            if (!hit && Role != "sniper")
                impact += new Vector3(Random.Range(-1.2f, 1.2f), 1 + Random.value, Random.Range(-1, 1));
            game.Tracer(Eye, impact);
            game.Audio.Play("enemy", .3f);
            if (hit)
                game.Hurt(TargetIndex, damage, transform.position);
        }

        void Glow(Color c)
        {
            for (int i = 0; i < renderers.Length; i++)
            {
                var r = renderers[i];
                if (!r || !r.sharedMaterial)
                    continue;
                properties.SetColor("_EmissionColor", baseEmission[i] + c);
                properties.SetColor("_Color", Cue > 0 && !r.sharedMaterial.HasProperty("_EmissionColor") ? Data.ColorOf("#edac58") : baseColor[i]);
                r.SetPropertyBlock(properties);
            }
        }

        static float HorizontalDistanceSquared(Vector3 a, Vector3 b)
        {
            float x = a.x - b.x, z = a.z - b.z;
            return x * x + z * z;
        }

        void OnDestroy()
        {
            if (warning)
                Destroy(warning.gameObject);
        }
    }
}
