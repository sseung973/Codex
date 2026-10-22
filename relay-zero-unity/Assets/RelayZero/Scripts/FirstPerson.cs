using System;
using System.Collections.Generic;
using UnityEngine;

namespace RelayZero
{
    public class FirstPerson : MonoBehaviour
    {
        public CharacterController Body;
        public Camera Camera, WeaponCamera;
        public float Health = 100, Yaw, Pitch, RecoilPitch, RecoilYaw, DashCooldown, DashRemaining;
        public bool Crouched, Sprinting, Aiming, Moving;
        public Vector3 Velocity;
        Vector3 dashDirection;
        float bob, eye = 1.65f, recoilDelay, steps;
        public Vector3 Feet
        {
            get
            {
                return transform.position;
            }
        }

        public Vector3 Eye
        {
            get
            {
                return Camera.transform.position;
            }
        }

        public bool Grounded
        {
            get
            {
                return Body.isGrounded;
            }
        }

        public void Create()
        {
            gameObject.layer = Geometry.PlayerLayer;
            Body = gameObject.AddComponent<CharacterController>();
            Body.radius = .36f;
            Body.height = 1.7f;
            Body.center = Vector3.up * .85f;
            Body.stepOffset = .36f;
            Body.slopeLimit = 60;
            Body.skinWidth = .025f;
            var go = new GameObject("Player camera");
            go.transform.SetParent(transform, false);
            Camera = go.AddComponent<Camera>();
            Camera.nearClipPlane = .06f;
            Camera.farClipPlane = 170;
            Camera.cullingMask = ~(1 << Geometry.ViewLayer);
            Camera.tag = "MainCamera";
            go.AddComponent<AudioListener>();
            var v = new GameObject("Weapon camera");
            v.transform.SetParent(go.transform, false);
            WeaponCamera = v.AddComponent<Camera>();
            WeaponCamera.clearFlags = CameraClearFlags.Depth;
            WeaponCamera.depth = 1;
            WeaponCamera.cullingMask = 1 << Geometry.ViewLayer;
            WeaponCamera.nearClipPlane = .01f;
            WeaponCamera.farClipPlane = 5;
            WeaponCamera.fieldOfView = 90;
        }

        public void ResetAt(Vector3 p, float yaw = 0)
        {
            Body.enabled = false;
            transform.position = p;
            Body.height = 1.7f;
            Body.center = Vector3.up * .85f;
            Body.enabled = true;
            Health = 100;
            Yaw = yaw;
            Pitch = RecoilPitch = RecoilYaw = DashCooldown = DashRemaining = 0;
            Velocity = Vector3.zero;
            eye = 1.65f;
            Crouched = Sprinting = false;
            Camera.transform.localPosition = Vector3.up * eye;
            Camera.transform.rotation = Quaternion.Euler(0, Yaw, 0);
        }

