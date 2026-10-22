using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

namespace RelayZero
{
    public class TacticalUI
    {
        readonly RelayGame game;
        Transform root;
        readonly Dictionary<string, GameObject> panels = new Dictionary<string, GameObject>();
        readonly Dictionary<string, Text> labels = new Dictionary<string, Text>();
        Image healthFill, missionFill, reloadFill, bossFill, damageFlash;
        RectTransform damageArrow;
        RadarGraphic radar;
        Text toast, hit, damageLabel;
        float toastTime, hitTime, damageTime;
        string current = "menu", back = "menu";
        Text lobbyStatus, lobbyRoster, roomCode, readyLabel, shopCoins;
        InputField roomInput, serverInput;
        Font display;
        Image portrait;
        readonly List<Image> abilityIcons = new List<Image>();
        public string Page
        {
            get
            {
                return current;
            }
        }

        static readonly Color White = new Color(.95f, .97f, .94f), Muted = new Color(.58f, .65f, .69f), Mint = new Color(.67f, .94f, .82f), Amber = new Color(.93f, .68f, .35f), Panel = new Color(.065f, .1f, .14f, .96f), Danger = new Color(.9f, .3f, .29f);
        public TacticalUI(RelayGame owner)
        {
            game = owner;
            display = Resources.Load<Font>("Fonts/BarlowCondensed-Bold");
            var go = new GameObject("RELAY ZERO / UI");
            var canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1280, 720);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.Expand;
            go.AddComponent<GraphicRaycaster>();
            if (!UnityEngine.Object.FindObjectOfType<EventSystem>())
            {
                var events = new GameObject("EventSystem");
                events.AddComponent<EventSystem>();
                events.AddComponent<StandaloneInputModule>();
            }

            root = go.transform;
            BuildHUD();
            BuildMenu();
            BuildPause();
            BuildShop();
            BuildSettings();
            BuildLobby();
            BuildResult();
        }

        RectTransform Rect(string name, Transform parent, float x, float y, float w, float h)
        {
            var go = new GameObject(name, typeof(RectTransform));
            var r = go.GetComponent<RectTransform>();
            r.SetParent(parent, false);
            r.anchorMin = r.anchorMax = new Vector2(0, 1);
            r.pivot = new Vector2(0, 1);
            r.anchoredPosition = new Vector2(x, -y);
            r.sizeDelta = new Vector2(w, h);
            return r;
        }

        GameObject PageRoot(string name)
        {
            var r = Rect(name, root, 0, 0, 1280, 720);
            r.anchorMin = r.anchorMax = r.pivot = new Vector2(.5f, .5f);
            r.anchoredPosition = Vector2.zero;
            panels[name] = r.gameObject;
            return r.gameObject;
        }

        Image Box(string name, Transform parent, float x, float y, float w, float h, Color color)
        {
            var r = Rect(name, parent, x, y, w, h);
            var im = r.gameObject.AddComponent<Image>();
            im.color = color;
            im.raycastTarget = false;
            return im;
        }

        Text Text(string key, Transform parent, string value, float x, float y, float w, float h, int size = 18, Color? color = null, bool strong = false, TextAnchor align = TextAnchor.MiddleLeft)
        {
            var r = Rect(key, parent, x, y, w, h);
            var t = r.gameObject.AddComponent<Text>();
            t.font = strong && display ? display : Data.Font;
            t.fontSize = size;
            t.color = color ?? White;
            t.text = value;
            t.alignment = align;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Truncate;
            t.raycastTarget = false;
            if (!string.IsNullOrEmpty(key))
                labels[key] = t;
            return t;
        }

        Button Button(Transform parent, string name, float x, float y, float w, float h, Action action, bool primary = false)
        {
            var im = Box(name, parent, x, y, w, h, primary ? Mint : new Color(.13f, .19f, .24f, .98f));
            im.raycastTarget = true;
            var b = im.gameObject.AddComponent<Button>();
            b.targetGraphic = im;
            var colors = b.colors;
            colors.highlightedColor = new Color(.8f, .92f, .93f);
            colors.pressedColor = new Color(.5f, .7f, .75f);
            b.colors = colors;
            Text("", im.transform, name, 15, 0, w - 30, h, 18, primary ? Panel : White);
            b.onClick.AddListener(() =>
            {
                game.Audio.Play("ui", .5f);
                action();
            });
            return b;
        }

        Image Icon(string resource, Transform parent, float x, float y, float w, float h, Color color)
        {
            var im = Box(resource, parent, x, y, w, h, color);
            var texture = Resources.Load<Texture2D>("UI/" + resource);
            if (texture)
                im.sprite = Sprite.Create(texture, new Rect(0, 0, texture.width, texture.height), new Vector2(.5f, .5f), 100);
            im.preserveAspect = true;
            return im;
        }

        InputField InputBox(Transform parent, string name, float x, float y, float w, string placeholder, int limit = 100)
        {
            var im = Box(name, parent, x, y, w, 46, new Color(.035f, .06f, .085f));
            im.raycastTarget = true;
            var input = im.gameObject.AddComponent<InputField>();
            input.textComponent = Text("", im.transform, "", 12, 0, w - 24, 46, 18);
            input.placeholder = Text("", im.transform, placeholder, 12, 0, w - 24, 46, 17, Muted);
            input.characterLimit = limit;
            input.lineType = InputField.LineType.SingleLine;
            return input;
        }

        void Set(string key, string value)
        {
            if (labels.TryGetValue(key, out var t) && t.text != value)
                t.text = value;
        }

