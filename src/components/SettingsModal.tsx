import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { X, Eye, EyeOff, Check, AlertCircle, Moon, Sun, Monitor, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t } = useTranslation();
  const { geminiApiKey, setGeminiApiKey, theme, setTheme, language, setLanguage } = useStore();
  const [key, setKey] = useState(geminiApiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setGeminiApiKey(key.trim() || null);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-zinc-200 dark:border-zinc-800"
        >
          <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t('settings')}</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-8">
            {/* Appearance */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                {t('appearance')}
              </label>
              <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                <button 
                  onClick={() => setTheme('light')} 
                  className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all text-sm font-medium", theme === 'light' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
                >
                  <Sun className="w-4 h-4" /> {t('light')}
                </button>
                <button 
                  onClick={() => setTheme('system')} 
                  className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all text-sm font-medium", theme === 'system' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
                >
                  <Monitor className="w-4 h-4" /> {t('system')}
                </button>
                <button 
                  onClick={() => setTheme('dark')} 
                  className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all text-sm font-medium", theme === 'dark' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
                >
                  <Moon className="w-4 h-4" /> {t('dark')}
                </button>
              </div>
            </div>

            {/* Language */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                {t('language')}
              </label>
              <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                <button 
                  onClick={() => setLanguage('en')} 
                  className={cn("flex-1 py-2 rounded-md transition-all text-sm font-medium", language === 'en' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
                >
                  English
                </button>
                <button 
                  onClick={() => setLanguage('zh')} 
                  className={cn("flex-1 py-2 rounded-md transition-all text-sm font-medium", language === 'zh' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
                >
                  中文
                </button>
              </div>
            </div>

            {/* API Key */}
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                {t('api_key')}
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={t('api_key_placeholder')}
                  className="w-full px-4 py-2 pr-10 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 flex items-start gap-1">
                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>
                  {t('api_key_help')}{' '}
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    Google AI Studio
                  </a>.
                </span>
              </p>
            </div>
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isSaved ? <Check className="w-4 h-4" /> : null}
              {isSaved ? t('saved') : t('save')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
