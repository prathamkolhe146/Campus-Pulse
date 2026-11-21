import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminPortal } from './components/AdminPortal';
import { CampusPulseChatbot } from './components/CampusPulseChatbot';
import { FacultyAttendanceSheet } from './components/FacultyAttendanceSheet';
import { LandingPage } from './components/LandingPage';
import { LoginModal, LoginTab } from './components/LoginModal';
import { OperatorPortal } from './components/OperatorPortal';
import { ReportsMatrixPanel } from './components/ReportsMatrixPanel';
import { StudentOnboardingPanel } from './components/StudentOnboardingPanel';
import { StudentPortal } from './components/StudentPortal';
import { NavItem, WorkspaceShell } from './components/WorkspaceShell';
import { api } from './lib/api';
import {
  calculateAttendancePercentage,
  calculateRecoveryMetrics,
  isAttendedStatus,
} from './lib/attendanceMath';
import { CampusStatePayload, Role, UserAccount } from './lib/types';

function getNavForRole(role: Role): NavItem[] {
  switch (role) {
    case Role.SUPER_ADMIN:
    case Role.COLLEGE_ADMIN:
      return [
        { id: 'overview', label: 'Command Center', icon: 'dashboard' },
        { id: 'departments', label: 'Departments & Batches', icon: 'users' },
        { id: 'staff', label: 'Teachers & Staff', icon: 'students' },
        { id: 'students', label: 'All Students', icon: 'student' },
        { id: 'reports', label: 'Monthly Reports', icon: 'reports' },
        { id: 'audit', label: 'Audit Log Vault', icon: 'audit' },
      ];
    case Role.FACULTY:
      return [
        { id: 'mark', label: 'One-Tap Attendance', icon: 'mark' },
        { id: 'overview', label: 'Class Command Center', icon: 'dashboard' },
        { id: 'students', label: 'Students & Onboarding', icon: 'students' },
        { id: 'reports', label: 'Monthly Matrix & PDF', icon: 'reports' },
        { id: 'audit', label: 'Audit Trail', icon: 'audit' },
      ];
    case Role.OPERATOR:
      return [
        { id: 'onboarding', label: 'Bulk Onboarding', icon: 'students' },
        { id: 'leaves', label: 'Institutional Leaves', icon: 'mark' },
        { id: 'reports', label: 'Monthly Matrix & CSV', icon: 'reports' },
        { id: 'audit', label: 'System Audit Logs', icon: 'audit' },
      ];
    case Role.STUDENT:
      return [
        { id: 'overview', label: 'Attendance & Months', icon: 'student' },
        { id: 'history', label: 'All-Month Heatmap', icon: 'dashboard' },
      ];
  }
}

