import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { type Language, type ROIParams, type ROIResults } from '../../types';
import { type ProjectInput } from '../../domain/model';
import { type ChatMessage } from '../../hooks/useAppState';

interface AIChatbotProps {
  lang: Language;
  t: any;
  params: ROIParams;
  advancedResults: ROIResults | null;
  /**
   * The project on the rebuilt engine, when one is loaded. Sent in preference
   * to the legacy pair: it is the model the reports are produced from, so an
   * assistant answering from anything else would contradict them.
   */
  project?: ProjectInput | null;
  initialPrompt?: string;
  setAiPrompt?: (value: string) => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

const GREETING: ChatMessage = {
  role: 'assistant',
  content: 'How can I help you with your ROI analysis today?',
};

export const AIChatbot: React.FC<AIChatbotProps> = ({
  lang, t, params, advancedResults, project, initialPrompt, setAiPrompt, messages, setMessages,
}) => {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Guards against StrictMode running the effect twice and firing the same
  // prompt at the API two times over (P2-10).
  const sentPromptRef = useRef<string | null>(null);

  const visible = messages.length > 0 ? messages : [GREETING];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const send = async (textToSend?: string) => {
    const text = (typeof textToSend === 'string' ? textToSend : input).trim();
    if (!text || isTyping) return;

    const history: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(history);
    setInput('');
    setIsTyping(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          contextData: { project: project ?? undefined, params, advancedResults },
          targetLanguage: lang,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        // The server sends a readable sentence; surface it rather than a status code.
        throw new Error(data?.error || 'The assistant is unavailable right now.');
      }

      setMessages([...history, { role: 'assistant', content: data.text }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
      setMessages(history);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    if (!initialPrompt || sentPromptRef.current === initialPrompt) return;
    sentPromptRef.current = initialPrompt;
    void send(initialPrompt);
    setAiPrompt?.('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  return (
    <div className="p-8 max-w-3xl mx-auto h-full flex flex-col">
      <h2 className="text-2xl font-bold text-[#002D32] mb-6">{t.aiAssistant || 'AI Assistant'}</h2>
      <div className="flex-1 bg-white/80 border border-[#006D77]/20 rounded-2xl backdrop-blur-[16px] shadow-[0_8px_32px_rgba(0,109,119,0.1)] p-6 overflow-y-auto mb-4 flex flex-col gap-4">
        {visible.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <span className={`inline-block p-4 rounded-2xl max-w-[85%] whitespace-pre-wrap ${m.role === 'user' ? 'bg-[#006D77] text-white shadow-sm' : 'bg-white/90 border border-[#006D77]/10 text-[#002D32] shadow-sm'}`}>
              {m.content}
            </span>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <span className="inline-block p-4 rounded-2xl bg-white/90 border border-[#006D77]/10 text-[#002D32] shadow-sm flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-[#006D77]" /> Typing...
            </span>
          </div>
        )}
        {error && (
          <div className="flex justify-start">
            <span className="inline-flex items-start gap-2 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm max-w-[85%]">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex gap-2 p-2 bg-white/80 backdrop-blur-md border border-[#006D77]/20 rounded-[20px] shadow-sm">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
          className="flex-1 bg-transparent px-4 py-2 text-slate-900 focus:outline-none placeholder:text-slate-400"
          placeholder="Ask about your ROI..."
          disabled={isTyping}
        />
        <button
          onClick={() => void send()}
          disabled={isTyping || !input.trim()}
          className="p-3 bg-[#006D77] text-white rounded-xl hover:bg-[#005259] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};
