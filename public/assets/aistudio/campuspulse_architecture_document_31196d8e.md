# CampusPulse — Modern College Attendance & Academic Intelligence Platform
## Product Requirements Document (PRD), Technical Requirements Document (TRD), and System Design Specification

---

## 1. Executive Summary & Value Proposition

### 1.1 Problem Statement
Legacy University Enterprise Resource Planning (ERP) systems (e.g., SAP, Ellucian, proprietary legacy systems) cost higher-education institutions tens of thousands of dollars annually in licensing, maintenance, and training. Despite high costs, these systems suffer from outdated user interfaces, slow manual attendance workflows, complex multi-click record correction steps, and poor mobile accessibility for both faculty and students.

### 1.2 The CampusPulse Solution
**CampusPulse** is a lightweight, high-performance, modular Attendance & Academic Intelligence Platform designed specifically for colleges and universities. It serves as a zero-friction, zero-license-bloat replacement for traditional ERP attendance modules:
- **Zero ERP Overhead:** Built to run as a sleek SaaS or self-hosted institution platform.
- **One-Tap Attendance Marking:** Designed for touch interfaces—faculty can mark an entire class in under 15 seconds.
- **Instant Error Correction:** Faculty and operators can adjust attendance records with a single tap, backed by an immutable audit trail.
- **Automated Student Onboarding:** Automated transactional emails issue credentials to students instantly upon enrollment.
- **Defaulter & Safety Analytics:** Real-time calculation of student eligibility ($<75\%$ threshold alerts and "Safe-Bunk / Attendance Recovery" prediction metrics).

---

## 2. Product Requirements Document (PRD)

### 2.1 User Roles & Access Control (RBAC)

| Role | Primary Responsibilities | Key UI Views |
| :--- | :--- | :--- |
| **College / Super Admin** | Manages institution configuration, departments, courses, semester cycles, creates Teacher & Operator accounts, views macro institution analytics. | Admin Command Center, User Provisioning, Audit Log Vault, Global Defaulter Matrix |
| **Teacher / Faculty** | Creates/Manages student rosters, marks daily attendance, rectifies marking errors, monitors class analytics, exports monthly compliance sheets. | Faculty Workspace, One-Tap Attendance Grid, Quick-Edit Portal, Class Defaulter Panel |
| **Operator / Staff** | Performs bulk student onboarding, handles institutional leave entries, administrative attendance corrections. | Data Management Portal, Bulk Action Suite, System Log Viewer |
| **Student** | Views personal attendance metrics, monthly heatmap calendar, course-wise breakdowns, safe-bunk recovery suggestions. | Student Dashboard, Monthly Heatmap, Course Pulse Card, Recovery Predictor |

---

### 2.2 Core Functional Requirements

#### F-1: Unified Public Landing Page (`CampusPulse`)
- **Visual Style:** Ultra-modern dark modern aesthetic with smooth micro-interactions, Bento-grid feature highlights, live ROI calculator (Savings vs Legacy ERPs), interactive demo preview, and role-based login portal.
- **Role Routing:** A clean modal allowing direct login access for **College Admin**, **Faculty / Operator**, and **Student**.

#### F-2: Multi-Tier Account Setup & Email Onboarding Trigger
- **College Setup:** College Admin sets up Departments (e.g., *Computer Science & Engineering*), Batches (e.g., *2024–2028*), and Divisions (e.g., *Section A*).
- **Teacher & Operator Creation:** Admin creates credentials for faculty members with assigned subjects and divisions.
- **Automated Student Provisioning:**
  1. Teacher/Operator adds students individually or via bulk `.csv` import (Roll No, Name, Email, Division).
  2. System automatically generates a unique temporary password and securely dispatches an onboarding email via Nodemailer / Resend API.
  3. Email contains: College Name, Student ID, Temporary Password, and a direct activation link (`/login?activate=token`).

#### F-3: One-Tap Daily Attendance Engine
- **Quick Selection:** Teacher selects Department $\rightarrow$ Semester $\rightarrow$ Course $\rightarrow$ Division $\rightarrow$ Lecture Date & Time Slot.
- **Interactive Grid UI:**
  - Default status set to **Present** (Green) or **Unmarked**.
  - Single tap toggles state: **Present ($P$)** $\rightarrow$ **Absent ($A$)** $\rightarrow$ **Late ($L$)**.
  - **"Mark All Present"** master toggle button.
  - Search bar for quick filtering by student name or roll number during live attendance call.
