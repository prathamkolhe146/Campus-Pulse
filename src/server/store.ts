import crypto from 'node:crypto';
import {
  AttendanceAuditLog,
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  Batch,
  CampusStatePayload,
  Course,
  Department,
  Institution,
  LeaveEntry,
  OnboardingEmailLog,
  Role,
  StudentProfile,
  UserAccount,
} from '../lib/types';

interface StoredUser extends UserAccount {
  passwordHash: string;
}

interface SessionEntry {
  token: string;
  userId: string;
  createdAt: number;
}

export function hashPassword(password: string, salt?: string): string {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, useSalt, 64).toString('hex');
  return `${useSalt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

class CampusPulseStore {
  institution: Institution;
  departments: Department[];
  batches: Batch[];
  courses: Course[];
  users: StoredUser[];
  students: StudentProfile[];
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  auditLogs: AttendanceAuditLog[];
  onboardingEmails: OnboardingEmailLog[];
  leaveEntries: LeaveEntry[];
  activeSessions: Map<string, SessionEntry>;

  constructor() {
    this.activeSessions = new Map();
    const seeded = this.buildSeedData();
    this.institution = seeded.institution;
    this.departments = seeded.departments;
    this.batches = seeded.batches;
    this.courses = seeded.courses;
    this.users = seeded.users;
    this.students = seeded.students;
    this.sessions = seeded.sessions;
    this.records = seeded.records;
    this.auditLogs = seeded.auditLogs;
    this.onboardingEmails = seeded.onboardingEmails;
    this.leaveEntries = seeded.leaveEntries;
  }

  private buildSeedData() {
    const institution: Institution = {
      id: 'inst-trinity',
      name: 'Trinity College of Engineering and Research',
      code: 'TCER-2026',
      address: 'Near Khadimachine Chowk, Kondhwa-Saswad Road, Pune 411048',
      academicYear: '2026–2027 (Odd Semester)',
      attendanceThreshold: 75,
    };

    const departments: Department[] = [
      {
        id: 'dept-cse',
        institutionId: institution.id,
        name: 'Computer Engineering',
        code: 'COMP',
        hodName: 'Dr. Kavita Subramanian',
      },
      {
        id: 'dept-ece',
        institutionId: institution.id,
        name: 'Electronics & Telecommunication',
        code: 'ENTC',
        hodName: 'Dr. Rajeshwar Kulkarni',
      },
      {
        id: 'dept-mech',
        institutionId: institution.id,
        name: 'Mechanical Engineering',
        code: 'MECH',
        hodName: 'Dr. Vikramaditya Rao',
      },
      {
        id: 'dept-it',
        institutionId: institution.id,
        name: 'Information Technology',
        code: 'IT',
        hodName: 'Dr. Pranjali Deshmukh',
      },
    ];

    const batches: Batch[] = [
      {
        id: 'batch-cse-24a',
        departmentId: 'dept-cse',
        name: '2024–2028',
        division: 'Division A',
        semester: 5,
      },
      {
        id: 'batch-cse-24b',
        departmentId: 'dept-cse',
        name: '2024–2028',
        division: 'Division B',
        semester: 5,
      },
      {
        id: 'batch-ece-24a',
        departmentId: 'dept-ece',
        name: '2024–2028',
        division: 'Division A',
        semester: 5,
      },
      {
        id: 'batch-mech-24a',
        departmentId: 'dept-mech',
        name: '2024–2028',
        division: 'Division A',
        semester: 5,
      },
    ];

    const courses: Course[] = [
      {
        id: 'course-cs301',
        departmentId: 'dept-cse',
        code: 'CS301',
        name: 'Data Structures & Algorithms',
        credits: 4,
        semester: 5,
        facultyIds: ['user-faculty-1'],
      },
      {
        id: 'course-cs304',
        departmentId: 'dept-cse',
        code: 'CS304',
        name: 'Operating Systems',
        credits: 4,
        semester: 5,
        facultyIds: ['user-faculty-1', 'user-faculty-2'],
      },
      {
        id: 'course-cs308',
        departmentId: 'dept-cse',
        code: 'CS308',
        name: 'Database Management Systems',
        credits: 3,
        semester: 5,
        facultyIds: ['user-faculty-2'],
      },
      {
        id: 'course-cs312',
        departmentId: 'dept-cse',
        code: 'CS312',
        name: 'Computer Networks',
        credits: 3,
        semester: 5,
        facultyIds: ['user-faculty-1'],
      },
      {
        id: 'course-ec202',
        departmentId: 'dept-ece',
        code: 'EC202',
        name: 'Digital Signal Processing',
        credits: 4,
        semester: 5,
        facultyIds: ['user-faculty-2'],
      },
      {
        id: 'course-me305',
        departmentId: 'dept-mech',
        code: 'ME305',
        name: 'Thermodynamics & Heat Transfer',
        credits: 4,
        semester: 5,
        facultyIds: ['user-faculty-3'],
      },
    ];

    const demoPassHash = hashPassword('CampusPulse@2026', 'trinity-seed-salt');

    const users: StoredUser[] = [
      {
        id: 'user-admin-1',
        institutionId: institution.id,
        departmentId: 'dept-cse',
        email: 'admin@tcer.edu.in',
        passwordHash: demoPassHash,
        role: Role.COLLEGE_ADMIN,
        firstName: 'Dr. Siddharth',
        lastName: 'Menon',
        phoneNumber: '+91 98220 11001',
        isActive: true,
        createdAt: '2026-07-10T08:00:00Z',
      },
      {
        id: 'user-faculty-1',
        institutionId: institution.id,
        departmentId: 'dept-cse',
        email: 'faculty@tcer.edu.in',
        passwordHash: demoPassHash,
        role: Role.FACULTY,
        firstName: 'Prof. Arvind',
        lastName: 'Nair',
        phoneNumber: '+91 98220 22014',
        isActive: true,
        createdAt: '2026-07-12T08:00:00Z',
      },
      {
        id: 'user-faculty-2',
        institutionId: institution.id,
        departmentId: 'dept-ece',
        email: 'meera.iyer@tcer.edu.in',
        passwordHash: demoPassHash,
        role: Role.FACULTY,
        firstName: 'Prof. Meera',
        lastName: 'Iyer',
        phoneNumber: '+91 98220 22019',
        isActive: true,
        createdAt: '2026-07-14T08:00:00Z',
      },
      {
        id: 'user-faculty-3',
        institutionId: institution.id,
        departmentId: 'dept-mech',
        email: 'sandeep.kulkarni@tcer.edu.in',
        passwordHash: demoPassHash,
        role: Role.FACULTY,
        firstName: 'Prof. Sandeep',
        lastName: 'Kulkarni',
        phoneNumber: '+91 98220 22044',
        isActive: true,
        createdAt: '2026-07-14T08:00:00Z',
      },
      {
        id: 'user-operator-1',
        institutionId: institution.id,
        departmentId: 'dept-cse',
        email: 'operator@tcer.edu.in',
        passwordHash: demoPassHash,
        role: Role.OPERATOR,
        firstName: 'Nikhil',
        lastName: 'Joshi',
        phoneNumber: '+91 98220 33008',
        isActive: true,
        createdAt: '2026-07-15T08:00:00Z',
      },
      {
        id: 'user-student-1',
        institutionId: institution.id,
        departmentId: 'dept-cse',
        email: 'student@tcer.edu.in',
        passwordHash: demoPassHash,
        role: Role.STUDENT,
        firstName: 'Ananya',
        lastName: 'Sharma',
        phoneNumber: '+91 98220 44101',
        isActive: true,
        createdAt: '2026-08-01T08:00:00Z',
      },
      {
        id: 'user-student-2',
        institutionId: institution.id,
        departmentId: 'dept-cse',
        email: 'rohan.deshmukh@tcer.edu.in',
        passwordHash: demoPassHash,
        role: Role.STUDENT,
        firstName: 'Rohan',
        lastName: 'Deshmukh',
        phoneNumber: '+91 98220 44102',
        isActive: true,
        createdAt: '2026-08-01T08:00:00Z',
      },
    ];

    const rosterSeed: Array<{
      id: string;
      userId: string;
      rollNumber: string;
      firstName: string;
      lastName: string;
      email: string;
      batchId: string;
      departmentId: string;
      targetRate: number;
    }> = [
      { id: 'stu-01', userId: 'user-student-1', rollNumber: 'TC24001', firstName: 'Ananya', lastName: 'Sharma', email: 'student@tcer.edu.in', batchId: 'batch-cse-24a', departmentId: 'dept-cse', targetRate: 0.89 },
      { id: 'stu-02', userId: 'user-student-2', rollNumber: 'TC24002', firstName: 'Rohan', lastName: 'Deshmukh', email: 'rohan.deshmukh@tcer.edu.in', batchId: 'batch-cse-24a', departmentId: 'dept-cse', targetRate: 0.66 },
      { id: 'stu-03', userId: 'u-stu-03', rollNumber: 'TC24003', firstName: 'Diya', lastName: 'Krishnan', email: 'diya.krishnan@tcer.edu.in', batchId: 'batch-cse-24a', departmentId: 'dept-cse', targetRate: 0.94 },
      { id: 'stu-04', userId: 'u-stu-04', rollNumber: 'TC24004', firstName: 'Kabir', lastName: 'Malhotra', email: 'kabir.malhotra@tcer.edu.in', batchId: 'batch-cse-24a', departmentId: 'dept-cse', targetRate: 0.69 },
      { id: 'stu-05', userId: 'u-stu-05', rollNumber: 'TC24005', firstName: 'Ishita', lastName: 'Verma', email: 'ishita.verma@tcer.edu.in', batchId: 'batch-cse-24a', departmentId: 'dept-cse', targetRate: 0.85 },
      { id: 'stu-06', userId: 'u-stu-06', rollNumber: 'TC24006', firstName: 'Arjun', lastName: 'Patel', email: 'arjun.patel@tcer.edu.in', batchId: 'batch-cse-24a', departmentId: 'dept-cse', targetRate: 0.78 },
      { id: 'stu-07', userId: 'u-stu-07', rollNumber: 'TC24007', firstName: 'Sneha', lastName: 'Reddy', email: 'sneha.reddy@tcer.edu.in', batchId: 'batch-cse-24a', departmentId: 'dept-cse', targetRate: 0.92 },
      { id: 'stu-08', userId: 'u-stu-08', rollNumber: 'TC24008', firstName: 'Devansh', lastName: 'Kulkarni', email: 'devansh.kulkarni@tcer.edu.in', batchId: 'batch-cse-24a', departmentId: 'dept-cse', targetRate: 0.62 },
      { id: 'stu-09', userId: 'u-stu-09', rollNumber: 'TC24009', firstName: 'Meghna', lastName: 'Bhat', email: 'meghna.bhat@tcer.edu.in', batchId: 'batch-cse-24a', departmentId: 'dept-cse', targetRate: 0.88 },
      { id: 'stu-10', userId: 'u-stu-10', rollNumber: 'TC24010', firstName: 'Pranav', lastName: 'Choudhary', email: 'pranav.c@tcer.edu.in', batchId: 'batch-cse-24a', departmentId: 'dept-cse', targetRate: 0.77 },
      { id: 'stu-11', userId: 'u-stu-11', rollNumber: 'TC24011', firstName: 'Tanvi', lastName: 'Gokhale', email: 'tanvi.gokhale@tcer.edu.in', batchId: 'batch-cse-24a', departmentId: 'dept-cse', targetRate: 0.91 },
      { id: 'stu-12', userId: 'u-stu-12', rollNumber: 'TC24012', firstName: 'Siddhanth', lastName: 'Bose', email: 'siddhanth.bose@tcer.edu.in', batchId: 'batch-cse-24a', departmentId: 'dept-cse', targetRate: 0.71 },
      { id: 'stu-13', userId: 'u-stu-13', rollNumber: 'TC24013', firstName: 'Riya', lastName: 'Banerjee', email: 'riya.banerjee@tcer.edu.in', batchId: 'batch-cse-24b', departmentId: 'dept-cse', targetRate: 0.86 },
      { id: 'stu-14', userId: 'u-stu-14', rollNumber: 'TC24014', firstName: 'Vikram', lastName: 'Sengupta', email: 'vikram.sengupta@tcer.edu.in', batchId: 'batch-cse-24b', departmentId: 'dept-cse', targetRate: 0.68 },
      { id: 'stu-15', userId: 'u-stu-15', rollNumber: 'TE24001', firstName: 'Nandini', lastName: 'Pillai', email: 'nandini.pillai@tcer.edu.in', batchId: 'batch-ece-24a', departmentId: 'dept-ece', targetRate: 0.90 },
      { id: 'stu-16', userId: 'u-stu-16', rollNumber: 'TE24002', firstName: 'Harshvardhan', lastName: 'Rao', email: 'harsh.rao@tcer.edu.in', batchId: 'batch-ece-24a', departmentId: 'dept-ece', targetRate: 0.70 },
      { id: 'stu-17', userId: 'u-stu-17', rollNumber: 'TM24001', firstName: 'Omkar', lastName: 'Patil', email: 'omkar.patil@tcer.edu.in', batchId: 'batch-mech-24a', departmentId: 'dept-mech', targetRate: 0.84 },
      { id: 'stu-18', userId: 'u-stu-18', rollNumber: 'TM24002', firstName: 'Shruti', lastName: 'Jadhav', email: 'shruti.jadhav@tcer.edu.in', batchId: 'batch-mech-24a', departmentId: 'dept-mech', targetRate: 0.69 },
    ];

    const students: StudentProfile[] = rosterSeed.map((s) => ({
      id: s.id,
      userId: s.userId,
      rollNumber: s.rollNumber,
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      batchId: s.batchId,
      departmentId: s.departmentId,
      guardianMail: `guardian.${s.rollNumber.toLowerCase()}@example.com`,
      activated: s.rollNumber !== 'TC24012',
      createdAt: '2026-08-01T08:00:00Z',
    }));

    // Multi-month sessions spanning August, September, October, and November 2026
    const sessionPlan: Array<{
      id: string;
      date: string;
      courseId: string;
      batchId: string;
      slot: string;
      topic: string;
      markedById: string;
      markedByName: string;
    }> = [
      // August 2026
      { id: 'sess-aug-01', date: '2026-08-05', courseId: 'course-cs301', batchId: 'batch-cse-24a', slot: '09:00 AM - 10:00 AM', topic: 'Asymptotic Complexity & Big-O', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-aug-02', date: '2026-08-07', courseId: 'course-cs304', batchId: 'batch-cse-24a', slot: '10:00 AM - 11:00 AM', topic: 'OS Kernel & System Calls', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-aug-03', date: '2026-08-11', courseId: 'course-cs308', batchId: 'batch-cse-24a', slot: '11:15 AM - 12:15 PM', topic: 'ER Modeling & Relational Schema', markedById: 'user-faculty-2', markedByName: 'Prof. Meera Iyer' },
      { id: 'sess-aug-04', date: '2026-08-14', courseId: 'course-cs312', batchId: 'batch-cse-24a', slot: '02:00 PM - 03:00 PM', topic: 'OSI vs TCP/IP Reference Stack', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-aug-05', date: '2026-08-18', courseId: 'course-cs301', batchId: 'batch-cse-24a', slot: '09:00 AM - 10:00 AM', topic: 'Stacks, Queues & Linked Lists', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-aug-06', date: '2026-08-21', courseId: 'course-cs304', batchId: 'batch-cse-24a', slot: '10:00 AM - 11:00 AM', topic: 'Threads & Context Switching', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-aug-07', date: '2026-08-26', courseId: 'course-cs308', batchId: 'batch-cse-24a', slot: '11:15 AM - 12:15 PM', topic: 'Relational Algebra & SQL Joins', markedById: 'user-faculty-2', markedByName: 'Prof. Meera Iyer' },
      // September 2026
      { id: 'sess-sep-01', date: '2026-09-02', courseId: 'course-cs301', batchId: 'batch-cse-24a', slot: '09:00 AM - 10:00 AM', topic: 'Hash Tables & Collision Resolution', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-sep-02', date: '2026-09-07', courseId: 'course-cs304', batchId: 'batch-cse-24a', slot: '10:00 AM - 11:00 AM', topic: 'Mutexes, Semaphores & Monitors', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-sep-03', date: '2026-09-10', courseId: 'course-cs308', batchId: 'batch-cse-24a', slot: '11:15 AM - 12:15 PM', topic: 'Functional Dependencies & 3NF', markedById: 'user-faculty-2', markedByName: 'Prof. Meera Iyer' },
      { id: 'sess-sep-04', date: '2026-09-15', courseId: 'course-cs312', batchId: 'batch-cse-24a', slot: '02:00 PM - 03:00 PM', topic: 'IPv4 Subnetting & CIDR', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-sep-05', date: '2026-09-18', courseId: 'course-cs301', batchId: 'batch-cse-24a', slot: '09:00 AM - 10:00 AM', topic: 'Heaps & Priority Queues', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-sep-06', date: '2026-09-22', courseId: 'course-cs304', batchId: 'batch-cse-24a', slot: '10:00 AM - 11:00 AM', topic: 'Banker Algorithm & Deadlocks', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-sep-07', date: '2026-09-25', courseId: 'course-cs312', batchId: 'batch-cse-24a', slot: '02:00 PM - 03:00 PM', topic: 'Sliding Window & Go-Back-N', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      // October 2026
      { id: 'sess-oct-01', date: '2026-10-06', courseId: 'course-cs301', batchId: 'batch-cse-24a', slot: '09:00 AM - 10:00 AM', topic: 'Binary Search Trees & Traversals', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-oct-02', date: '2026-10-09', courseId: 'course-cs304', batchId: 'batch-cse-24a', slot: '10:00 AM - 11:00 AM', topic: 'Memory Segmentation & Paging', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-oct-03', date: '2026-10-14', courseId: 'course-cs308', batchId: 'batch-cse-24a', slot: '11:15 AM - 12:15 PM', topic: 'Query Execution Plans', markedById: 'user-faculty-2', markedByName: 'Prof. Meera Iyer' },
      { id: 'sess-oct-04', date: '2026-10-19', courseId: 'course-cs312', batchId: 'batch-cse-24a', slot: '02:00 PM - 03:00 PM', topic: 'OSPF & Distance Vector Routing', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-01', date: '2026-10-26', courseId: 'course-cs301', batchId: 'batch-cse-24a', slot: '09:00 AM - 10:00 AM', topic: 'Balanced Binary Search Trees', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-02', date: '2026-10-27', courseId: 'course-cs304', batchId: 'batch-cse-24a', slot: '10:00 AM - 11:00 AM', topic: 'Process Scheduling Algorithms', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-03', date: '2026-10-28', courseId: 'course-cs308', batchId: 'batch-cse-24a', slot: '11:15 AM - 12:15 PM', topic: 'BCNF & Third Normal Form', markedById: 'user-faculty-2', markedByName: 'Prof. Meera Iyer' },
      { id: 'sess-04', date: '2026-10-29', courseId: 'course-cs312', batchId: 'batch-cse-24a', slot: '02:00 PM - 03:00 PM', topic: 'TCP Congestion Control', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-05', date: '2026-10-30', courseId: 'course-cs301', batchId: 'batch-cse-24a', slot: '09:00 AM - 10:00 AM', topic: 'Red-Black Tree Rotations', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      // November 2026
      { id: 'sess-06', date: '2026-11-02', courseId: 'course-cs301', batchId: 'batch-cse-24a', slot: '09:00 AM - 10:00 AM', topic: 'Shortest Path: Dijkstra', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-07', date: '2026-11-03', courseId: 'course-cs304', batchId: 'batch-cse-24a', slot: '10:00 AM - 11:00 AM', topic: 'Deadlock Detection & Recovery', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-08', date: '2026-11-04', courseId: 'course-cs308', batchId: 'batch-cse-24a', slot: '11:15 AM - 12:15 PM', topic: 'B+ Tree Indexing Internals', markedById: 'user-faculty-2', markedByName: 'Prof. Meera Iyer' },
      { id: 'sess-09', date: '2026-11-05', courseId: 'course-cs312', batchId: 'batch-cse-24a', slot: '02:00 PM - 03:00 PM', topic: 'BGP Inter-Domain Routing', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-10', date: '2026-11-06', courseId: 'course-cs301', batchId: 'batch-cse-24a', slot: '09:00 AM - 10:00 AM', topic: 'Minimum Spanning Trees', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-11', date: '2026-11-09', courseId: 'course-cs304', batchId: 'batch-cse-24a', slot: '10:00 AM - 11:00 AM', topic: 'Virtual Memory & Paging', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-12', date: '2026-11-10', courseId: 'course-cs308', batchId: 'batch-cse-24a', slot: '11:15 AM - 12:15 PM', topic: 'MVCC & Isolation Levels', markedById: 'user-faculty-2', markedByName: 'Prof. Meera Iyer' },
      { id: 'sess-13', date: '2026-11-11', courseId: 'course-cs312', batchId: 'batch-cse-24a', slot: '02:00 PM - 03:00 PM', topic: 'TLS 1.3 Handshake Mechanics', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-14', date: '2026-11-12', courseId: 'course-cs301', batchId: 'batch-cse-24a', slot: '09:00 AM - 10:00 AM', topic: 'Dynamic Programming: Knapsack', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-15', date: '2026-11-13', courseId: 'course-cs304', batchId: 'batch-cse-24a', slot: '10:00 AM - 11:00 AM', topic: 'Page Replacement Policies', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-16', date: '2026-11-16', courseId: 'course-cs308', batchId: 'batch-cse-24a', slot: '11:15 AM - 12:15 PM', topic: 'Write-Ahead Logging (WAL)', markedById: 'user-faculty-2', markedByName: 'Prof. Meera Iyer' },
      { id: 'sess-17', date: '2026-11-17', courseId: 'course-cs312', batchId: 'batch-cse-24a', slot: '02:00 PM - 03:00 PM', topic: 'DNS Resolution & Anycast', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-18', date: '2026-11-18', courseId: 'course-cs301', batchId: 'batch-cse-24a', slot: '09:00 AM - 10:00 AM', topic: 'Network Flow: Ford-Fulkerson', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-19', date: '2026-11-19', courseId: 'course-cs304', batchId: 'batch-cse-24a', slot: '10:00 AM - 11:00 AM', topic: 'File Systems & Inodes', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      { id: 'sess-20', date: '2026-11-20', courseId: 'course-cs301', batchId: 'batch-cse-24a', slot: '09:00 AM - 10:00 AM', topic: 'NP-Completeness Overview', markedById: 'user-faculty-1', markedByName: 'Prof. Arvind Nair' },
      // Other divisions/departments for full admin visibility
      { id: 'sess-21', date: '2026-11-14', courseId: 'course-cs308', batchId: 'batch-cse-24b', slot: '09:00 AM - 10:00 AM', topic: 'Query Optimization', markedById: 'user-faculty-2', markedByName: 'Prof. Meera Iyer' },
      { id: 'sess-22', date: '2026-11-18', courseId: 'course-cs308', batchId: 'batch-cse-24b', slot: '09:00 AM - 10:00 AM', topic: 'Distributed Transactions', markedById: 'user-faculty-2', markedByName: 'Prof. Meera Iyer' },
      { id: 'sess-23', date: '2026-11-16', courseId: 'course-ec202', batchId: 'batch-ece-24a', slot: '11:15 AM - 12:15 PM', topic: 'Fast Fourier Transform', markedById: 'user-faculty-2', markedByName: 'Prof. Meera Iyer' },
      { id: 'sess-24', date: '2026-11-20', courseId: 'course-ec202', batchId: 'batch-ece-24a', slot: '11:15 AM - 12:15 PM', topic: 'FIR Filter Design', markedById: 'user-faculty-2', markedByName: 'Prof. Meera Iyer' },
      { id: 'sess-25', date: '2026-11-17', courseId: 'course-me305', batchId: 'batch-mech-24a', slot: '10:00 AM - 11:00 AM', topic: 'Carnot & Rankine Cycles', markedById: 'user-faculty-3', markedByName: 'Prof. Sandeep Kulkarni' },
      { id: 'sess-26', date: '2026-11-20', courseId: 'course-me305', batchId: 'batch-mech-24a', slot: '10:00 AM - 11:00 AM', topic: 'Convective Heat Exchangers', markedById: 'user-faculty-3', markedByName: 'Prof. Sandeep Kulkarni' },
    ];

    const sessions: AttendanceSession[] = sessionPlan.map((s) => ({
      ...s,
      createdAt: `${s.date}T09:15:00Z`,
      updatedAt: `${s.date}T09:15:00Z`,
    }));

    const records: AttendanceRecord[] = [];
    const rosterById = new Map(rosterSeed.map((r) => [r.id, r]));

    sessions.forEach((sess, sIdx) => {
      const batchStudents = students.filter((st) => st.batchId === sess.batchId);
      batchStudents.forEach((st, stIdx) => {
        const seedMeta = rosterById.get(st.id);
        const target = seedMeta?.targetRate ?? 0.85;
        const hashVal = ((sIdx * 37 + stIdx * 19 + 11) % 100) / 100;
        let status = AttendanceStatus.PRESENT;
        if (hashVal > target) {
          status = AttendanceStatus.ABSENT;
        } else if (hashVal > target - 0.08 && sIdx % 3 === 0) {
          status = AttendanceStatus.LATE;
        }

        records.push({
          id: `rec-${sess.id}-${st.id}`,
          sessionId: sess.id,
          studentId: st.id,
          status,
          createdAt: sess.createdAt,
          updatedAt: sess.updatedAt,
        });
      });
    });

    const auditLogs: AttendanceAuditLog[] = [
      {
        id: 'audit-01',
        recordId: 'rec-sess-19-stu-02',
        sessionId: 'sess-19',
        studentId: 'stu-02',
        studentName: 'Rohan Deshmukh',
        rollNumber: 'TC24002',
        courseCode: 'CS304',
        sessionDate: '2026-11-19',
        changedById: 'user-faculty-1',
        changedByName: 'Prof. Arvind Nair',
        changedByRole: Role.FACULTY,
        oldStatus: AttendanceStatus.ABSENT,
        newStatus: AttendanceStatus.LATE,
        reason: 'Student entered 7 minutes after roll call; lab badge timestamp verified.',
        withinDirectWindow: true,
        timestamp: '2026-11-19T11:22:00Z',
      },
      {
        id: 'audit-02',
        recordId: 'rec-sess-15-stu-04',
        sessionId: 'sess-15',
        studentId: 'stu-04',
        studentName: 'Kabir Malhotra',
        rollNumber: 'TC24004',
        courseCode: 'CS304',
        sessionDate: '2026-11-13',
        changedById: 'user-operator-1',
        changedByName: 'Nikhil Joshi',
        changedByRole: Role.OPERATOR,
        oldStatus: AttendanceStatus.ABSENT,
        newStatus: AttendanceStatus.EXCUSED,
        reason: 'Approved institutional robotics competition representation (Ref #TCER-DEAN-419).',
        withinDirectWindow: false,
        timestamp: '2026-11-17T14:05:00Z',
      },
      {
        id: 'audit-03',
        recordId: 'rec-sess-18-stu-01',
        sessionId: 'sess-18',
        studentId: 'stu-01',
        studentName: 'Ananya Sharma',
        rollNumber: 'TC24001',
        courseCode: 'CS301',
        sessionDate: '2026-11-18',
        changedById: 'user-faculty-1',
        changedByName: 'Prof. Arvind Nair',
        changedByRole: Role.FACULTY,
        oldStatus: AttendanceStatus.ABSENT,
        newStatus: AttendanceStatus.PRESENT,
        reason: 'Accidental double tap during rapid roll call; rectified immediately.',
        withinDirectWindow: true,
        timestamp: '2026-11-18T10:12:00Z',
      },
    ];

    const onboardingEmails: OnboardingEmailLog[] = [
      {
        id: 'mail-seed-01',
        studentId: 'stu-01',
        studentName: 'Ananya Sharma',
        rollNumber: 'TC24001',
        recipientEmail: 'student@tcer.edu.in',
        temporaryPassword: 'CP-KX74-MN',
        activationToken: 'act9f83c10a4421',
        activationLink: '/?activate=act9f83c10a4421',
        deliveryMode: 'LOCAL_QUEUE',
        status: 'DELIVERED',
        subject: '[Trinity College of Engineering and Research] Your CampusPulse Portal Credentials',
        htmlPreview:
          'Hello Ananya Sharma,\n\nYour student attendance portal account at Trinity College of Engineering and Research (2024–2028 · Division A) is ready.\n\nStudent Roll No: TC24001\nPortal Email: student@tcer.edu.in\nTemporary Password: CP-KX74-MN\nActivation Link: /?activate=act9f83c10a4421',
        sentAt: '2026-11-15T08:30:00Z',
      },
      {
        id: 'mail-seed-02',
        studentId: 'stu-12',
        studentName: 'Siddhanth Bose',
        rollNumber: 'TC24012',
        recipientEmail: 'siddhanth.bose@tcer.edu.in',
        temporaryPassword: 'CP-TR29-PL',
        activationToken: 'act4b21d90f1187',
        activationLink: '/?activate=act4b21d90f1187',
        deliveryMode: 'LOCAL_QUEUE',
        status: 'DELIVERED',
        subject: '[Trinity College of Engineering and Research] Your CampusPulse Portal Credentials',
        htmlPreview:
          'Hello Siddhanth Bose,\n\nYour student attendance portal account at Trinity College of Engineering and Research (2024–2028 · Division A) is ready.\n\nStudent Roll No: TC24012\nPortal Email: siddhanth.bose@tcer.edu.in\nTemporary Password: CP-TR29-PL\nActivation Link: /?activate=act4b21d90f1187',
        sentAt: '2026-11-18T11:45:00Z',
      },
    ];

    const leaveEntries: LeaveEntry[] = [
      {
        id: 'leave-01',
        studentId: 'stu-04',
        studentName: 'Kabir Malhotra',
        rollNumber: 'TC24004',
        date: '2026-11-13',
        reason: 'Inter-University Robotics Hackathon (Dean Approval #TCER-DEAN-419)',
        category: 'INSTITUTIONAL_DUTY',
        approvedByName: 'Nikhil Joshi',
        createdAt: '2026-11-17T14:05:00Z',
      },
    ];

    return {
      institution,
      departments,
      batches,
      courses,
      users,
      students,
      sessions,
      records,
      auditLogs,
      onboardingEmails,
      leaveEntries,
    };
  }

  toPublicUser(user: StoredUser): UserAccount {
    const { passwordHash: _ignored, ...safeUser } = user;
    return safeUser;
  }

  createSession(userId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    this.activeSessions.set(token, {
      token,
      userId,
      createdAt: Date.now(),
    });
    return token;
  }

  getUserByToken(token: string | undefined): UserAccount | null {
    if (!token) return null;
    const entry = this.activeSessions.get(token);
    if (!entry) return null;
    const user = this.users.find((u) => u.id === entry.userId && u.isActive);
    return user ? this.toPublicUser(user) : null;
  }

  authenticate(email: string, password: string): { token: string; user: UserAccount } | null {
    const normalized = email.trim().toLowerCase();
    const user = this.users.find((u) => u.email.toLowerCase() === normalized && u.isActive);
    if (!user) return null;
    if (!verifyPassword(password, user.passwordHash)) return null;
    const token = this.createSession(user.id);
    return { token, user: this.toPublicUser(user) };
  }

  createDemoSessionForRole(
    role: Role,
    specificEmail?: string
  ): { token: string; user: UserAccount } | null {
    const user = specificEmail
      ? this.users.find(
          (u) =>
            u.role === role &&
            u.email.toLowerCase() === specificEmail.toLowerCase() &&
            u.isActive
        )
      : this.users.find((u) => u.role === role && u.isActive);
    if (!user) return null;
    const token = this.createSession(user.id);
    return { token, user: this.toPublicUser(user) };
  }

  revokeSession(token: string) {
    this.activeSessions.delete(token);
  }

  /**
   * Role-scoped state payload enforcing strict RBAC isolation:
   * - STUDENT receives ONLY their own student profile, own records, own batch/department/courses.
   * - COLLEGE_ADMIN / FACULTY / OPERATOR receive institutional operational datasets needed by their role.
   */
  getScopedStateForUser(user: UserAccount): CampusStatePayload {
    if (user.role === Role.STUDENT) {
      const ownStudent = this.students.find(
        (s) => s.userId === user.id || s.email.toLowerCase() === user.email.toLowerCase()
      );
      const ownStudents = ownStudent ? [ownStudent] : [];
      const ownRecords = ownStudent
        ? this.records.filter((r) => r.studentId === ownStudent.id)
        : [];
      const ownSessionIds = new Set(ownRecords.map((r) => r.sessionId));
      const ownSessions = this.sessions.filter((s) => ownSessionIds.has(s.id));
      const ownBatches = ownStudent
        ? this.batches.filter((b) => b.id === ownStudent.batchId)
        : [];
      const ownDepartments = ownStudent
        ? this.departments.filter((d) => d.id === ownStudent.departmentId)
        : [];
      const ownCourses = ownStudent
        ? this.courses.filter((c) => c.departmentId === ownStudent.departmentId)
        : [];

      return {
        institution: this.institution,
        departments: ownDepartments,
        batches: ownBatches,
        courses: ownCourses,
        users: [user],
        students: ownStudents,
        sessions: ownSessions,
        records: ownRecords,
        auditLogs: [],
        onboardingEmails: [],
        leaveEntries: ownStudent
          ? this.leaveEntries.filter((l) => l.studentId === ownStudent.id)
          : [],
      };
    }

    return {
      institution: this.institution,
      departments: this.departments,
      batches: this.batches,
      courses: this.courses,
      users: this.users.map((u) => this.toPublicUser(u)),
      students: this.students,
      sessions: this.sessions,
      records: this.records,
      auditLogs: this.auditLogs,
      onboardingEmails: this.onboardingEmails,
      leaveEntries: this.leaveEntries,
    };
  }
}

export const campusStore = new CampusPulseStore();
