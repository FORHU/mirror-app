"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocketClient(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
      autoConnect: false,
      transports: ["websocket"],
    });
  }

  return socket;
}
