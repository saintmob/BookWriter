import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, Check, X } from 'lucide-react';
import { chatWithChapter } from '../lib/ai';
import ReactMarkdown from 'react-markdown';

interface ChapterChatProps {
  content: string;
  chapterTitle: string;
  bookTitle: string;
  language: string;
  onApplyContent: (newContent: string) => void;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  updatedContent?: string;
}

export function ChapterChat({ content, chapterTitle, bookTitle, language, onApplyContent, onClose }: ChapterChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await chatWithChapter(content, userMessage, chapterTitle, bookTitle, language);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.reply,
        updatedContent: response.updatedContent
      }]);
    } catch (error) {
      console.error('Chat failed', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 w-80 lg:w-96 shadow-xl z-20 absolute right-0 top-0 bottom-0">
      <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-500" />
          AI Assistant
        </h3>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-zinc-500 text-sm mt-8">
            <p>Ask me to rewrite, expand, or polish your chapter.</p>
            <p className="mt-2 text-xs opacity-70">Example: "Make the dialogue more intense" or "Describe the setting in more detail"</p>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div 
              className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user' 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm'
              }`}
            >
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
            
            {msg.updatedContent && (
              <div className="mt-2 w-full">
                <button
                  onClick={() => onApplyContent(msg.updatedContent!)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-300 rounded-lg text-xs font-medium transition-colors border border-emerald-200 dark:border-emerald-800"
                >
                  <Check className="w-3 h-3" />
                  Apply Changes
                </button>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start">
            <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type instructions..."
            className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg pl-3 pr-10 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[40px] max-h-32"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-2 p-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
