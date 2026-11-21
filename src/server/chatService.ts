import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import {
  calculateAttendancePercentage,
  computeStudentAnalytics,
  isAttendedStatus,
} from '../lib/attendanceMath';
import { Role, UserAccount } from '../lib/types';
import { campusStore } from './store';

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

function buildRoleScopedContext(user: UserAccount | null): string {
  const inst = campusStore.institution;

  if (!user) {
    return [
      `Institution: ${inst.name} (${inst.code}), ${inst.address}.`,
      `Academic Year: ${inst.academicYear}. Attendance eligibility threshold: ${inst.attendanceThreshold}%.`,
      `Departments: ${campusStore.departments.map((d) => `${d.code} (${d.name})`).join(', ')}.`,
      `Platform Capabilities: One-Tap Attendance Marking (<15 sec), 48-hour Direct Edit Window & Immutable Audit Log Vault, Automated Student Credential Onboarding, 75% Safe-Bunk & Consecutive Recovery Predictor, Multi-Month Student Heatmap, Monthly 1-31 CSV Matrix, Official Printable A4 Register.`,
      `User Status: Public visitor on Landing Page (not signed in). Do not reveal private student records or passwords.`,
    ].join('\n');
  }

  if (user.role === Role.STUDENT) {
    const stu = campusStore.students.find(
      (s) => s.userId === user.id || s.email.toLowerCase() === user.email.toLowerCase()
    );
    if (!stu) {
      return `Authenticated Student: ${user.firstName} ${user.lastName} at ${inst.name}.`;
    }
    const analytics = computeStudentAnalytics(
      stu,
      campusStore.sessions,
      campusStore.records,
      campusStore.courses,
      '2026-11-21',
      inst.attendanceThreshold
    );

    const monthSummary = analytics.monthlyHeatmaps
      .map((m) => `${m.shortLabel}: ${m.percentage.toFixed(1)}% (${m.attended}/${m.total})`)
      .join('; ');
    const courseSummary = analytics.courseBreakdowns
      .map(
        (c) =>
          `${c.courseCode} ${c.courseName}: ${c.percentage.toFixed(1)}% (${c.attended}/${c.total}) — ${c.recovery.headline}`
      )
      .join('\n');

    return [
      `Institution: ${inst.name} (${inst.code}).`,
      `Authenticated Role: STUDENT (Strict privacy scope — answer ONLY about this student).`,
      `Student: ${stu.firstName} ${stu.lastName} (${stu.rollNumber}).`,
      `Overall Attendance: ${analytics.overall.percentage.toFixed(1)}% (${analytics.overall.attended}/${analytics.overall.total}).`,
      `Recovery/Safe-Bunk Guidance: ${analytics.overall.headline}`,
      `Month-Wise Attendance: ${monthSummary}.`,
      `Course Breakdown:\n${courseSummary}`,
    ].join('\n');
  }

  // Admin / Faculty / Operator institutional context
  const totalAtt = campusStore.records.filter((r) => isAttendedStatus(r.status)).length;
  const overallPct = calculateAttendancePercentage(totalAtt, campusStore.records.length);
  const defaulterCount = campusStore.students.filter((stu) => {
    const recs = campusStore.records.filter((r) => r.studentId === stu.id);
    const att = recs.filter((r) => isAttendedStatus(r.status)).length;
    return recs.length > 0 && calculateAttendancePercentage(att, recs.length) < inst.attendanceThreshold;
  }).length;

  return [
    `Institution: ${inst.name} (${inst.code}), ${inst.academicYear}.`,
    `Authenticated Role: ${user.role} (${user.firstName} ${user.lastName}).`,
    `Departments (${campusStore.departments.length}): ${campusStore.departments.map((d) => `${d.code} - ${d.name} (HOD: ${d.hodName})`).join('; ')}.`,
    `Total Students: ${campusStore.students.length} | Total Staff: ${campusStore.users.filter((u) => u.role !== Role.STUDENT).length} | Recorded Sessions: ${campusStore.sessions.length}.`,
    `Institutional Attendance Rate: ${overallPct.toFixed(1)}% | Students below ${inst.attendanceThreshold}%: ${defaulterCount} | Audit Corrections Logged: ${campusStore.auditLogs.length}.`,
  ].join('\n');
}

export async function generateCampusChatReply(
  message: string,
  history: ChatTurn[],
  user: UserAccount | null
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets to enable live AI chat responses.'
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const contextBlock = buildRoleScopedContext(user);
  const systemInstruction = [
    `You are the CampusPulse Academic Assistant for Trinity College of Engineering and Research.`,
    `Be concise, practical, accurate, and directly helpful (keep replies under 140 words unless a detailed table or step list is asked for).`,
    `Strictly respect Role-Based Access Control: never expose other students' private records, never disclose passwords, and base all numeric answers strictly on the provided live institutional context below.`,
    ``,
    `LIVE CONTEXT:`,
    contextBlock,
  ].join('\n');

  const recentHistory = history
    .slice(-6)
    .map((turn) => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.text}`)
    .join('\n');

  const prompt = recentHistory
    ? `${recentHistory}\nUser: ${message}\nAssistant:`
    : message;

  const callModel = async (): Promise<GenerateContentResponse> =>
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction,
      },
    });

  let response: GenerateContentResponse;
  try {
    response = await callModel();
  } catch (firstErr) {
    const rawMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    const isTransient =
      rawMsg.includes('503') ||
      rawMsg.includes('UNAVAILABLE') ||
      rawMsg.toLowerCase().includes('high demand') ||
      rawMsg.includes('429');

    if (isTransient) {
      await new Promise((resolve) => setTimeout(resolve, 750));
      try {
        response = await callModel();
      } catch (retryErr) {
        const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
        throw new Error(formatGeminiErrorMessage(retryMsg));
      }
    } else {
      throw new Error(formatGeminiErrorMessage(rawMsg));
    }
  }

  const text = response.text?.trim();
  if (!text) {
    throw new Error('The assistant returned an empty response. Please try rephrasing your question.');
  }
  return text;
}

function formatGeminiErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; status?: string; code?: number } };
    if (parsed?.error?.message) {
      if (parsed.error.code === 503 || parsed.error.status === 'UNAVAILABLE') {
        return 'The CampusPulse AI model is temporarily experiencing high demand. Please try again in a few seconds.';
      }
      return parsed.error.message;
    }
  } catch {
    // Not a JSON payload — fall through
  }
  if (raw.includes('503') || raw.includes('UNAVAILABLE')) {
    return 'The CampusPulse AI model is temporarily experiencing high demand. Please try again in a few seconds.';
  }
  return raw;
}