        public void Tick(float dt, RelayGame game, bool controls)
        {
            var s = game.Settings;
            bool ads = controls && game.Guns.Aiming;
            Aiming = ads;
            float mx = controls ? Input.GetAxisRaw("Mouse X") : 0, my = controls ? Input.GetAxisRaw("Mouse Y") : 0;
            Yaw = Mathf.Repeat(Yaw + mx * .91673f * s.sensitivity * (ads ? .63f : 1), 360);
            Pitch = Mathf.Clamp(Pitch - my * .91673f * s.sensitivity * (ads ? .63f : 1), -88.2f, 88.2f);
            bool shortBody = controls && (Input.GetKey(KeyCode.LeftControl) || Input.GetKey(KeyCode.C));
            if (Crouched && !shortBody)
                shortBody = Physics.SphereCast(Feet + Vector3.up * .55f, .33f, Vector3.up, out _, .82f, Geometry.WorldMask, QueryTriggerInteraction.Ignore);
            Crouched = shortBody;
            Body.height = shortBody ? 1.06f : 1.7f;
            Body.center = Vector3.up * Body.height * .5f;
            Body.stepOffset = Mathf.Min(.36f, Body.height - .05f);
            float x = controls ? (Input.GetKey(KeyCode.D) ? 1 : 0) - (Input.GetKey(KeyCode.A) ? 1 : 0) : 0, z = controls ? (Input.GetKey(KeyCode.W) ? 1 : 0) - (Input.GetKey(KeyCode.S) ? 1 : 0) : 0;
            Moving = x != 0 || z != 0;
            Sprinting = controls && z > 0 && Input.GetKey(KeyCode.LeftShift) && !shortBody && !ads;
            var wish = Quaternion.Euler(0, Yaw, 0) * new Vector3(x, 0, z).normalized;
            float speed = (shortBody ? 2.6f : Sprinting ? 8.2f : 5.4f) * (ads ? .66f : 1);
            DashCooldown = Mathf.Max(0, DashCooldown - dt);
            if (controls && Grounded && !shortBody && DashCooldown <= 0 && (Input.GetKeyDown(KeyCode.LeftAlt) || Input.GetKeyDown(KeyCode.RightAlt)))
            {
                dashDirection = Moving ? wish : Quaternion.Euler(0, Yaw, 0) * Vector3.forward;
                DashRemaining = .16f;
                DashCooldown = 3.5f;
                game.Audio.Play("swing");
            }

            if (Grounded)
            {
                Velocity.x = wish.x * speed;
                Velocity.z = wish.z * speed;
                Velocity.y = -2;
                if (controls && Input.GetKeyDown(KeyCode.Space))
                {
                    Velocity.y = 8;
                    game.Audio.Play("jump");
                }
            }
            else
            {
                if (Moving)
                {
                    Velocity.x = Mathf.MoveTowards(Velocity.x, wish.x * speed, 10 * dt);
                    Velocity.z = Mathf.MoveTowards(Velocity.z, wish.z * speed, 10 * dt);
                }

                Velocity.y -= 23 * dt;
            }

            float active = Mathf.Min(dt, DashRemaining);
            DashRemaining = Mathf.Max(0, DashRemaining - dt);
            Vector3 delta = Velocity * dt;
            if (active > 0)
                delta += dashDirection * 21 * active - new Vector3(Velocity.x, 0, Velocity.z) * active;
            bool was = Grounded;
            var flags = Body.Move(delta);
            if ((flags & CollisionFlags.Above) != 0 && Velocity.y > 0)
                Velocity.y = 0;
            if (!was && Grounded)
                game.Audio.Play("land", .4f);
            if (Feet.y < -10)
                ResetAt(Data.V(game.Arena.spawn));
            float recovery = Mathf.Max(0, dt - recoilDelay);
            recoilDelay = Mathf.Max(0, recoilDelay - dt);
            RecoilPitch = Data.Damp(RecoilPitch, 0, game.Guns.Current.Spec.recoilRecovery, recovery);
            RecoilYaw = Data.Damp(RecoilYaw, 0, game.Guns.Current.Spec.recoilRecovery, recovery);
            eye = Data.Damp(eye, shortBody ? 1.02f : 1.65f, 15, dt);
            bob += dt * (Sprinting ? 15 : 11);
            Camera.transform.localPosition = Vector3.up * (eye + (s.headBob && Grounded && Moving ? Mathf.Sin(bob) * .018f * (ads ? .15f : 1) : 0));
            Camera.transform.rotation = Quaternion.Euler(Mathf.Clamp(Pitch - RecoilPitch, -89, 89), Yaw + RecoilYaw, 0);
            Camera.fieldOfView = Data.Damp(Camera.fieldOfView, ads ? (game.Guns.Current.Spec.weaponType == "sniper" ? 28 : 61) : s.fov + (Sprinting ? 5 : 0), 14, dt);
            if (Grounded && Moving)
            {
                steps += dt;
                if (steps > (shortBody ? .62f : Sprinting ? .29f : .42f))
                {
                    steps = 0;
                    game.Audio.Play("step", .55f);
                    game.Hear(Feet, shortBody ? 5 : Sprinting ? 20 : 11);
                }
            }
            else
                steps = 0;
        }

        public void Kick(WeaponSpec w, int shot)
        {
            float strength = (Aiming ? w.adsRecoilMultiplier : 1) * (Crouched ? .75f : 1) * (!Grounded ? 1.3f : Moving ? 1.15f : 1);
            RecoilPitch += w.verticalRecoil * (1 + Mathf.Min(shot - 1, 12) * .045f) * strength * Mathf.Rad2Deg;
            RecoilYaw += CombatRules.RecoilYaw(shot) * w.horizontalRecoil * strength * Mathf.Rad2Deg;
            recoilDelay = .08f;
        }
    }

