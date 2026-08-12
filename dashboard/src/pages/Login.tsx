import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Languages } from 'lucide-react';
import { languageOptions, resolveSupportedLanguage, type SupportedLanguage } from '../i18n';
import { API_BASE_URL } from '../services/api';
import { useTheme } from '../hooks/useTheme';
import './Login.css';

interface LoginProps {
  onLogin: (apiKey: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const { t, i18n } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  
  const currentLang = resolveSupportedLanguage(i18n.resolvedLanguage || i18n.language);
  const { resolvedTheme } = useTheme();

  // Clear legacy tokens on mount
  useEffect(() => {
    sessionStorage.removeItem('openwa_api_key');
    sessionStorage.removeItem('openwa_login_token');
    localStorage.removeItem('openwa_login_token');
  }, []);

  // Handle rate limiter cooldown count down
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => {
      setCooldown(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Update dynamic cooldown error message
  useEffect(() => {
    if (cooldown > 0) {
      setError(t('login.tooManyAttemptsError', { seconds: cooldown }));
    } else if (failedAttempts >= 5) {
      setFailedAttempts(0);
      setError('');
    }
  }, [cooldown, failedAttempts, t]);

  const changeLanguage = (language: SupportedLanguage) => {
    void i18n.changeLanguage(language);
  };

  const handleFailure = (msg: string) => {
    setFailedAttempts(prev => {
      const next = prev + 1;
      if (next >= 5) {
        setCooldown(30);
      } else {
        setError(msg);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0) return;

    const trimmedUsername = username.trim();
    const trimmedApiKey = apiKey.trim();

    if (!trimmedUsername || !password.trim() || !trimmedApiKey) {
      setError(t('login.requiredFieldsError'));
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: trimmedUsername, password, apiKey: trimmedApiKey }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          if (data.loginToken) {
            sessionStorage.setItem('openwa_login_token', data.loginToken);
            localStorage.setItem('openwa_login_token', data.loginToken);
          }
          setFailedAttempts(0);
          onLogin(trimmedApiKey);
        } else {
          const msg = data.message || t('login.invalidKey');
          if (msg === 'Invalid username or password' || msg === 'Invalid credentials') {
            handleFailure(t('login.invalidCredentials', 'Invalid username or password'));
          } else if (msg === 'Invalid API key') {
            handleFailure(t('login.invalidKey'));
          } else {
            handleFailure(msg);
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.message || t('login.invalidKey');
        if (msg === 'Invalid username or password' || msg === 'Invalid credentials') {
          handleFailure(t('login.invalidCredentials', 'Invalid username or password'));
        } else if (msg === 'Invalid API key') {
          handleFailure(t('login.invalidKey'));
        } else {
          handleFailure(msg);
        }
      }
    } catch {
      handleFailure(t('login.connectionError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <img 
            src={resolvedTheme === 'dark' ? '/logo-dark.svg' : '/logo-light.svg'} 
            alt="WhatsGrow Logo" 
            className="logo-icon"
            style={{ width: '220px', height: 'auto', objectFit: 'contain', marginBottom: '0.5rem' }}
          />
          <p className="login-subtitle">{t('login.title')}</p>
        </div>

        <div className="login-language">
          <Languages size={18} />
          <select
            value={currentLang}
            onChange={event => changeLanguage(event.target.value as SupportedLanguage)}
            aria-label={t('common.language')}
          >
            {languageOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label htmlFor="username">{t('login.username')}</label>
            <div className="input-wrapper">
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder={t('login.usernamePlaceholder')}
                autoComplete="username"
                autoFocus
                disabled={cooldown > 0}
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="password">{t('login.password')}</label>
            <div className="input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('login.passwordPlaceholder')}
                autoComplete="current-password"
                disabled={cooldown > 0}
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={cooldown > 0}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="apiKey">{t('login.apiKey')}</label>
            <div className="input-wrapper">
              <input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={t('login.apiKeyPlaceholder')}
                autoComplete="off"
                className={error ? 'error' : ''}
                disabled={cooldown > 0}
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? t('common.hideApiKey') : t('common.showApiKey')}
                disabled={cooldown > 0}
              >
                {showKey ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {error && <span className="error-message">{error}</span>}
          </div>

          <button type="submit" className="connect-btn" disabled={isLoading || cooldown > 0}>
            {isLoading ? t('login.connecting') : t('login.connect')}
          </button>
        </form>
      </div>
    </div>
  );
}
