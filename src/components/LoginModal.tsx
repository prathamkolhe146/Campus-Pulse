import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, KeyRound, Lock, X } from 'lucide-react';
import { Role } from '../lib/types';

export type LoginTab = 'ADMIN' | 'STAFF' | 'STUDENT';

interface LoginModalProps {
  isOpen: boolean;
  initialTab: LoginTab;
  activationToken?: string | null;
  onClose: () => void;
  onEmailLogin: (email: string, password: string) => Promise<void>;
  onDemoRoleLogin: (role: Role, email?: string) => Promise<void>;
}

const TAB_DEFAULTS: Record<
  LoginTab,
  {
    label: string;
    hintEmail: string;
    primaryRole: Role;
    primaryLabel: string;
    description: string;
  }
> = {
  ADMIN: {
    label: 'College Admin',
    hintEmail: 'admin@tcer.edu.in',
    primaryRole: Role.COLLEGE_ADMIN,
    primaryLabel: 'Sign In as College Admin',
    description:
      'Full institutional oversight across all departments, teachers, students, monthly reports, and audit logs.',
  },
  STAFF: {
    label: 'Faculty / Operator',
    hintEmail: 'faculty@tcer.edu.in',
    primaryRole: Role.FACULTY,
    primaryLabel: 'Sign In as Faculty',
    description:
      'Mark one-tap attendance, edit historical sessions, onboard cohorts, and export monthly registers.',
  },
  STUDENT: {
    label: 'Student',
    hintEmail: 'student@tcer.edu.in',
    primaryRole: Role.STUDENT,
    primaryLabel: 'Sign In as Ananya (89%)',
    description:
      'Restricted personal portal for month-wise attendance, all-month heatmap, and 75% recovery predictor.',
  },
};

export function LoginModal({
  isOpen,
  initialTab,
  activationToken,
  onClose,
  onEmailLogin,
  onDemoRoleLogin,
}: LoginModalProps) {
  const [activeTab, setActiveTab] = useState<LoginTab>(initialTab);
  const [email, setEmail] = useState<string>(TAB_DEFAULTS[initialTab].hintEmail);
  const [password, setPassword] = useState<string>('CampusPulse@2026');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setEmail(TAB_DEFAULTS[initialTab].hintEmail);
      setPassword('CampusPulse@2026');
      setError(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const currentTabConfig = TAB_DEFAULTS[activeTab];

  const handleSelectTab = (tab: LoginTab) => {
    setActiveTab(tab);
    setEmail(TAB_DEFAULTS[tab].hintEmail);
    setPassword('CampusPulse@2026');
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter both your institutional email and password.');
      return;
    }

    setSubmitting(true);
    try {
      await onEmailLogin(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemo = async (role: Role, specificEmail?: string) => {
    setError(null);
    setSubmitting(true);
    try {
      await onDemoRoleLogin(role, specificEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start session.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-xl border border-[#1E293B] bg-[#131A26] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="login-modal-title" className="text-xl font-bold text-white">
              Sign In to CampusPulse
            </h2>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Trinity College of Engineering and Research · Role-Based Access Portal
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
            className="p-2 text-[#94A3B8] hover:text-white rounded-lg hover:bg-[#1E293B] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {activationToken && (
          <div className="mt-4 rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-4 py-3 text-xs text-[#A7F3D0]">
            Account activation token <span className="font-mono">{activationToken}</span>{' '}
            detected. Enter your temporary password from the onboarding email below.
          </div>
        )}

        {/* Role Tabs */}
        <div
          role="tablist"
          aria-label="Select portal role"
          className="mt-5 grid grid-cols-3 gap-1 rounded-lg bg-[#0B0F17] p-1 border border-[#1E293B]"
        >
          {(['ADMIN', 'STAFF', 'STUDENT'] as LoginTab[]).map((tabKey) => {
            const selected = activeTab === tabKey;
            return (
              <button
                key={tabKey}
                role="tab"
                type="button"
                aria-selected={selected}
                onClick={() => handleSelectTab(tabKey)}
                className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  selected
                    ? 'bg-[#3B82F6] text-white'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {TAB_DEFAULTS[tabKey].label}
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-[#94A3B8]">{currentTabConfig.description}</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-medium text-[#CBD5E1] mb-1.5"
            >
              Institutional Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@tcer.edu.in"
              className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3.5 py-2.5 text-sm text-white placeholder-[#64748B] focus:border-[#3B82F6] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-medium text-[#CBD5E1] mb-1.5"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3.5 py-2.5 text-sm text-white placeholder-[#64748B] focus:border-[#3B82F6] focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-[#F87171]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
            <span>{submitting ? 'Signing in...' : 'Sign In'}</span>
          </button>
        </form>

        {/* Quick Credential Access */}
        <div className="mt-5 border-t border-[#1E293B] pt-4">
          <p className="text-xs font-medium text-[#94A3B8] mb-3">
            Quick Portal Sign-In (Strictly Scoped to Selected Account)
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleQuickDemo(currentTabConfig.primaryRole)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#1E293B] bg-[#0B0F17] hover:bg-[#1E293B] px-3 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>{currentTabConfig.primaryLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {activeTab === 'STAFF' && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleQuickDemo(Role.OPERATOR)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#1E293B] bg-[#0B0F17] hover:bg-[#1E293B] px-3 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                <span>Sign In as Operator</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {activeTab === 'STUDENT' && (
              <button
                type="button"
                disabled={submitting}
                onClick={() =>
                  handleQuickDemo(Role.STUDENT, 'rohan.deshmukh@tcer.edu.in')
                }
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#1E293B] bg-[#0B0F17] hover:bg-[#1E293B] px-3 py-2 text-xs font-semibold text-[#FCA5A5] hover:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                <span>Sign In as Rohan (&lt;75%)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#64748B]">
            <Lock className="w-3 h-3 shrink-0" />
            <span className="font-mono">
              {currentTabConfig.hintEmail} / CampusPulse@2026 · Locked per account
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
