import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { API } from '../config/api';
import usePlayer from '../hooks/usePlayer';

const AdminPanel = () => {
  const { token } = usePlayer();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ total: 0, users: [] });
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const res = await axios.get(API('/admin/users'), {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Unauthorized access');
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchUsers();
  }, [token]);

  const filteredUsers = data.users.filter(u => 
    u.fullName?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto px-6 py-10 md:px-12 md:py-16">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-5xl font-black text-[var(--text-primary)] mb-4 tracking-tighter uppercase font-headline">
              Admin <span className="text-[var(--accent-green)] italic">Dashboard</span>
            </h1>
            <p className="text-[var(--text-muted)] text-lg font-['Manrope'] font-medium">
              Monitoring <span className="text-[var(--text-primary)]">{data.total} unique entries</span> in the Aurevon ecosystem.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--accent-green)] transition-colors">search</span>
              <input 
                type="text" 
                placeholder="Search accounts..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[var(--surface-container-low)] border border-[var(--glass-border)] rounded-full pl-12 pr-6 py-4 w-full md:w-72 focus:outline-none focus:border-[var(--accent-green)] focus:bg-[var(--surface-container-high)] transition-all text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-medium"
              />
            </div>
          </div>
        </div>

        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-[32px] p-12 text-center">
            <span className="material-symbols-outlined text-red-500 text-6xl mb-6">lock_person</span>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Access Denied</h3>
            <p className="text-red-400/80 max-w-md mx-auto">{error}</p>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 bg-[var(--surface-container-low)] rounded-[32px] border border-[var(--glass-border)]" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Table Container */}
            <div className="bg-[var(--bg-glass-heavy)] border border-[var(--glass-border)] rounded-[40px] overflow-hidden backdrop-blur-3xl shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--glass-border)]">
                      <th className="px-8 py-6 text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">User Profile</th>
                      <th className="px-8 py-6 text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Contact Info</th>
                      <th className="px-8 py-6 text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Activity</th>
                      <th className="px-8 py-6 text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Registration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filteredUsers.map((user, idx) => (
                        <motion.tr 
                          key={user.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="group hover:bg-[var(--surface-container-low)] transition-colors border-b border-[var(--glass-border)] last:border-0"
                        >
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-[var(--glass-border)] group-hover:border-[var(--accent-green)] transition-all shadow-lg shadow-black/20">
                                <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random&color=fff`} className="w-full h-full object-cover" alt="Avatar" />
                              </div>
                              <div>
                                <h4 className="text-[var(--text-primary)] font-bold text-lg group-hover:text-[var(--accent-green)] transition-colors">{user.fullName}</h4>
                                <p className="text-xs text-[var(--text-muted)] font-medium tracking-tight">ID: {user.id.slice(-8)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2 text-[var(--text-secondary)] font-medium">
                              <span className="material-symbols-outlined text-lg text-[var(--accent-green)]">mail</span>
                              {user.email}
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="px-3 py-1.5 bg-[var(--surface-container)] rounded-xl border border-[var(--glass-border)] text-center">
                                <p className="text-[10px] uppercase font-black text-[var(--text-muted)] leading-none mb-1">Songs</p>
                                <p className="text-[var(--text-primary)] font-black text-sm">{user.likedSongsCount}</p>
                              </div>
                              <div className="px-3 py-1.5 bg-[var(--surface-container)] rounded-xl border border-[var(--glass-border)] text-center">
                                <p className="text-[10px] uppercase font-black text-[var(--text-muted)] leading-none mb-1">Lists</p>
                                <p className="text-[var(--text-primary)] font-black text-sm">{user.playlistsCount}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-[var(--text-secondary)] font-bold text-sm tracking-tight">{user.joinedAt}</p>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>

            {filteredUsers.length === 0 && (
              <div className="py-20 text-center">
                 <span className="material-symbols-outlined text-[var(--text-muted)] text-6xl mb-4 opacity-20">search_off</span>
                 <p className="text-[var(--text-muted)] font-bold">No accounts found matching your search.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
