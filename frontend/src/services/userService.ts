import { User } from '../types';
import { API_BASE } from '../api';

export const getUsers = async (): Promise<User[]> => {
  try {
    const res = await fetch(`${API_BASE}/api/users`);
    if (!res.ok) throw new Error('Failed to fetch users');
    return await res.json();
  } catch (e) {
    console.error('Failed to fetch users:', e);
    return [];
  }
};

export const saveUser = async (user: User) => {
  const res = await fetch(`${API_BASE}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  });
  if (!res.ok) throw new Error('Failed to save user');
};

export const deleteUser = async (id: string) => {
  const res = await fetch(`${API_BASE}/api/users/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete user');
};

export const authenticate = async (username: string, password: string): Promise<User | null> => {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch (e) {
    console.error('Login error:', e);
    return null;
  }
};
