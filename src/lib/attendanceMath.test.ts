import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAttendancePercentage,
  calculateErpSavings,
  calculateRecoveryMetrics,
  computeStudentAnalytics,
  cycleAttendanceStatus,
  isWithinDirectEditWindow,
} from './attendanceMath';
import { buildMonthlyMatrixCsv, parseStudentImportCsv } from './csvExport';
import {
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  Course,
  StudentProfile,
} from './types';

test('calculateRecoveryMetrics computes exact classes needed when below 75%', () => {
  const result = calculateRecoveryMetrics(14, 20);
  assert.equal(result.percentage, 70);
  assert.equal(result.isDefaulter, true);
  assert.equal(result.classesNeededToReachThreshold, 4);
  assert.equal(result.safeClassesToMiss, 0);
  assert.match(result.headline, /Attend next 4 consecutive classes to reach 75%/);
});

test('calculateRecoveryMetrics computes exact safe-bunk margin when >= 75%', () => {
  const result = calculateRecoveryMetrics(30, 36);
  assert.equal(result.percentage, 83.3);
  assert.equal(result.isDefaulter, false);
  assert.equal(result.classesNeededToReachThreshold, 0);
  assert.equal(result.safeClassesToMiss, 4);
  assert.match(result.headline, /safely miss 4 classes/);
});

test('calculateRecoveryMetrics handles exact 75% boundary and empty sessions', () => {
  const boundary = calculateRecoveryMetrics(15, 20);
  assert.equal(boundary.isDefaulter, false);
  assert.equal(boundary.safeClassesToMiss, 0);

  const empty = calculateRecoveryMetrics(0, 0);
  assert.equal(empty.percentage, 100);
  assert.equal(empty.isDefaulter, false);
});

test('cycleAttendanceStatus transitions Present -> Absent -> Late -> Present', () => {
  assert.equal(cycleAttendanceStatus(AttendanceStatus.PRESENT), AttendanceStatus.ABSENT);
  assert.equal(cycleAttendanceStatus(AttendanceStatus.ABSENT), AttendanceStatus.LATE);
  assert.equal(cycleAttendanceStatus(AttendanceStatus.LATE), AttendanceStatus.PRESENT);
});

test('isWithinDirectEditWindow enforces 48-hour correction policy', () => {
  const now = new Date('2026-11-21T12:00:00Z');
  assert.equal(isWithinDirectEditWindow('2026-11-21', now), true);
  assert.equal(isWithinDirectEditWindow('2026-11-20', now), true);
  assert.equal(isWithinDirectEditWindow('2026-11-15', now), false);
});

test('calculateErpSavings scales deterministically with enrollment count', () => {
  const small = calculateErpSavings(1000);
  const large = calculateErpSavings(5000);
  assert.ok(small.annualSavings > 0);
  assert.ok(large.annualSavings > small.annualSavings);
  assert.equal(large.threeYearSavings, large.annualSavings * 3);
});

test('buildMonthlyMatrixCsv outputs 1..30 columns and escapes spreadsheet formulas', () => {
  const students: StudentProfile[] = [
    {
      id: 'st-1',
      userId: 'u-1',
      rollNumber: 'CS24001',
      firstName: '=CMD',
      lastName: 'Student',
      email: 'a@tcer.edu.in',
      batchId: 'b-1',
      departmentId: 'd-1',
      activated: true,
      createdAt: '2026-08-01T00:00:00Z',
    },
  ];
  const sessions: AttendanceSession[] = [
    {
      id: 'sess-1',
      courseId: 'c-1',
      batchId: 'b-1',
      markedById: 'f-1',
      markedByName: 'Prof. A',
      date: '2026-11-05',
      slot: '09:00 AM - 10:00 AM',
      topic: 'Trees',
      createdAt: '2026-11-05T09:00:00Z',
      updatedAt: '2026-11-05T09:00:00Z',
    },
  ];
  const records: AttendanceRecord[] = [
    {
      id: 'r-1',
      sessionId: 'sess-1',
      studentId: 'st-1',
      status: AttendanceStatus.PRESENT,
      createdAt: '2026-11-05T09:00:00Z',
      updatedAt: '2026-11-05T09:00:00Z',
    },
  ];

  const csv = buildMonthlyMatrixCsv(students, sessions, records, 2026, 11);
  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes('01,02,03'));
  assert.ok(lines[0].includes(',30,Total Attended'));
  assert.ok(lines[1].includes("'=CMD Student"));
  assert.ok(lines[1].includes('100.0%,ELIGIBLE'));
});

