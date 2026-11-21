import {
  AttendanceStatus,
  AuthSessionResponse,
  CampusStatePayload,
  OnboardingEmailLog,
  Role,
} from './types';

async function requestJson<T>(
  url: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  login(email: string, password: string): Promise<AuthSessionResponse> {
    return requestJson<AuthSessionResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  loginDemoRole(role: Role, email?: string): Promise<AuthSessionResponse> {
    return requestJson<AuthSessionResponse>('/api/auth/demo', {
      method: 'POST',
      body: JSON.stringify({ role, email }),
    });
  },

  logout(token: string): Promise<{ ok: boolean }> {
    return requestJson<{ ok: boolean }>(
      '/api/auth/logout',
      { method: 'POST' },
      token
    );
  },

  getState(token: string): Promise<CampusStatePayload> {
    return requestJson<CampusStatePayload>('/api/state', { method: 'GET' }, token);
  },

  sendChatMessage(
    token: string | null,
    payload: {
      message: string;
      history: Array<{ role: 'user' | 'assistant'; text: string }>;
    }
  ): Promise<{ reply: string }> {
    return requestJson<{ reply: string }>(
      '/api/chat',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token
    );
  },

  submitSession(
    token: string,
    payload: {
      courseId: string;
      batchId: string;
      date: string;
      slot: string;
      topic: string;
      entries: Array<{ studentId: string; status: AttendanceStatus }>;
    }
  ): Promise<{ state: CampusStatePayload }> {
    return requestJson<{ state: CampusStatePayload }>(
      '/api/sessions',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token
    );
  },

  correctRecord(
    token: string,
    recordId: string,
    payload: { newStatus: AttendanceStatus; reason: string }
  ): Promise<{ state: CampusStatePayload }> {
    return requestJson<{ state: CampusStatePayload }>(
      `/api/records/${encodeURIComponent(recordId)}/correct`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      token
    );
  },

  createStudent(
    token: string,
    payload: {
      rollNumber: string;
      firstName: string;
      lastName: string;
      email: string;
      batchId: string;
    }
  ): Promise<{ emailLog: OnboardingEmailLog; state: CampusStatePayload }> {
    return requestJson<{ emailLog: OnboardingEmailLog; state: CampusStatePayload }>(
      '/api/students',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token
    );
  },

  bulkImportStudents(
    token: string,
    payload: { rawCsv: string; batchId: string }
  ): Promise<{
    createdCount: number;
    skipped: string[];
    parseErrors: string[];
    state: CampusStatePayload;
  }> {
    return requestJson(
      '/api/students/bulk',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token
    );
  },

  resendStudentCredentials(
    token: string,
    studentId: string
  ): Promise<{ emailLog: OnboardingEmailLog; state: CampusStatePayload }> {
    return requestJson(
      `/api/students/${encodeURIComponent(studentId)}/resend-credentials`,
      { method: 'POST' },
      token
    );
  },

  createLeaveEntry(
    token: string,
    payload: {
      studentId: string;
      date: string;
      reason: string;
      category: 'MEDICAL' | 'INSTITUTIONAL_DUTY' | 'APPROVED_LEAVE';
    }
  ): Promise<{ state: CampusStatePayload }> {
    return requestJson(
      '/api/leaves',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token
    );
  },

  createDepartment(
    token: string,
    payload: { name: string; code: string; hodName: string }
  ): Promise<{ state: CampusStatePayload }> {
    return requestJson(
      '/api/departments',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token
    );
  },

  createStaff(
    token: string,
    payload: {
      firstName: string;
      lastName: string;
      email: string;
      role: Role;
      departmentId: string;
    }
  ): Promise<{ state: CampusStatePayload }> {
    return requestJson(
      '/api/staff',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token
    );
  },

  async downloadMonthlyCsv(
    token: string,
    params: { year: number; month: number; batchId: string; courseId: string }
  ): Promise<string> {
    const qs = new URLSearchParams({
      year: String(params.year),
      month: String(params.month),
      batchId: params.batchId,
      courseId: params.courseId,
    });
    const res = await fetch(`/api/reports/csv?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error('Unable to export CSV matrix.');
    }
    return res.text();
  },
};
