import React, { useState } from 'react';
import { Sparkles, X, Send, Bot, User, Music, Film, ListMusic, RefreshCw } from 'lucide-react';
import { sendLesargeAssistantChat } from '../services/lesargeApi';

interface QwenAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPrompt?: (prompt: string) => void;
}

export const QwenAssistantDrawer: React.FC<QwenAssistantDrawerProps> = ({
  isOpen,
  onClose,
  onApplyPrompt,
}) => {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: `👋 Hi! I am **Qwen 2.5**, your AI Music & Video Orchestration Assistant for **Lesarge Music AI**.\n\nAsk me anything like:\n- *"Write lyrics for an emotional Afrobeats song about overcoming obstacles."*\n- *"What instruments work best for Amapiano?"*\n- *"Create a 3-scene video storyboard for a synthwave track."*`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const newMsgs = [...messages, { role: 'user' as const, content: query }];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);

    try {
      const reply = await sendLesargeAssistantChat(newMsgs);
      setMessages([...newMsgs, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      setMessages([
        ...newMsgs,
        {
          role: 'assistant',
          content: `⚠️ Assistant error: ${err.message || 'Could not connect to Qwen assistant service.'}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    'Write Afrobeats lyrics about success',
    'Recommend instruments for deep Amapiano',
    'Create a video storyboard for a high-energy dance track',
    'How do log drums work in ACE-Step 1.5?',
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col font-sans">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm leading-tight flex items-center gap-1.5">
              Qwen 2.5 Assistant
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200 font-mono">
                AI Orchestrator
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">music.lesarge.ch intelligence engine</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex gap-3 text-xs leading-relaxed ${
              m.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {m.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}
            <div
              className={`p-3 rounded-2xl max-w-[85%] whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none shadow-sm'
                  : 'bg-white border border-slate-200/80 text-slate-800 rounded-bl-none shadow-sm'
              }`}
            >
              {m.content}

              {m.role === 'assistant' && onApplyPrompt && (
                <button
                  onClick={() => {
                    const cleanPrompt = m.content.replace(/[*#]/g, '').substring(0, 150);
                    onApplyPrompt(cleanPrompt);
                    onClose();
                  }}
                  className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1 text-[11px] text-indigo-600 font-medium hover:underline"
                >
                  <Music className="w-3 h-3" />
                  Use this concept in Creation Studio
                </button>
              )}
            </div>
            {m.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-white shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 items-center text-xs text-slate-500 bg-white p-3 rounded-xl border border-slate-200/80 w-fit">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
            <span>Qwen 2.5 is composing ideas...</span>
          </div>
        )}
      </div>

      {/* Quick Suggestions */}
      <div className="px-4 py-2 border-t border-slate-100 bg-white flex flex-wrap gap-1.5">
        {quickPrompts.map((qp, i) => (
          <button
            key={i}
            onClick={() => handleSend(qp)}
            className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 transition-colors text-left truncate max-w-full"
          >
            💡 {qp}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-3 border-t border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Qwen for lyrics, genres, or storyboard ideas..."
            className="flex-1 bg-slate-100 border border-slate-200 text-xs rounded-xl px-3.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="p-2.5 rounded-xl bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
