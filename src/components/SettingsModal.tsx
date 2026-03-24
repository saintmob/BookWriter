import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { X, Eye, EyeOff, Check, AlertCircle, Moon, Sun, Monitor, Globe, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t } = useTranslation();
  const { 
    geminiApiKey, setGeminiApiKey, 
    geminiTextModel, setGeminiTextModel,
    geminiImageModel, setGeminiImageModel,
    openRouterApiKey, setOpenRouterApiKey,
    openRouterTextModel, setOpenRouterTextModel,
    openRouterImageModel, setOpenRouterImageModel,
    textProvider, setTextProvider,
    imageProvider, setImageProvider,
    theme, setTheme, 
    language, setLanguage 
  } = useStore();
  
  const [geminiKey, setGeminiKey] = useState(geminiApiKey || '');
  const [gTextModel, setGTextModel] = useState(geminiTextModel || 'gemini-3-flash-preview');
  const [gImageModel, setGImageModel] = useState(geminiImageModel || 'gemini-2.5-flash-image');
  const [orKey, setOrKey] = useState(openRouterApiKey || '');
  const [orTextModel, setOrTextModel] = useState(openRouterTextModel || 'stepfun/step-3.5-flash:free');
  const [orImageModel, setOrImageModel] = useState(openRouterImageModel || 'google/gemini-3.1-flash-image-preview');
  const [localTextProvider, setLocalTextProvider] = useState(textProvider || 'openrouter');
  const [localImageProvider, setLocalImageProvider] = useState(imageProvider || 'gemini');
  
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOrKey, setShowOrKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setGeminiApiKey(geminiKey.trim() || null);
    setGeminiTextModel(gTextModel.trim() || 'gemini-3-flash-preview');
    setGeminiImageModel(gImageModel.trim() || 'gemini-2.5-flash-image');
    setOpenRouterApiKey(orKey.trim() || null);
    setOpenRouterTextModel(orTextModel.trim() || 'stepfun/step-3.5-flash:free');
    setOpenRouterImageModel(orImageModel.trim() || 'google/gemini-3.1-flash-image-preview');
    setTextProvider(localTextProvider);
    setImageProvider(localImageProvider);
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
          className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]"
        >
          <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t('settings')}</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-8 overflow-y-auto">
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

            {/* AI Provider */}
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  {t('ai_provider')}
                </label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t('ai_provider_help')}
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* OpenRouter Card */}
                <div className="border rounded-xl p-5 transition-all relative overflow-hidden border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">OpenRouter</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        {t('openrouter_api_key')}
                      </label>
                      <div className="relative">
                        <input
                          type={showOrKey ? "text" : "password"}
                          value={orKey}
                          onChange={(e) => setOrKey(e.target.value)}
                          placeholder={t('openrouter_api_key_placeholder')}
                          className="w-full px-4 py-2 pr-10 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                        />
                        <button
                          onClick={() => setShowOrKey(!showOrKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        >
                          {showOrKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 flex items-start gap-1">
                        <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>
                          {t('openrouter_api_key_help')}{' '}
                          <a 
                            href="https://openrouter.ai/keys" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-emerald-600 hover:underline dark:text-emerald-400"
                          >
                            OpenRouter
                          </a>.
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        {t('openrouter_text_model')}
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={orTextModel}
                          onChange={(e) => setOrTextModel(e.target.value)}
                          placeholder="stepfun/step-3.5-flash:free"
                          className="w-full px-4 py-2 pr-12 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                        />
                        <button
                          onClick={() => setLocalTextProvider('openrouter')}
                          className={cn(
                            "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors",
                            localTextProvider === 'openrouter' 
                              ? "bg-emerald-500 text-white" 
                              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                          )}
                          title={localTextProvider === 'openrouter' ? t('text_active') : t('set_as_text')}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        {t('openrouter_image_model')}
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={orImageModel}
                          onChange={(e) => setOrImageModel(e.target.value)}
                          placeholder="google/gemini-3.1-flash-image-preview"
                          className="w-full px-4 py-2 pr-12 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                        />
                        <button
                          onClick={() => setLocalImageProvider('openrouter')}
                          className={cn(
                            "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors",
                            localImageProvider === 'openrouter' 
                              ? "bg-emerald-500 text-white" 
                              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                          )}
                          title={localImageProvider === 'openrouter' ? t('image_active') : t('set_as_image')}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gemini Card */}
                <div className="border rounded-xl p-5 transition-all relative overflow-hidden border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Google Gemini</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        {t('api_key')}
                      </label>
                      <div className="relative">
                        <input
                          type={showGeminiKey ? "text" : "password"}
                          value={geminiKey}
                          onChange={(e) => setGeminiKey(e.target.value)}
                          placeholder={t('api_key_placeholder')}
                          className="w-full px-4 py-2 pr-10 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                        />
                        <button
                          onClick={() => setShowGeminiKey(!showGeminiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        >
                          {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        {t('gemini_text_model')}
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={gTextModel}
                          onChange={(e) => setGTextModel(e.target.value)}
                          placeholder="gemini-3-flash-preview"
                          className="w-full px-4 py-2 pr-12 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                        />
                        <button
                          onClick={() => setLocalTextProvider('gemini')}
                          className={cn(
                            "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors",
                            localTextProvider === 'gemini' 
                              ? "bg-emerald-500 text-white" 
                              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                          )}
                          title={localTextProvider === 'gemini' ? t('text_active') : t('set_as_text')}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        {t('gemini_image_model')}
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={gImageModel}
                          onChange={(e) => setGImageModel(e.target.value)}
                          placeholder="gemini-2.5-flash-image"
                          className="w-full px-4 py-2 pr-12 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                        />
                        <button
                          onClick={() => setLocalImageProvider('gemini')}
                          className={cn(
                            "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors",
                            localImageProvider === 'gemini' 
                              ? "bg-emerald-500 text-white" 
                              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                          )}
                          title={localImageProvider === 'gemini' ? t('image_active') : t('set_as_image')}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2 shrink-0">
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
