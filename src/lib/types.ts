export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  COLLEGE_ADMIN = 'COLLEGE_ADMIN',
  FACULTY = 'FACULTY',
  OPERATOR = 'OPERATOR',
  STUDENT = 'STUDENT',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  EXCUSED = 'EXCUSED',
}

export interface Institution {
  id: string;
  name: string;
  code: string;
  address: string;
  academicYear: string;
  attendanceThreshold: number;
}

export interface Department {
  id: string;
  institutionId: string;
  name: string;
  code: string;
  hodName: string;
}

export interface Batch {
  id: string;
  departmentId: string;
  name: string; // e.g., "2024–2028"
  division: string; // e.g., "Section A"
  semester: number;
}

export interface Course {
  id: string;
  departmentId: string;
  code: string;
  name: string;
  credits: number;
  semester: number;
  facultyIds: string[];
}

export interface UserAccount {
  id: string;
  institutionId: string;
  departmentId?: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  isActive: boolean;
  createdAt: string;
}

export interface StudentProfile {
  id: string;
  userId: string;
  rollNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  batchId: string;
  departmentId: string;
  guardianMail?: string;
  activated: boolean;
  createdAt: string;
}

export interface AttendanceSession {
  id: string;
  courseId: string;
  batchId: string;
  markedById: string;
  markedByName: string;
  date: string; // YYYY-MM-DD
  slot: string; // e.g., "09:00 AM - 10:00 AM"
  topic: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceAuditLog {
  id: string;
  recordId: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  courseCode: string;
  sessionDate: string;
  changedById: string;
  changedByName: string;
  changedByRole: Role;
  oldStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  reason: string;
  withinDirectWindow: boolean;
  timestamp: string;
}

export interface OnboardingEmailLog {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  recipientEmail: string;
  temporaryPassword: string;
  activationToken: string;
  activationLink: string;
  deliveryMode: 'RESEND_LIVE' | 'LOCAL_QUEUE';
  status: 'DELIVERED' | 'QUEUED';
  subject: string;
  htmlPreview: string;
  sentAt: string;
}

export interface LeaveEntry {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  date: string;
  reason: string;
  category: 'MEDICAL' | 'INSTITUTIONAL_DUTY' | 'APPROVED_LEAVE';
  approvedByName: string;
  createdAt: string;
}

export interface CampusStatePayload {
  institution: Institution;
  departments: Department[];
  batches: Batch[];
  courses: Course[];
  users: UserAccount[];
  students: StudentProfile[];
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  auditLogs: AttendanceAuditLog[];
  onboardingEmails: OnboardingEmailLog[];
  leaveEntries: LeaveEntry[];
}

export interface AuthSessionResponse {
  token: string;
  user: UserAccount;
}
