#if UNITY_WEBGL && !UNITY_EDITOR
using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using System.Text;

namespace RelayZero
{
    // Browser builds must use the browser's WebSocket API; ClientWebSocket needs OS sockets.
    public class RoomSocket
    {
        [DllImport("__Internal")] static extern int RelaySocketOpen(string url, string action);
        [DllImport("__Internal")] static extern int RelaySocketState(int id);
        [DllImport("__Internal")] static extern int RelaySocketSize(int id);
        [DllImport("__Internal")] static extern int RelaySocketRead(int id, [Out] byte[] buffer, int capacity);
        [DllImport("__Internal")] static extern void RelaySocketSend(int id, string json);
        [DllImport("__Internal")] static extern void RelaySocketClose(int id);

        public readonly ConcurrentQueue<string> Messages = new ConcurrentQueue<string>();
        int handle;
        byte[] buffer = new byte[8192];
        public bool Connected { get { return handle != 0 && RelaySocketState(handle) == 1; } }

        public void Connect(string url, string action)
        {
            Close();
            handle = RelaySocketOpen(url, action);
        }

        public void Pump()
        {
            if (handle == 0)
                return;
            // Bound work per frame even if several snapshots arrived while the tab was inactive.
            for (int i = 0; i < 64; i++)
            {
                int size = RelaySocketSize(handle);
                if (size <= 0)
                    break;
                if (size > 262145)
                {
                    Close();
                    Messages.Enqueue("{\"type\":\"closed\",\"message\":\"Room packet exceeds limit\"}");
                    break;
                }
                if (buffer.Length < size)
                    buffer = new byte[size];
                int count = RelaySocketRead(handle, buffer, buffer.Length);
                if (count <= 0)
                    break;
                Messages.Enqueue(Encoding.UTF8.GetString(buffer, 0, count));
            }
        }

        public void Send(string json)
        {
            if (Connected)
                RelaySocketSend(handle, json);
        }

        public void Close()
        {
            if (handle != 0)
                RelaySocketClose(handle);
            handle = 0;
            while (Messages.TryDequeue(out _)) { }
        }
    }
}
#endif
