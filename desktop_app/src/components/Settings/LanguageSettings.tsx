import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../hooks/useLanguage';
import { LanguageSelector } from '../LanguageSelector';
import { SupportedLanguage } from '../../locales';
import './LanguageSettings.css';

interface LanguageSettingsProps {
  className?: string;
}

const LanguageSettings: React.FC<LanguageSettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation(['settings', 'common']);
  const { 
    currentLanguage, 
    supportedLanguages, 
    changeLanguage, 
    resetToSystem, 
    isChanging, 
    error 
  } = useLanguage();
  
  const [autoDetect, setAutoDetect] = useState(true);
  const [systemLanguage, setSystemLanguage] = useState<SupportedLanguage | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 检测系统语言
  useEffect(() => {
    const detectSystemLanguage = async () => {
      try {
        // 这里可以调用 Tauri 命令检测系统语言
        const detected = navigator.language.toLowerCase();
        
        // 映射到支持的语言
        let mappedLanguage: SupportedLanguage = 'zh';
        for (const lang of supportedLanguages) {
          if (detected.startsWith(lang.code)) {
            mappedLanguage = lang.code;
            break;
          }
        }
        
        setSystemLanguage(mappedLanguage);
      } catch (err) {
        console.error('Failed to detect system language:', err);
      }
    };

    detectSystemLanguage();
  }, [supportedLanguages]);

  const handleLanguageChange = async (language: SupportedLanguage) => {
    try {
      await changeLanguage(language);
    } catch (err) {
      console.error('Failed to change language:', err);
    }
  };

  const handleResetToSystem = async () => {
    try {
      await resetToSystem();
    } catch (err) {
      console.error('Failed to reset to system language:', err);
    }
  };

  const handleAutoDetectToggle = (enabled: boolean) => {
    setAutoDetect(enabled);
    // 这里可以保存自动检测设置到后端
  };

  return (
    <div className={`language-settings ${className}`}>
      <div className="settings-section">
        <h3 className="section-title">
          {t('settings:general.language')}
        </h3>
        
        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">
              {t('settings:general.language')}
            </label>
            <div className="setting-description">
              {t('settings:messages.restartRequired')}
            </div>
          </div>
          
          <div className="setting-control">
            <LanguageSelector
              variant="dropdown"
              showNativeName={true}
              showFlag={true}
              disabled={isChanging}
              onLanguageChange={handleLanguageChange}
            />
          </div>
        </div>

        {error && (
          <div className="error-message" role="alert">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">
              {t('settings:general.language')} - {t('common:actions.reset')}
            </label>
            <div className="setting-description">
              {systemLanguage && (
                <>
                  {t('settings:general.language')}: {
                    supportedLanguages.find(lang => lang.code === systemLanguage)?.nativeName
                  }
                </>
              )}
            </div>
          </div>
          
          <div className="setting-control">
            <button
              className="reset-button"
              onClick={handleResetToSystem}
              disabled={isChanging || currentLanguage === systemLanguage}
            >
              {isChanging ? (
                <>
                  <span className="loading-spinner">⟳</span>
                  {t('common:status.loading')}
                </>
              ) : (
                <>
                  <span className="reset-icon">🔄</span>
                  {t('settings:actions.reset')}
                </>
              )}
            </button>
          </div>
        </div>

        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">
              {t('settings:general.language')} - 自动检测
            </label>
            <div className="setting-description">
              启动时自动检测系统语言
            </div>
          </div>
          
          <div className="setting-control">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={autoDetect}
                onChange={(e) => handleAutoDetectToggle(e.target.checked)}
                disabled={isChanging}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="setting-item">
          <div className="setting-header">
            <label className="setting-label">
              高级设置
            </label>
          </div>
          
          <div className="setting-control">
            <button
              className="toggle-advanced-button"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span className={`expand-icon ${showAdvanced ? 'expanded' : ''}`}>
                ▶
              </span>
              {showAdvanced ? '隐藏高级设置' : '显示高级设置'}
            </button>
          </div>
        </div>

        {showAdvanced && (
          <div className="advanced-settings">
            <div className="setting-item">
              <div className="setting-header">
                <label className="setting-label">
                  语言包信息
                </label>
              </div>
              
              <div className="language-info-grid">
                {supportedLanguages.map((lang) => (
                  <div 
                    key={lang.code} 
                    className={`language-info-card ${currentLanguage === lang.code ? 'current' : ''}`}
                  >
                    <div className="language-info-header">
                      <span className="language-flag">
                        {lang.code === 'zh' && '🇨🇳'}
                        {lang.code === 'en' && '🇺🇸'}
                        {lang.code === 'ja' && '🇯🇵'}
                        {lang.code === 'ko' && '🇰🇷'}
                      </span>
                      <div className="language-names">
                        <div className="language-name">{lang.name}</div>
                        <div className="language-native">{lang.nativeName}</div>
                      </div>
                      {currentLanguage === lang.code && (
                        <span className="current-indicator">✓</span>
                      )}
                    </div>
                    <div className="language-code">
                      代码: {lang.code.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="setting-item">
              <div className="setting-header">
                <label className="setting-label">
                  快速切换
                </label>
                <div className="setting-description">
                  使用按钮快速切换语言
                </div>
              </div>
              
              <div className="setting-control">
                <LanguageSelector
                  variant="buttons"
                  showNativeName={false}
                  showFlag={true}
                  disabled={isChanging}
                  onLanguageChange={handleLanguageChange}
                />
              </div>
            </div>

            <div className="setting-item">
              <div className="setting-header">
                <label className="setting-label">
                  紧凑模式
                </label>
                <div className="setting-description">
                  适用于工具栏或状态栏
                </div>
              </div>
              
              <div className="setting-control">
                <LanguageSelector
                  variant="compact"
                  showNativeName={false}
                  showFlag={true}
                  disabled={isChanging}
                  onLanguageChange={handleLanguageChange}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LanguageSettings;
