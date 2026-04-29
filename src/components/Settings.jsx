import { useEffect, useRef, useState } from 'react';
import usePlayer from '../hooks/usePlayer';
import { getGoogleOriginIssue } from '../utils/googleAuth';
import './Settings.css';

const getGsiState = () => {
  if (!window.__aurevonGsiState) {
    window.__aurevonGsiState = { initialized: false };
  }
  return window.__aurevonGsiState;
};

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
  const [showGoogleFallback, setShowGoogleFallback] = useState(false);
  const [googlePrompting, setGooglePrompting] = useState(false);
  const gsiInitialized = useRef(false);

  const triggerGooglePrompt = () => {
    const originIssue = getGoogleOriginIssue();
    if (originIssue) {
      setLoginError(originIssue);
      setShowGoogleFallback(true);
      return;
    }

    if (!window.google?.accounts?.id) {
      setLoginError('Google Sign-In is still loading. Please try again in a moment.');
      setShowGoogleFallback(true);
      return;
    }

    setGooglePrompting(true);
    try {
      window.google.accounts.id.prompt((notification) => {
        const notDisplayed = notification?.isNotDisplayed?.();
        const skipped = notification?.isSkippedMoment?.();
        const dismissed = notification?.isDismissedMoment?.();

        if (notDisplayed || skipped || dismissed) {
          setShowGoogleFallback(true);
        }
        setGooglePrompting(false);
      });
    } catch (error) {
      console.error('Google prompt failed:', error);
      setLoginError('Could not open Google Sign-In. Please try again.');
      setShowGoogleFallback(true);
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

  useEffect(() => {
    if (authStatus === 'authenticated') return;

    const initGoogle = () => {
      const originIssue = getGoogleOriginIssue();
      if (originIssue) {
        setLoginError(originIssue);
        setShowGoogleFallback(true);
        return;
      }

      if (!window.google || !import.meta.env.VITE_GOOGLE_CLIENT_ID) {
        setShowGoogleFallback(true);
        return;
      }

      try {
        const gsiState = getGsiState();
        if (!gsiInitialized.current && !gsiState.initialized) {
          window.google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            callback: async (res) => {
              if (!res.credential) return;

              setLoginError(null);
              try {
                await loginWithGoogle(res.credential);
              } catch (err) {
                setLoginError(err.response?.data?.message || 'Login failed. Please try again.');
              }
            }
          });
          gsiInitialized.current = true;
          gsiState.initialized = true;
        } else if (gsiState.initialized) {
          gsiInitialized.current = true;
        }

        const parent = document.getElementById('settings-google-signin-btn');
        if (parent) {
          parent.innerHTML = '';
          window.google.accounts.id.renderButton(parent, {
            theme: 'filled_black',
            size: 'large',
            shape: 'pill',
            text: 'signin_with',
            logo_alignment: 'left',
            width: Math.min(parent.offsetWidth || 280, 320)
          });
          setTimeout(() => {
            const visibleIframe = parent.querySelector('iframe, div[role="button"]');
            const failedToRender = !visibleIframe || parent.getBoundingClientRect().height < 40;
            setShowGoogleFallback(failedToRender);
            if (failedToRender && !loginError) {
              setLoginError('Google button did not render inside settings. You can still use the backup sign-in button below.');
            }
          }, 350);
        }
      } catch (err) {
        console.error('GIS Error:', err);
        setShowGoogleFallback(true);
      }
    };

    if (!window.google) {
      const interval = setInterval(() => {
        if (window.google) {
          initGoogle();
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }

    const timeout = setTimeout(initGoogle, 150);
    return () => clearTimeout(timeout);
  }, [authStatus, loginError, loginWithGoogle]);

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
            <div id="settings-google-signin-btn" className="settings-google-slot" />
            <button
              type="button"
              onClick={triggerGooglePrompt}
              className="settings-google-manual"
              disabled={googlePrompting}
            >
              <span className="material-symbols-outlined text-[18px]">login</span>
              {googlePrompting ? 'Opening Google...' : 'Continue with Google'}
            </button>
            {showGoogleFallback && (
              <div className="settings-google-fallback">
                <p className="text-[var(--text-primary)] font-semibold">Google sign-in button could not load.</p>
                <p className="mt-1">
                  {loginError || `Authorize ${window.location.origin} in Google Cloud Console for this client ID.`}
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
