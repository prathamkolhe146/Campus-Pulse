import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { isWithinDirectEditWindow } from './src/lib/attendanceMath';
import { buildMonthlyMatrixCsv, parseStudentImportCsv } from './src/lib/csvExport';
import { AttendanceStatus, Role, UserAccount } from './src/lib/types';
import { ChatTurn, generateCampusChatReply } from './src/server/chatService';
import { sendStudentCredentials } from './src/server/emailService';
import { campusStore, hashPassword } from './src/server/store';

dotenv.config();

interface AuthenticatedRequest extends Request {
  currentUser?: UserAccount;
  authToken?: string;
}

function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim();
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  const user = campusStore.getUserByToken(token);
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please sign in to CampusPulse.' });
    return;
  }
  req.currentUser = user;
  req.authToken = token;
  next();
}

function requireRoles(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.currentUser || !allowedRoles.includes(req.currentUser.role)) {
      res.status(403).json({ error: 'Access restricted: your account does not have permission for this resource.' });
      return;
    }
    next();
  };
}

function isValidStatus(value: unknown): value is AttendanceStatus {
  return (
    value === AttendanceStatus.PRESENT ||
    value === AttendanceStatus.ABSENT ||
    value === AttendanceStatus.LATE ||
    value === AttendanceStatus.EXCUSED
  );
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, institution: campusStore.institution.code });
  });

  // Email + Password Login
  app.post('/api/auth/login', (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const result = campusStore.authenticate(email, password);
    if (!result) {
      res.status(401).json({ error: 'Invalid credentials. Verify your institutional email and password.' });
      return;
    }

    res.json(result);
  });

  // Role login from Landing / Login modal (single session strictly locked to that account)
  app.post('/api/auth/demo', (req, res) => {
    const requestedRole = req.body?.role as Role;
    const specificEmail = typeof req.body?.email === 'string' ? req.body.email.trim() : undefined;
    const validRoles = [Role.COLLEGE_ADMIN, Role.FACULTY, Role.OPERATOR, Role.STUDENT];
    if (!validRoles.includes(requestedRole)) {
      res.status(400).json({ error: 'Unsupported role selected.' });
      return;
    }

    const session = campusStore.createDemoSessionForRole(requestedRole, specificEmail);
    if (!session) {
      res.status(404).json({ error: 'Account unavailable for this role.' });
      return;
    }

    res.json(session);
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.authToken) {
      campusStore.revokeSession(req.authToken);
    }
    res.json({ ok: true });
  });

  // Strictly role-scoped workspace state
  app.get('/api/state', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json(campusStore.getScopedStateForUser(req.currentUser!));
  });

  // Server-side Gemini Chatbot Endpoint (available on landing & inside role-scoped workspaces)
  app.post('/api/chat', async (req: AuthenticatedRequest, res) => {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];

    if (!message || message.length > 1000) {
      res.status(400).json({ error: 'Please enter a message between 1 and 1,000 characters.' });
      return;
    }

    const history: ChatTurn[] = rawHistory
      .filter(
        (item: unknown): item is ChatTurn =>
          Boolean(item) &&
          typeof item === 'object' &&
          ((item as ChatTurn).role === 'user' || (item as ChatTurn).role === 'assistant') &&
          typeof (item as ChatTurn).text === 'string'
      )
      .slice(-8);

    const token = extractBearerToken(req);
    const currentUser = campusStore.getUserByToken(token);

    try {
      const reply = await generateCampusChatReply(message, history, currentUser);
      res.json({ reply });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unable to reach CampusPulse Assistant.';
      const status =
        errMsg.includes('API key') || errMsg.includes('API_KEY_INVALID')
          ? 503
          : errMsg.includes('RESOURCE_EXHAUSTED')
          ? 429
          : 502;
      res.status(status).json({ error: errMsg });
    }
  });

  // Submit one-tap attendance session
  app.post(
    '/api/sessions',
    requireAuth,
    requireRoles(Role.COLLEGE_ADMIN, Role.SUPER_ADMIN, Role.FACULTY, Role.OPERATOR),
    (req: AuthenticatedRequest, res) => {
      const courseId = typeof req.body?.courseId === 'string' ? req.body.courseId : '';
      const batchId = typeof req.body?.batchId === 'string' ? req.body.batchId : '';
      const date = typeof req.body?.date === 'string' ? req.body.date : '';
      const slot = typeof req.body?.slot === 'string' ? req.body.slot.trim() : '';
      const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : 'Regular Lecture';
      const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];

      if (!courseId || !batchId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !slot) {
        res.status(400).json({ error: 'Course, division, valid date (YYYY-MM-DD), and slot are required.' });
        return;
      }

      if (entries.length === 0) {
        res.status(400).json({ error: 'At least one student attendance entry is required.' });
        return;
      }

      const course = campusStore.courses.find((c) => c.id === courseId);
      const batch = campusStore.batches.find((b) => b.id === batchId);
      if (!course || !batch) {
        res.status(404).json({ error: 'Selected course or division does not exist.' });
        return;
      }

      const nowIso = new Date().toISOString();
      const user = req.currentUser!;
      const sessionId = `sess-${crypto.randomUUID().slice(0, 8)}`;

      const newSession = {
        id: sessionId,
        courseId,
        batchId,
        markedById: user.id,
        markedByName: `${user.firstName} ${user.lastName}`,
        date,
        slot,
        topic: topic || 'Scheduled Lecture',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const newRecords = [];
      for (const entry of entries) {
        const studentId = typeof entry?.studentId === 'string' ? entry.studentId : '';
        const status = entry?.status;
        if (!studentId || !isValidStatus(status)) {
          res.status(400).json({ error: 'Invalid student attendance status payload.' });
          return;
        }
        newRecords.push({
          id: `rec-${sessionId}-${studentId}`,
          sessionId,
          studentId,
          status,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }

      campusStore.sessions.push(newSession);
      campusStore.records.push(...newRecords);

      res.status(201).json({
        session: newSession,
        records: newRecords,
        state: campusStore.getScopedStateForUser(user),
      });
    }
  );

  // Mistake correction with immutable audit trail
  app.patch(
    '/api/records/:recordId/correct',
    requireAuth,
    requireRoles(Role.COLLEGE_ADMIN, Role.SUPER_ADMIN, Role.FACULTY, Role.OPERATOR),
    (req: AuthenticatedRequest, res) => {
      const { recordId } = req.params;
      const newStatus = req.body?.newStatus;
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

      if (!isValidStatus(newStatus)) {
        res.status(400).json({ error: 'A valid target attendance status is required.' });
        return;
      }

      const record = campusStore.records.find((r) => r.id === recordId);
      if (!record) {
        res.status(404).json({ error: 'Attendance record not found.' });
        return;
      }

      const session = campusStore.sessions.find((s) => s.id === record.sessionId);
      const student = campusStore.students.find((s) => s.id === record.studentId);
      const course = session ? campusStore.courses.find((c) => c.id === session.courseId) : undefined;

      if (!session || !student) {
        res.status(404).json({ error: 'Associated session or student record not found.' });
        return;
      }

      const withinWindow = isWithinDirectEditWindow(session.date);
      if (!withinWindow && reason.length < 8) {
        res.status(400).json({
          error: 'Records older than 48 hours require an administrative reason of at least 8 characters.',
        });
        return;
      }
      if (reason.length < 3) {
        res.status(400).json({ error: 'Please provide a brief correction reason for the audit log.' });
        return;
      }

      const oldStatus = record.status;
      if (oldStatus === newStatus) {
        res.status(400).json({ error: 'New status must differ from the current status.' });
        return;
      }

      const nowIso = new Date().toISOString();
      record.status = newStatus;
      record.remarks = reason;
      record.updatedAt = nowIso;

      const actor = req.currentUser!;
      const auditEntry = {
        id: `audit-${crypto.randomUUID().slice(0, 8)}`,
        recordId: record.id,
        sessionId: session.id,
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        rollNumber: student.rollNumber,
        courseCode: course?.code ?? 'COURSE',
        sessionDate: session.date,
        changedById: actor.id,
        changedByName: `${actor.firstName} ${actor.lastName}`,
        changedByRole: actor.role,
        oldStatus,
        newStatus,
        reason,
        withinDirectWindow: withinWindow,
        timestamp: nowIso,
      };

      campusStore.auditLogs.unshift(auditEntry);

      res.json({
        record,
        auditEntry,
        state: campusStore.getScopedStateForUser(actor),
      });
    }
  );

  // Add individual student + automated onboarding email
  app.post(
    '/api/students',
    requireAuth,
    requireRoles(Role.COLLEGE_ADMIN, Role.SUPER_ADMIN, Role.FACULTY, Role.OPERATOR),
    async (req: AuthenticatedRequest, res) => {
      const rollNumber = typeof req.body?.rollNumber === 'string' ? req.body.rollNumber.trim().toUpperCase() : '';
      const firstName = typeof req.body?.firstName === 'string' ? req.body.firstName.trim() : '';
      const lastName = typeof req.body?.lastName === 'string' ? req.body.lastName.trim() : '';
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const batchId = typeof req.body?.batchId === 'string' ? req.body.batchId : 'batch-cse-24a';

      if (!rollNumber || !firstName || !lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: 'Roll Number, First Name, Last Name, and valid Email are required.' });
        return;
      }

      if (campusStore.students.some((s) => s.rollNumber.toUpperCase() === rollNumber)) {
        res.status(409).json({ error: `Student with Roll Number ${rollNumber} already exists.` });
        return;
      }

      const batch = campusStore.batches.find((b) => b.id === batchId) || campusStore.batches[0];
      const studentId = `stu-${crypto.randomUUID().slice(0, 8)}`;
      const userId = `u-${studentId}`;
      const nowIso = new Date().toISOString();

      const emailLog = await sendStudentCredentials({
        institutionName: campusStore.institution.name,
        studentId,
        rollNumber,
        firstName,
        lastName,
        email,
        batchLabel: `${batch.name} · ${batch.division}`,
      });

      campusStore.users.push({
        id: userId,
        institutionId: campusStore.institution.id,
        departmentId: batch.departmentId,
        email,
        passwordHash: hashPassword(emailLog.temporaryPassword),
        role: Role.STUDENT,
        firstName,
        lastName,
        isActive: true,
        createdAt: nowIso,
      });

      const newStudent = {
        id: studentId,
        userId,
        rollNumber,
        firstName,
        lastName,
        email,
        batchId: batch.id,
        departmentId: batch.departmentId,
        activated: false,
        createdAt: nowIso,
      };

      campusStore.students.push(newStudent);
      campusStore.onboardingEmails.unshift(emailLog);

      res.status(201).json({
        student: newStudent,
        emailLog,
        state: campusStore.getScopedStateForUser(req.currentUser!),
      });
    }
  );

  // Bulk CSV student onboarding
  app.post(
    '/api/students/bulk',
    requireAuth,
    requireRoles(Role.COLLEGE_ADMIN, Role.SUPER_ADMIN, Role.FACULTY, Role.OPERATOR),
    async (req: AuthenticatedRequest, res) => {
      const rawCsv = typeof req.body?.rawCsv === 'string' ? req.body.rawCsv : '';
      const batchId = typeof req.body?.batchId === 'string' ? req.body.batchId : 'batch-cse-24a';

      const parsed = parseStudentImportCsv(rawCsv);
      if (parsed.validRows.length === 0) {
        res.status(400).json({
          error: parsed.errors[0] || 'No valid student rows found in CSV.',
          errors: parsed.errors,
        });
        return;
      }

      const batch = campusStore.batches.find((b) => b.id === batchId) || campusStore.batches[0];
      const createdStudents = [];
      const dispatchedEmails = [];
      const skipped: string[] = [];

      for (const row of parsed.validRows) {
        if (campusStore.students.some((s) => s.rollNumber === row.rollNumber)) {
          skipped.push(`${row.rollNumber} (duplicate roll number)`);
          continue;
        }

        const studentId = `stu-${crypto.randomUUID().slice(0, 8)}`;
        const userId = `u-${studentId}`;
        const nowIso = new Date().toISOString();

        const emailLog = await sendStudentCredentials({
          institutionName: campusStore.institution.name,
          studentId,
          rollNumber: row.rollNumber,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          batchLabel: `${batch.name} · ${row.division || batch.division}`,
        });

        campusStore.users.push({
          id: userId,
          institutionId: campusStore.institution.id,
          departmentId: batch.departmentId,
          email: row.email,
          passwordHash: hashPassword(emailLog.temporaryPassword),
          role: Role.STUDENT,
          firstName: row.firstName,
          lastName: row.lastName,
          isActive: true,
          createdAt: nowIso,
        });

        const student = {
          id: studentId,
          userId,
          rollNumber: row.rollNumber,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          batchId: batch.id,
          departmentId: batch.departmentId,
          activated: false,
          createdAt: nowIso,
        };

        campusStore.students.push(student);
        campusStore.onboardingEmails.unshift(emailLog);
        createdStudents.push(student);
        dispatchedEmails.push(emailLog);
      }

      res.status(201).json({
        createdCount: createdStudents.length,
        skipped,
        parseErrors: parsed.errors,
        dispatchedEmails,
        state: campusStore.getScopedStateForUser(req.currentUser!),
      });
    }
  );

  // Resend onboarding credentials
  app.post(
    '/api/students/:studentId/resend-credentials',
    requireAuth,
    requireRoles(Role.COLLEGE_ADMIN, Role.SUPER_ADMIN, Role.FACULTY, Role.OPERATOR),
    async (req: AuthenticatedRequest, res) => {
      const student = campusStore.students.find((s) => s.id === req.params.studentId);
      if (!student) {
        res.status(404).json({ error: 'Student not found.' });
        return;
      }

      const batch = campusStore.batches.find((b) => b.id === student.batchId);
      const emailLog = await sendStudentCredentials({
        institutionName: campusStore.institution.name,
        studentId: student.id,
        rollNumber: student.rollNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        batchLabel: batch ? `${batch.name} · ${batch.division}` : 'Assigned Batch',
      });

      const userAccount = campusStore.users.find((u) => u.id === student.userId);
      if (userAccount) {
        userAccount.passwordHash = hashPassword(emailLog.temporaryPassword);
      }

      campusStore.onboardingEmails.unshift(emailLog);

      res.json({
        emailLog,
        state: campusStore.getScopedStateForUser(req.currentUser!),
      });
    }
  );

  // Operator institutional leave entry
  app.post(
    '/api/leaves',
    requireAuth,
    requireRoles(Role.COLLEGE_ADMIN, Role.SUPER_ADMIN, Role.OPERATOR),
    (req: AuthenticatedRequest, res) => {
      const studentId = typeof req.body?.studentId === 'string' ? req.body.studentId : '';
      const date = typeof req.body?.date === 'string' ? req.body.date : '';
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
      const category = req.body?.category as 'MEDICAL' | 'INSTITUTIONAL_DUTY' | 'APPROVED_LEAVE';

      if (!studentId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || reason.length < 5) {
        res.status(400).json({ error: 'Student, valid date, and reason (min 5 chars) are required.' });
        return;
      }

      const student = campusStore.students.find((s) => s.id === studentId);
      if (!student) {
        res.status(404).json({ error: 'Student not found.' });
        return;
      }

      const actor = req.currentUser!;
      const nowIso = new Date().toISOString();

      const leave = {
        id: `leave-${crypto.randomUUID().slice(0, 8)}`,
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        rollNumber: student.rollNumber,
        date,
        reason,
        category: category || 'APPROVED_LEAVE',
        approvedByName: `${actor.firstName} ${actor.lastName}`,
        createdAt: nowIso,
      };
      campusStore.leaveEntries.unshift(leave);

      const matchingSessions = campusStore.sessions.filter(
        (s) => s.date === date && s.batchId === student.batchId
      );
      for (const sess of matchingSessions) {
        const rec = campusStore.records.find(
          (r) => r.sessionId === sess.id && r.studentId === student.id
        );
        if (rec && rec.status !== AttendanceStatus.EXCUSED) {
          const oldStatus = rec.status;
          rec.status = AttendanceStatus.EXCUSED;
          rec.remarks = reason;
          rec.updatedAt = nowIso;
          const course = campusStore.courses.find((c) => c.id === sess.courseId);
          campusStore.auditLogs.unshift({
            id: `audit-${crypto.randomUUID().slice(0, 8)}`,
            recordId: rec.id,
            sessionId: sess.id,
            studentId: student.id,
            studentName: `${student.firstName} ${student.lastName}`,
            rollNumber: student.rollNumber,
            courseCode: course?.code ?? 'COURSE',
            sessionDate: sess.date,
            changedById: actor.id,
            changedByName: `${actor.firstName} ${actor.lastName}`,
            changedByRole: actor.role,
            oldStatus,
            newStatus: AttendanceStatus.EXCUSED,
            reason: `[${leave.category}] ${reason}`,
            withinDirectWindow: isWithinDirectEditWindow(sess.date),
            timestamp: nowIso,
          });
        }
      }

      res.status(201).json({ leave, state: campusStore.getScopedStateForUser(actor) });
    }
  );

  // Admin: Create Department
  app.post(
    '/api/departments',
    requireAuth,
    requireRoles(Role.COLLEGE_ADMIN, Role.SUPER_ADMIN),
    (req: AuthenticatedRequest, res) => {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
      const hodName = typeof req.body?.hodName === 'string' ? req.body.hodName.trim() : '';

      if (!name || !code || !hodName) {
        res.status(400).json({ error: 'Department name, code, and Head of Department are required.' });
        return;
      }

      const dept = {
        id: `dept-${crypto.randomUUID().slice(0, 6)}`,
        institutionId: campusStore.institution.id,
        name,
        code,
        hodName,
      };
      campusStore.departments.push(dept);

      campusStore.batches.push({
        id: `batch-${code.toLowerCase()}-24a`,
        departmentId: dept.id,
        name: '2024–2028',
        division: 'Division A',
        semester: 5,
      });

      res.status(201).json({ department: dept, state: campusStore.getScopedStateForUser(req.currentUser!) });
    }
  );

  // Admin: Provision Faculty or Operator account
  app.post(
    '/api/staff',
    requireAuth,
    requireRoles(Role.COLLEGE_ADMIN, Role.SUPER_ADMIN),
    (req: AuthenticatedRequest, res) => {
      const firstName = typeof req.body?.firstName === 'string' ? req.body.firstName.trim() : '';
      const lastName = typeof req.body?.lastName === 'string' ? req.body.lastName.trim() : '';
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const role = req.body?.role as Role;
      const departmentId = typeof req.body?.departmentId === 'string' ? req.body.departmentId : 'dept-cse';

      if (!firstName || !lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: 'First name, last name, and valid institutional email are required.' });
        return;
      }

      if (role !== Role.FACULTY && role !== Role.OPERATOR) {
        res.status(400).json({ error: 'Role must be Faculty or Operator.' });
        return;
      }

      if (campusStore.users.some((u) => u.email.toLowerCase() === email)) {
        res.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }

      const newUser = {
        id: `user-${crypto.randomUUID().slice(0, 8)}`,
        institutionId: campusStore.institution.id,
        departmentId,
        email,
        passwordHash: hashPassword('CampusPulse@2026'),
        role,
        firstName,
        lastName,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      campusStore.users.push(newUser);

      res.status(201).json({
        user: campusStore.toPublicUser(newUser),
        state: campusStore.getScopedStateForUser(req.currentUser!),
      });
    }
  );

  // Monthly Matrix CSV Export
  app.get(
    '/api/reports/csv',
    requireAuth,
    requireRoles(Role.COLLEGE_ADMIN, Role.SUPER_ADMIN, Role.FACULTY, Role.OPERATOR),
    (req: AuthenticatedRequest, res) => {
      const year = Number(req.query.year) || 2026;
      const month = Number(req.query.month) || 11;
      const batchId = typeof req.query.batchId === 'string' ? req.query.batchId : 'batch-cse-24a';
      const courseId = typeof req.query.courseId === 'string' ? req.query.courseId : 'ALL';

      const batchStudents = campusStore.students.filter((s) => s.batchId === batchId);
      const csv = buildMonthlyMatrixCsv(
        batchStudents,
        campusStore.sessions,
        campusStore.records,
        year,
        month,
        courseId
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="tcer-attendance-${year}-${String(month).padStart(2, '0')}.csv"`
      );
      res.send(csv);
    }
  );

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`CampusPulse server listening on http://localhost:${port}`);
  });
}

startServer();
