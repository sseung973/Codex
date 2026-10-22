import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { Rooms } from './rooms.mjs';
const allowed = new Set((process.env.ALLOWED_ORIGINS || 'https://relay-zero-arena.sseung973.chatgpt.site,http://localhost:5173,http://127.0.0.1:5173').split(','));
const server = http.createServer((req, res) => {
  res.writeHead(req.url === '/health' ? 200 : 404, {'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify(req.url === '/health' ? {ok:true, version:'3.0.0'} : {error:'not found'}));
});
const wss = new WebSocketServer({noServer:true, maxPayload:65536, perMessageDeflate:false});
const rooms = new Rooms((ws, message) => {
  if (ws.readyState !== WebSocket.OPEN) return;
  if (ws.bufferedAmount > 1024 * 1024) return ws.terminate();
  if (ws.bufferedAmount > 256 * 1024 && ['pose','state'].includes(message.type)) return;
  ws.send(JSON.stringify(message));
});
server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/rooms' || !allowed.has(req.headers.origin) || wss.clients.size >= 220) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
  wss.handleUpgrade(req,socket,head,ws => wss.emit('connection',ws,req));
});
wss.on('connection', ws => {
  const peer = rooms.connect(ws); ws.alive = true;
  ws.on('pong', () => {ws.alive = true;});
  ws.on('message', data => {try {rooms.receive(peer,JSON.parse(data.toString()));} catch {ws.close(1007,'Invalid message');}});
  ws.on('close', () => rooms.disconnect(peer)); ws.on('error', () => rooms.disconnect(peer));
});
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) { if (!ws.alive) ws.terminate(); else {ws.alive=false;ws.ping();} }
  rooms.sweep();
},30000); heartbeat.unref();
server.listen(Number(process.env.PORT || 3001),'0.0.0.0',()=>console.log('RELAY ZERO rooms listening'));
function shutdown() {clearInterval(heartbeat);for(const ws of wss.clients) ws.close(1001,'Server restarting');server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),5000).unref();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
