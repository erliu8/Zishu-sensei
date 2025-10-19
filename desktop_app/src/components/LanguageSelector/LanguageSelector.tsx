import React, { useState } from 'react';
import { useLanguage } from '../../hooks/useLanguage';
import { SupportedLanguage } from '../../locales';
import './LanguageSelector.css';

interface LanguageSelectorProps {
  variant?: 'dropdown' | 'buttons' | 'compact';
  showNativeName?: boolean;
  showFlag?: boolean;
  className?: string;
  disabled?: boolean;
  onLanguageChange?: (language: SupportedLanguage) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'dropdown',
  showNativeName = true,
  showFlag = true,
  className = '',
  disabled = false,
  onLanguageChange
}) => {
  const { 
    currentLanguage, 
    supportedLanguages, 
    changeLanguage, 
    isChanging, 
    error,
    t 
  } = useLanguage();
  
  const [isOpen, setIsOpen] = useState(false);

  const handleLanguageChange = async (language: SupportedLanguage) => {
    if (language === currentLanguage || disabled || isChanging) {
      return;
    }

    try {
      await changeLanguage(language);
      onLanguageChange?.(language);
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to change language:', err);
    }
  };

  const getLanguageFlag = (code: SupportedLanguage): string => {
    const flagMap: Record<SupportedLanguage, string> = {
      zh: '🇨🇳',
      en: '🇺🇸',
      ja: '🇯🇵',
      ko: '🇰🇷'
    };
    return flagMap[code] || '🌐';
  };

  const renderLanguageOption = (lang: typeof supportedLanguages[number], isSelected: boolean = false) => (
    <div className={`language-option ${isSelected ? 'selected' : ''}`}>
      {showFlag && (
        <span className="language-flag" role="img" aria-label={lang.name}>
          {getLanguageFlag(lang.code)}
        </span>
      )}
      <span className="language-name">{lang.name}</span>
      {showNativeName && lang.nativeName !== lang.name && (
        <span className="language-native">({lang.nativeName})</span>
      )}
    </div>
  );

  if (variant === 'buttons') {
    return (
      <div className={`language-selector language-selector--buttons ${className}`}>
        {supportedLanguages.map((lang) => (
          <button
            key={lang.code}
            className={`language-button ${currentLanguage === lang.code ? 'active' : ''}`}
            onClick={() => handleLanguageChange(lang.code)}
            disabled={disabled || isChanging}
            title={showNativeName ? lang.nativeName : lang.name}
          >
            {showFlag && (
              <span className="language-flag" role="img" aria-label={lang.name}>
                {getLanguageFlag(lang.code)}
              </span>
            )}
            {!showFlag && <span className="language-code">{lang.code.toUpperCase()}</span>}
          </button>
        ))}
        {error && (
          <div className="language-error" role="alert">
            {error}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    const currentLang = supportedLanguages.find(lang => lang.code === currentLanguage);
    
    return (
      <div className={`language-selector language-selector--compact ${className}`}>
        <button
          className={`language-toggle ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled || isChanging}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          title={t('settings.general.language')}
        >
          {showFlag && currentLang && (
            <span className="language-flag" role="img" aria-label={currentLang.name}>
              {getLanguageFlag(currentLang.code)}
            </span>
          )}
          <span className="language-code">{currentLanguage.toUpperCase()}</span>
          <span className="dropdown-arrow" aria-hidden="true">
            {isOpen ? '▲' : '▼'}
          </span>
        </button>
        
        {isOpen && (
          <div className="language-dropdown" role="listbox">
            {supportedLanguages.map((lang) => (
              <button
                key={lang.code}
                className={`language-option-button ${currentLanguage === lang.code ? 'selected' : ''}`}
                onClick={() => handleLanguageChange(lang.code)}
                disabled={disabled || isChanging}
                role="option"
                aria-selected={currentLanguage === lang.code}
              >
                {renderLanguageOption(lang, currentLanguage === lang.code)}
              </button>
            ))}
          </div>
        )}
        
        {error && (
          <div className="language-error" role="alert">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Default dropdown variant
  const currentLang = supportedLanguages.find(lang => lang.code === currentLanguage);
  
  return (
    <div className={`language-selector language-selector--dropdown ${className}`}>
      <label className="language-label">
        {t('settings.general.language')}
      </label>
      
      <div className="language-dropdown-container">
        <button
          className={`language-dropdown-trigger ${isOpen ? 'open' : ''} ${isChanging ? 'loading' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled || isChanging}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          {currentLang && renderLanguageOption(currentLang, true)}
          <span className="dropdown-arrow" aria-hidden="true">
            {isChanging ? '⟳' : isOpen ? '▲' : '▼'}
          </span>
        </button>
        
        {isOpen && (
          <div className="language-dropdown-menu" role="listbox">
            {supportedLanguages.map((lang) => (
              <button
                key={lang.code}
                className={`language-dropdown-option ${currentLanguage === lang.code ? 'selected' : ''}`}
                onClick={() => handleLanguageChange(lang.code)}
                disabled={disabled || isChanging}
                role="option"
                aria-selected={currentLanguage === lang.code}
              >
                {renderLanguageOption(lang, currentLanguage === lang.code)}
                {currentLanguage === lang.code && (
                  <span className="selected-indicator" aria-hidden="true">✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {error && (
        <div className="language-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