- **Submission:** One-click batch submission with visual success confirmation and immediate database sync.

#### F-4: Mistake Correction & Audit Trail Engine
- **Instant Correction Modal:** Faculty can select any historical date and reopen the attendance sheet.
- **Time-Window Policy:** Direct inline edit allowed within 48 hours; post-48 hours requires an administrative note/reason submission.
- **Audit Logging:** System logs every correction: `[User ID, Timestamp, Old Status, New Status, Reason]`.

#### F-5: Defaulter Analytics & 75% Recovery Predictor
- **1-Tap Defaulter List:** Instant filter on Admin & Teacher dashboards isolating all students whose cumulative attendance falls below $75\%$.
- **Student Recovery Math:** Displays exact actionable metrics on the Student Dashboard:
  - If current attendance $< 75\%$: *“Attend next $N$ consecutive classes to reach 75%.”*
  - If current attendance $\ge 75\%$: *“You can safely miss $M$ classes and remain above 75%.”*
  
  $$\text{Current \%} = \left( \frac{\text{Classes Attended}}{\text{Total Conducted}} \right) \times 100$$
  $$\text{Classes Needed to Reach 75\%} = \lceil 3 \times \text{Total Conducted} - 4 \times \text{Classes Attended} \rceil$$

#### F-6: Total Monthly Data Export Suite
- **Monthly Matrix CSV:** 30/31-day horizontal grid ($1 \dots 31$) showing individual daily status ($P/A/L$), total attended, total held, and cumulative percentage.
- **Official Print PDF Register:** Clean `@media print` layout featuring college logo, department header, monthly grid, faculty signature block, and official seal space.

---

## 3. Technical Requirements Document (TRD) & System Architecture

### 3.1 Tech Stack Specification

```
                          ┌──────────────────────────────────────────┐
                          │         CampusPulse Frontend             │
                          │   Next.js 14 (App Router) + React 18     │
                          │   Tailwind CSS + Framer Motion           │
                          │   Shadcn UI + Lucide Icons + Recharts    │
                          └────────────────────┬─────────────────────┘
                                               │ (REST API / Server Actions)
                                               ▼
                          ┌──────────────────────────────────────────┐
                          │          CampusPulse API Server          │
                          │        Node.js / Express or NestJS       │
                          │    JWT Authentication + RBAC Middleware  │
                          └──────┬───────────────────┬───────────────┘
                                 │                   │
             ┌───────────────────┴──┐             ┌──┴──────────────────┐
             ▼                      ▼             ▼                     ▼
┌─────────────────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐
│  PostgreSQL (Primary)   │  │ Redis Cache  │  │ Resend API   │  │ Puppeteer / │
│  Prisma ORM Data Model  │  │ Session/Jobs │  │ Email Engine │  │ PDF Builder │
└─────────────────────────┘  └──────────────┘  └──────────────┘  └─────────────┘
```

#### Frontend Architecture
- **Framework:** Next.js 14+ (React 18, App Router, TypeScript)
- **Styling:** Tailwind CSS v3.4+, CSS Variables, Custom Bento-Grid System
- **Icons & UI Components:** Lucide-React, Radix UI Primitives / Shadcn UI
- **State Management & Data Fetching:** TanStack Query (React Query v5) + Zustand
- **Visualization:** Recharts (Analytics, Attendance trends, Defaulter distributions)

#### Backend Architecture
- **Runtime & Language:** Node.js (v20 LTS), TypeScript
- **Framework:** Express.js or NestJS with RESTful JSON endpoints
- **Database & ORM:** PostgreSQL 16 with Prisma ORM
- **Cache & Queue:** Redis + BullMQ (Handles asynchronous email queuing for bulk onboarding)
- **Email Service:** Resend API / Nodemailer over SMTP
- **PDF Generation:** React-PDF (`@react-pdf/renderer`) or Client-side Print Engine

---

### 3.2 Directory & File Structure