function getRoleRoutePrefix(role: Role): string {
  switch (role) {
    case Role.SUPER_ADMIN:
    case Role.COLLEGE_ADMIN:
      return 'admin';
    case Role.FACULTY:
      return 'faculty';
    case Role.OPERATOR:
      return 'operator';
    case Role.STUDENT:
      return 'student';
  }
}

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [campusState, setCampusState] = useState<CampusStatePayload | null>(null);
  const [activeNav, setActiveNav] = useState<string>('mark');
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginModalTab, setLoginModalTab] = useState<LoginTab>('STAFF');
  const [activationToken, setActivationToken] = useState<string | null>(null);
  const [busyAuth, setBusyAuth] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [restrictedRouteAttempt, setRestrictedRouteAttempt] = useState<string | null>(null);

  const hydrateWorkspace = useCallback(async (token: string, user: UserAccount) => {
    const state = await api.getState(token);
    setAuthToken(token);
    setCurrentUser(user);
    setCampusState(state);
    const items = getNavForRole(user.role);
    const initialSection = items[0]?.id ?? 'overview';
    setActiveNav(initialSection);
    setRestrictedRouteAttempt(null);
    setLoginModalOpen(false);
    setGlobalError(null);
    const prefix = getRoleRoutePrefix(user.role);
    window.history.replaceState(null, '', `#/${prefix}/${initialSection}`);
  }, []);

  const handleDemoRole = useCallback(
    async (role: Role, email?: string) => {
      setBusyAuth(true);
      setGlobalError(null);
      try {
        const res = await api.loginDemoRole(role, email);
        await hydrateWorkspace(res.token, res.user);
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : 'Unable to start session.');
      } finally {
        setBusyAuth(false);
      }
    },
    [hydrateWorkspace]
  );

  const handleEmailLogin = useCallback(
    async (email: string, password: string) => {
      const res = await api.login(email, password);
      await hydrateWorkspace(res.token, res.user);
    },
    [hydrateWorkspace]
  );

  const handleLogout = useCallback(async () => {
    if (authToken) {
      await api.logout(authToken).catch(() => {});
    }
    setAuthToken(null);
    setCurrentUser(null);
    setCampusState(null);
    setRestrictedRouteAttempt(null);
    window.history.replaceState(null, '', window.location.pathname || '/');
  }, [authToken]);

  const handleSelectNav = useCallback(
    (sectionId: string) => {
      if (!currentUser) return;
      const allowed = getNavForRole(currentUser.role).some((n) => n.id === sectionId);
      if (!allowed) {
        setRestrictedRouteAttempt(`#/${sectionId}`);
        return;
      }
      setActiveNav(sectionId);
      setRestrictedRouteAttempt(null);
      const prefix = getRoleRoutePrefix(currentUser.role);
      window.history.replaceState(null, '', `#/${prefix}/${sectionId}`);
    },
    [currentUser]
  );

  // Strict Route-Lock Guard: when authenticated, block navigating to any unauthorized hash or portal path
  useEffect(() => {
    if (!currentUser) return;

    const authorizedPrefix = getRoleRoutePrefix(currentUser.role);
    const allowedSectionIds = new Set(getNavForRole(currentUser.role).map((n) => n.id));

    const enforceRouteLock = () => {
      const rawHash = window.location.hash;
      if (!rawHash) {
        window.history.replaceState(null, '', `#/${authorizedPrefix}/${activeNav}`);
        return;
      }

      const cleaned = rawHash.replace(/^#\/?/, '');
      const segments = cleaned.split('/').filter(Boolean);
      const targetPrefix = segments[0]?.toLowerCase() ?? '';
      const targetSection = segments[1]?.toLowerCase() ?? '';

      if (targetPrefix !== authorizedPrefix) {
        setRestrictedRouteAttempt(rawHash);
        window.history.replaceState(null, '', `#/${authorizedPrefix}/${activeNav}`);
        return;
      }

      if (targetSection && !allowedSectionIds.has(targetSection)) {
        setRestrictedRouteAttempt(rawHash);
        window.history.replaceState(null, '', `#/${authorizedPrefix}/${activeNav}`);
        return;
      }

      if (targetSection && targetSection !== activeNav) {
        setActiveNav(targetSection);
        setRestrictedRouteAttempt(null);
      }
    };

    window.addEventListener('hashchange', enforceRouteLock);
    window.addEventListener('popstate', enforceRouteLock);
    return () => {
      window.removeEventListener('hashchange', enforceRouteLock);
      window.removeEventListener('popstate', enforceRouteLock);
    };
  }, [currentUser, activeNav]);

  // Handle ?autostart=1 and ?activate=<token> query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const activate = params.get('activate');
    if (activate) {
      setActivationToken(activate);
      setLoginModalTab('STUDENT');
      setLoginModalOpen(true);
      return;
    }

    if (params.get('autostart') === '1') {
      const roleParam = params.get('role')?.toUpperCase();
      const targetRole =
        roleParam === Role.COLLEGE_ADMIN
          ? Role.COLLEGE_ADMIN
          : roleParam === Role.OPERATOR
          ? Role.OPERATOR
          : roleParam === Role.STUDENT
          ? Role.STUDENT
          : Role.FACULTY;
      handleDemoRole(targetRole);
    }
  }, [handleDemoRole]);

  const facultyOverviewMetrics = useMemo(() => {
    if (!campusState) return null;
    const totalAtt = campusState.records.filter((r) => isAttendedStatus(r.status)).length;
    const avgPct = calculateAttendancePercentage(totalAtt, campusState.records.length);
    const defaulterList = campusState.students
      .map((s) => {
        const recs = campusState.records.filter((r) => r.studentId === s.id);
        const att = recs.filter((r) => isAttendedStatus(r.status)).length;
        return {
          student: s,
          recovery: calculateRecoveryMetrics(
            att,
            recs.length,
            campusState.institution.attendanceThreshold
          ),
        };
      })
      .filter((x) => x.recovery.isDefaulter)
      .sort((a, b) => a.recovery.percentage - b.recovery.percentage);
    return { avgPct, defaulterList };
  }, [campusState]);

  // Public Landing Page View
  if (!authToken || !currentUser || !campusState) {
    return (
      <>
        {globalError && (
          <div
            role="alert"
            className="bg-[#EF4444]/15 border-b border-[#EF4444]/40 px-6 py-2.5 text-center text-xs text-[#FCA5A5]"
          >
            {globalError}
          </div>
        )}
        <LandingPage
          isBusy={busyAuth}
          onQuickDemoRole={handleDemoRole}
          onOpenLogin={(tab = 'STAFF') => {
            setLoginModalTab(tab);
            setLoginModalOpen(true);
          }}
        />
        <LoginModal
          isOpen={loginModalOpen}
          initialTab={loginModalTab}
          activationToken={activationToken}
          onClose={() => setLoginModalOpen(false)}
          onEmailLogin={handleEmailLogin}
          onDemoRoleLogin={handleDemoRole}
        />
        <CampusPulseChatbot authToken={null} currentUser={null} />
      </>
    );
  }

  const navItems = getNavForRole(currentUser.role);

  const renderWorkspaceContent = () => {
    if (
      currentUser.role === Role.COLLEGE_ADMIN ||
      currentUser.role === Role.SUPER_ADMIN
    ) {
      return (
        <AdminPortal
          section={activeNav}
          state={campusState}
          onNavigateSection={handleSelectNav}
          onCreateDepartment={async (payload) => {
            const res = await api.createDepartment(authToken, payload);
            setCampusState(res.state);
          }}
          onCreateStaff={async (payload) => {
            const res = await api.createStaff(authToken, payload);
            setCampusState(res.state);
          }}
          onExportCsvFromServer={(params) => api.downloadMonthlyCsv(authToken, params)}
        />
      );
    }

    if (currentUser.role === Role.STUDENT) {
      return (
        <StudentPortal
          section={activeNav}
          user={currentUser}
          state={campusState}
        />
      );
    }

    if (currentUser.role === Role.OPERATOR) {
      if (activeNav === 'reports') {
        return (
          <ReportsMatrixPanel
            state={campusState}
            onExportCsvFromServer={(params) => api.downloadMonthlyCsv(authToken, params)}
          />
        );
      }

      return (
        <OperatorPortal
          section={activeNav}
          state={campusState}
          onCreateStudent={async (payload) => {
            const res = await api.createStudent(authToken, payload);
            setCampusState(res.state);
            return res.emailLog;
          }}
          onBulkImport={async (payload) => {
            const res = await api.bulkImportStudents(authToken, payload);
            setCampusState(res.state);
            return res;
          }}
          onResendCredentials={async (studentId) => {
            const res = await api.resendStudentCredentials(authToken, studentId);
            setCampusState(res.state);
            return res.emailLog;
          }}
          onCreateLeave={async (payload) => {
            const res = await api.createLeaveEntry(authToken, payload);
            setCampusState(res.state);
          }}
        />
      );
    }

    // Faculty Workspace
    if (activeNav === 'mark') {
      return (
        <FacultyAttendanceSheet
          state={campusState}
          onSubmitSession={async (payload) => {
            const res = await api.submitSession(authToken, payload);
            setCampusState(res.state);
          }}
          onCorrectRecord={async (recordId, payload) => {
            const res = await api.correctRecord(authToken, recordId, payload);
            setCampusState(res.state);
          }}
        />
      );
    }

    if (activeNav === 'students') {
      return (
        <StudentOnboardingPanel
          state={campusState}
          onCreateStudent={async (payload) => {
            const res = await api.createStudent(authToken, payload);
            setCampusState(res.state);
            return res.emailLog;
          }}
          onBulkImport={async (payload) => {
            const res = await api.bulkImportStudents(authToken, payload);
            setCampusState(res.state);
            return res;
          }}
          onResendCredentials={async (studentId) => {
            const res = await api.resendStudentCredentials(authToken, studentId);
            setCampusState(res.state);
            return res.emailLog;
          }}
        />
      );
    }

    if (activeNav === 'reports') {
      return (
        <ReportsMatrixPanel
          state={campusState}
          onExportCsvFromServer={(params) => api.downloadMonthlyCsv(authToken, params)}
        />
      );
    }

    if (activeNav === 'audit') {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Faculty Correction Audit Trail
            </h1>
            <p className="text-sm text-[#94A3B8] mt-1">
              Every historical attendance adjustment is logged with timestamp, actor, status delta,
              and reason.
            </p>
          </div>
          <div className="rounded-xl border border-[#1E293B] bg-[#131A26] overflow-hidden divide-y divide-[#1E293B]">
            {campusState.auditLogs.map((log) => (
              <div key={log.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <span className="text-white font-semibold">
                    {log.rollNumber} · {log.studentName} · {log.courseCode} ({log.sessionDate})
                  </span>
                  <span>
                    <span className="text-[#F87171]">{log.oldStatus}</span>
                    <span className="mx-1.5 text-[#64748B]">→</span>
                    <span className="text-[#34D399] font-semibold">{log.newStatus}</span>
                  </span>
                </div>
                <p className="text-xs text-[#CBD5E1] mt-1.5">{log.reason}</p>
                <p className="text-[11px] font-mono text-[#64748B] mt-1">
                  {log.changedByName} · {new Date(log.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Faculty Class Command Center Overview
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Faculty Command Center
            </h1>
            <p className="text-sm text-[#94A3B8] mt-1">
              Welcome back, {currentUser.firstName} {currentUser.lastName} · Trinity College of
              Engineering and Research · Computer Engineering
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleSelectNav('mark')}
            className="rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] px-4 py-2.5 text-xs font-semibold text-white cursor-pointer"
          >
            Start One-Tap Roll Call
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[#1E293B] bg-[#131A26] p-5">
            <p className="text-xs text-[#94A3B8]">Average Class Attendance</p>
            <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-white">
              {facultyOverviewMetrics?.avgPct.toFixed(1)}%
            </p>
          </div>
          <div className="rounded-xl border border-[#1E293B] bg-[#131A26] p-5">
            <p className="text-xs text-[#94A3B8]">Conducted Sessions</p>
            <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-white">
              {campusState.sessions.length}
            </p>
          </div>
          <div className="rounded-xl border border-[#1E293B] bg-[#131A26] p-5">
            <p className="text-xs text-[#94A3B8]">Class Defaulters (&lt; 75%)</p>
            <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-[#F87171]">
              {facultyOverviewMetrics?.defaulterList.length ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-[#1E293B] bg-[#131A26] p-5">
            <p className="text-xs text-[#94A3B8]">Dispatched Student Invites</p>
            <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-[#38BDF8]">
              {campusState.onboardingEmails.length}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[#1E293B] bg-[#131A26] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1E293B] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">
              Students Below 75% Requiring Follow-Up
            </h2>
            <button
              type="button"
              onClick={() => handleSelectNav('reports')}
              className="text-xs font-medium text-[#38BDF8] hover:text-white cursor-pointer"
            >
              Open Full Monthly Matrix
            </button>
          </div>
          <div className="divide-y divide-[#1E293B]">
            {facultyOverviewMetrics?.defaulterList.map(({ student, recovery }) => (
              <div
                key={student.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm"
              >
                <div>
                  <p className="font-medium text-white">
                    <span className="font-mono text-xs text-[#94A3B8] mr-2.5">
                      {student.rollNumber}
                    </span>
                    {student.firstName} {student.lastName}
                  </p>
                  <p className="text-xs text-[#94A3B8] mt-0.5">{recovery.headline}</p>
                </div>
                <span className="font-mono tabular-nums font-semibold text-[#F87171]">
                  {recovery.percentage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <WorkspaceShell
        institution={campusState.institution}
        user={currentUser}
        navItems={navItems}
        activeNav={activeNav}
        restrictedRouteAttempt={restrictedRouteAttempt}
        onDismissRestrictedAttempt={() => setRestrictedRouteAttempt(null)}
        onSelectNav={handleSelectNav}
        onLogout={handleLogout}
      >
        {renderWorkspaceContent()}
      </WorkspaceShell>
      <CampusPulseChatbot
        authToken={authToken}
        currentUser={currentUser}
        elevatedOffset={currentUser.role === Role.FACULTY && activeNav === 'mark'}
      />
    </>
  );
}
