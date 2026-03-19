import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';

export const AIChatbot = ({ lang, t, params, advancedResults, initialPrompt, setAiPrompt }: any) => {
  const [messages, setMessages] = useState<any[]>([{ role: 'assistant', content: 'How can I help you with your ROI analysis today?' }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (initialPrompt) {
      handleSend(initialPrompt);
      if (setAiPrompt) setAiPrompt('');
    }
  }, [initialPrompt]);

  const handleSend = async (textToSend?: string) => {
    const text = typeof textToSend === 'string' ? textToSend : input;
    if (!text.trim()) return;
    
    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          contextData: { params, advancedResults }
        })
      });

      if (!response.ok) throw new Error('Failed to get response');
      const data = await response.json();
      
      setMessages([...newMessages, { role: 'assistant', content: data.text }]);
    } catch (error) {
      console.error(error);
      setMessages([...newMessages, { role: 'assistant', content: 'Sorry, I encountered an error while processing your request.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto h-full flex flex-col">
      <h2 className="text-2xl font-bold text-white mb-6">{t.aiAssistant || 'AI Assistant'}</h2>
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-6 overflow-y-auto mb-4 flex flex-col gap-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <span className={`inline-block p-3 rounded-lg max-w-[80%] whitespace-pre-wrap ${m.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300'}`}>
              {m.content}
            </span>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <span className="inline-block p-3 rounded-lg bg-zinc-800 text-zinc-300 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Typing...
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex gap-2">
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
          placeholder="Ask about your ROI..."
          disabled={isTyping}
        />
        <button 
          onClick={() => handleSend()} 
          disabled={isTyping || !input.trim()}
          className="p-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};
