import {
  calculateAttendancePercentage,
  DEFAULT_THRESHOLD,
  isAttendedStatus,
} from './attendanceMath';
import {
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  StudentProfile,
} from './types';

function escapeCsvCell(value: string | number): string {
  const raw = String(value ?? '');
  // Guard against spreadsheet formula injection
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

export function statusToShortCode(status?: AttendanceStatus): string {
  if (!status) return '-';
  switch (status) {
    case AttendanceStatus.PRESENT:
      return 'P';
    case AttendanceStatus.ABSENT:
      return 'A';
    case AttendanceStatus.LATE:
      return 'L';
    case AttendanceStatus.EXCUSED:
      return 'E';
    default:
      return '-';
  }
}

export interface MonthlyMatrixRow {
  studentId: string;
  rollNumber: string;
  studentName: string;
  dailyCodes: Record<number, string>;
  attended: number;
  held: number;
  percentage: number;
  isDefaulter: boolean;
}

export function getDaysInMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

export function buildMonthlyMatrixData(
  students: StudentProfile[],
  sessions: AttendanceSession[],
  records: AttendanceRecord[],
  year: number,
  month1Based: number,
  courseId?: string
): { days: number[]; rows: MonthlyMatrixRow[] } {
  const daysInMonth = getDaysInMonth(year, month1Based);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const prefix = `${year}-${String(month1Based).padStart(2, '0')}-`;

  const filteredSessions = sessions.filter((s) => {
    const matchesMonth = s.date.startsWith(prefix);
    const matchesCourse = !courseId || courseId === 'ALL' || s.courseId === courseId;
    return matchesMonth && matchesCourse;
  });

  const sessionById = new Map(filteredSessions.map((s) => [s.id, s]));
  const sessionIds = new Set(filteredSessions.map((s) => s.id));

  const recordsByStudent = new Map<string, AttendanceRecord[]>();
  for (const r of records) {
    if (!sessionIds.has(r.sessionId)) continue;
    const list = recordsByStudent.get(r.studentId) ?? [];
    list.push(r);
    recordsByStudent.set(r.studentId, list);
  }

  const rows: MonthlyMatrixRow[] = students
    .slice()
    .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber))
    .map((student) => {
      const sRecords = recordsByStudent.get(student.id) ?? [];
      const dailyCodes: Record<number, string> = {};
      let attended = 0;
      let held = 0;

      for (const r of sRecords) {
        const sess = sessionById.get(r.sessionId);
        if (!sess) continue;
        const dayNum = Number(sess.date.slice(8, 10));
        const code = statusToShortCode(r.status);
        dailyCodes[dayNum] = dailyCodes[dayNum] ? `${dailyCodes[dayNum]}/${code}` : code;
        held += 1;
        if (isAttendedStatus(r.status)) attended += 1;
      }

      const percentage = calculateAttendancePercentage(attended, held);
      return {
        studentId: student.id,
        rollNumber: student.rollNumber,
        studentName: `${student.firstName} ${student.lastName}`,
        dailyCodes,
        attended,
        held,
        percentage,
        isDefaulter: held > 0 && percentage < DEFAULT_THRESHOLD,
      };
    });

  return { days, rows };
}

export function buildMonthlyMatrixCsv(
  students: StudentProfile[],
  sessions: AttendanceSession[],
  records: AttendanceRecord[],
  year: number,
  month1Based: number,
  courseId?: string
): string {
  const { days, rows } = buildMonthlyMatrixData(
    students,
    sessions,
    records,
    year,
    month1Based,
    courseId
  );

  const header = [
    'Roll No',
    'Student Name',
    ...days.map((d) => String(d).padStart(2, '0')),
    'Total Attended',
    'Total Held',
    'Attendance %',
    'Standing',
  ];

  const lines = [header.map(escapeCsvCell).join(',')];

  for (const row of rows) {
    const line = [
      row.rollNumber,
      row.studentName,
      ...days.map((d) => row.dailyCodes[d] ?? '-'),
      row.attended,
      row.held,
      `${row.percentage.toFixed(1)}%`,
      row.isDefaulter ? 'DEFAULTER (<75%)' : 'ELIGIBLE',
    ];
    lines.push(line.map(escapeCsvCell).join(','));
  }

  return lines.join('\n');
}

export interface ParsedStudentCsvRow {
  rollNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  division: string;
}

export interface StudentCsvParseResult {
  validRows: ParsedStudentCsvRow[];
  errors: string[];
}

export function parseStudentImportCsv(rawCsv: string): StudentCsvParseResult {
  const lines = rawCsv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { validRows: [], errors: ['CSV input is empty.'] };
  }

  const validRows: ParsedStudentCsvRow[] = [];
  const errors: string[] = [];

  lines.forEach((line, idx) => {
    const cols = line.split(',').map((c) => c.trim());
    if (idx === 0 && cols[0].toLowerCase().includes('roll')) {
      return; // Skip header line
    }

    if (cols.length < 3) {
      errors.push(`Row ${idx + 1}: Expected at least Roll No, Name, Email.`);
      return;
    }

    let rollNumber = cols[0];
    let firstName = '';
    let lastName = '';
    let email = '';
    let division = 'Section A';

    if (cols.length >= 5) {
      // Roll No, First Name, Last Name, Email, Division
      firstName = cols[1];
      lastName = cols[2];
      email = cols[3];
      division = cols[4] || 'Section A';
    } else {
      // Roll No, Full Name, Email, [Division]
      const nameParts = cols[1].split(/\s+/);
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || 'Student';
      email = cols[2];
      division = cols[3] || 'Section A';
    }

    if (!rollNumber || !firstName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Row ${idx + 1}: Invalid Roll No, Name, or Email (${email || 'missing'}).`);
      return;
    }

    validRows.push({
      rollNumber: rollNumber.toUpperCase(),
      firstName,
      lastName,
      email: email.toLowerCase(),
      division,
    });
  });

  return { validRows, errors };
}
