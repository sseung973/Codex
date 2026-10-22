using System;
using System.Collections.Concurrent;
using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace RelayZero
{
    public class RoomSocket
    {
        public bool Connected
        {
            get
            {
                return socket != null && socket.State == WebSocketState.Open;
            }
        }

        public readonly ConcurrentQueue<string> Messages = new ConcurrentQueue<string>();
        ClientWebSocket socket;
        CancellationTokenSource cancellation;
        readonly SemaphoreSlim sending = new SemaphoreSlim(1, 1);
        int generation;
        public async void Connect(string url, string action)
        {
            Close();
            int id = ++generation;
            cancellation = new CancellationTokenSource();
            cancellation.CancelAfter(TimeSpan.FromSeconds(75));
            var token = cancellation.Token;
            socket = new ClientWebSocket();
            // The existing Render service checks this first-party origin on upgrade.
            socket.Options.SetRequestHeader("Origin", "https://relay-zero-arena.sseung973.chatgpt.site");
            var current = socket;
            try
            {
                await current.ConnectAsync(new Uri(url), token);
                if (id != generation)
                    return;
                cancellation.CancelAfter(Timeout.Infinite);
                Send(action);
                await Receive(current, token, id);
            }
            catch (Exception e)
            {
                if (id == generation && !token.IsCancellationRequested)
                    Messages.Enqueue(JsonUtilitySafeError(e.Message));
                else if (id == generation)
                    Messages.Enqueue(JsonUtilitySafeError("연결 시간이 초과됐어. Render 서버를 확인해줘."));
            }
        }

        static string JsonUtilitySafeError(string message)
        {
            return "{\"type\":\"closed\",\"message\":\"" + message.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", " ").Replace("\r", " ") + "\"}";
        }

        async Task Receive(ClientWebSocket current, CancellationToken token, int id)
        {
            var buffer = new byte[8192];
            while (current.State == WebSocketState.Open && !token.IsCancellationRequested && id == generation)
            {
                using (var stream = new MemoryStream())
                {
                    WebSocketReceiveResult result;
                    do
                    {
                        result = await current.ReceiveAsync(new ArraySegment<byte>(buffer), token);
                        if (result.MessageType == WebSocketMessageType.Close)
                        {
                            if (id == generation)
                                Messages.Enqueue(JsonUtilitySafeError("서버 연결이 종료됐어."));
                            return;
                        }

                        stream.Write(buffer, 0, result.Count);
                        if (stream.Length > 262144)
                            throw new InvalidDataException("Room packet exceeds limit");
                    }
                    while (!result.EndOfMessage);
                    if (id == generation)
                        Messages.Enqueue(Encoding.UTF8.GetString(stream.ToArray()));
                }
            }
        }

        public async void Send(string json)
        {
            var current = socket;
            var token = cancellation?.Token ?? CancellationToken.None;
            if (current == null || current.State != WebSocketState.Open)
                return;
            bool entered = false;
            try
            {
                await sending.WaitAsync(token);
                entered = true;
                if (current.State == WebSocketState.Open)
                {
                    byte[] bytes = Encoding.UTF8.GetBytes(json);
                    await current.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, token);
                }
            }
            catch (Exception)
            { /* Receive loop reports connection failure on the main thread. */
            }
            finally
            {
                if (entered)
                    sending.Release();
            }
        }

        public void Close()
        {
            generation++;
            var old = socket;
            socket = null;
            cancellation?.Cancel();
            cancellation?.Dispose();
            cancellation = null;
            old?.Abort();
            old?.Dispose();
            while (Messages.TryDequeue(out _))
            {
            }
        }
    }
}