        void Fill(Image im, float f)
        {
            f = Mathf.Clamp01(f);
            var r = im.rectTransform;
            var scale = r.localScale;
            if (Mathf.Abs(scale.x - f) > .001f)
                r.localScale = new Vector3(f, 1, 1);
        }

        void Title(Transform p, string small, string large, string detail)
        {
            Text("", p, small, 80, 80, 1000, 30, 16, Mint);
            Text("", p, large, 80, 118, 1080, 72, 48, White, true);
            Text("", p, detail, 80, 201, 1080, 56, 17, Muted);
        }

        void BuildHUD()
        {
            var p = PageRoot("playing").transform;
            Box("top shade", p, 0, 0, 1280, 112, new Color(.02f, .035f, .05f, .55f));
            Box("bottom shade", p, 0, 602, 1280, 118, new Color(.02f, .035f, .05f, .64f));
            var bg = Box("radar", p, 25, 35, 204, 204, new Color(.05f, .1f, .14f, .76f));
            bg.sprite = CircleSprite();
            bg.gameObject.AddComponent<Mask>().showMaskGraphic = true;
            var r = Rect("map geometry", bg.transform, 8, 8, 188, 188);
            radar = r.gameObject.AddComponent<RadarGraphic>();
            radar.color = White;
            radar.raycastTarget = false;
            Text("", bg.transform, "N", 91, 0, 20, 20, 12, Mint, true, TextAnchor.MiddleCenter);
            Text("radar-name", p, "THE FOUNDRY", 30, 244, 220, 24, 18, White, true);
            Text("", p, "YOU  ▲    OBJECTIVE  ◇", 30, 270, 230, 20, 11, Muted);
            Box("friend line", p, 334, 43, 195, 3, Mint);
            Box("enemy line", p, 752, 43, 195, 3, Danger);
            Icon("operative", p, 403, 5, 34, 40, White);
            Icon("robot", p, 847, 7, 32, 32, Danger);
            Text("friendly", p, "0", 337, 5, 60, 42, 32, White, true);
            Text("opposition", p, "0", 891, 5, 60, 42, 32, White, true);
            Text("match-wave", p, "WAVE 01 / 05", 531, 2, 218, 21, 13, Mint, false, TextAnchor.MiddleCenter);
            Text("match-time", p, "0:00", 550, 18, 180, 45, 37, White, true, TextAnchor.MiddleCenter);
            Text("objective", p, "적 전멸", 480, 64, 320, 26, 17, White, false, TextAnchor.MiddleCenter);
            Text("remaining", p, "CONTACT INBOUND", 30, 308, 300, 27, 16, White);
            Text("mission-hint", p, "", 30, 342, 320, 48, 15, White);
            Box("mission track", p, 30, 396, 230, 3, new Color(1, 1, 1, .15f));
            missionFill = Box("mission fill", p, 30, 396, 230, 3, Mint);
            Text("mission-distance", p, "", 30, 407, 320, 27, 13, Muted);
            Text("", p, "SESSION SCORE", 1050, 38, 200, 18, 11, Muted, false, TextAnchor.MiddleRight);
            Text("score", p, "00000", 1020, 58, 230, 35, 29, White, true, TextAnchor.MiddleRight);
            Text("coins", p, "0 COINS · B 상점", 1000, 95, 250, 24, 13, Amber, false, TextAnchor.MiddleRight);
            portrait = Icon("operative", p, 26, 600, 80, 98, White);
            Box("badge line", p, 24, 702, 87, 3, Mint);
            Text("", p, "OPERATOR / INTEGRITY", 126, 626, 200, 18, 10, Muted);
            Text("hp", p, "100", 124, 645, 100, 41, 35, White, true);
            Text("", p, "/ 100", 205, 657, 80, 27, 16, Muted);
            Box("health track", p, 125, 690, 211, 8, new Color(1, 1, 1, .18f));
            healthFill = Box("health fill", p, 125, 690, 211, 8, White);
            for (int i = 1; i < 5; i++)
                Box("health tick", p, 125 + i * 42.2f, 690, 2, 8, Panel);
            Text("weapon", p, "P-12 SIDEARM", 497, 614, 286, 24, 15, Muted, true, TextAnchor.MiddleCenter);
            Text("ammo", p, "12", 510, 640, 120, 53, 48, White, true, TextAnchor.MiddleRight);
            Text("reserve", p, "/ 72", 647, 653, 120, 40, 26, Muted, true);
            Text("reload", p, "R · RELOAD", 516, 699, 245, 17, 10, Muted, false, TextAnchor.MiddleCenter);
            Box("reload track", p, 530, 695, 220, 2, new Color(1, 1, 1, .14f));
            reloadFill = Box("reload fill", p, 530, 695, 220, 2, Mint);
            for (int i = 0; i < 3; i++)
            {
                Icon(i == 0 ? "rifle" : i == 1 ? "pistol" : "baton", p, 1125, 430 + i * 50, 72, 34, White);
                Text("slot-" + i, p, "", 960, 429 + i * 50, 150, 33, 12, Muted, false, TextAnchor.MiddleRight);
                Text("", p, (i + 1).ToString(), 1212, 430 + i * 50, 28, 33, 13, White);
                Box("rail line", p, 1120, 469 + i * 50, 120, 1, new Color(1, 1, 1, .3f));
            }

            string[] names =
            {
                "dash",
                "emp",
                "interact",
                "baton"
            }, keys =
            {
                "ALT",
                "G",
                "E",
                "3"
            }, titles =
            {
                "대시",
                "EMP",
                "상호작용",
                "충격봉"
            };
            for (int i = 0; i < 4; i++)
            {
                float x = 913 + i * 82;
                abilityIcons.Add(Icon(names[i], p, x, 627, 34, 34, White));
                Text("ability-" + i, p, "", x - 14, 605, 62, 20, 12, Mint, false, TextAnchor.MiddleCenter);
                Text("", p, titles[i], x - 16, 668, 66, 18, 10, Muted, false, TextAnchor.MiddleCenter);
                Text("", p, keys[i], x - 8, 689, 50, 17, 11, White, false, TextAnchor.MiddleCenter);
            }

            Text("device", p, "", 801, 577, 450, 35, 14, Mint, false, TextAnchor.MiddleRight);
            Text("mode", p, "RELAY ZERO", 30, 706, 390, 12, 9, Muted);
            Text("", p, "ESC · 메뉴", 1132, 707, 120, 12, 9, Muted, false, TextAnchor.MiddleRight);
            Text("boss-label", p, "", 430, 114, 420, 25, 14, Amber, false, TextAnchor.MiddleCenter);
            Box("boss track", p, 460, 143, 360, 4, new Color(0, 0, 0, .25f));
            bossFill = Box("boss fill", p, 460, 143, 360, 4, Danger);
            for (int i = 0; i < 4; i++)
            {
                var line = Box("crosshair-" + i, p, 0, 0, i < 2 ? 2 : 8, i < 2 ? 8 : 2, White);
                cross.Add(line.rectTransform);
            }

            Box("center dot", p, 639, 359, 2, 2, White);
            hit = Text("", p, "×", 615, 335, 50, 50, 38, White, true, TextAnchor.MiddleCenter);
            hit.gameObject.SetActive(false);
            damageFlash = Box("damage flash", p, 0, 0, 1280, 720, new Color(1, 0, 0, 0));
            damageFlash.sprite = DamageVignette();
            damageArrow = Text("", p, "▲", 620, 236, 40, 36, 30, Danger, true, TextAnchor.MiddleCenter).rectTransform;
            damageArrow.gameObject.SetActive(false);
            damageLabel = Text("", p, "", 566, 450, 148, 35, 19, Danger, true, TextAnchor.MiddleCenter);
            toast = Text("", p, "", 325, 500, 630, 45, 20, White, true, TextAnchor.MiddleCenter);
            BuildScope(p);
        }

