import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import axiosInstance from '../api/axiosInstance';

const AuthContext = createContext(null);

const getStoredUser = () => {
  try {
    const saved = localStorage.getItem('chatUser');
    return saved ? JSON.parse(saved) : null;
  } catch {
    localStorage.removeItem('chatUser');
    return null;
  }
};

const normalizeUser = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw.user && typeof raw.user === 'object' ? raw.user : raw;
  return {
    _id: source._id,
    name: source.name,
    email: source.email,
    avatar: source.avatar || '',
  };
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        if (active) setLoading(false);
        return;
      }

      try {
        const { data } = await axiosInstance.get('/auth/me');
        const normalized = normalizeUser(data);
        if (!active) return;

        if (normalized?._id) {
          setUser(normalized);
          localStorage.setItem('chatUser', JSON.stringify(normalized));
        } else {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('chatUser');
          setUser(null);
        }
      } catch {
        if (!active) return;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('chatUser');
        setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    verifySession();

    return () => {
      active = false;
    };
  }, []);

  const saveAuthSession = (authData) => {
    if (authData?.token) {
      localStorage.setItem('accessToken', authData.token);
    }
    const userPayload = normalizeUser(authData);
    if (userPayload?._id) {
      localStorage.setItem('chatUser', JSON.stringify(userPayload));
      setUser(userPayload);
    }
  };

  const login = async (email, password) => {
    const { data } = await axiosInstance.post('/auth/login', { email, password });
    saveAuthSession(data);
    return data;
  };

  const register = async (name, email, password) => {
    const { data } = await axiosInstance.post('/auth/register', { name, email, password });
    saveAuthSession(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('chatUser');
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);