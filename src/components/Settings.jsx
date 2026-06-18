import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import usePlayer from '../hooks/usePlayer';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth as firebaseAuth } from '../config/firebase';
import './Settings.css';

export default function Settings() {
  const { userProfile, updateUserProfile, user, token, authStatus, loginWithGoogle } = usePlayer();
  
  const [formData, setFormData] = useState({
    name: userProfile?.name || user?.name || '',
    fullName: userProfile?.fullName || user?.name || '',
    email: userProfile?.email || user?.email || '',
    dob: userProfile?.dob || '',
    gender: userProfile?.gender || '',
    queuingMode: userProfile?.preferences?.queuingMode || 'ai',
    username: user?.username || ''
  });

  const [saveStatus, setSaveStatus] = useState('idle'); // idle, saving, success, error
  const [loginError, setLoginError] = useState(null);
  const [googlePrompting, setGooglePrompting] = useState(false);

  const buttonX = useMotionValue(0);
  const buttonY = useMotionValue(0);
  const springConfig = { damping: 12, stiffness: 120, mass: 0.8 };
  const springX = useSpring(buttonX, springConfig);
  const springY = useSpring(buttonY, springConfig);

  const handlePointerMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const centerX = rect.left + width / 2;
    const centerY = rect.top + height / 2;
    const distanceX = e.clientX - centerX;
    const distanceY = e.clientY - centerY;
    
    buttonX.set(distanceX * 0.25);
    buttonY.set(distanceY * 0.25);
  };

  const handlePointerLeave = () => {
    buttonX.set(0);
    buttonY.set(0);
  };

  const handleGoogleSignIn = async () => {
    setGooglePrompting(true);
    setLoginError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(firebaseAuth, provider);
      const idToken = await result.user.getIdToken(true);
      await loginWithGoogle(idToken);
    } catch (err) {
      console.error('Firebase Google Sign-In failed in Settings:', err);
      setLoginError(err.message || 'Google Sign-In failed. Please try again.');
    } finally {
      setGooglePrompting(false);
    }
  };

  useEffect(() => {
    setFormData({
      name: userProfile?.name || user?.name || '',
      fullName: userProfile?.fullName || user?.name || '',
      email: userProfile?.email || user?.email || '',
      dob: userProfile?.dob || '',
      gender: userProfile?.gender || '',
      queuingMode: userProfile?.preferences?.queuingMode || 'ai',
      username: user?.username || ''
    });
  }, [userProfile, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggleQueuing = () => {
    setFormData(prev => ({ 
      ...prev, 
      queuingMode: prev.queuingMode === 'ai' ? 'manual' : 'ai' 
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveStatus('saving');
    
    const updates = {
      name: formData.name,
      fullName: formData.fullName,
      email: formData.email,
      dob: formData.dob,
      gender: formData.gender,
      preferences: {
        ...userProfile.preferences,
        queuingMode: formData.queuingMode
      },
      username: formData.username
    };

    try {
      await updateUserProfile(updates);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  return (
    <div className="settings-view">
      <header className="settings-header">
        <h2 className="settings-title">Settings</h2>
        <p className="settings-subtitle">Personalize your music experience</p>
      </header>

      <form className="settings-form" onSubmit={handleSave}>
        {/* Experience Section */}
        <section className="settings-section">
          <h3 className="section-title">App Experience</h3>
          
          <div className="setting-card">
            <div className="setting-info">
              <span className="material-symbols-outlined setting-icon">palette</span>
              <div className="setting-text">
                <h4 className="setting-label">Light Mode</h4>
                <p className="setting-desc">Switch between dark and light themes</p>
              </div>
            </div>
            <button 
              type="button"
              className={`toggle-switch ${document.documentElement.getAttribute('data-theme') === 'light' ? 'toggle-switch--active' : ''}`}
              onClick={() => {
                const current = document.documentElement.getAttribute('data-theme');
                const next = current === 'light' ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', next);
                localStorage.setItem('wavify_theme', next);
                // Force re-render if needed (though CSS handles it)
                setFormData(prev => ({ ...prev, _t: Date.now() }));
              }}
            >
              <div className="toggle-handle" />
            </button>
          </div>

          <div className="setting-card">
            <div className="setting-info">
              <span className="material-symbols-outlined setting-icon">smart_toy</span>
              <div className="setting-text">
                <h4 className="setting-label">Smart AI Queuing</h4>
                <p className="setting-desc">Automatically add similar tracks when your queue is low</p>
              </div>
            </div>
            <button 
              type="button"
              className={`toggle-switch ${formData.queuingMode === 'ai' ? 'toggle-switch--active' : ''}`}
              onClick={handleToggleQueuing}
            >
              <div className="toggle-handle" />
            </button>
          </div>
        </section>

        {/* Profile Section */}
        <section className="settings-section">
          <h3 className="section-title">Edit Profile</h3>
          
          <div className="input-group">
            <label htmlFor="name">Display Name</label>
            <input 
              type="text" 
              id="name" 
              name="name" 
              value={formData.name} 
              onChange={handleChange}
              placeholder={user?.name || "How we should call you"}
            />
          </div>

          <div className="input-group">
            <label htmlFor="username">Personalized Username (@)</label>
            <input 
              type="text" 
              id="username" 
              name="username" 
              value={formData.username} 
              onChange={handleChange}
              placeholder="unique_handle"
            />
          </div>

          <div className="input-group">
            <label htmlFor="fullName">Full Name</label>
            <input 
              type="text" 
              id="fullName" 
              name="fullName" 
              value={formData.fullName} 
              onChange={handleChange}
              placeholder="Your full legal name"
            />
          </div>

          <div className="input-group">
            <label htmlFor="email">Email Address</label>
            <input 
              type="email" 
              id="email" 
              name="email" 
              value={formData.email} 
              onChange={handleChange}
              placeholder="email@example.com"
            />
          </div>

          <div className="input-row">
            <div className="input-group flex-1">
              <label htmlFor="dob">Date of Birth</label>
              <input 
                type="date" 
                id="dob" 
                name="dob" 
                value={formData.dob} 
                onChange={handleChange}
              />
            </div>
            <div className="input-group flex-1">
              <label htmlFor="gender">Gender</label>
              <select 
                id="gender" 
                name="gender" 
                value={formData.gender} 
                onChange={handleChange}
              >
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non-binary">Non-binary</option>
                <option value="other">Other</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </select>
            </div>
          </div>
        </section>

        <div className="settings-footer">
          {saveStatus === 'success' && <span className="status-msg status-msg--success">Changes saved!</span>}
          {saveStatus === 'error' && <span className="status-msg status-msg--error">Failed to save.</span>}
          
          <button 
            type="submit" 
            className={`save-btn ${saveStatus === 'saving' ? 'save-btn--loading' : ''}`}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Data Storage Info Section */}
      <section className="settings-section data-info-section">
        <h3 className="section-title">Data & Privacy</h3>
        <div className="setting-card">
          <div className="setting-info">
            <span className="material-symbols-outlined setting-icon">database</span>
            <div className="setting-text">
              <h4 className="setting-label">Where is my data?</h4>
              <p className="setting-desc">
                {token ? 
                  "Your data is securely synced to our cloud database (backend/data/db.json) and also cached locally for offline use." : 
                  "You are in Guest Mode. Your data is stored only in this browser's Local Storage."
                }
              </p>
            </div>
          </div>
        </div>
      </section>

      {!token && (
        <div className="settings-login-teaser">
          <span className="material-symbols-outlined">info</span>
          <div>
            <p>Login with Google to sync your settings across devices.</p>
            {loginError && (
              <p className="mt-2 text-red-400">{loginError}</p>
            )}
          </div>
        </div>
      )}

      {!token && (
        <section className="settings-section">
          <h3 className="section-title">Sign In</h3>
          <div className="setting-card settings-google-card flex-col items-start gap-4">
            <div className="setting-info">
              <span className="material-symbols-outlined setting-icon">login</span>
              <div className="setting-text">
                <h4 className="setting-label">Sign in with Google</h4>
                <p className="setting-desc">Use your existing account to sync likes, playlists, and profile settings.</p>
              </div>
            </div>
            <div className="premium-google-btn-wrapper w-full flex justify-center mt-2">
              <motion.button
                style={{ x: springX, y: springY }}
                onPointerMove={handlePointerMove}
                onPointerLeave={handlePointerLeave}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googlePrompting}
                className="premium-google-btn"
                title="Sign in with Google"
              >
                {googlePrompting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
              </motion.button>
              <div className="premium-google-btn-glow" />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
