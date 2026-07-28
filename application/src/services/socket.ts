import { io, type Socket } from 'socket.io-client';
import { Env } from '../config/env';
import { tokenStorage } from './tokenStorage';

let socket: Socket | null = null;
const rooms = new Map<string, number>();

const log = (...args: unknown[]): void => {
  if (Env.IS_DEV) {
    console.log('[socket]', ...args);
  }
};

const attachLogging = (s: Socket): void => {
  s.on('connect', () => {
    log('✅ connected · id =', s.id);
    rooms.forEach((_count, visitId) => {
      log('↻ re-joining room visit:' + visitId);
      s.emit('visit:join', { visitId });
    });
  });
  s.on('connect_error', (e: Error) => log('❌ connect_error:', e.message));
  s.on('disconnect', (reason: string) => log('🔌 disconnected:', reason));
  s.io.on('reconnect_attempt', (n: number) => log('♻️  reconnect attempt', n));
  s.io.on('reconnect', (n: number) => log('✅ reconnected after', n, 'attempt(s)'));
  s.io.on('error', (e: Error) => log('⚠️  manager error:', e.message));
  s.onAny((event: string, ...args: unknown[]) => log('⬇️  recv', event, args[0]));
  s.onAnyOutgoing((event: string, ...args: unknown[]) => log('⬆️  send', event, args[0]));
};

export const connectSocket = async (): Promise<Socket> => {
  const token = (await tokenStorage.get()) ?? '';
  log(
    'connectSocket() · host =',
    Env.API_HOST,
    '· token =',
    token ? `${token.slice(0, 10)}…` : 'MISSING',
  );
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) {
      log('reusing socket → reconnecting…');
      socket.connect();
    } else {
      log('reusing socket · already connected · id =', socket.id);
    }
    return socket;
  }
  log('creating new socket →', `${Env.API_HOST}/socket.io`);
  socket = io(Env.API_HOST, {
    path: '/socket.io',
    transports: ['polling', 'websocket'],
    auth: { token },
    autoConnect: true,
    reconnection: true,
  });
  attachLogging(socket);
  return socket;
};

export const getSocket = (): Socket | null => socket;

/**
 * Re-hands the socket its new access token after an HTTP refresh.
 *
 * The handshake auth is only read when a connection is established, so a socket
 * that is already up keeps running on the old token — but the next reconnect
 * would present an expired one and be refused. Updating `auth` in place fixes
 * that; a socket that has already dropped is reconnected immediately.
 */
export const reauthSocket = (token: string): void => {
  if (!socket) {
    return;
  }
  socket.auth = { token };
  if (!socket.connected) {
    log('re-auth · reconnecting with refreshed token');
    socket.connect();
  }
};

export const joinVisitRoom = (visitId: string): void => {
  rooms.set(visitId, (rooms.get(visitId) ?? 0) + 1);
  socket?.emit('visit:join', { visitId });
};

export const leaveVisitRoom = (visitId: string): void => {
  const next = (rooms.get(visitId) ?? 0) - 1;
  if (next <= 0) {
    rooms.delete(visitId);
  } else {
    rooms.set(visitId, next);
  }
};

export const closeSocket = (): void => {
  if (socket) {
    log('closeSocket() · tearing down');
    rooms.clear();
    socket.removeAllListeners();
    socket.close();
    socket = null;
  }
};