```text
campuspulse/
├── apps/
│   ├── web/                           # Next.js Frontend Application
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── page.tsx           # Public Landing Page (CampusPulse)
│   │   │   │   ├── login/
│   │   │   │   │   └── page.tsx       # Universal Role-Based Login
│   │   │   │   ├── admin/             # College Super Admin Portal
│   │   │   │   │   ├── page.tsx       # Admin Dashboard Analytics
│   │   │   │   │   ├── users/         # Manage Teachers & Operators
│   │   │   │   │   └── departments/   # Manage Classes & Batches
│   │   │   │   ├── faculty/           # Teacher / Faculty Portal
│   │   │   │   │   ├── page.tsx       # Faculty Command Center
│   │   │   │   │   ├── mark/          # One-Tap Attendance Sheet
│   │   │   │   │   ├── students/      # Add/Manage Students + Resend Credentials
│   │   │   │   │   └── reports/       # Monthly Matrix & Defaulter List
│   │   │   │   └── student/           # Student Portal
│   │   │   │       ├── page.tsx       # Student Analytics & Predictor
│   │   │   │       └── history/       # Monthly Heatmap & Logs
│   │   │   ├── components/
│   │   │   │   ├── landing/           # Landing page UI components
│   │   │   │   ├── dashboard/         # Bento Grid cards, metrics widgets
│   │   │   │   ├── attendance/        # One-tap marking toggle, Edit modal
│   │   │   │   └── UI/                # Buttons, Modals, Badges, Inputs
│   │   │   ├── lib/                   # API clients, utilities, PDF generators
│   │   │   └── styles/                # Global CSS & Design Tokens
│   └── api/                           # Backend Server (Node.js/Express)
│       ├── src/
│       │   ├── controllers/           # Auth, Attendance, Analytics, Users
│       │   ├── middleware/            # Auth Guard, RBAC Validator, Audit Logger
│       │   ├── services/              # Email Service, Predictor Engine, Export Engine
│       │   └── routes/                # System Route Handlers
├── prisma/
│   └── schema.prisma                  # PostgreSQL Database Schema
├── docker-compose.yml                 # Local Dev Environment (PostgreSQL + Redis)
└── README.md
```

---

## 4. Database Schema Specification (Prisma / PostgreSQL)

```prisma
// ==========================================
// CampusPulse Complete PostgreSQL Schema
// ==========================================

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  SUPER_ADMIN
  COLLEGE_ADMIN
  FACULTY
  OPERATOR
  STUDENT
}

enum AttendanceStatus {
  PRESENT
  ABSENT
  LATE
  EXCUSED
}

model Institution {
  id          String       @id @default(uuid())
  name        String
  code        String       @unique
  logoUrl     String?
  address     String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  departments Department[]
  users       User[]
}

model Department {
  id            String       @id @default(uuid())
  institutionId String
  institution   Institution  @relation(fields: [institutionId], references: [id], onDelete: Cascade)
  name          String
  code          String
  courses       Course[]
  batches       Batch[]
  users         User[]
  createdAt     DateTime     @default(now())
}

model Batch {
  id           String     @id @default(uuid())
  departmentId String
  department   Department @relation(fields: [departmentId], references: [id], onDelete: Cascade)
  name         String     // e.g., "2024-2028"
  division     String     // e.g., "Section A"
  students     StudentProfile[]
  createdAt    DateTime   @default(now())
}

model User {
  id             String          @id @default(uuid())
  institutionId  String
  institution    Institution     @relation(fields: [institutionId], references: [id], onDelete: Cascade)
  departmentId   String?
  department     Department?     @relation(fields: [departmentId], references: [id])
  email          String          @unique
  passwordHash   String
  role           Role            @default(STUDENT)
  firstName      String
  lastName       String
  phoneNumber    String?
  isActive       Boolean         @default(true)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  
  studentProfile StudentProfile?
  facultyCourses Course[]        @relation("FacultyCourses")
  markedSessions AttendanceSession[] @relation("SessionMarkedBy")
  auditLogs      AttendanceAuditLog[]
}

model StudentProfile {
  id           String             @id @default(uuid())
  userId       String             @unique
  user         User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  rollNumber   String             @unique
  batchId      String
  batch        Batch              @relation(fields: [batchId], references: [id])
  guardianMail String?
  attendance   AttendanceRecord[]
  createdAt    DateTime           @default(now())
}

model Course {
  id           String              @id @default(uuid())
  departmentId String
  department   Department          @relation(fields: [departmentId], references: [id], onDelete: Cascade)
  code         String
  name         String
  credits      Int                 @default(3)
  faculty      User[]              @relation("FacultyCourses")
  sessions     AttendanceSession[]
  createdAt    DateTime            @default(now())
}

model AttendanceSession {
  id          String             @id @default(uuid())
  courseId    String
  course      Course             @relation(fields: [courseId], references: [id], onDelete: Cascade)
  markedById  String
  markedBy    User               @relation("SessionMarkedBy", fields: [markedById], references: [id])
  date        DateTime           @db.Date
  slot        String             // e.g., "09:00 AM - 10:00 AM"
  topic       String?
  records     AttendanceRecord[]
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt
}

model AttendanceRecord {
  id         String             @id @default(uuid())
  sessionId  String
  session    AttendanceSession  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  studentId  String
  student    StudentProfile     @relation(fields: [studentId], references: [id], onDelete: Cascade)
  status     AttendanceStatus   @default(PRESENT)
  remarks    String?
  createdAt  DateTime           @default(now())
  updatedAt  DateTime           @updatedAt
  auditLogs  AttendanceAuditLog[]

  @@unique([sessionId, studentId])
}

model AttendanceAuditLog {
  id         String           @id @default(uuid())
  recordId   String
  record     AttendanceRecord @relation(fields: [recordId], references: [id], onDelete: Cascade)
  changedById String
  changedBy  User             @relation(fields: [changedById], references: [id])
  oldStatus  AttendanceStatus
  newStatus  AttendanceStatus
  reason     String
  timestamp  DateTime         @default(now())
}
```

