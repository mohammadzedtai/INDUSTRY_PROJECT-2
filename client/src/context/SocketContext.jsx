import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext({
  socket: null,
  onlineUsers: [],
  isConnected: false,
});

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  const userId = user?._id || null;

  useEffect(() => {
    const token = localStorage.getItem('accessToken');

    if (!userId || !token) {
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers([]);
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const handleConnect = () => {
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleOnlineUsers = (usersList) => {
      setOnlineUsers(Array.isArray(usersList) ? usersList : []);
    };

    const handleConnectError = (err) => {
      console.error('Socket connection error:', err?.message || err);
      setIsConnected(false);
    };

    newSocket.on('connect', handleConnect);
    newSocket.on('disconnect', handleDisconnect);
    newSocket.on('online_users', handleOnlineUsers);
    newSocket.on('connect_error', handleConnectError);

    setSocket(newSocket);

    return () => {
      newSocket.off('connect', handleConnect);
      newSocket.off('disconnect', handleDisconnect);
      newSocket.off('online_users', handleOnlineUsers);
      newSocket.off('connect_error', handleConnectError);
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [userId]);

  const value = useMemo(
    () => ({ socket, onlineUsers, isConnected }),
    [socket, onlineUsers, isConnected]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);