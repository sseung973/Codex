using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using RelayZero;

class Program
{
    static int checks;
    static void Assert(bool value, string name)
    {
        if (!value)
            throw new Exception("FAIL: " + name);
        checks++;
        Console.WriteLine("PASS " + name);
    }

    static void Main()
    {
        string root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../Assets/RelayZero/Resources/Data"));
        if (!Directory.Exists(root))
            root = Path.GetFullPath("Assets/RelayZero/Resources/Data");
        var options = new JsonSerializerOptions
        {
            IncludeFields = true
        };
        using var balance = JsonDocument.Parse(File.ReadAllText(Path.Combine(root, "balance.json")));
        var weapons = JsonSerializer.Deserialize<WeaponSpec[]>(balance.RootElement.GetProperty("weapons").GetRawText(), options);
        var diffs = JsonSerializer.Deserialize<DifficultySpec[]>(balance.RootElement.GetProperty("difficulties").GetRawText(), options);
        var ar = weapons.Single(w => w.id == "ar7");
        var m = new Magazine(ar)
        {
            Ammo = 8,
            Reserve = 50
        };
        Assert(m.StartReload(), "reload starts");
        m.Tick(ar.reloadTime);
        Assert(m.Ammo == 30 && m.Reserve == 28, "partial reload conserves ammunition");
        Assert(!m.StartReload(), "full magazine cannot reload");
        m.Ammo = 0;
        m.Reserve = 0;
        Assert(!m.StartReload(), "no reserve cannot reload");
        m.Ammo = 8;
        m.Reserve = 1;
        m.StartReload();
        m.Tick(100);
        Assert(m.Ammo == 9 && m.Reserve == 0, "last reserve round is preserved");
        m = new Magazine(ar);
        Assert(m.Upgrade("magazine") && m.Spec.magazineSize == 45 && m.Ammo == 30, "extended magazine does not create loaded ammunition");
        Assert(m.Upgrade("stabilizer") && !m.Upgrade("loader") && !m.Upgrade("magazine"), "two distinct attachments maximum");
        Assert(ar.magazineSize == 30, "attachment does not mutate shared weapon definition");
        m.Reserve = 170;
        m.Resupply(3);
        Assert(m.Reserve == 180, "resupply is capped");
        var mission = new Mission();
        mission.Reset(2);
        mission.Tick(6, true, false, false);
        mission.Tick(3, false, false, false);
        Assert(mission.Progress == 6, "capture progress persists outside zone");
        mission.Tick(6, true, true, false);
        Assert(!mission.Done && mission.Progress == 6, "contested capture pauses");
        Assert(mission.Tick(6, true, false, false) && mission.Done, "capture completes at 12 seconds");
        mission.Reset(3);
        mission.Tick(2, true, false, true);
        mission.Tick(.1f, true, false, false);
        Assert(mission.Progress == 0, "activation resets when E is released");
        mission.Tick(3, true, false, true);
        Assert(mission.Stage == 1 && !mission.Done, "activation requires two devices");
        Assert(mission.Tick(3, true, false, true), "second device completes activation");
        mission.Reset(4);
        mission.Tick(10, true, false, false);
        mission.Tick(2, false, false, false);
        Assert(mission.Progress == 6, "defense decays two seconds per second");
        foreach (var d in diffs)
        {
            var waves = new WaveDirector();
            int total = 0, spawns = 0;
            bool victory = false;
            waves.Spawn = (w, n, o) =>
            {
                total += n;
                spawns++;
                waves.ObjectiveDone = false;
            };
            waves.Victory = () => victory = true;
            waves.Reset(d.waves, d.rest);
            for (int step = 0; step < 10000 && !victory; step++)
            {
                waves.Tick(.1f);
                if (waves.Wait <= 0 && waves.Remaining > 0)
                {
                    int active = waves.Spawned - (waves.Total - waves.Remaining);
                    if (active > 0)
                        waves.Kill();
                    if (waves.Remaining == 0)
                    {
                        Assert(!victory, "wave needs objective completion / " + d.id);
                        waves.FinishObjective();
                    }
                }
            }

            Assert(victory && waves.Wave == 5 && total == d.waves.Sum(), "all difficulty wave counts and reinforcements / " + d.id);
            Assert(waves.Continue() && waves.Endless && !waves.Complete, "endless resumes only after victory / " + d.id);
            waves.Tick(d.rest);
            Assert(waves.Wave == 6 && waves.Total == d.waves.Last() + 3, "endless increases total by three / " + d.id);
        }

        var gate = new ShotGate();
        Assert(gate.Accept(1, 0, 10) && !gate.Accept(1, 1, 10) && !gate.Accept(2, .01f, 10) && gate.Accept(2, .1f, 10), "network gate rejects replays and excessive fire rate");
        Assert(Math.Abs(CombatRules.RayBox(new[] { 0f, 1f, -5 }, new[] { 0f, 0f, 1 }, new[] { -1f, 0f, -1 }, new[] { 1f, 2f, 1 }, 10) - 4) < .001f, "duel slab intersection distance");
        Assert(CombatRules.RayBox(new[] { 3f, 1f, -5 }, new[] { 0f, 0f, 1 }, new[] { -1f, 0f, -1 }, new[] { 1f, 2f, 1 }, 10) < 0, "parallel ray misses player bounds");
        Assert(!CombatRules.FiniteVector(new[] { float.NaN, 0, 0 }) && !CombatRules.FiniteVector(new[] { 151f, 0, 0 }), "network vectors reject NaN and bounds overflow");
        foreach (string map in new[]
        {
            "foundry",
            "cargo",
            "nexus"
        }

        )
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(root, map + ".json")));
            var v = doc.RootElement;
            Assert(v.GetProperty("mission").GetArrayLength() == 2 && v.GetProperty("spawns").GetArrayLength() == 7, "exported spawn and objective anchors / " + map);
            Assert(v.GetProperty("lights").EnumerateArray().All(l => l.GetProperty("range").GetDouble() <= 5000), "Unity float-safe light ranges / " + map);
                int triangles = 0;
            foreach (var p in v.GetProperty("parts").EnumerateArray())
            {
                var verts = p.GetProperty("vertices");
                var indices = p.GetProperty("triangles");
                if (verts.GetArrayLength() % 3 != 0 || indices.GetArrayLength() % 3 != 0)
                    throw new Exception("Corrupt geometry");
                foreach (var index in indices.EnumerateArray())
                    if (index.GetInt32() < 0 || index.GetInt32() >= verts.GetArrayLength() / 3)
                        throw new Exception("Invalid mesh index");
                triangles += indices.GetArrayLength() / 3;
            }

            Assert(triangles > 100, "complete original mesh geometry / " + map);
        }

        Assert(weapons.Length == 7 && diffs.Length == 4, "all original weapons and difficulty presets");
        Console.WriteLine("Passed " + checks + " checks.");
    }
}
