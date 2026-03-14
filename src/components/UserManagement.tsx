import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { Users, UserPlus, Shield, Trash2, Search, MoreVertical, ShieldCheck, ShieldAlert, Eye, User as UserIcon, X, Key, Lock } from 'lucide-react';
import { getUsers, saveUser, deleteUser as removeUser } from '../services/userService';

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  ADMIN: <ShieldAlert className="w-4 h-4 text-rose-600" />,
  POWER_USER: <ShieldCheck className="w-4 h-4 text-indigo-600" />,
  END_USER: <UserIcon className="w-4 h-4 text-emerald-600" />,
  READ_ONLY: <Eye className="w-4 h-4 text-blue-600" />,
};

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  POWER_USER: 'Power User',
  END_USER: 'End User',
  READ_ONLY: 'Read Only',
};

export function UserManagement({ logEvent }: { logEvent: (type: string, details?: any) => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form state
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('END_USER');
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    const loadUsers = async () => {
      const data = await getUsers();
      setUsers(data);
    };
    loadUsers();
  }, []);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    const userToDelete = users.find(u => u.id === id);
    if (confirm(`Are you sure you want to delete user "${userToDelete?.name}"?`)) {
      await removeUser(id);
      logEvent('USER_DELETED', { deletedUserId: id, deletedUserName: userToDelete?.name });
      const data = await getUsers();
      setUsers(data);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    // Check for duplicate username
    if (users.some(u => u.username.toLowerCase() === newUsername.toLowerCase())) {
      setModalError('Username already exists. Please choose another one.');
      return;
    }

    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: newName,
      username: newUsername,
      password: newPassword,
      role: newRole
    };
    
    try {
      await saveUser(newUser);
      logEvent('USER_CREATED', { newUserId: newUser.id, newUserName: newUser.name, newUserRole: newUser.role });
      const data = await getUsers();
      setUsers(data);
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      setModalError('Failed to save user. Please try again.');
    }
  };

  const resetForm = () => {
    setNewName('');
    setNewUsername('');
    setNewPassword('');
    setNewRole('END_USER');
    setModalError(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
          <p className="text-zinc-500 mt-1">Manage system access and permission levels for all team members.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-zinc-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-zinc-800 transition-all flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Add New User
        </button>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search users by name, username or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 bg-white border border-zinc-200 px-3 py-2 rounded-lg">
            <Users className="w-3.5 h-3.5" />
            {users.length} Total Users
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-50/50">
                <th className="px-6 py-4 border-b border-zinc-100">User</th>
                <th className="px-6 py-4 border-b border-zinc-100">Username</th>
                <th className="px-6 py-4 border-b border-zinc-100">Permission Level</th>
                <th className="px-6 py-4 border-b border-zinc-100 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-600">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900">{user.name}</p>
                        <p className="text-xs text-zinc-500">ID: {user.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-mono text-zinc-600">{user.username}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md ${
                        user.role === 'ADMIN' ? 'bg-rose-50' : 
                        user.role === 'POWER_USER' ? 'bg-indigo-50' : 
                        user.role === 'END_USER' ? 'bg-emerald-50' : 'bg-blue-50'
                      }`}>
                        {ROLE_ICONS[user.role]}
                      </div>
                      <span className="text-sm font-medium text-zinc-700">{ROLE_LABELS[user.role]}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleDelete(user.id)}
                        disabled={user.username === 'admin'}
                        className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <h3 className="text-lg font-bold">Create New User</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-2 text-rose-700 text-xs font-medium">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <p>{modalError}</p>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="e.g. John Doe"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Username</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="e.g. jdoe"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Permission Level</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as UserRole)}
                  className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                >
                  <option value="READ_ONLY">Read Only</option>
                  <option value="END_USER">End User</option>
                  <option value="POWER_USER">Power User</option>
                  <option value="ADMIN">Administrator</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-zinc-200 text-zinc-600 rounded-lg font-medium hover:bg-zinc-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition-all"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
