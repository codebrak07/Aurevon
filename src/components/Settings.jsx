import { useState, useCallback } from 'react';
import usePlayer from '../hooks/usePlayer';
import './Settings.css';

export default function Settings() {
  const { userProfile, updateUserProfile, user, token } = usePlayer();
  
  const [formData, setFormData] = useState({
    name: userProfile.name || '',
    fullName: userProfile.fullName || '',
    email: userProfile.email || '',
    dob: userProfile.dob || '',
    gender: userProfile.gender || '',
    queuingMode: userProfile.preferences?.queuingMode || 'ai'
  });

  const [saveStatus, setSaveStatus] = useState('idle'); // idle, saving, success, error

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
      }
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
          <h3 className="section-title">Music Experience</h3>
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
              placeholder="How we should call you"
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
          <p>Login with Google to sync your settings across devices.</p>
        </div>
      )}
    </div>
  );
}
