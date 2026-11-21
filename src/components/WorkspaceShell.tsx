import { ReactNode, useState } from 'react';
import {
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  ShieldAlert,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Institution, Role, UserAccount } from '../lib/types';

export interface NavItem {
  id: string;
  label: string;
  icon: 'dashboard' | 'mark' | 'students' | 'reports' | 'audit' | 'users' | 'student';
}

interface WorkspaceShellProps {
  institution: Institution;
  user: UserAccount;
  navItems: NavItem[];
  activeNav: string;
  restrictedRouteAttempt?: string | null;
  onDismissRestrictedAttempt?: () => void;
  onSelectNav: (id: string) => void;
  onLogout: () => void;
  children: ReactNode;
}

function renderNavIcon(icon: NavItem['icon']) {
  const cls = 'w-4 h-4 shrink-0';
  switch (icon) {
    case 'dashboard':
      return <LayoutDashboard className={cls} />;
    case 'mark':
      return <ClipboardCheck className={cls} />;
    case 'students':
      return <UserPlus className={cls} />;
    case 'reports':
      return <FileSpreadsheet className={cls} />;
    case 'audit':
      return <ShieldAlert className={cls} />;
    case 'users':
      return <Users className={cls} />;
    case 'student':
      return <GraduationCap className={cls} />;
  }
}

export function formatRoleLabel(role: Role): string {
  switch (role) {
    case Role.SUPER_ADMIN:
    case Role.COLLEGE_ADMIN:
      return 'College Admin';
    case Role.FACULTY:
      return 'Faculty';
    case Role.OPERATOR:
      return 'Operator';
    case Role.STUDENT:
      return 'Student';
  }
}

export function WorkspaceShell({
  institution,
  user,
  navItems,
  activeNav,
  restrictedRouteAttempt,
  onDismissRestrictedAttempt,
  onSelectNav,
  onLogout,
  children,
}: WorkspaceShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeNavLabel = navItems.find((n) => n.id === activeNav)?.label ?? 'Overview';

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="flex h-16 items-center justify-between px-5 border-b border-[#1E293B]">
          <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
            CampusPulse
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close sidebar navigation"
            className="lg:hidden p-1.5 text-[#94A3B8] hover:text-white rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-[#1E293B]">
          <p className="text-xs font-semibold text-white leading-snug">{institution.name}</p>
          <p className="text-[11px] text-[#94A3B8] mt-1">
            {institution.code} · {institution.academicYear}
          </p>
        </div>

        <nav aria-label="Workspace sections" className="p-3 space-y-1">
          {navItems.map((item) => {
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectNav(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors text-left cursor-pointer ${
                  active
                    ? 'bg-[#3B82F6]/15 text-white border border-[#3B82F6]/35'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#131A26] border border-transparent'
                }`}
              >
                {renderNavIcon(item.icon)}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-[#1E293B]">
        <div className="mb-3">
          <p className="text-sm font-semibold text-white truncate">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs text-[#94A3B8] truncate">
            {formatRoleLabel(user.role)} · {user.email}
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white bg-[#131A26] hover:bg-[#1E293B] border border-[#1E293B] rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0B0F17] text-[#F1F5F9] flex">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-[#1E293B] bg-[#0D131F]">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 bg-[#0D131F] border-r border-[#1E293B] h-full shadow-2xl">
            {sidebarContent}
          </div>
          <button
            type="button"
            aria-label="Dismiss navigation backdrop"
            onClick={() => setMobileMenuOpen(false)}
            className="flex-1 bg-black/60"
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="no-print sticky top-0 z-30 h-16 border-b border-[#1E293B] bg-[#0B0F17]/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 text-[#94A3B8] hover:text-white rounded-lg hover:bg-[#131A26] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0 truncate">
              <span className="text-[#94A3B8] hidden sm:inline whitespace-nowrap">
                {formatRoleLabel(user.role)} Portal
              </span>
              <span className="text-[#475569] hidden sm:inline">/</span>
              <span className="font-semibold text-white truncate">{activeNavLabel}</span>
            </div>
          </div>

          {/* Strictly locked role indicator + Sign Out action (no cross-portal switching) */}
          <div className="flex items-center gap-4 shrink-0">
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-[#94A3B8] whitespace-nowrap">
              <Lock className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Restricted to {formatRoleLabel(user.role)} Access</span>
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#E2E8F0] hover:text-white bg-[#131A26] hover:bg-[#1E293B] border border-[#1E293B] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1360px] w-full mx-auto">
          {restrictedRouteAttempt && (
            <div
              role="alert"
              className="no-print mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#EF4444]/45 bg-[#EF4444]/10 px-5 py-4"
            >
              <div className="flex items-start gap-3">
                <Lock className="w-4 h-4 text-[#FCA5A5] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[#FCA5A5]">
                    Access Restricted (403)
                  </p>
                  <p className="text-xs text-[#FECACA] mt-0.5">
                    Your <span className="font-semibold">{formatRoleLabel(user.role)}</span>{' '}
                    account cannot visit <span className="font-mono">{restrictedRouteAttempt}</span>.
                    Sign out first to authenticate with a different role.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onDismissRestrictedAttempt && (
                  <button
                    type="button"
                    onClick={onDismissRestrictedAttempt}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1E293B] hover:bg-[#334155] rounded-md cursor-pointer"
                  >
                    Stay in Portal
                  </button>
                )}
                <button
                  type="button"
                  onClick={onLogout}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] rounded-md cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {children}
        </main>

        {/* Quiet Professional Workspace Footer */}
        <footer className="no-print border-t border-[#1E293B] px-6 py-4 text-xs text-[#64748B] flex flex-wrap items-center justify-between gap-2">
          <span>
            © 2026 CampusPulse · {institution.name} ({institution.code})
          </span>
          <span>Strict Role-Based Access Active · Sign out to switch accounts</span>
        </footer>
      </div>
    </div>
  );
}
