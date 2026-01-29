import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@/types';
import { useDirectorStore } from '@/stores/director-store';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export function getSocket(): TypedSocket {
  if (!socket) {
    socket = io({
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setupSocketListeners(socket);
  }
  return socket;
}

function setupSocketListeners(socket: TypedSocket) {
  socket.on('connect', () => console.log('Socket connected:', socket.id));
  socket.on('disconnect', () => console.log('Socket disconnected'));
  socket.on('marker_update', (data) => {
    useDirectorStore.getState().setMarkedLineIndex(data.index);
  });
  socket.on('director_status', (data) => {
    useDirectorStore.getState().setIsDirector(data.isDirector);
    useDirectorStore.getState().setDirectorName(data.directorName);
  });
  socket.on('director_changed', (data) => {
    useDirectorStore.getState().setDirectorName(data.directorName);
  });
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}

export function joinPlay(playId: string) {
  getSocket().emit('join_play', { play_id: playId });
}

export function setDirector(name: string, password: string, playId: string) {
  getSocket().emit('set_director', { name, password, play_id: playId });
}

export function unsetDirector(playId: string) {
  getSocket().emit('unset_director', { play_id: playId });
}

export function setMarker(index: number, playId: string) {
  getSocket().emit('set_marker', { index, play_id: playId });
}

export function useSocket() {
  return { socket: getSocket(), connect: connectSocket, disconnect: disconnectSocket, joinPlay, setDirector, unsetDirector, setMarker };
}
