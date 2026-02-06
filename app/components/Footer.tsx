'use client';

import { useLanguage } from '../../i18n/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="py-12" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Logo 和介绍 */}
          <div className="md:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                <i className="fas fa-wrench text-sm text-white"></i>
              </div>
              <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>NextTools</span>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>
              {t('footer.description')}
            </p>
            <div className="flex space-x-4">
              <a href="#" className="transition-colors hover:opacity-70" style={{ color: 'var(--text-tertiary)' }}>
                <i className="fab fa-github text-xl"></i>
              </a>
              <a href="#" className="transition-colors hover:opacity-70" style={{ color: 'var(--text-tertiary)' }}>
                <i className="fab fa-twitter text-xl"></i>
              </a>
              <a href="#" className="transition-colors hover:opacity-70" style={{ color: 'var(--text-tertiary)' }}>
                <i className="fab fa-linkedin text-xl"></i>
              </a>
              <a href="#" className="transition-colors hover:opacity-70" style={{ color: 'var(--text-tertiary)' }}>
                <i className="fab fa-youtube text-xl"></i>
              </a>
            </div>
          </div>

          {/* 产品 */}
          <div>
            <h4 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{t('footer.product')}</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="transition-colors hover:text-[#165DFF]" style={{ color: 'var(--text-secondary)' }}>{t('footer.features')}</a></li>
              <li><a href="#" className="transition-colors hover:text-[#165DFF]" style={{ color: 'var(--text-secondary)' }}>{t('footer.pricing')}</a></li>
              <li><a href="#" className="transition-colors hover:text-[#165DFF]" style={{ color: 'var(--text-secondary)' }}>{t('footer.changelog')}</a></li>
              <li><a href="#" className="transition-colors hover:text-[#165DFF]" style={{ color: 'var(--text-secondary)' }}>{t('footer.roadmap')}</a></li>
            </ul>
          </div>

          {/* 资源 */}
          <div>
            <h4 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{t('footer.resources')}</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="transition-colors hover:text-[#165DFF]" style={{ color: 'var(--text-secondary)' }}>{t('footer.documentation')}</a></li>
              <li><a href="#" className="transition-colors hover:text-[#165DFF]" style={{ color: 'var(--text-secondary)' }}>{t('footer.help')}</a></li>
              <li><a href="#" className="transition-colors hover:text-[#165DFF]" style={{ color: 'var(--text-secondary)' }}>{t('footer.faq')}</a></li>
              <li><a href="#" className="transition-colors hover:text-[#165DFF]" style={{ color: 'var(--text-secondary)' }}>{t('footer.community')}</a></li>
            </ul>
          </div>

          {/* 公司 */}
          <div>
            <h4 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{t('footer.company')}</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="transition-colors hover:text-[#165DFF]" style={{ color: 'var(--text-secondary)' }}>{t('footer.about')}</a></li>
              <li><a href="#" className="transition-colors hover:text-[#165DFF]" style={{ color: 'var(--text-secondary)' }}>{t('footer.contact')}</a></li>
              <li><a href="#" className="transition-colors hover:text-[#165DFF]" style={{ color: 'var(--text-secondary)' }}>{t('footer.privacy')}</a></li>
              <li><a href="#" className="transition-colors hover:text-[#165DFF]" style={{ color: 'var(--text-secondary)' }}>{t('footer.terms')}</a></li>
            </ul>
          </div>
        </div>

        {/* 版权信息 */}
        <div className="pt-6 text-center" style={{ borderTop: '1px solid var(--border-primary)' }}>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {t('footer.copyright')}
          </p>
        </div>
      </div>
    </footer>
  );
}