---

## 5. UI/UX Design System Specifications

### 5.1 Design Tokens & Theme Foundations

```css
:root {
  /* CampusPulse Brand Palette */
  --bg-primary: #0B0F17;        /* Deep Obsidian Navy */
  --bg-surface: #131A26;        /* Dark Glassmorphic Card */
  --bg-surface-border: #1E293B; /* Subtle Structural Border */
  
  --accent-blue: #3B82F6;       /* Vibrant Electric Blue */
  --accent-cyan: #06B6D4;       /* High-contrast Cyan Highlight */
  
  /* Attendance Status Indicators */
  --status-present: #10B981;    /* Emerald Green */
  --status-absent: #EF4444;     /* Crimson Red */
  --status-late: #F59E0B;       /* Amber Orange */
  --status-defaulter: #DC2626;  /* Deep Alert Crimson */

  /* Typography Fonts */
  --font-sans: 'Plus Jakarta Sans', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

### 5.2 Layout Architecture & Component Specs

#### 1. Public Landing Page (`CampusPulse`)
- **Hero Section:** Sleek typography header: *"The Intelligent Attendance & Academic Operations Platform for Modern Higher Education."* Dual CTA buttons: `Launch Interactive Demo` and `Sign In to Portal`.
- **Bento Grid Layout:**
  - *Card 1 (One-Tap Speed):* Interactive micro-widget simulating live attendance marking in under 3 seconds.
  - *Card 2 (ERP Savings Calculator):* Dynamic slider calculating yearly budget savings by switching from traditional ERPs to CampusPulse.
  - *Card 3 (Automated Onboarding):* Visual representation of real-time student email dispatch.
  - *Card 4 (Safety Predictor):* Live preview of the "Safe-Bunk" calculator.

#### 2. Faculty One-Tap Marking Matrix
- **Top Bar:** Quick selector for Course, Division, and Date/Time slot + `Mark All Present` master switch.
- **Student Cards / Row Layout:**
  - Large, touch-friendly status pill (`PRESENT`, `ABSENT`, `LATE`).
  - Haptic-style color animations on click: Green (Present) $\rightarrow$ Red (Absent) $\rightarrow$ Orange (Late).
  - Floating bottom bar showing current count: `Present: 42 | Absent: 4 | Defaulter Warnings: 2` with a prominent `Submit Session` button.

#### 3. Student Dashboard & Heatmap Calendar
- **Hero Metric Bento Grid:**
  - *Overall Attendance Rate:* Large radial gauge ($84.2\%$).
  - *Recovery Predictor Box:* Highlighted in green or amber based on threshold status.
  - *Total Classes Breakdown:* Attended vs Total Conducted.
- **Monthly Heatmap Grid:**
  - GitHub-style 30-day calendar matrix.
  - Color-coded days: Green (Attended all classes), Red (Missed 1 or more classes), Amber (Late), Gray (No scheduled classes / Holiday).

---

## 6. Implementation Prompts for Development

Use these focused prompts to generate the complete code for each module step-by-step.

```text
================================================================================
PROMPT 1: LANDING PAGE & UNIVERSAL LOGIN (CampusPulse)
================================================================================
Act as a Principal Frontend Engineer. Build the single-page Landing Page & Universal Login Modal for "CampusPulse" using Next.js 14, Tailwind CSS, Lucide Icons, and Framer Motion.

