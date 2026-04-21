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
            <h1 className="text-5xl font-black text-white mb-4 tracking-tighter uppercase font-headline">
              Admin <span className="text-primary italic">Dashboard</span>
            </h1>
            <p className="text-[#686880] text-lg font-['Manrope'] font-medium">
              Monitoring <span className="text-white">{data.total} unique entries</span> in the Aurevon ecosystem.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#686880] group-focus-within:text-primary transition-colors">search</span>
              <input 
                type="text" 
                placeholder="Search accounts..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-full pl-12 pr-6 py-4 w-full md:w-72 focus:outline-none focus:border-primary/40 focus:bg-white/[0.08] transition-all text-white placeholder:text-[#686880] font-medium"
              />
            </div>
          </div>
        </div>

        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-[32px] p-12 text-center">
            <span className="material-symbols-outlined text-red-500 text-6xl mb-6">lock_person</span>
            <h3 className="text-2xl font-bold text-white mb-2">Access Denied</h3>
            <p className="text-red-400/80 max-w-md mx-auto">{error}</p>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 bg-white/5 rounded-[32px] border border-white/5" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Table Container */}
            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] overflow-hidden backdrop-blur-3xl shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-8 py-6 text-xs font-bold text-[#686880] uppercase tracking-widest">User Profile</th>
                      <th className="px-8 py-6 text-xs font-bold text-[#686880] uppercase tracking-widest">Contact Info</th>
                      <th className="px-8 py-6 text-xs font-bold text-[#686880] uppercase tracking-widest">Activity</th>
                      <th className="px-8 py-6 text-xs font-bold text-[#686880] uppercase tracking-widest">Registration</th>
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
                          className="group hover:bg-white/[0.03] transition-colors border-b border-white/[0.02] last:border-0"
                        >
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/5 group-hover:border-primary/30 transition-all shadow-lg shadow-black/20">
                                <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random&color=fff`} className="w-full h-full object-cover" alt="Avatar" />
                              </div>
                              <div>
                                <h4 className="text-white font-bold text-lg group-hover:text-primary transition-colors">{user.fullName}</h4>
                                <p className="text-xs text-[#686880] font-medium tracking-tight">ID: {user.id.slice(-8)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2 text-white/80 font-medium">
                              <span className="material-symbols-outlined text-lg text-primary/60">mail</span>
                              {user.email}
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="px-3 py-1.5 bg-white/5 rounded-xl border border-white/5 text-center">
                                <p className="text-[10px] uppercase font-black text-[#686880] leading-none mb-1">Songs</p>
                                <p className="text-white font-black text-sm">{user.likedSongsCount}</p>
                              </div>
                              <div className="px-3 py-1.5 bg-white/5 rounded-xl border border-white/5 text-center">
                                <p className="text-[10px] uppercase font-black text-[#686880] leading-none mb-1">Lists</p>
                                <p className="text-white font-black text-sm">{user.playlistsCount}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-white/60 font-bold text-sm tracking-tight">{user.joinedAt}</p>
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
                 <span className="material-symbols-outlined text-[#686880] text-6xl mb-4 opacity-20">search_off</span>
                 <p className="text-[#686880] font-bold">No accounts found matching your search.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
