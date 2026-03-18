import React, { useState } from 'react';
import { Send } from 'lucide-react';

export const AIChatbot = ({ lang, t }: any) => {
  const [messages, setMessages] = useState<any[]>([{ role: 'assistant', content: 'How can I help you with your ROI analysis today?' }]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages([...messages, { role: 'user', content: input }]);
    setInput('');
    // Logic to call AI will be added later
  };

  return (
    <div className="p-8 max-w-3xl mx-auto h-full flex flex-col">
      <h2 className="text-2xl font-bold text-white mb-6">{t.aiAssistant}</h2>
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-6 overflow-y-auto mb-4">
        {messages.map((m, i) => (
          <div key={i} className={`mb-4 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
            <span className={`inline-block p-3 rounded-lg ${m.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300'}`}>
              {m.content}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
          placeholder="Ask about your ROI..."
        />
        <button onClick={handleSend} className="p-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500">
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};
