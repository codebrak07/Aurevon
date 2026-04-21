import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import usePlayer from '../hooks/usePlayer';

const ResumeSessionOverlay = () => {
    const { 
        videoId, 
        isPlaying, 
        userInteracted, 
        togglePlay, 
        currentTrack, 
        authStatus 
    } = usePlayer();

    // Show overlay if:
    // 1. We have a saved videoId
    // 2. Not playing (blocked by browser or initial load)
    // 3. User has not interacted yet
    // 4. We are authenticated or have local data
    const showOverlay = videoId && !isPlaying && !userInteracted;

    if (!showOverlay) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[999] flex items-center justify-center p-6 bg-[#0e0e0e]/40 backdrop-blur-3xl"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="w-full max-w-md bg-white/[0.03] border border-white/[0.08] rounded-[40px] p-10 text-center shadow-2xl relative overflow-hidden"
                >
                    {/* Decorative Gradient */}
                    <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/20 blur-[80px] rounded-full" />
                    <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 blur-[80px] rounded-full" />

                    <div className="relative z-10">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 border border-white/10 group overflow-hidden relative">
                            {currentTrack?.albumArt ? (
                                <>
                                    <img 
                                        src={currentTrack.albumArt} 
                                        alt="Current Track" 
                                        className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity"
                                    />
                                    <div className="absolute inset-0 bg-black/20" />
                                </>
                            ) : (
                                <span className="material-symbols-outlined text-4xl text-primary/80">play_circle</span>
                            )}
                            <span className="material-symbols-outlined text-3xl text-white absolute">ads_click</span>
                        </div>

                        <h2 className="text-3xl font-black text-white mb-3 tracking-tight font-headline">Welcome Back</h2>
                        <p className="text-[#acaab1] text-lg mb-10 leading-relaxed font-medium px-4">
                            Your last session is ready. Click below to resume listening to your favorites.
                        </p>

                        <button
                            onClick={togglePlay}
                            className="w-full py-5 bg-white text-black rounded-2xl font-bold text-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl hover:shadow-white/10"
                        >
                            <span className="material-symbols-outlined text-2xl">play_arrow</span>
                            Resume Last Session
                        </button>

                        {authStatus === 'unauthenticated' && (
                            <p className="mt-6 text-xs text-white/30 font-medium">
                                Log in to sync this session across all your devices
                            </p>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ResumeSessionOverlay;