    public class Arsenal
    {
        readonly RelayGame game;
        public readonly Dictionary<string, Magazine> Inventory = new Dictionary<string, Magazine>();
        public readonly Magazine[] Slots = new Magazine[3];
        public int Slot = 1;
        public bool PrimaryOwned;
        public float Cooldown, Heat, Spread, Ads, Swing;
        public Transform View;
        GameObject model;
        float idle, kick, phase;
        bool held, pendingSwing, blockTrigger;
        string shown = "";
        public Magazine Current
        {
            get
            {
                return Slots[Slot];
            }
        }

        public bool Melee
        {
            get
            {
                return Current.Spec.weaponType == "melee";
            }
        }

        public bool Aiming
        {
            get
            {
                return !Melee && !blockTrigger && game.Controls && Input.GetMouseButton(1) && Current.Reload <= 0 && game.Player.DashRemaining <= 0;
            }
        }

        public Arsenal(RelayGame owner)
        {
            game = owner;
            View = new GameObject("Weapon pose").transform;
            View.SetParent(game.Player.Camera.transform, false);
            Start("p12", false);
        }

        public void Start(string pistol, bool full)
        {
            Inventory.Clear();
            Slots[0] = new Magazine(Data.Weapon("ar7"));
            Slots[1] = new Magazine(Data.Weapon(pistol));
            Slots[2] = new Magazine(Data.Weapon("arc"));
            PrimaryOwned = full;
            Slot = full ? 0 : 1;
            Inventory[pistol] = Slots[1];
            if (full)
                Inventory["ar7"] = Slots[0];
            Inventory["arc"] = Slots[2];
            Cooldown = Heat = Ads = Swing = idle = kick = 0;
            pendingSwing = held = false;
            shown = "";
            SuppressTrigger();
            Show();
        }

        public void SuppressTrigger()
        {
            blockTrigger = held = true;
        }

        public void Switch(int slot)
        {
            if (slot == Slot || slot < 0 || slot > 2 || slot == 0 && !PrimaryOwned)
                return;
            Current.Reload = 0;
            Slot = slot;
            Cooldown = .25f;
            Swing = 0;
            pendingSwing = false;
            held = true;
            Show();
        }

        public void Equip(string id)
        {
            Magazine mag;
            if (!Inventory.TryGetValue(id, out mag))
            {
                mag = new Magazine(Data.Weapon(id));
                Inventory[id] = mag;
            }

            Current.Reload = 0;
            Slots[0] = mag;
            PrimaryOwned = true;
            Slot = 0;
            Cooldown = .25f;
            Swing = 0;
            pendingSwing = false;
            SuppressTrigger();
            Show();
        }

        void Show()
        {
            if (shown == Current.Spec.id)
                return;
            shown = Current.Spec.id;
            if (model)
            {
                model.SetActive(false);
                UnityEngine.Object.Destroy(model);
            }

            model = Geometry.Model("weapon-" + shown, View);
        }

        public void Resupply(int count)
        {
            foreach (var m in Inventory.Values)
                m.Resupply(count);
        }

        public void FullAmmo()
        {
            foreach (var m in Inventory.Values)
                m.Reserve = m.Spec.reserveAmmo;
        }