        readonly List<RectTransform> cross = new List<RectTransform>();
        GameObject scope;
        Sprite CircleSprite()
        {
            const int n = 128;
            var tex = new Texture2D(n, n, TextureFormat.RGBA32, false);
            var pixels = new Color[n * n];
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float d = Vector2.Distance(new Vector2(x + .5f, y + .5f), Vector2.one * n * .5f);
                    pixels[y * n + x] = new Color(1, 1, 1, Mathf.Clamp01(n * .5f - d));
                }

            tex.SetPixels(pixels);
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, n, n), new Vector2(.5f, .5f));
        }

        Sprite DamageVignette()
        {
            const int n = 128;
            var tex = new Texture2D(n, n, TextureFormat.RGBA32, false);
            var pixels = new Color[n * n];
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float dx = (x - n * .5f) / (n * .5f), dy = (y - n * .5f) / (n * .5f);
                    float a = Mathf.Clamp01((Mathf.Max(Mathf.Abs(dx), Mathf.Abs(dy)) - .43f) / .57f);
                    pixels[y * n + x] = new Color(1, 1, 1, a * a);
                }

            tex.SetPixels(pixels);
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, n, n), new Vector2(.5f, .5f));
        }

        void BuildScope(Transform p)
        {
            scope = Rect("PRISM scope", p, 0, 0, 1280, 720).gameObject;
            Box("left mask", scope.transform, 0, 0, 280, 720, Color.black);
            Box("right mask", scope.transform, 1000, 0, 280, 720, Color.black);
            Box("vertical", scope.transform, 639, 0, 2, 720, new Color(.01f, .02f, .03f, .8f));
            Box("horizontal", scope.transform, 280, 359, 720, 2, new Color(.01f, .02f, .03f, .8f));
            for (int i = -3; i <= 3; i++)
            {
                Box("range", scope.transform, 640 + i * 48, 357, 1, 7, Color.black);
            }

            scope.SetActive(false);
            scope.transform.SetAsFirstSibling();
        }

        void BuildMenu()
        {
            var p = PageRoot("menu").transform;
            Box("menu pane", p, 0, 0, 1280, 720, new Color(.025f, .045f, .065f, .8f));
            Text("", p, "COMBAT SIMULATION / TRAINING DIVISION", 72, 52, 900, 25, 14, Mint);
            Text("", p, "RELAY\nZERO", 66, 101, 595, 204, 104, White, true);
            Text("", p, "돌파하고. 점령하고. 살아남아.", 76, 324, 530, 40, 23, White);
            Text("", p, "피스톨로 시작하는 다섯 번의 전투.\n친구와는 1vs1 결투 또는 2인 협동으로.", 76, 382, 490, 68, 17, Muted);
            Text("", p, "NATIVE UNITY / ORIGINAL ARENAS & ARSENAL", 76, 639, 620, 25, 12, Mint);
            Text("", p, "WASD 이동  ·  마우스 조준  ·  ALT 대시\nE 작동  ·  G EMP  ·  B 상점  ·  ESC 메뉴", 76, 547, 540, 63, 14, Muted);
            Text("", p, "01 / 전장 선택", 667, 51, 540, 30, 16, Mint);
            string[] ids =
            {
                "foundry",
                "cargo",
                "nexus"
            }, names =
            {
                "주조 공장",
                "화물 터미널",
                "넥서스 연구소"
            };
            for (int i = 0; i < 3; i++)
            {
                string id = ids[i];
                Button(p, names[i], 667 + i * 182, 91, 170, 57, () =>
                {
                    if (game.MapId != id)
                        game.LoadArena(id);
                    RefreshMenu();
                });
            }

            Text("map-description", p, "", 667, 157, 540, 46, 14, Muted);
            Text("", p, "02 / 난이도", 667, 218, 540, 30, 16, Mint);
            for (int i = 0; i < 4; i++)
            {
                int index = i;
                Button(p, Data.Balance.difficulties[i].label, 667 + i * 137, 256, 125, 43, () =>
                {
                    game.Difficulty = Data.Balance.difficulties[index];
                    PlayerPrefs.SetInt("relay-difficulty", index);
                    RefreshMenu();
                });
            }

            Text("difficulty-description", p, "", 667, 306, 540, 44, 13, Muted);
            Text("", p, "03 / 시작 피스톨", 667, 365, 540, 30, 16, Mint);
            Button(p, "P-12 SIDEARM / 12발", 667, 405, 262, 46, () =>
            {
                game.Pistol = "p12";
                RefreshMenu();
            });
            Button(p, "P-6 IMPACT / 6발", 941, 405, 262, 46, () =>
            {
                game.Pistol = "p6";
                RefreshMenu();
            });
            Text("selection", p, "", 667, 462, 540, 24, 13, Amber);
            Button(p, "게임 시작   →", 667, 505, 536, 57, () => game.StartRun(), true);
            Button(p, "친구와 1vs1", 667, 576, 170, 47, () => OpenLobby("duel"));
            Button(p, "2인 협동", 850, 576, 170, 47, () => OpenLobby("coop"));
            Button(p, "사격 연습장", 1033, 576, 170, 47, () => game.StartRun(true));
            Button(p, "설정", 667, 643, 170, 40, () => OpenSettings());
            Text("records", p, "", 850, 642, 353, 45, 12, Muted, false, TextAnchor.MiddleRight);
            RefreshMenu();
        }

        void RefreshMenu()
        {
            Set("map-description", game.Arena == null ? "" : game.Arena.title + " · " + game.Arena.description);
            Set("difficulty-description", game.Difficulty.description + " · 점수 ×" + game.Difficulty.scoreMultiplier);
            Set("selection", (game.Arena == null ? "" : game.Arena.name) + " / " + game.Difficulty.label + " / " + game.Pistol.ToUpperInvariant());
            if (game.Arena != null)
            {
                string key = "relay-record:" + game.MapId + ":" + game.Difficulty.id;
                Set("records", "BEST SCORE " + PlayerPrefs.GetInt(key) + "\n선택 전장·난이도의 개인 기록");
            }
        }

        void BuildPause()
        {
            var p = PageRoot("pause").transform;
            Box("pause background", p, 0, 0, 1280, 720, new Color(.02f, .04f, .06f, .88f));
            Title(p, "RELAY ZERO / PAUSED", "전투를 이어갈까?", "온라인에서는 메뉴를 열어도 전투가 계속돼.");
            Button(p, "게임으로 돌아가기", 80, 300, 480, 54, () => game.Resume(), true);
            Button(p, "무기 상점", 80, 371, 230, 48, () => game.OpenShop());
            Button(p, "설정", 330, 371, 230, 48, () => OpenSettings());
            Button(p, "다시 시작", 80, 439, 480, 48, () =>
            {
                if (game.Online.Active)
                {
                    Toast("온라인에서는 새 방에서 다시 시작해줘");
                    return;
                }

                game.StartRun(game.Practice);
            });
            Button(p, "메인 메뉴", 80, 507, 480, 48, () => game.Menu());
        }

        void BuildShop()
        {
            var p = PageRoot("shop").transform;
            Box("shop background", p, 0, 0, 1280, 720, Panel);
            Title(p, "SUPPLY / WEAPON MARKET", "다음 웨이브를 준비해.", "구매한 총기는 주무기 슬롯에 장착돼. 보유 무기의 탄약은 유지돼.");
            shopCoins = Text("", p, "", 830, 104, 370, 60, 35, Amber, true, TextAnchor.MiddleRight);
            string[] ids =
            {
                "s24",
                "ar7",
                "r20",
                "l5"
            };
            for (int i = 0; i < 4; i++)
            {
                string id = ids[i];
                var w = Data.Weapon(id);
                float x = 80 + i * 286;
                Box("weapon card", p, x, 292, 268, 196, new Color(.11f, .16f, .2f));
                Icon("rifle", p, x + 25, 308, 218, 50, Muted);
                Text("shop-item-" + id, p, w.name, x + 20, 367, 228, 31, 22, White, true);
                Text("", p, w.damage + " DMG  /  " + w.magazineSize + " ROUNDS", x + 20, 404, 228, 23, 12, Muted);
                Button(p, w.price + " COINS / 장착", x + 15, 444, 238, 33, () => game.Buy(id));
            }

            Text("", p, "현재 무기 부착물 · 총기당 최대 2개", 80, 512, 900, 26, 16, Mint);
            Button(p, "확장 탄창 / 200", 80, 554, 250, 43, () => game.Upgrade("magazine"));
            Button(p, "반동 제어기 / 250", 348, 554, 250, 43, () => game.Upgrade("stabilizer"));
            Button(p, "빠른 재장전 / 200", 616, 554, 250, 43, () => game.Upgrade("loader"));
            Button(p, "EMP +1 / 100", 884, 554, 316, 43, () => game.BuyEMP());
            Text("shop-detail", p, "", 80, 613, 790, 43, 14, Muted);
            Button(p, "전투로 돌아가기 →", 914, 644, 286, 47, () => game.Resume(), true);
        }

        public void RefreshShop()
        {
            shopCoins.text = game.Coins + " COINS";
            foreach (var w in Data.Balance.weapons)
                if (w.price > 0)
                    Set("shop-item-" + w.id, w.name + (game.Guns.Inventory.ContainsKey(w.id) ? "  ✓" : ""));
            Set("shop-detail", game.Guns.Current.Spec.name + " · 부착물 " + game.Guns.Current.Attachments.Count + "/2 · EMP " + game.EMP + "/3");
        }

        void OpenSettings()
        {
            back = current;
            Show("settings");
        }

        void BuildSettings()
        {
            var p = PageRoot("settings").transform;
            Box("settings background", p, 0, 0, 1280, 720, Panel);
            Title(p, "PREFERENCES", "전투 환경 설정", "화면 해상도를 유지하면서 조명·그림자 효과를 조절해.");
            Slider(p, "마우스 감도", 80, 285, .15f, 3, game.Settings.sensitivity, v => game.Settings.sensitivity = v);
            Slider(p, "시야각", 80, 348, 70, 110, game.Settings.fov, v => game.Settings.fov = v);
            Slider(p, "전체 음량", 80, 411, 0, 1, game.Settings.masterVolume, v => game.Settings.masterVolume = v);
            Slider(p, "효과음 음량", 80, 474, 0, 1, game.Settings.sfxVolume, v => game.Settings.sfxVolume = v);
            Slider(p, "크로스헤어 크기", 80, 537, .5f, 2, game.Settings.crosshairSize, v => game.Settings.crosshairSize = v);
            Text("", p, "그래픽 품질", 770, 284, 400, 30, 18, Mint);
            string[] quality =
            {
                "낮음",
                "중간",
                "높음"
            };
            for (int i = 0; i < 3; i++)
            {
                int n = i;
                Button(p, quality[i], 770 + i * 142, 331, 130, 43, () =>
                {
                    game.Settings.quality = n;
                    game.SaveSettings();
                });
            }

            Button(p, "머리 흔들림 켜기 / 끄기", 770, 410, 414, 46, () =>
            {
                game.Settings.headBob = !game.Settings.headBob;
                game.SaveSettings();
                Toast("머리 흔들림 " + (game.Settings.headBob ? "켜짐" : "꺼짐"));
            });
            Button(p, "그래픽 효과 자동 조절 켜기 / 끄기", 770, 478, 414, 46, () =>
            {
                game.Settings.autoGraphics = !game.Settings.autoGraphics;
                game.SaveSettings();
            });
            Button(p, "저장하고 돌아가기", 770, 623, 414, 54, () =>
            {
                game.SaveSettings();
                Show(back);
            }, true);
        }

        void Slider(Transform p, string label, float x, float y, float min, float max, float value, Action<float> change)
        {
            Text("", p, label, x, y, 245, 30, 17, White);
            var bg = Box(label, p, x + 246, y + 9, 365, 12, new Color(.2f, .27f, .3f));
            bg.raycastTarget = true;
            var s = bg.gameObject.AddComponent<Slider>();
            s.minValue = min;
            s.maxValue = max;
            s.direction = UnityEngine.UI.Slider.Direction.LeftToRight;
            var fill = Box("fill", bg.transform, 0, 0, 365, 12, Mint);
            s.fillRect = fill.rectTransform;
            var h = Box("handle", bg.transform, 0, -4, 12, 20, White);
            s.handleRect = h.rectTransform;
            s.targetGraphic = h;
            s.value = value;
            Text val = Text("", p, value.ToString("0.00"), x + 630, y, 100, 30, 14, Muted);
            s.onValueChanged.AddListener(v =>
            {
                change(v);
                val.text = v.ToString("0.00");
                game.SaveSettings();
            });
        }

        void OpenLobby(string mode)
        {
            game.Online.Mode = mode;
            Show("lobby");
            RefreshLobby();
        }

        void BuildLobby()
        {
            var p = PageRoot("lobby").transform;
            Box("lobby background", p, 0, 0, 1280, 720, Panel);
            Title(p, "FRIENDS / PRIVATE ROOM", "함께 전장으로.", "2명 전용 · 같은 무장 · 방장 권한으로 전투 판정 · 방장이 나가면 종료돼.");
            Button(p, "방 만들기", 80, 300, 480, 55, () => game.Online.Create(game.Online.Mode), true);
            roomInput = InputBox(p, "room input", 80, 388, 312, "10자리 방 코드", 10);
            Button(p, "입장", 410, 388, 150, 46, () => game.Online.Join(roomInput.text));
            roomCode = Text("", p, "", 705, 291, 490, 72, 43, Mint, true);
            Button(p, "방 코드 복사", 705, 375, 230, 43, () => GUIUtility.systemCopyBuffer = game.Online.Code);
            var ready = Button(p, "준비 완료", 705, 442, 490, 54, () =>
            {
                game.Online.SetReady();
                RefreshLobby();
            }, true);
            readyLabel = ready.GetComponentInChildren<Text>();
            lobbyRoster = Text("", p, "", 705, 509, 490, 58, 17, White);
            lobbyStatus = Text("", p, "", 80, 468, 500, 75, 16, Amber);
            Text("", p, "서버 주소 · 기존 Render 서버 사용", 80, 564, 1100, 24, 13, Muted);
            serverInput = InputBox(p, "server input", 80, 602, 800, "wss://…/rooms", 200);
            serverInput.text = game.Online.ServerURL;
            serverInput.onEndEdit.AddListener(v =>
            {
                if (Uri.TryCreate(v, UriKind.Absolute, out var uri) && (uri.Scheme == "wss" || uri.Scheme == "ws"))
                {
                    game.Online.ServerURL = v;
                    PlayerPrefs.SetString("relay-rooms-url", v);
                }
            });
            Button(p, "방 나가기 / 돌아가기", 913, 642, 286, 46, () =>
            {
                game.Online.Leave();
                game.Menu();
            });
        }

        public void RefreshLobby()
        {
            if (lobbyStatus)
                lobbyStatus.text = game.Online.Status;
            if (roomCode)
                roomCode.text = game.Online.Code;
            if (lobbyRoster)
                lobbyRoster.text = game.Online.Roster;
            if (readyLabel)
                readyLabel.text = game.Online.Ready ? "준비 취소" : "준비 완료";
        }

        void BuildResult()
        {
            var p = PageRoot("result").transform;
            Box("result background", p, 0, 0, 1280, 720, new Color(.025f, .045f, .065f, .95f));
            Title(p, "AFTER ACTION / MISSION REPORT", "전투 기록", "RELAY ZERO");
            Text("result-title", p, "", 80, 278, 1120, 74, 48, Mint, true);
            Text("result-stats", p, "", 80, 372, 1120, 164, 23, White);
            Button(p, "다시 시작", 80, 604, 342, 55, () =>
            {
                if (game.Online.Active)
                {
                    game.Menu();
                    return;
                }

                game.StartRun(game.Practice);
            }, true);
            Button(p, "무한 웨이브 계속", 446, 604, 352, 55, () =>
            {
                if (!game.Online.Active && game.Won && !game.Waves.Endless)
                    game.ContinueEndless();
                else
                    Toast("캠페인 5웨이브 승리 후 선택할 수 있어");
            });
            Button(p, "메인 메뉴", 822, 604, 378, 55, () => game.Menu());
        }

        public void Show(string page)
        {
            current = page;
            foreach (var p in panels)
                p.Value.SetActive(p.Key == page || p.Key == "playing" && page == "pause");
            if (page == "menu")
                RefreshMenu();
            if (page == "shop")
                RefreshShop();
            if (page == "lobby")
                RefreshLobby();
            if (page == "result")
            {
                Set("result-title", game.Won ? "MISSION COMPLETE" : "RETRY / 다시 도전해.");
                float accuracy = game.Shots > 0 ? (float)game.Hits / game.Shots * 100 : 0, heads = game.Hits > 0 ? (float)game.Heads / game.Hits * 100 : 0;
                Set("result-stats", game.Online.Active ? game.ResultDetail + "\n나 " + game.Online.Scores[game.Online.Self] + " : " + game.Online.Scores[1 - game.Online.Self] + " 친구  ·  " + Data.Clock(game.Elapsed) : "점수 " + game.Score + "   처치 " + game.Kills + "   플레이 시간 " + Data.Clock(game.Elapsed) + "\n명중률 " + accuracy.ToString("0.0") + "%   헤드샷 " + heads.ToString("0.0") + "%   받은 피해 " + game.DamageTaken.ToString("0") + "\n" + game.ResultDetail);
            }
        }

        public void ConfigureMap(ArenaData data)
        {
            radar.Configure(data);
            Set("radar-name", data.title);
            RefreshMenu();
        }

        public void Toast(string text, float duration = 2.5f)
        {
            toast.text = text;
            toastTime = duration;
        }

        public void Hit(bool head, bool killed)
        {
            hit.text = killed ? "✕" : "×";
            hit.color = head ? Amber : White;
            hit.gameObject.SetActive(true);
            hitTime = killed ? .23f : .14f;
        }

        public void Damage(Vector3 origin, float amount)
        {
            Vector3 d = origin - game.Player.Feet;
            float angle = Mathf.Atan2(d.x, d.z) * Mathf.Rad2Deg - game.Player.Yaw;
            damageArrow.anchoredPosition = new Vector2(640 + Mathf.Sin(angle * Mathf.Deg2Rad) * 103, -(360 - Mathf.Cos(angle * Mathf.Deg2Rad) * 103));
            damageArrow.localRotation = Quaternion.Euler(0, 0, -angle);
            damageArrow.gameObject.SetActive(true);
            damageTime = .75f;
            damageLabel.text = "−" + Mathf.CeilToInt(amount) + " HP";
        }

        public void Tick(float dt)
        {
            toastTime = Mathf.Max(0, toastTime - dt);
            if (toastTime == 0 && toast.text != "")
                toast.text = "";
            hitTime = Mathf.Max(0, hitTime - dt);
            if (hitTime == 0 && hit.gameObject.activeSelf)
                hit.gameObject.SetActive(false);
            damageTime = Mathf.Max(0, damageTime - dt);
            damageFlash.color = new Color(.95f, .08f, .06f, Mathf.Clamp01(damageTime / .75f) * .68f);
            if (damageTime == 0)
            {
                if (damageArrow.gameObject.activeSelf)
                    damageArrow.gameObject.SetActive(false);
                if (damageLabel.text != "")
                    damageLabel.text = "";
            }
        }

        float mapClock;
        public void Paint()
        {
            RefreshLobby();
            if (!game.Started || game.Finished)
                return;
            var online = game.Online;
            bool net = online.Active;
            int local = online.Self, other = 1 - local;
            int alive = 0;
            Bot boss = null;
            foreach (var b in game.Bots)
            {
                if (b.Alive)
                    alive++;
                if (b.Commander && b.Alive)
                    boss = b;
            }

            float wait = net ? online.Mode == "coop" ? online.Wait : 0 : game.Practice ? 0 : game.Waves.Wait;
            string objective = net ? online.Mode == "duel" ? "먼저 5킬을 달성해" : "서로 엄호하며 살아남아" : game.Practice ? "사격 연습장" : game.Mission.Kind == "capture" ? "중계기 점령" : game.Mission.Kind == "activate" ? "장치 2개 작동" : game.Mission.Kind == "defend" ? "구역 방어" : "적 전멸";
            Set("match-wave", net ? online.Mode == "duel" ? "FRIENDS / 1 VS 1" : "CO-OP / WAVE " + online.Wave + " / 05" : game.Practice ? "FIRING RANGE" : "WAVE " + Mathf.Max(1, game.Waves.Wave).ToString("00") + " / " + (game.Waves.Endless ? "∞" : "05"));
            Set("match-time", wait > 0 ? Mathf.CeilToInt(wait).ToString("00") : Data.Clock(game.Elapsed));
            Set("objective", objective);
            Set("friendly", net ? (online.Mode == "duel" ? online.Scores[local] : online.Scores[0] + online.Scores[1]).ToString() : game.Kills.ToString());
            Set("opposition", net ? (online.Mode == "duel" ? online.Scores[other] : alive + online.Pending).ToString() : game.Practice ? "03" : game.Waves.Remaining.ToString());
            Set("remaining", wait > 0 ? "다음 웨이브 " + Mathf.CeilToInt(wait) + "초" : net ? online.Mode == "duel" ? online.Ping + " ms" : "남은 로봇 " + (alive + online.Pending) + "기" : "남은 적 " + game.Waves.Remaining + " · 증원 " + game.Waves.Pending);
            Set("hp", Mathf.CeilToInt(game.Player.Health).ToString());
            Fill(healthFill, game.Player.Health / 100);
            healthFill.color = game.Player.Health <= 30 ? Danger : White;
            Set("score", net ? (online.Mode == "duel" ? online.Scores[local] + " : " + online.Scores[other] : (online.Scores[0] + online.Scores[1]).ToString()) : game.Score.ToString("00000"));
            Set("coins", net ? online.Mode == "duel" ? "5 KILLS TO WIN" : "친구 체력 " + Mathf.CeilToInt(online.HP[other]) : game.Coins + " COINS · B 상점");
            var gun = game.Guns;
            Set("weapon", gun.Current.Spec.name);
            Set("ammo", gun.Melee ? "∞" : gun.Current.Ammo.ToString());
            Set("reserve", gun.Melee ? "ARC-3" : "/ " + gun.Current.Reserve);
            Set("reload", gun.Current.Reload > 0 ? "RELOADING" : "R · RELOAD");
            Fill(reloadFill, gun.Current.Reload > 0 ? 1 - gun.Current.Reload / gun.Current.Spec.reloadTime : 0);
            for (int i = 0; i < 3; i++)
            {
                Set("slot-" + i, i == 0 && !gun.PrimaryOwned ? "주무기 미구매" : gun.Slots[i].Spec.name);
                labels["slot-" + i].color = gun.Slot == i ? White : Muted;
            }

            Set("ability-0", game.Player.DashCooldown > 0 ? game.Player.DashCooldown.ToString("0.0") : "준비");
            Set("ability-1", net ? "—" : game.EMP.ToString());
            Set("ability-2", net && online.Mode == "duel" ? "—" : game.HasMission ? (game.Mission.Progress / game.Mission.Duration * 100).ToString("0") + "%" : "");
            abilityIcons[1].color = net ? new Color(1, 1, 1, .15f) : White;
            abilityIcons[2].color = net && online.Mode == "duel" ? new Color(1, 1, 1, .15f) : White;
            Set("device", game.Online.Active ? game.Online.Hint : "");
            Set("mode", net ? online.Mode == "duel" ? "RELAY ZERO / DUEL" : "RELAY ZERO / CO-OP" : "RELAY ZERO / " + game.Difficulty.label);
            if (game.HasMission)
            {
                var mission = game.Mission;
                Set("mission-hint", mission.Contested ? "구역 경합 · 안의 적을 먼저 처리해" : mission.Kind == "activate" ? "E 길게 누르기 · 장치 " + (mission.Stage + 1) + " / 2" : mission.Kind == "defend" ? "구역에서 20초 방어" : "구역에서 12초 점령");
                var delta = game.MissionPoint - game.Player.Feet;
                float bearing = Mathf.DeltaAngle(game.Player.Yaw, Mathf.Atan2(delta.x, delta.z) * Mathf.Rad2Deg);
                Set("mission-distance", (Mathf.Abs(bearing) < 30 ? "↑" : bearing > 0 ? "→" : "←") + "  " + delta.magnitude.ToString("0") + "m · " + (mission.Progress / mission.Duration * 100).ToString("0") + "%");
                Fill(missionFill, mission.Progress / mission.Duration);
            }
            else
            {
                Set("mission-hint", "");
                Set("mission-distance", "");
                Fill(missionFill, 0);
            }

            Set("boss-label", boss ? "COMMAND UNIT / " + (boss.Windup > 0 ? "공격 경고 · 회피" : boss.WeakWindow > 0 ? "약점 노출 · 공격" : "장갑 가동") : "");
            Fill(bossFill, boss ? boss.Health / boss.MaxHealth : 0);
            float gap = (4 + gun.Spread * 1000) * game.Settings.crosshairSize;
            cross[0].anchoredPosition = new Vector2(639, -(360 - gap - 8));
            cross[1].anchoredPosition = new Vector2(639, -(360 + gap));
            cross[2].anchoredPosition = new Vector2(640 - gap - 8, -359);
            cross[3].anchoredPosition = new Vector2(640 + gap, -359);
            scope.SetActive(gun.Aiming && gun.Current.Spec.weaponType == "sniper");
            mapClock += .05f;
            if (mapClock >= .1f)
            {
                mapClock = 0;
                radar.Player = game.Player.Feet;
                radar.Yaw = game.Player.Yaw;
                radar.HasAlly = net && online.Mode == "coop";
                radar.Ally = Data.V(online.Remote.p);
                radar.AllyDown = radar.HasAlly && online.HP[other] <= 0;
                radar.HasObjective = game.HasMission;
                radar.Objective = game.HasMission ? game.MissionPoint : Vector3.zero;
                radar.SetVerticesDirty();
            }
        }
    }

    public class RadarGraphic : Graphic
    {
        struct Block
        {
            public float x, z, w, d;
        }

        readonly List<Block> walls = new List<Block>();
        public Vector3 Player, Ally, Objective;
        public float Yaw;
        public bool HasAlly, AllyDown, HasObjective;
        public void Configure(ArenaData map)
        {
            walls.Clear();
            foreach (var p in map.parts)
            {
                if (!p.solid || p.name == "ground")
                    continue;
                float minx = float.PositiveInfinity, minz = minx, maxx = float.NegativeInfinity, maxz = maxx, miny = minx;
                for (int i = 0; i < p.vertices.Length; i += 3)
                {
                    minx = Mathf.Min(minx, p.vertices[i]);
                    maxx = Mathf.Max(maxx, p.vertices[i]);
                    miny = Mathf.Min(miny, p.vertices[i + 1]);
                    minz = Mathf.Min(minz, p.vertices[i + 2]);
                    maxz = Mathf.Max(maxz, p.vertices[i + 2]);
                }

                if (miny > 5)
                    continue;
                walls.Add(new Block { x = minx, z = minz, w = maxx - minx, d = maxz - minz });
            }

            SetVerticesDirty();
        }

        Vector2 P(Vector3 p)
        {
            return new Vector2((p.x + 24) / 48 * rectTransform.rect.width, (-24 + p.z) / 48 * rectTransform.rect.height);
        }

        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();
            foreach (var b in walls)
            {
                var a = P(new Vector3(b.x, 0, b.z));
                var c = P(new Vector3(b.x + b.w, 0, b.z + b.d));
                Quad(vh, a, c, new Color(.48f, .57f, .62f, .8f));
            }

            if (HasObjective)
                Diamond(vh, P(Objective), 6, new Color(1, .8f, .4f));
            if (HasAlly)
                Diamond(vh, P(Ally), 4, AllyDown ? new Color(1, .4f, .35f) : new Color(.6f, 1, .83f));
            Vector2 center = P(Player), forward = new Vector2(Mathf.Sin(Yaw * Mathf.Deg2Rad), Mathf.Cos(Yaw * Mathf.Deg2Rad)), right = new Vector2(forward.y, -forward.x);
            int i = vh.currentVertCount;
            Vertex(vh, center + forward * 6, Color.white);
            Vertex(vh, center - forward * 4 + right * 4, Color.white);
            Vertex(vh, center - forward * 4 - right * 4, Color.white);
            vh.AddTriangle(i, i + 1, i + 2);
        }

        static void Vertex(VertexHelper vh, Vector2 p, Color c)
        {
            var v = UIVertex.simpleVert;
            v.position = p;
            v.color = c;
            vh.AddVert(v);
        }

        static void Quad(VertexHelper vh, Vector2 a, Vector2 c, Color color)
        {
            int i = vh.currentVertCount;
            Vertex(vh, a, color);
            Vertex(vh, new Vector2(a.x, c.y), color);
            Vertex(vh, c, color);
            Vertex(vh, new Vector2(c.x, a.y), color);
            vh.AddTriangle(i, i + 1, i + 2);
            vh.AddTriangle(i, i + 2, i + 3);
        }

        static void Diamond(VertexHelper vh, Vector2 p, float s, Color c)
        {
            int i = vh.currentVertCount;
            Vertex(vh, p + Vector2.up * s, c);
            Vertex(vh, p + Vector2.right * s, c);
            Vertex(vh, p + Vector2.down * s, c);
            Vertex(vh, p + Vector2.left * s, c);
            vh.AddTriangle(i, i + 1, i + 2);
            vh.AddTriangle(i, i + 2, i + 3);
        }
    }
}
