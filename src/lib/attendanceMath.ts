import {
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  Course,
  StudentProfile,
} from './types';

export const DEFAULT_THRESHOLD = 75;
export const DIRECT_EDIT_WINDOW_HOURS = 48;

export function isAttendedStatus(status: AttendanceStatus): boolean {
  return (
    status === AttendanceStatus.PRESENT ||
    status === AttendanceStatus.LATE ||
    status === AttendanceStatus.EXCUSED
  );
}

export function cycleAttendanceStatus(current: AttendanceStatus): AttendanceStatus {
  if (current === AttendanceStatus.PRESENT) return AttendanceStatus.ABSENT;
  if (current === AttendanceStatus.ABSENT) return AttendanceStatus.LATE;
  return AttendanceStatus.PRESENT;
}

export function calculateAttendancePercentage(attended: number, total: number): number {
  if (total <= 0) return 100;
  const clampedAttended = Math.max(0, Math.min(attended, total));
  return Number(((clampedAttended / total) * 100).toFixed(1));
}

export interface RecoveryMetrics {
  attended: number;
  total: number;
  percentage: number;
  isDefaulter: boolean;
  classesNeededToReachThreshold: number;
  safeClassesToMiss: number;
  headline: string;
  subtext: string;
}

export function calculateRecoveryMetrics(
  attended: number,
  total: number,
  threshold = DEFAULT_THRESHOLD
): RecoveryMetrics {
  const safeTotal = Math.max(0, Math.floor(total));
  const safeAttended = Math.max(0, Math.min(Math.floor(attended), safeTotal));
  const percentage = calculateAttendancePercentage(safeAttended, safeTotal);

  if (safeTotal === 0) {
    return {
      attended: 0,
      total: 0,
      percentage: 100,
      isDefaulter: false,
      classesNeededToReachThreshold: 0,
      safeClassesToMiss: 0,
      headline: 'No lectures recorded yet.',
      subtext: `Maintain at least ${threshold}% attendance once sessions begin.`,
    };
  }

  const ratio = threshold / 100;
  const isDefaulter = percentage < threshold;

  if (isDefaulter) {
    let classesNeeded = 0;
    if (threshold === 75) {
      classesNeeded = Math.max(0, Math.ceil(3 * safeTotal - 4 * safeAttended));
    } else {
      classesNeeded = Math.max(
        0,
        Math.ceil((ratio * safeTotal - safeAttended) / (1 - ratio))
      );
    }

    return {
      attended: safeAttended,
      total: safeTotal,
      percentage,
      isDefaulter: true,
      classesNeededToReachThreshold: classesNeeded,
      safeClassesToMiss: 0,
      headline: `Attend next ${classesNeeded} consecutive ${classesNeeded === 1 ? 'class' : 'classes'} to reach ${threshold}%.`,
      subtext: `Currently ${(threshold - percentage).toFixed(1)}% below institutional eligibility threshold.`,
    };
  }

  let safeToMiss = 0;
  if (threshold === 75) {
    safeToMiss = Math.max(0, Math.floor((4 * safeAttended - 3 * safeTotal) / 3));
  } else {
    safeToMiss = Math.max(0, Math.floor(safeAttended / ratio - safeTotal));
  }

  return {
    attended: safeAttended,
    total: safeTotal,
    percentage,
    isDefaulter: false,
    classesNeededToReachThreshold: 0,
    safeClassesToMiss: safeToMiss,
    headline:
      safeToMiss > 0
        ? `You can safely miss ${safeToMiss} ${safeToMiss === 1 ? 'class' : 'classes'} and remain above ${threshold}%.`
        : `On the ${threshold}% threshold — attend the next class to keep eligibility.`,
    subtext: `Currently ${(percentage - threshold).toFixed(1)}% above minimum requirement.`,
  };
}

export function isWithinDirectEditWindow(
  sessionDateStr: string,
  now: Date = new Date()
): boolean {
  const parsed = new Date(`${sessionDateStr}T23:59:59`);
  if (Number.isNaN(parsed.getTime())) return false;
  const diffMs = now.getTime() - parsed.getTime();
  return diffMs <= DIRECT_EDIT_WINDOW_HOURS * 60 * 60 * 1000;
}

export interface ErpSavingsResult {
  studentCount: number;
  legacyAnnualCost: number;
  campusPulseAnnualCost: number;
  annualSavings: number;
  threeYearSavings: number;
  hoursSavedPerYear: number;
}

