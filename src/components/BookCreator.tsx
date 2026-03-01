import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { generateProposals, generateOutline, Proposal } from '../lib/ai';
import { db, Book } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Loader2, Sparkles, ArrowRight, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function BookCreator() {
  const { t } = useTranslation();
  const { createBook, language, loadBooks, setActiveBook } = useStore();
  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [idea, setIdea] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  const handleGenerateProposals = async () => {
    if (!idea.trim()) return;
    setIsGenerating(true);
    try {
      const results = await generateProposals(idea, language);
      setProposals(results);
      setStep(2);
    } catch (error) {
      console.error(error);
      alert('Failed to generate proposals');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectProposal = async (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setIsGenerating(true);
    setStep(3);
    try {
      const outline = await generateOutline(proposal, language);
      
      // Create book in DB (without setting activeBookId yet)
      const newBookId = uuidv4();
      const newBook: Book = {
        id: newBookId,
        title: proposal.title,
        idea,
        summary: outline.summary,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await db.saveBook(newBook);
      
      // Create chapters in DB
      for (let i = 0; i < outline.chapters.length; i++) {
        await db.saveChapter({
          id: uuidv4(),
          bookId: newBookId,
          title: outline.chapters[i].title,
          description: outline.chapters[i].description,
          content: '',
          order: i,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      // Now load books and set active book
      await loadBooks();
      setActiveBook(newBookId);

      
    } catch (error) {
      console.error(error);
      alert('Failed to generate outline');
      setStep(2);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-8 md:p-16 transition-colors duration-200">
      <div className="max-w-3xl mx-auto">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-serif font-bold mb-4 flex items-center justify-center gap-3">
            <Sparkles className="w-8 h-8 text-emerald-500" />
            {t('new_book')}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            {step === 1 && t('step_1')}
            {step === 2 && t('step_2')}
            {step === 3 && t('step_3')}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <label className="block text-sm font-medium mb-3 text-zinc-700 dark:text-zinc-300">
                  {t('book_idea')}
                </label>
                <textarea
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder={t('idea_placeholder')}
                  className="w-full h-48 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none text-lg transition-all"
                />
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={handleGenerateProposals}
                  disabled={!idea.trim() || isGenerating}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  {isGenerating ? t('generating') : t('generate_proposals')}
                  {!isGenerating && <ArrowRight className="w-5 h-5" />}
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-serif font-semibold mb-6">{t('proposals_title')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {proposals.map((proposal, idx) => (
                  <div
                    key={idx}
                    className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all cursor-pointer flex flex-col h-full group shadow-sm hover:shadow-md"
                    onClick={() => handleSelectProposal(proposal)}
                  >
                    <h3 className="text-xl font-serif font-bold mb-3 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {proposal.title}
                    </h3>
                    
                    <div className="space-y-4 flex-1 text-sm">
                      <div>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 block mb-1">{t('concept')}</span>
                        <p className="text-zinc-600 dark:text-zinc-400 line-clamp-4">{proposal.concept}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 block mb-1">{t('target_audience')}</span>
                        <p className="text-zinc-600 dark:text-zinc-400">{proposal.targetAudience}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 block mb-1">{t('tone')}</span>
                        <p className="text-zinc-600 dark:text-zinc-400">{proposal.tone}</p>
                      </div>
                    </div>
                    
                    <button className="mt-6 w-full py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg font-medium group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      {t('select')}
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center h-64 space-y-6"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                <BookOpen className="w-16 h-16 text-emerald-600 dark:text-emerald-400 relative z-10 animate-bounce" />
              </div>
              <h2 className="text-2xl font-serif font-semibold">{t('creating_book')}</h2>
              <p className="text-zinc-500 dark:text-zinc-400">{selectedProposal?.title}</p>
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
