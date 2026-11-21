import { FormEvent, useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';
import { api } from '../lib/api';
import { Role, UserAccount } from '../lib/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isError?: boolean;
}

interface CampusPulseChatbotProps {
  authToken: string | null;
  currentUser: UserAccount | null;
  elevatedOffset?: boolean;
}

function getQuickPrompts(user: UserAccount | null): string[] {
  if (!user) {
    return [
      'How does the 75% recovery formula work?',
      'What roles are supported at Trinity College?',
      'How does CampusPulse replace legacy ERPs?',
    ];
  }
  if (user.role === Role.STUDENT) {
    return [
      'Summarize my current attendance standing',
      'Which month was my lowest attendance?',
      'Which course needs attention to stay above 75%?',
    ];
  }
  if (user.role === Role.COLLEGE_ADMIN || user.role === Role.SUPER_ADMIN) {
    return [
      'Summarize Trinity College attendance overview',
      'How many students are currently below 75%?',
      'Explain the 48-hour audit correction policy',
    ];
  }
  return [
    'How does the 48-hour correction audit rule work?',
    'How do I export a 1–31 monthly CSV matrix?',
    'How are student onboarding credentials dispatched?',
  ];
}

function getScopeLabel(user: UserAccount | null): string {
  if (!user) return 'Public Guide · Trinity College';
  if (user.role === Role.STUDENT) return `Student Assistant · ${user.firstName}`;
  if (user.role === Role.COLLEGE_ADMIN || user.role === Role.SUPER_ADMIN) {
    return 'Admin Intelligence Assistant';
  }
  if (user.role === Role.OPERATOR) return 'Operator Support Assistant';
  return 'Faculty Workspace Assistant';
}

export function CampusPulseChatbot({
  authToken,
  currentUser,
  elevatedOffset = false,
}: CampusPulseChatbotProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Welcome to CampusPulse at Trinity College of Engineering and Research. Ask me about attendance rules, 75% recovery math, monthly reports, or your portal analytics.',
    },
  ]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Reset welcome message cleanly when account changes so prior role chat never bleeds over
  useEffect(() => {
    setMessages([
      {
        id: `welcome-${currentUser?.id ?? 'public'}`,
        role: 'assistant',
        text: currentUser
          ? `Hello ${currentUser.firstName}. I am scoped to your ${currentUser.role.replace('_', ' ').toLowerCase()} workspace at Trinity College of Engineering and Research. How can I help?`
          : 'Welcome to CampusPulse for Trinity College of Engineering and Research. Ask about one-tap attendance, 75% recovery math, or portal login.',
      },
    ]);
  }, [currentUser?.id, currentUser?.firstName, currentUser?.role]);

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    const historyForApi = messages
      .filter((m) => !m.isError)
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await api.sendChatMessage(authToken, {
        message: trimmed,
        history: historyForApi,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: res.reply,
        },
      ]);
    } catch (err) {
      const errText =
        err instanceof Error
          ? err.message
          : 'Unable to reach CampusPulse Assistant right now.';
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text: errText,
          isError: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await sendQuestion(input);
  };

  const quickPrompts = getQuickPrompts(currentUser);
  const bottomClass = elevatedOffset ? 'bottom-20' : 'bottom-5';

  return (
    <div className={`no-print fixed ${bottomClass} right-5 z-40`}>
      {open ? (
        <section
          aria-label="CampusPulse Assistant Chat"
          className="w-[340px] sm:w-[390px] rounded-xl border border-[#334155] bg-[#131A26] shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: '520px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-[#1E293B] bg-[#0D131F] px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                CampusPulse Assistant
              </p>
              <p className="text-[11px] text-[#94A3B8] truncate">
                {getScopeLabel(currentUser)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close CampusPulse Assistant"
              className="p-1.5 text-[#94A3B8] hover:text-white rounded-md hover:bg-[#1E293B] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0B0F17]"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[#3B82F6] text-white'
                      : msg.isError
                      ? 'border border-[#EF4444]/40 bg-[#EF4444]/10 text-[#FCA5A5]'
                      : 'border border-[#1E293B] bg-[#131A26] text-[#E2E8F0]'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-lg border border-[#1E293B] bg-[#131A26] px-3.5 py-2 text-xs text-[#94A3B8]">
                  Thinking...
                </div>
              </div>
            )}
          </div>

          {/* Quick Prompts */}
          <div className="border-t border-[#1E293B] bg-[#0D131F] px-3 py-2 flex flex-wrap gap-1.5">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={sending}
                onClick={() => sendQuestion(prompt)}
                className="text-[11px] text-[#CBD5E1] hover:text-white bg-[#131A26] hover:bg-[#1E293B] border border-[#1E293B] rounded-md px-2.5 py-1 transition-colors text-left cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-[#1E293B] bg-[#131A26] p-3 flex items-center gap-2"
          >
            <label htmlFor="chatbot-input" className="sr-only">
              Ask CampusPulse Assistant
            </label>
            <input
              id="chatbot-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about attendance, reports, or 75% math..."
              className="flex-1 rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-xs text-white placeholder-[#64748B] focus:border-[#3B82F6] focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className="p-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 text-white transition-colors cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open CampusPulse Assistant"
          className="inline-flex items-center gap-2 rounded-lg border border-[#3B82F6]/60 bg-[#3B82F6] hover:bg-[#2563EB] px-4 py-2.5 text-xs font-semibold text-white shadow-xl transition-colors whitespace-nowrap cursor-pointer"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Ask CampusPulse</span>
        </button>
      )}
    </div>
  );
}