export function calculateErpSavings(studentCount: number): ErpSavingsResult {
  const clamped = Math.max(200, Math.min(25000, Math.round(studentCount)));
  const legacyAnnualCost = clamped * 24 + 14000;
  const campusPulseAnnualCost = Math.round(clamped * 3.5 + 1800);
  const annualSavings = Math.max(0, legacyAnnualCost - campusPulseAnnualCost);
  const threeYearSavings = annualSavings * 3;
  const hoursSavedPerYear = Math.round(clamped * 1.4);

  return {
    studentCount: clamped,
    legacyAnnualCost,
    campusPulseAnnualCost,
    annualSavings,
    threeYearSavings,
    hoursSavedPerYear,
  };
}

export interface CourseAttendanceBreakdown {
  courseId: string;
  courseCode: string;
  courseName: string;
  attended: number;
  lateCount: number;
  absentCount: number;
  total: number;
  percentage: number;
  recovery: RecoveryMetrics;
}

export interface HeatmapLectureItem {
  sessionId: string;
  courseCode: string;
  courseName: string;
  slot: string;
  topic: string;
  status: AttendanceStatus;
}

export interface HeatmapDayEntry {
  date: string;
  dayNumber: number;
  weekday: string;
  status: 'ALL_PRESENT' | 'HAS_LATE' | 'HAS_ABSENT' | 'NO_CLASS';
  lectures: HeatmapLectureItem[];
}

export interface MonthlyHeatmapGroup {
  monthKey: string; // YYYY-MM
  year: number;
  month: number; // 1-12
  label: string; // e.g., "August 2026"
  shortLabel: string; // e.g., "Aug 2026"
  leadingEmptySlots: number; // 0 (Sun) .. 6 (Sat)
  attended: number;
  total: number;
  lateCount: number;
  absentCount: number;
  percentage: number;
  isDefaulter: boolean;
  days: HeatmapDayEntry[];
}

export interface StudentAnalyticsSummary {
  student: StudentProfile;
  overall: RecoveryMetrics;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  courseBreakdowns: CourseAttendanceBreakdown[];
  heatmapDays: HeatmapDayEntry[];
  monthlyHeatmaps: MonthlyHeatmapGroup[];
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const SHORT_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function computeDayStatus(lectures: HeatmapLectureItem[]): HeatmapDayEntry['status'] {
  if (lectures.length === 0) return 'NO_CLASS';
  if (lectures.some((l) => l.status === AttendanceStatus.ABSENT)) return 'HAS_ABSENT';
  if (lectures.some((l) => l.status === AttendanceStatus.LATE)) return 'HAS_LATE';
  return 'ALL_PRESENT';
}

export function buildCalendarMonthHeatmap(
  year: number,
  month1Based: number,
  lecturesByDate: Map<string, HeatmapLectureItem[]>,
  threshold = DEFAULT_THRESHOLD
): MonthlyHeatmapGroup {
  const daysInMonth = new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
  const firstDayOfWeek = new Date(Date.UTC(year, month1Based - 1, 1)).getUTCDay();
  const monthKey = `${year}-${String(month1Based).padStart(2, '0')}`;

  const days: HeatmapDayEntry[] = [];
  let attended = 0;
  let total = 0;
  let lateCount = 0;
  let absentCount = 0;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(Date.UTC(year, month1Based - 1, day, 12, 0, 0));
    const iso = `${monthKey}-${String(day).padStart(2, '0')}`;
    const lectures = lecturesByDate.get(iso) ?? [];

    for (const lec of lectures) {
      total += 1;
      if (isAttendedStatus(lec.status)) attended += 1;
      if (lec.status === AttendanceStatus.LATE) lateCount += 1;
      if (lec.status === AttendanceStatus.ABSENT) absentCount += 1;
    }

    days.push({
      date: iso,
      dayNumber: day,
      weekday: WEEKDAYS[d.getUTCDay()],
      status: computeDayStatus(lectures),
      lectures,
    });
  }

  const percentage = calculateAttendancePercentage(attended, total);
  return {
    monthKey,
    year,
    month: month1Based,
    label: `${MONTH_NAMES[month1Based - 1]} ${year}`,
    shortLabel: `${SHORT_MONTH_NAMES[month1Based - 1]} ${year}`,
    leadingEmptySlots: firstDayOfWeek,
    attended,
    total,
    lateCount,
    absentCount,
    percentage,
    isDefaulter: total > 0 && percentage < threshold,
    days,
  };
}