Design Guidelines:
- Aesthetic: Deep obsidian dark theme (#0B0F17) with glassmorphic cards, crisp typography (Plus Jakarta Sans), and subtle electric blue glows.
- Hero Section: Headline "Say Goodbye to Clunky ERPs. Welcome to One-Tap Campus Intelligence."
- Feature Bento Grid: Highlight One-Tap Attendance, Auto Student Email Onboarding, 75% Safe-Bunk Calculator, and Real-Time Defaulter Analytics.
- Role-Based Login Modal: Tabbed navigation for (1) College Admin, (2) Faculty / Operator, and (3) Student.
- Implement realistic mock authentication state switching to preview respective dashboard states. Ensure responsive layout and fluid transitions.
```

```text
================================================================================
PROMPT 2: FACULTY ONE-TAP MARKING SHEET & EDIT CORRECTION ENGINE
================================================================================
Act as a Senior Full-Stack Engineer. Create the Faculty Attendance Marking Page and Correction Engine (`/faculty/mark`).

Requirements:
1. Header Bar: Dropdowns for Subject, Division, Date Picker, and a "Mark All Present" button.
2. Attendance Grid: Render student list with Roll No, Name, and a 3-State Toggle Pill (Present -> Absent -> Late).
3. Tap Logic: Toggling changes color immediately (Emerald -> Crimson -> Amber) with animated visual feedback.
4. Correction Modal: Click on any past record to open an "Edit Attendance" dialog requiring a reason input and updating the immutable audit record.
5. Real-Time Counter: Floating bottom bar displaying real-time tally of Present, Absent, and Defaulters in the batch.
```

```text
================================================================================
PROMPT 3: STUDENT DASHBOARD & RECOVERY PREDICTOR
================================================================================
Act as a UI/UX & Frontend Specialist. Build the Student Attendance Portal (`/student`).

Requirements:
1. Overview Cards: Show Overall Attendance %, Total Attended / Conducted, and Course-Wise Progress Bars.
2. 75% Recovery & Safe-Bunk Predictor:
   - Dynamic widget calculating exact classes needed if attendance < 75% OR safe classes to miss if >= 75%.
3. Monthly Heatmap Calendar:
   - 30-day GitHub-style calendar grid color-coded by daily attendance status. Hovering a day shows detailed lecture logs.
4. Download Report CTA: Button to generate a printable monthly report.
```

```text
================================================================================
PROMPT 4: AUTOMATED EMAIL ONBOARDING SERVICE & DATA EXPORT ENGINE
================================================================================
Act as a Backend Specialist. Build the Node.js / Express service functions for:
1. Automated Student Onboarding Email:
   - Function `sendStudentCredentials(studentData)` using Resend/Nodemailer.
   - Generates clean HTML template with Student Roll No, Temporary Password, and Activation Link.
2. Monthly Matrix CSV Exporter:
   - Generates a horizontal CSV matrix of days 1 to 31 for a given batch and month.
3. Printable PDF Register Layout:
   - Provides `@media print` CSS and HTML template for clean A4 monthly attendance printouts.
```

---

## 7. Verification & Compliance Checklist

- [x] **Zero ERP License Dependency:** Modular standalone operational platform.
- [x] **RBAC Matrix:** Clear role separation across Admin, Faculty, Operator, and Student.
- [x] **Automated Student Credentials Dispatch:** Integrated email trigger workflow.
- [x] **One-Tap Marking & Historical Correction:** Fast touch grid with full audit trails.
- [x] **1-Tap Defaulter & Recovery Math:** Explicit $75\%$ logic and safe-bunk formula.
- [x] **Monthly Matrix Export:** Comprehensive CSV & PDF register layout specs.
- [x] **Bespoke UI/UX Specifications:** Obsidian glassmorphic design system and tokens.