        public void Tick(float dt, bool controls)
        {
            Cooldown = Mathf.Max(0, Cooldown - dt);
            if (Current.Tick(dt))
                game.Audio.Play("reload");
            Heat = Mathf.Max(0, Heat - 1.8f * dt);
            idle += dt;
            if (idle > .32f)
                shots = 0;
            Ads = Data.Damp(Ads, Aiming ? 1 : 0, 15, dt);
            kick = Data.Damp(kick, 0, 22, dt);
            phase += dt * (game.Player.Sprinting ? 15 : 10);
            if (Swing > 0)
            {
                Swing = Mathf.Max(0, Swing - dt);
                if (pendingSwing && Swing <= .3f)
                {
                    pendingSwing = false;
                    Attack(true);
                }
            }

            if (controls)
            {
                if (Input.GetKeyDown(KeyCode.Alpha1))
                    Switch(0);
                if (Input.GetKeyDown(KeyCode.Alpha2))
                    Switch(1);
                if (Input.GetKeyDown(KeyCode.Alpha3))
                    Switch(2);
                float wheel = Input.mouseScrollDelta.y;
                if (wheel != 0)
                {
                    int sign = wheel > 0 ? 1 : -1, next = (Slot + sign + 3) % 3;
                    if (next == 0 && !PrimaryOwned)
                        next = (next + sign + 3) % 3;
                    Switch(next);
                }

                if (Input.GetKeyDown(KeyCode.R) && !Melee && Current.StartReload())
                    game.Audio.Play("reload");
            }

            var w = Current.Spec;
            Spread = ((Aiming ? w.adsSpread : w.baseSpread) + (game.Player.Moving ? w.movementSpread * (Aiming ? .25f : 1) : 0) + (!game.Player.Grounded ? w.airSpread : 0) + Heat * .002f) * (game.Player.Crouched ? .7f : 1);
            if (controls && !Input.GetMouseButton(0) && !Input.GetMouseButton(1))
                blockTrigger = false;
            bool fire = controls && !blockTrigger && Input.GetMouseButton(0);
            if (fire && (!held || w.automatic) && Cooldown <= 0 && Current.Reload <= 0 && !game.Player.Sprinting && game.Player.DashRemaining <= 0)
            {
                if (Melee)
                {
                    Cooldown = 1 / w.fireRate;
                    Swing = .48f;
                    pendingSwing = true;
                    game.Audio.Play("swing");
                }
                else if (Current.Ammo <= 0)
                {
                    Cooldown = .2f;
                    game.Audio.Play("dry");
                }
                else
                {
                    Current.Ammo--;
                    Cooldown = 1 / w.fireRate;
                    shots++;
                    idle = 0;
                    Heat = Mathf.Min(5, Heat + .4f);
                    kick = Mathf.Min(.095f, kick + Mathf.Max(.025f, w.cameraKick));
                    game.Shots++;
                    Attack(false);
                    game.Player.Kick(w, shots);
                    game.Audio.Play("fire");
                    game.Hear(game.Player.Feet, 34);
                }
            }

            held = fire;
            float reload = Current.Reload > 0 ? Mathf.Sin((1 - Current.Reload / w.reloadTime) * Mathf.PI) : 0;
            float swing = Swing > 0 ? Mathf.Sin((1 - Swing / .48f) * Mathf.PI) : 0;
            float wall = Physics.Raycast(game.Player.Eye, game.Player.Camera.transform.forward, out var hit, 1.05f, Geometry.WorldMask) ? 1 - hit.distance / 1.05f : 0;
            View.localPosition = new Vector3(.29f * (1 - Ads) - swing * .25f, -.29f + (w.weaponType == "sniper" ? -.13f : .03f) * Ads - reload * .25f - wall * .28f - (game.Player.Sprinting ? .085f : 0), .36f - kick - wall * .12f);
            if (game.Settings.headBob && game.Player.Moving && game.Player.Grounded)
                View.localPosition += new Vector3(Mathf.Sin(phase) * .004f, Mathf.Sin(phase * 2) * .002f, 0) * (1 - .96f * Ads);
            View.localRotation = Quaternion.Euler((-reload * .42f + swing * .75f - kick * .85f) * Mathf.Rad2Deg, -swing * .6f * Mathf.Rad2Deg, (-reload * .28f + swing * .9f) * Mathf.Rad2Deg);
            model.SetActive(!(Aiming && w.weaponType == "sniper"));
        }

        int shots;
        void Attack(bool melee)
        {
            var camera = game.Player.Camera;
            Vector3 origin = camera.transform.position, dir = camera.transform.forward;
            if (!melee)
                dir = (dir + camera.transform.right * UnityEngine.Random.Range(-Spread, Spread) + camera.transform.up * UnityEngine.Random.Range(-Spread, Spread)).normalized;
            Vector3 muzzle = camera.transform.TransformPoint(new Vector3(.25f, -.2f, .8f));
            if (!melee && Physics.Linecast(origin, muzzle, out var wall, Geometry.WorldMask, QueryTriggerInteraction.Ignore))
            {
                game.Fx.Tracer(origin, wall.point);
                return;
            }

            if (game.Online.Active)
            {
                game.Online.Fire(origin, dir, Current.Spec);
                return;
            }

            game.Shoot(origin, dir, Current.Spec, melee, 0);
        }
    }
}