export function computeStudentAnalytics(
  student: StudentProfile,
  sessions: AttendanceSession[],
  records: AttendanceRecord[],
  courses: Course[],
  referenceDateStr: string = '2026-11-21',
  threshold = DEFAULT_THRESHOLD
): StudentAnalyticsSummary {
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const studentRecords = records.filter((r) => r.studentId === student.id);

  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let excusedCount = 0;

  const byCourse = new Map<
    string,
    { attended: number; lateCount: number; absentCount: number; total: number }
  >();
  const lecturesByDate = new Map<string, HeatmapLectureItem[]>();
  const monthKeysSet = new Set<string>();

  for (const rec of studentRecords) {
    const session = sessionMap.get(rec.sessionId);
    if (!session) continue;

    monthKeysSet.add(session.date.slice(0, 7));

    if (rec.status === AttendanceStatus.PRESENT) presentCount += 1;
    else if (rec.status === AttendanceStatus.LATE) lateCount += 1;
    else if (rec.status === AttendanceStatus.ABSENT) absentCount += 1;
    else if (rec.status === AttendanceStatus.EXCUSED) excusedCount += 1;

    const bucket = byCourse.get(session.courseId) ?? {
      attended: 0,
      lateCount: 0,
      absentCount: 0,
      total: 0,
    };
    bucket.total += 1;
    if (isAttendedStatus(rec.status)) bucket.attended += 1;
    if (rec.status === AttendanceStatus.LATE) bucket.lateCount += 1;
    if (rec.status === AttendanceStatus.ABSENT) bucket.absentCount += 1;
    byCourse.set(session.courseId, bucket);

    const course = courseMap.get(session.courseId);
    const dayList = lecturesByDate.get(session.date) ?? [];
    dayList.push({
      sessionId: session.id,
      courseCode: course?.code ?? 'COURSE',
      courseName: course?.name ?? 'Lecture',
      slot: session.slot,
      topic: session.topic,
      status: rec.status,
    });
    lecturesByDate.set(session.date, dayList);
  }

  const totalAttended = presentCount + lateCount + excusedCount;
  const totalConducted = totalAttended + absentCount;
  const overall = calculateRecoveryMetrics(totalAttended, totalConducted, threshold);

  const courseBreakdowns: CourseAttendanceBreakdown[] = Array.from(byCourse.entries())
    .map(([courseId, stats]) => {
      const course = courseMap.get(courseId);
      return {
        courseId,
        courseCode: course?.code ?? courseId,
        courseName: course?.name ?? 'Course',
        attended: stats.attended,
        lateCount: stats.lateCount,
        absentCount: stats.absentCount,
        total: stats.total,
        percentage: calculateAttendancePercentage(stats.attended, stats.total),
        recovery: calculateRecoveryMetrics(stats.attended, stats.total, threshold),
      };
    })
    .sort((a, b) => a.courseCode.localeCompare(b.courseCode));

  // Rolling 30-day heatmap ending on referenceDateStr
  const refDate = new Date(`${referenceDateStr}T12:00:00Z`);
  const heatmapDays: HeatmapDayEntry[] = [];
  for (let offset = 29; offset >= 0; offset -= 1) {
    const d = new Date(refDate);
    d.setUTCDate(refDate.getUTCDate() - offset);
    const iso = d.toISOString().slice(0, 10);
    const dayLectures = lecturesByDate.get(iso) ?? [];
    heatmapDays.push({
      date: iso,
      dayNumber: d.getUTCDate(),
      weekday: WEEKDAYS[d.getUTCDay()],
      status: computeDayStatus(dayLectures),
      lectures: dayLectures,
    });
  }

  // Month-wise calendar heatmaps across all recorded months (chronological)
  if (monthKeysSet.size === 0) {
    monthKeysSet.add(referenceDateStr.slice(0, 7));
  }
  const sortedMonthKeys = Array.from(monthKeysSet).sort((a, b) => a.localeCompare(b));
  const monthlyHeatmaps: MonthlyHeatmapGroup[] = sortedMonthKeys.map((key) => {
    const [yStr, mStr] = key.split('-');
    return buildCalendarMonthHeatmap(
      Number(yStr),
      Number(mStr),
      lecturesByDate,
      threshold
    );
  });

  return {
    student,
    overall,
    presentCount,
    lateCount,
    absentCount,
    excusedCount,
    courseBreakdowns,
    heatmapDays,
    monthlyHeatmaps,
  };
}