test('parseStudentImportCsv parses valid rows and catches malformed emails', () => {
  const raw = [
    'Roll No, Name, Email, Division',
    'CS24020, Aarav Mehta, aarav.mehta@tcer.edu.in, Section A',
    'CS24021, Invalid Row, not-an-email, Section A',
  ].join('\n');

  const parsed = parseStudentImportCsv(raw);
  assert.equal(parsed.validRows.length, 1);
  assert.equal(parsed.validRows[0].rollNumber, 'CS24020');
  assert.equal(parsed.errors.length, 1);
});

test('computeStudentAnalytics builds month-wise calendar heatmaps across multiple months', () => {
  const student: StudentProfile = {
    id: 'st-1',
    userId: 'u-1',
    rollNumber: 'CS24001',
    firstName: 'Ananya',
    lastName: 'Sharma',
    email: 'student@tcer.edu.in',
    batchId: 'b-1',
    departmentId: 'd-1',
    activated: true,
    createdAt: '2026-08-01T00:00:00Z',
  };
  const courses: Course[] = [
    {
      id: 'c-1',
      departmentId: 'd-1',
      code: 'CS301',
      name: 'Data Structures',
      credits: 4,
      semester: 5,
      facultyIds: ['f-1'],
    },
  ];
  const sessions: AttendanceSession[] = [
    {
      id: 's-aug',
      courseId: 'c-1',
      batchId: 'b-1',
      markedById: 'f-1',
      markedByName: 'Prof. Nair',
      date: '2026-08-12',
      slot: '09:00 AM - 10:00 AM',
      topic: 'Linked Lists',
      createdAt: '2026-08-12T09:00:00Z',
      updatedAt: '2026-08-12T09:00:00Z',
    },
    {
      id: 's-oct',
      courseId: 'c-1',
      batchId: 'b-1',
      markedById: 'f-1',
      markedByName: 'Prof. Nair',
      date: '2026-10-14',
      slot: '10:00 AM - 11:00 AM',
      topic: 'AVL Trees',
      createdAt: '2026-10-14T09:00:00Z',
      updatedAt: '2026-10-14T09:00:00Z',
    },
    {
      id: 's-nov',
      courseId: 'c-1',
      batchId: 'b-1',
      markedById: 'f-1',
      markedByName: 'Prof. Nair',
      date: '2026-11-21',
      slot: '10:00 AM - 11:00 AM',
      topic: 'Graph Traversal',
      createdAt: '2026-11-21T10:00:00Z',
      updatedAt: '2026-11-21T10:00:00Z',
    },
  ];
  const records: AttendanceRecord[] = [
    {
      id: 'r-aug',
      sessionId: 's-aug',
      studentId: 'st-1',
      status: AttendanceStatus.PRESENT,
      createdAt: '2026-08-12T09:00:00Z',
      updatedAt: '2026-08-12T09:00:00Z',
    },
    {
      id: 'r-oct',
      sessionId: 's-oct',
      studentId: 'st-1',
      status: AttendanceStatus.LATE,
      createdAt: '2026-10-14T09:00:00Z',
      updatedAt: '2026-10-14T09:00:00Z',
    },
    {
      id: 'r-nov',
      sessionId: 's-nov',
      studentId: 'st-1',
      status: AttendanceStatus.ABSENT,
      createdAt: '2026-11-21T10:00:00Z',
      updatedAt: '2026-11-21T10:00:00Z',
    },
  ];

  const summary = computeStudentAnalytics(student, sessions, records, courses, '2026-11-21');
  assert.equal(summary.monthlyHeatmaps.length, 3);
  assert.equal(summary.monthlyHeatmaps[0].monthKey, '2026-08');
  assert.equal(summary.monthlyHeatmaps[0].days.length, 31);
  assert.equal(summary.monthlyHeatmaps[0].percentage, 100);
  assert.equal(summary.monthlyHeatmaps[1].monthKey, '2026-10');
  assert.equal(summary.monthlyHeatmaps[1].lateCount, 1);
  assert.equal(summary.monthlyHeatmaps[2].monthKey, '2026-11');
  assert.equal(summary.monthlyHeatmaps[2].days.length, 30);
  assert.equal(summary.monthlyHeatmaps[2].percentage, 0);
  assert.equal(summary.monthlyHeatmaps[2].isDefaulter, true);
  assert.equal(calculateAttendancePercentage(2, 3), 66.7);
});
