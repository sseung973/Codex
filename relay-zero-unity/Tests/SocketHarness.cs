using System;
using System.Text.Json;
using System.Threading.Tasks;
using RelayZero;

class SocketTests
{
    static async Task<JsonElement> Wait(RoomSocket s, string type)
    {
        var until = DateTime.UtcNow.AddSeconds(10);
        while (DateTime.UtcNow < until)
        {
            while (s.Messages.TryDequeue(out string json))
            {
                var m = JsonDocument.Parse(json).RootElement.Clone();
                var t = m.GetProperty("type").GetString();
                if (t == "closed" || t == "error")
                    throw new Exception(json);
                if (t == type)
                    return m;
            }

            await Task.Delay(10);
        }

        throw new Exception("Timeout " + type);
    }

    static async Task Main()
    {
        foreach (string mode in new[]
        {
            "duel",
            "coop"
        }

        )
        {
            var h = new RoomSocket();
            var g = new RoomSocket();
            try
            {
                string url = Environment.GetEnvironmentVariable("RELAY_ROOM_TEST_URL") ?? "ws://127.0.0.1:3001/rooms";
                h.Connect(url, "{\"type\":\"create\",\"mode\":\"" + mode + "\",\"map\":\"nexus\"}");
                await Wait(h, "joined");
                var room = await Wait(h, "room");
                string code = room.GetProperty("code").GetString();
                g.Connect(url, "{\"type\":\"join\",\"code\":\"" + code + "\"}");
                await Wait(g, "joined");
                await Wait(g, "room");
                h.Send("{\"type\":\"ready\",\"value\":true}");
                g.Send("{\"type\":\"ready\",\"value\":true}");
                await Wait(h, "start");
                await Wait(g, "start");
                h.Send("{\"type\":\"loaded\"}");
                g.Send("{\"type\":\"loaded\"}");
                await Wait(h, "begin");
                await Wait(g, "begin");
                g.Send("{\"type\":\"pose\",\"p\":[2,0,18],\"y\":3.1416,\"pitch\":0,\"crouch\":false,\"revive\":true}");
                var pose = await Wait(h, "pose");
                if (pose.GetProperty("from").GetString() != "guest")
                    throw new Exception("Pose source");
                g.Send("{\"type\":\"shot\",\"o\":[2,1.65,18],\"d\":[0,0,-1],\"weapon\":\"ar7\",\"seq\":1}");
                await Wait(h, "shot");
                h.Send("{\"type\":\"state\",\"state\":{\"hp\":[100,74],\"scores\":[1,0],\"respawn\":[0,0],\"epochs\":[0,0],\"protect\":[0,0],\"wave\":1,\"pending\":0,\"wait\":0,\"revive\":0,\"time\":1,\"enemies\":[]}}");
                var state = await Wait(g, "state");
                if (state.GetProperty("state").GetProperty("hp")[1].GetInt32() != 74)
                    throw new Exception("State mismatch");
                h.Send("{\"type\":\"event\",\"event\":\"damage\",\"origin\":[0,1,0],\"amount\":26}");
                await Wait(g, "event");
                Console.WriteLine("PASS native ClientWebSocket " + mode + ": origin, create, join, ready, load barrier, begin, pose, shot, full state, damage");
            }
            finally
            {
                h.Close();
                g.Close();
            }
        }
    }
}
