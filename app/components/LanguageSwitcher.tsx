'use client';

import { useLanguage } from '../../i18n/LanguageContext';
import { LOCALE_CONFIG, Locale } from '../../i18n/config';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
  };

  return (
    <div className="relative">
      <select
        value={locale}
        onChange={(e) => handleLocaleChange(e.target.value as Locale)}
        className="bg-transparent border-none text-sm font-medium focus:outline-none focus:ring-0 cursor-pointer"
        aria-label="语言切换"
      >
        {Object.entries(LOCALE_CONFIG).map(([key, config]) => (
          <option key={key} value={key}>
            {config.flag} {config.name}
          </option>
        ))}
      </select>
    </div>
  );
}