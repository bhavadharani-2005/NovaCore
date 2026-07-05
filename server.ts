import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// In production, server runs from dist-server/, so go up one level to find data/
const PROJECT_ROOT = process.env.NODE_ENV === 'production' 
  ? path.resolve(__dirname, '..') 
  : __dirname;
const DB_PATH = path.join(PROJECT_ROOT, 'data', 'db.json');

// Helper to read and write database
function readDb(): any {
  try {
    if (!fs.existsSync(DB_PATH)) {
      // Create directories if they don't exist
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      fs.writeFileSync(DB_PATH, JSON.stringify({ users: [], departments: [] }, null, 2));
    }
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading DB:', error);
    return { users: [], departments: [] };
  }
}

function writeDb(data: any) {
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing DB:', error);
  }
}

// Lazy initialization of Gemini API Client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in the application environment.');
    }
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return geminiClient;
}

// Simple JWT-like Session Token Utility
function generateToken(user: any): string {
  const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
  const base64Str = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `novacore_jwt_${base64Str}_sig`;
}

function decodeToken(token: string): any {
  try {
    if (!token || !token.startsWith('novacore_jwt_')) return null;
    const base64Part = token.split('_')[2];
    if (!base64Part) return null;
    const jsonStr = Buffer.from(base64Part, 'base64').toString('utf-8');
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

// Middleware for authentication and RBAC
interface AuthenticatedRequest extends Request {
  user?: any;
}

function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authorization token missing.' });
  }

  const payload = decodeToken(token);
  if (!payload) {
    return res.status(403).json({ message: 'Invalid or expired authorization token.' });
  }

  const db = readDb();
  const user = db.users.find((u: any) => u.id === payload.id);
  if (!user) {
    return res.status(403).json({ message: 'User associated with token no longer exists.' });
  }

  req.user = user;
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // ---- API ROUTES ----

  // 1. Auth Login
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const db = readDb();
    const user = db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());

    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials. Please try again.' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        department: user.department,
        year: user.year,
        semester: user.semester,
        regNo: user.regNo,
        avatar: user.avatar,
        attendancePercentage: user.attendancePercentage || 90,
        codingProgress: user.codingProgress || 50
      }
    });
  });

  // 2. Auth Profile
  app.get('/api/auth/profile', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.user });
  });

  // 3. Departments
  app.get('/api/departments', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    res.json({ departments: db.departments || [] });
  });

  app.post('/api/departments', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden. Admin privileges required.' });
    }
    const { name, code, description } = req.body;
    if (!name || !code) {
      return res.status(400).json({ message: 'Department name and code are required.' });
    }

    const db = readDb();
    const newDept = {
      id: `d-${Date.now()}`,
      name,
      code,
      description: description || ''
    };
    db.departments = db.departments || [];
    db.departments.push(newDept);
    writeDb(db);

    // log activity
    db.activityLogs = db.activityLogs || [];
    db.activityLogs.push({
      id: `l-${Date.now()}`,
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      action: `Created department: ${name} (${code})`,
      timestamp: new Date().toISOString()
    });
    writeDb(db);

    res.status(201).json({ department: newDept });
  });

  // 4. Subjects
  app.get('/api/subjects', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    const { departmentId, year, semester } = req.query;
    let list = db.subjects || [];

    if (departmentId) list = list.filter((s: any) => s.departmentId === departmentId);
    if (year) list = list.filter((s: any) => s.year === parseInt(year as string));
    if (semester) list = list.filter((s: any) => s.semester === parseInt(semester as string));

    res.json({ subjects: list });
  });

  app.post('/api/subjects', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden. Admin privileges required.' });
    }
    const { name, code, departmentId, year, semester } = req.body;
    if (!name || !code || !departmentId || !year || !semester) {
      return res.status(400).json({ message: 'All subject fields are required.' });
    }

    const db = readDb();
    const newSubject = {
      id: `s-${Date.now()}`,
      name,
      code,
      departmentId,
      year: parseInt(year),
      semester: parseInt(semester)
    };
    db.subjects = db.subjects || [];
    db.subjects.push(newSubject);
    writeDb(db);

    res.status(201).json({ subject: newSubject });
  });

  // 5. Users and Bulk Import
  app.get('/api/users', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    const { role, department } = req.query;
    let list = db.users || [];

    if (role) list = list.filter((u: any) => u.role === role);
    if (department) list = list.filter((u: any) => u.department === department);

    // Sanitize passwords
    const sanitized = list.map(({ password, ...u }: any) => u);
    res.json({ users: sanitized });
  });

  app.post('/api/users', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden. Admin privileges required.' });
    }
    const { email, password, role, name, department, year, semester, regNo } = req.body;
    if (!email || !password || !role || !name) {
      return res.status(400).json({ message: 'Name, email, password, and role are required.' });
    }

    const db = readDb();
    if (db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    const newUser = {
      id: `u-${Date.now()}`,
      email,
      password,
      role,
      name,
      department: department || 'All',
      year: year ? parseInt(year) : 0,
      semester: semester ? parseInt(semester) : 0,
      regNo: regNo || `REG-${Math.floor(1000 + Math.random() * 9000)}`,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
      attendancePercentage: 95.0,
      codingProgress: 0
    };

    db.users.push(newUser);
    writeDb(db);

    res.status(201).json({ user: newUser });
  });

  app.post('/api/users/bulk-import', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden. Admin privileges required.' });
    }
    const { users } = req.body; // Expect an array of objects
    if (!users || !Array.isArray(users)) {
      return res.status(400).json({ message: 'Invalid bulk import payload. Expected users array.' });
    }

    const db = readDb();
    const imported: any[] = [];
    const errors: string[] = [];

    users.forEach((item: any, idx: number) => {
      const { name, email, role, department, year, semester } = item;
      if (!name || !email || !role) {
        errors.push(`Row ${idx + 1}: Name, email, and role are required.`);
        return;
      }

      if (db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
        errors.push(`Row ${idx + 1}: Email ${email} is already registered.`);
        return;
      }

      // Auto generate credentials
      const cleanName = name.replace(/\s+/g, '').toLowerCase();
      const generatedPassword = `${cleanName}123`;
      const generatedReg = `${role === 'student' ? '23' : 'ST'}${department ? department.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() : 'GEN'}${Math.floor(100 + Math.random() * 900)}`;

      const newUser = {
        id: `u-bulk-${Date.now()}-${idx}`,
        email: email.toLowerCase(),
        password: generatedPassword,
        role,
        name,
        department: department || 'General',
        year: year ? parseInt(year) : 0,
        semester: semester ? parseInt(semester) : 0,
        regNo: generatedReg,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
        attendancePercentage: 100.0,
        codingProgress: 0
      };

      db.users.push(newUser);
      imported.push(newUser);
    });

    writeDb(db);

    // log activity
    db.activityLogs = db.activityLogs || [];
    db.activityLogs.push({
      id: `l-${Date.now()}`,
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      action: `Bulk imported ${imported.length} users successfully.`,
      timestamp: new Date().toISOString()
    });
    writeDb(db);

    res.json({ successCount: imported.length, errors, imported });
  });

  // Delete User
  app.delete('/api/users/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden. Admin privileges required.' });
    }
    const db = readDb();
    const initialLen = db.users.length;
    db.users = db.users.filter((u: any) => u.id !== req.params.id);

    if (db.users.length === initialLen) {
      return res.status(404).json({ message: 'User not found.' });
    }

    writeDb(db);
    res.json({ message: 'User deleted successfully.' });
  });

  // 6. Materials API
  app.get('/api/materials', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    let list = db.materials || [];

    // Students only see matching department/semester (or general)
    if (req.user.role === 'student') {
      list = list.filter((m: any) =>
        m.departmentId === 'all' ||
        (m.departmentId === 'd-aids' && req.user.department === 'AI & DS') ||
        (m.departmentId === 'd-aiml' && req.user.department === 'AI & ML') ||
        m.semester === req.user.semester
      );
    }

    res.json({ materials: list });
  });

  app.post('/api/materials', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden. Only Staff and Admins can upload materials.' });
    }
    const { title, type, subjectId, departmentId, year, semester, fileUrl, fileType } = req.body;
    if (!title || !type || !subjectId) {
      return res.status(400).json({ message: 'Title, type, and subject are required.' });
    }

    const db = readDb();
    const newMaterial = {
      id: `m-${Date.now()}`,
      title,
      type,
      subjectId,
      departmentId: departmentId || 'all',
      year: year ? parseInt(year) : 1,
      semester: semester ? parseInt(semester) : 1,
      fileUrl: fileUrl || '#',
      fileType: fileType || 'pdf',
      uploadedBy: req.user.name,
      uploadedAt: new Date().toISOString(),
      views: 0
    };

    db.materials = db.materials || [];
    db.materials.push(newMaterial);

    // Create notifications for students in matching criteria
    const students = db.users.filter((u: any) => u.role === 'student' &&
      (u.department === departmentId || departmentId === 'all') &&
      u.semester === parseInt(semester)
    );

    students.forEach((stud: any) => {
      db.notifications = db.notifications || [];
      db.notifications.push({
        id: `n-${Date.now()}-${stud.id}`,
        userId: stud.id,
        title: 'New Study Material Uploaded',
        message: `${req.user.name} uploaded '${title}' under ${type}.`,
        type: 'material',
        read: false,
        createdAt: new Date().toISOString()
      });
    });

    writeDb(db);
    res.status(201).json({ material: newMaterial });
  });

  app.delete('/api/materials/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    const db = readDb();
    db.materials = (db.materials || []).filter((m: any) => m.id !== req.params.id);
    writeDb(db);
    res.json({ message: 'Material deleted successfully.' });
  });

  // 7. Assignments API
  app.get('/api/assignments', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    let list = db.assignments || [];

    if (req.user.role === 'student') {
      // Filter for student's department & semester
      const studentDept = db.departments.find((d: any) => d.code === req.user.department);
      list = list.filter((a: any) =>
        (a.departmentId === studentDept?.id || a.departmentId === 'all') &&
        a.semester === req.user.semester
      );
    }

    res.json({ assignments: list });
  });

  app.post('/api/assignments', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden. Only Staff and Admins can distribute assignments.' });
    }
    const { title, description, subjectId, departmentId, year, semester, deadline, points, criteria, type } = req.body;
    if (!title || !subjectId || !deadline || !points) {
      return res.status(400).json({ message: 'Title, Subject, Deadline, and Points are required.' });
    }

    const db = readDb();
    const newAssignment = {
      id: `a-${Date.now()}`,
      title,
      description: description || '',
      subjectId,
      departmentId: departmentId || 'all',
      year: year ? parseInt(year) : 1,
      semester: semester ? parseInt(semester) : 1,
      deadline,
      points: parseInt(points),
      criteria: criteria || 'General Submission quality',
      type: type || 'assignment'
    };

    db.assignments = db.assignments || [];
    db.assignments.push(newAssignment);

    // Notify matching students
    const targetDept = db.departments.find((d: any) => d.id === departmentId);
    const targetDeptCode = targetDept ? targetDept.code : '';

    const targetStudents = db.users.filter((u: any) => u.role === 'student' &&
      (u.department === targetDeptCode || departmentId === 'all') &&
      u.semester === parseInt(semester)
    );

    targetStudents.forEach((stud: any) => {
      db.notifications = db.notifications || [];
      db.notifications.push({
        id: `n-${Date.now()}-${stud.id}`,
        userId: stud.id,
        title: 'New Assignment Distributed',
        message: `An assignment '${title}' has been uploaded. Due: ${new Date(deadline).toLocaleDateString()}`,
        type: 'assignment',
        read: false,
        createdAt: new Date().toISOString()
      });
    });

    writeDb(db);
    res.status(201).json({ assignment: newAssignment });
  });

  app.delete('/api/assignments/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    const db = readDb();
    db.assignments = (db.assignments || []).filter((a: any) => a.id !== req.params.id);
    db.submissions = (db.submissions || []).filter((s: any) => s.assignmentId !== req.params.id);
    writeDb(db);
    res.json({ message: 'Assignment deleted.' });
  });

  // 8. Submissions API
  app.get('/api/submissions', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    let list = db.submissions || [];

    if (req.user.role === 'student') {
      list = list.filter((s: any) => s.studentId === req.user.id);
    }

    res.json({ submissions: list });
  });

  app.post('/api/submissions', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can upload submissions.' });
    }
    const { assignmentId, submissionType, fileUrl, fileName, codeProof, certProof } = req.body;
    if (!assignmentId || !submissionType || !fileUrl) {
      return res.status(400).json({ message: 'Assignment, Submission Type, and Resource Link are required.' });
    }

    const db = readDb();
    const existingIdx = (db.submissions || []).findIndex((s: any) => s.assignmentId === assignmentId && s.studentId === req.user.id);

    const newSub = {
      id: existingIdx > -1 ? db.submissions[existingIdx].id : `sub-${Date.now()}`,
      assignmentId,
      studentId: req.user.id,
      studentName: req.user.name,
      submissionType,
      fileUrl,
      fileName: fileName || 'Document Upload',
      submittedAt: new Date().toISOString(),
      status: 'pending',
      marks: null,
      remarks: '',
      codeProof: codeProof || '',
      certProof: certProof || ''
    };

    db.submissions = db.submissions || [];
    if (existingIdx > -1) {
      db.submissions[existingIdx] = newSub;
    } else {
      db.submissions.push(newSub);
    }

    // Increment user coding progress if it's a coding challenge
    const assign = db.assignments.find((a: any) => a.id === assignmentId);
    if (assign && assign.type === 'coding') {
      const studentIdx = db.users.findIndex((u: any) => u.id === req.user.id);
      if (studentIdx > -1) {
        db.users[studentIdx].codingProgress = Math.min(100, (db.users[studentIdx].codingProgress || 0) + 12);
      }
    }

    writeDb(db);
    res.status(201).json({ submission: newSub });
  });

  // Grade Submissions
  app.post('/api/submissions/grade', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden. Staff/Admin privileges required.' });
    }
    const { id, marks, remarks, status } = req.body;
    if (!id || status === undefined) {
      return res.status(400).json({ message: 'Submission ID and Status are required.' });
    }

    const db = readDb();
    db.submissions = db.submissions || [];
    const idx = db.submissions.findIndex((s: any) => s.id === id);
    if (idx === -1) {
      return res.status(404).json({ message: 'Submission record not found.' });
    }

    db.submissions[idx].status = status; // approved / rejected
    db.submissions[idx].marks = marks !== undefined ? parseInt(marks) : null;
    db.submissions[idx].remarks = remarks || '';
    db.submissions[idx].gradedBy = req.user.name;
    db.submissions[idx].gradedAt = new Date().toISOString();

    // Notify student
    db.notifications = db.notifications || [];
    db.notifications.push({
      id: `n-${Date.now()}`,
      userId: db.submissions[idx].studentId,
      title: 'Assignment Graded / Reviewed',
      message: `Your submission for Assignment has been ${status}. Score: ${marks || 'N/A'}. Remarks: "${remarks || ''}"`,
      type: 'marks',
      read: false,
      createdAt: new Date().toISOString()
    });

    writeDb(db);
    res.json({ submission: db.submissions[idx] });
  });

  // 9. Attendance Module
  app.get('/api/attendance', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    let list = db.attendance || [];

    if (req.user.role === 'student') {
      list = list.filter((a: any) => a.studentId === req.user.id);
    }

    res.json({ attendance: list });
  });

  app.post('/api/attendance', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    const { studentId, date, status, period } = req.body;
    if (!studentId || !date || !status) {
      return res.status(400).json({ message: 'Student, Date, and Status are required.' });
    }

    const db = readDb();
    const newRecord = {
      id: `at-${Date.now()}`,
      studentId,
      date,
      status,
      period: period || '1'
    };

    db.attendance = db.attendance || [];
    db.attendance.push(newRecord);

    // Re-calculate attendance percentage for student
    const studentRecords = db.attendance.filter((r: any) => r.studentId === studentId);
    const presentCount = studentRecords.filter((r: any) => r.status === 'present' || r.status === 'late').length;
    const totalCount = studentRecords.length;
    const percentage = totalCount > 0 ? parseFloat(((presentCount / totalCount) * 100).toFixed(1)) : 100.0;

    const studentIdx = db.users.findIndex((u: any) => u.id === studentId);
    if (studentIdx > -1) {
      db.users[studentIdx].attendancePercentage = percentage;

      // Add alert if attendance drops below 75%
      if (percentage < 75.0) {
        db.notifications = db.notifications || [];
        db.notifications.push({
          id: `n-${Date.now()}`,
          userId: studentId,
          title: '⚠️ Attendance Shortage Alert',
          message: `Your attendance has dropped to ${percentage}%. 75% is required for semester examinations eligibility.`,
          type: 'ai',
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    }

    writeDb(db);
    res.status(201).json({ attendance: newRecord, currentPercentage: percentage });
  });

  // Leave Requests
  app.get('/api/leave-requests', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    let list = db.leaveRequests || [];

    if (req.user.role === 'student') {
      list = list.filter((l: any) => l.studentId === req.user.id);
    }

    res.json({ leaveRequests: list });
  });

  app.post('/api/leave-requests', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can request leaves.' });
    }
    const { startDate, endDate, reason } = req.body;
    if (!startDate || !endDate || !reason) {
      return res.status(400).json({ message: 'Start date, end date, and reason are required.' });
    }

    const db = readDb();
    const newRequest = {
      id: `lr-${Date.now()}`,
      studentId: req.user.id,
      studentName: req.user.name,
      startDate,
      endDate,
      reason,
      status: 'pending'
    };

    db.leaveRequests = db.leaveRequests || [];
    db.leaveRequests.push(newRequest);
    writeDb(db);

    res.status(201).json({ leaveRequest: newRequest });
  });

  app.put('/api/leave-requests/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: 'Status is required.' });
    }

    const db = readDb();
    const idx = (db.leaveRequests || []).findIndex((l: any) => l.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    db.leaveRequests[idx].status = status;

    // Notify student
    db.notifications = db.notifications || [];
    db.notifications.push({
      id: `n-${Date.now()}`,
      userId: db.leaveRequests[idx].studentId,
      title: `Leave Request ${status.toUpperCase()}`,
      message: `Your leave request from ${db.leaveRequests[idx].startDate} has been ${status}.`,
      type: 'general',
      read: false,
      createdAt: new Date().toISOString()
    });

    writeDb(db);
    res.json({ leaveRequest: db.leaveRequests[idx] });
  });

  // 10. Placement Module
  app.get('/api/placement/announcements', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    res.json({ announcements: db.placementAnnouncements || [] });
  });

  app.post('/api/placement/announcements', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    const { title, company, description, eligibility, role, salary, date, deadline } = req.body;
    if (!title || !company || !role || !salary) {
      return res.status(400).json({ message: 'Title, Company, Role, and Salary are required.' });
    }

    const db = readDb();
    const newPost = {
      id: `pa-${Date.now()}`,
      title,
      company,
      description: description || '',
      eligibility: eligibility || 'All branch eligible',
      role,
      salary,
      date: date || new Date().toISOString(),
      deadline: deadline || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      applicants: []
    };

    db.placementAnnouncements = db.placementAnnouncements || [];
    db.placementAnnouncements.push(newPost);

    // Create notifications for students
    db.users.filter((u: any) => u.role === 'student').forEach((stud: any) => {
      db.notifications = db.notifications || [];
      db.notifications.push({
        id: `n-${Date.now()}-${stud.id}`,
        userId: stud.id,
        title: `🏢 Placement Drive: ${company}`,
        message: `Microsoft, Google or other partners are looking for ${role} (${salary}). Check eligibility details!`,
        type: 'placement',
        read: false,
        createdAt: new Date().toISOString()
      });
    });

    writeDb(db);
    res.status(201).json({ announcement: newPost });
  });

  app.post('/api/placement/apply', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can apply.' });
    }
    const { announcementId } = req.body;
    if (!announcementId) {
      return res.status(400).json({ message: 'Announcement ID is required.' });
    }

    const db = readDb();
    const postIdx = (db.placementAnnouncements || []).findIndex((pa: any) => pa.id === announcementId);
    if (postIdx === -1) {
      return res.status(404).json({ message: 'Drive announcement not found.' });
    }

    const post = db.placementAnnouncements[postIdx];
    post.applicants = post.applicants || [];
    if (post.applicants.includes(req.user.id)) {
      return res.status(400).json({ message: 'You have already applied to this placement drive.' });
    }

    // Eligibility validation check
    if (req.user.attendancePercentage < 75.0) {
      return res.status(400).json({ message: 'Application rejected: Minimum 75% attendance required for placement drives.' });
    }

    post.applicants.push(req.user.id);
    writeDb(db);

    res.json({ message: 'Applied successfully to drive.', announcement: post });
  });

  // Mock Interviews
  app.get('/api/placement/mock-interviews', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    let list = db.mockInterviews || [];

    if (req.user.role === 'student') {
      list = list.filter((m: any) => m.studentId === req.user.id);
    }

    res.json({ mockInterviews: list });
  });

  app.post('/api/placement/mock-interviews', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    const { studentId, company, date, time } = req.body;
    if (!studentId || !company || !date || !time) {
      return res.status(400).json({ message: 'Student, Company, Date, and Time are required.' });
    }

    const db = readDb();
    const newInterview = {
      id: `mi-${Date.now()}`,
      studentId,
      company,
      date,
      time,
      status: 'scheduled',
      feedback: ''
    };

    db.mockInterviews = db.mockInterviews || [];
    db.mockInterviews.push(newInterview);

    // Notify Student
    db.notifications = db.notifications || [];
    db.notifications.push({
      id: `n-${Date.now()}`,
      userId: studentId,
      title: 'Mock Interview Scheduled',
      message: `Your mock interview with ${company} has been scheduled on ${date} at ${time}.`,
      type: 'placement',
      read: false,
      createdAt: new Date().toISOString()
    });

    writeDb(db);
    res.status(201).json({ mockInterview: newInterview });
  });

  app.put('/api/placement/mock-interviews/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    const { status, feedback } = req.body;
    if (!status) {
      return res.status(400).json({ message: 'Status is required.' });
    }

    const db = readDb();
    const idx = (db.mockInterviews || []).findIndex((mi: any) => mi.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ message: 'Mock interview record not found.' });
    }

    db.mockInterviews[idx].status = status;
    db.mockInterviews[idx].feedback = feedback || '';

    // Notify Student
    db.notifications = db.notifications || [];
    db.notifications.push({
      id: `n-${Date.now()}`,
      userId: db.mockInterviews[idx].studentId,
      title: 'Mock Interview Evaluated',
      message: `Your mock interview with ${db.mockInterviews[idx].company} has been completed. Feedback: "${feedback || 'Keep practicing'}"`,
      type: 'placement',
      read: false,
      createdAt: new Date().toISOString()
    });

    writeDb(db);
    res.json({ mockInterview: db.mockInterviews[idx] });
  });

  // 11. Tickets API
  app.get('/api/tickets', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    let list = db.tickets || [];

    if (req.user.role === 'student') {
      list = list.filter((t: any) => t.studentId === req.user.id);
    } else if (req.user.role === 'staff') {
      // staff can see all escalated tickets
    }

    res.json({ tickets: list });
  });

  app.post('/api/tickets', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can file tickets.' });
    }
    const { subjectId, query } = req.body;
    if (!query) {
      return res.status(400).json({ message: 'Query description is required.' });
    }

    const db = readDb();
    const newTicket = {
      id: `t-${Date.now()}`,
      studentId: req.user.id,
      studentName: req.user.name,
      subjectId: subjectId || 'general',
      query,
      answer: '',
      status: 'escalated',
      createdAt: new Date().toISOString()
    };

    db.tickets = db.tickets || [];
    db.tickets.push(newTicket);
    writeDb(db);

    res.status(201).json({ ticket: newTicket });
  });

  app.put('/api/tickets/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    const { answer } = req.body;
    if (!answer) {
      return res.status(400).json({ message: 'Resolution answer is required.' });
    }

    const db = readDb();
    const idx = (db.tickets || []).findIndex((t: any) => t.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ message: 'Ticket not found.' });
    }

    db.tickets[idx].answer = answer;
    db.tickets[idx].status = 'resolved';
    db.tickets[idx].resolvedBy = req.user.name;
    db.tickets[idx].resolvedAt = new Date().toISOString();

    // Create a notification for the student
    db.notifications = db.notifications || [];
    db.notifications.push({
      id: `n-${Date.now()}`,
      userId: db.tickets[idx].studentId,
      title: '🎟️ Support Ticket Resolved',
      message: `Your support ticket escalated has been resolved by ${req.user.name}: "${answer.slice(0, 60)}..."`,
      type: 'ai',
      read: false,
      createdAt: new Date().toISOString()
    });

    writeDb(db);
    res.json({ ticket: db.tickets[idx] });
  });

  // 12. Notifications API
  app.get('/api/notifications', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    const list = (db.notifications || []).filter((n: any) => n.userId === req.user.id);
    res.json({ notifications: list });
  });

  app.put('/api/notifications/read-all', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    const db = readDb();
    db.notifications = (db.notifications || []).map((n: any) => {
      if (n.userId === req.user.id) {
        return { ...n, read: true };
      }
      return n;
    });
    writeDb(db);
    res.json({ success: true });
  });

  // 13. Institutional Analytics (Admin Dashboard)
  app.get('/api/analytics', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    const db = readDb();
    const studentsCount = db.users.filter((u: any) => u.role === 'student').length;
    const staffCount = db.users.filter((u: any) => u.role === 'staff').length;
    const deptsCount = db.departments.length;
    const materialsCount = (db.materials || []).length;
    const assignmentsCount = (db.assignments || []).length;
    const submissionsCount = (db.submissions || []).length;
    const pendingTicketsCount = (db.tickets || []).filter((t: any) => t.status === 'escalated').length;

    res.json({
      studentsCount,
      staffCount,
      deptsCount,
      materialsCount,
      assignmentsCount,
      submissionsCount,
      pendingTicketsCount,
      activityLogs: (db.activityLogs || []).slice(-15) // last 15 actions
    });
  });

  // Helper to generate simulated AI responses when Gemini API is unavailable
  function getSimulatedResponse(message: string, user: any, db: any, subjectContext: string): string {

    const query = message.toLowerCase();

    // Dynamically retrieve student details if role is student
    const isStudent = user.role === 'student';
    const studentDept = isStudent ? db.departments.find((d: any) => d.code === user.department) : null;
    const currentSubjects = isStudent ? (db.subjects || []).filter((s: any) => s.departmentId === studentDept?.id && s.semester === user.semester) : [];
    const studentArrears = isStudent ? (user.arrears || []) : [];
    const studentInternalMarks = isStudent ? (user.internalMarks || {}) : {};

    // 1. Greetings
    if (query.includes('hello') || query.includes('hi ') || query.includes('hey') || query.includes('greetings') || query.includes('who are you')) {
      return `Hello ${user.name}! I am your NovaCore AI Academic Assistant. 🎓 How can I assist you in your studies today?\n\nAs your AI Coach, I can help you check your **internal marks**, review your **arrears status**, check **placement drive eligibility** (such as Google, Microsoft, Amazon, or Meta), download **course PDFs/lecture notes**, or walk you through coding challenges like CNN/LSTM. What would you like to know?`;
    }

    // 2. Internal Marks Query
    if (query.includes('internal') || query.includes('marks') || query.includes('test') || query.includes('score') || query.includes('grade')) {
      if (!isStudent) {
        return `Hello ${user.name}. As a faculty/admin member, you can view and evaluate student submissions from the Submission Desk tab, or input internal scores. Current database registers ${db.users.filter((u: any) => u.role === 'student').length} active student profiles.`;
      }
      
      let response = `### 📊 Your Internal Marks (Semester ${user.semester})\n\nHere are your current subject internal marks (evaluated out of 55 maximum total points):\n\n`;
      if (Object.keys(studentInternalMarks).length === 0) {
        response += `*No internal marks have been recorded yet for your profile.*`;
      } else {
        Object.entries(studentInternalMarks).forEach(([subjId, m]: [string, any]) => {
          const subj = db.subjects.find((s: any) => s.id === subjId);
          const name = subj ? `${subj.name} (${subj.code})` : subjId;
          response += `- **${name}**:
  - Test 1 (Cycle Test): **${m.test1}/20**
  - Test 2 (Model Test): **${m.test2}/20**
  - Continuous Assessment Assignment: **${m.assignment}/10**
  - Attendance Weightage: **${m.attendance}/5**
  - **Total Internal Score: ${m.total}/55**\n\n`;
        });
        response += `*Note: A minimum of 25/55 internal marks is recommended to comfortably clear the end-semester examinations.*`;
      }
      return response;
    }

    // 3. Arrears / Academic Backlogs Query
    if (query.includes('arrear') || query.includes('backlog') || query.includes('fail') || query.includes('standing')) {
      if (!isStudent) {
        return `As a faculty/admin, you can view student academic details by selecting their profiles in the User Directory.`;
      }

      if (studentArrears.length === 0) {
        return `### 🟢 Academic Standing: Clear\n\nExcellent work, **${user.name}**! You currently have **0 active arrears** (all previous semesters are fully cleared). This keeps your profile in clear standing, making you eligible for top-tier placement opportunities. Keep up the high standard!`;
      } else {
        const arrearsList = studentArrears.map((a: string) => `- **${a}**`).join('\n');
        return `### ⚠️ Academic Standing: Active Arrear Alert\n\nYou currently have **${studentArrears.length} active arrear(s)** on your registry:\n\n${arrearsList}\n\n**AI Coach Recommendation**:\n- Having active arrears will restrict your eligibility for certain premium placement drives (e.g. Google, Amazon, and Meta require "No Active Arrears").\n- We highly recommend downloading the reference materials for these backlog courses from the Library.\n- Consider coordinating with your advisor, **Dr. Kavitha**, to schedule remedial sessions.`;
      }
    }

    // 4. Current Semester Courses / Subjects Query
    if (query.includes('course') || query.includes('subject') || query.includes('class') || query.includes('semester')) {
      if (!isStudent) {
        return `You are logged in as a faculty member for the **${user.department}** department. You are teaching curriculum courses for the current semester.`;
      }

      const subjectList = currentSubjects.map((s: any) => `- **${s.name}** (Code: \`${s.code}\`)`).join('\n');
      return `### 📚 Your Current Semester Courses (Semester ${user.semester})\n\nHere are your registered courses for the current academic session under the **${user.department}** specialty:\n\n${subjectList || '*No subjects registered for this semester*'}\n\n*Would you like me to recommend study notes, or give you the upcoming assignment deadlines for any of these courses?*`;
    }

    // 5. Course PDFs & Study Materials Catalog
    if (query.includes('material') || query.includes('pdf') || query.includes('book') || query.includes('note') || query.includes('library')) {
      const materialsList = (db.materials || []).filter((m: any) => 
        m.departmentId === 'all' || 
        m.departmentId === studentDept?.id || 
        (isStudent && m.semester === user.semester)
      );

      if (materialsList.length === 0) {
        return `### 📖 Study Materials Library\n\nThere are currently no learning resources uploaded for your semester. Please check back later or ask your course staff.`;
      }

      let response = `### 📖 Course PDFs & Reference Documents\n\nHere are the active study materials and course PDFs available in your digital library:\n\n`;
      materialsList.forEach((m: any) => {
        const subj = db.subjects.find((s: any) => s.id === m.subjectId);
        const subjName = subj ? `${subj.name} (${subj.code})` : 'General';
        const fileLink = m.fileUrl !== '#' ? `[Download File](${m.fileUrl})` : '*Link not attached*';
        response += `- **${m.title}** (${m.type.toUpperCase()})
  - Course: *${subjName}*
  - File Format: \`${m.fileType.toUpperCase()}\` | Shared By: *${m.uploadedBy}*
  - Resource Link: ${fileLink}\n\n`;
      });
      return response;
    }

    // 6. Active Assignments and Tasks
    if (query.includes('assignment') || query.includes('task') || query.includes('deadline') || query.includes('homework') || query.includes('submit')) {
      const activeAssignments = (db.assignments || []).filter((a: any) => 
        !isStudent || (a.departmentId === studentDept?.id || a.departmentId === 'all') && a.semester === user.semester
      );

      if (activeAssignments.length === 0) {
        return `### 📝 Tasks & Assignments\n\nThere are no active assignments or homework tasks posted for your courses at the moment.`;
      }

      let response = `### 📝 Your Active Portal Assignments\n\nHere are the distributed course tasks and deadlines for your profile:\n\n`;
      activeAssignments.forEach((a: any) => {
        const isSubmitted = isStudent && (db.submissions || []).some((s: any) => s.assignmentId === a.id && s.studentId === user.id);
        const submission = isSubmitted ? (db.submissions || []).find((s: any) => s.assignmentId === a.id && s.studentId === user.id) : null;
        
        response += `- **${a.title}** (\`${a.type.toUpperCase()}\`)
  - Course Subject ID: \`${a.subjectId.toUpperCase()}\`
  - Deadline: **${new Date(a.deadline).toLocaleString()}**
  - Marks Value: **${a.points} Pts**
  - Grading Criteria: *${a.criteria}*
  - **Status**: ${isSubmitted ? `🟢 **Submitted** (Grade: ${submission.marks !== null ? `${submission.marks}/${a.points}` : 'Pending review'})` : '🔴 **Pending Submission**'}\n\n`;
      });
      return response;
    }

    // 7. Placement Drives & Eligibility Status
    if (query.includes('placement') || query.includes('drive') || query.includes('job') || query.includes('google') || query.includes('microsoft') || query.includes('amazon') || query.includes('meta')) {
      let response = `### 🏢 Training & Placement Cell Drives\n\nWe have several recruitment drives open for registrations in the portal:\n\n`;
      
      (db.placementAnnouncements || []).forEach((p: any) => {
        let eligibilityStatus = '🟢 Eligible to Apply';
        const hasArrearsConstraint = p.eligibility.toLowerCase().includes('no active arrears') || p.eligibility.toLowerCase().includes('no arrears');
        
        if (isStudent) {
          if (user.attendancePercentage < 75.0) {
            eligibilityStatus = '🔴 Ineligible (Attendance below 75%)';
          } else if (hasArrearsConstraint && studentArrears.length > 0) {
            eligibilityStatus = '🔴 Ineligible (Active arrears recorded)';
          }
        }

        response += `- **${p.company} - ${p.title}**
  - Role: **${p.role}** | Package: **${p.salary}**
  - Criteria: *${p.eligibility}*
  - Deadline: **${new Date(p.deadline).toLocaleDateString()}**
  - **Your Eligibility Status**: **${eligibilityStatus}**\n\n`;
      });

      if (isStudent && studentArrears.length > 0) {
        response += `\n*Note: Since you have active arrears, you are eligible for circuit branch drives like Microsoft (no strict backlog constraint listed), but must clear your discrete mathematics backlogs to qualify for Google, Amazon, and Meta drives.*`;
      }
      return response;
    }

    // 8. CNN Image Classification Tips
    if (query.includes('cnn') || query.includes('image classification') || query.includes('cifar')) {
      return `### 📋 Tips for CNN Image Classification (Assignment: AD3601)
To build a highly accurate image classifier for **CIFAR-10** (targeting >85% accuracy):

1. **Architecture & Parameters**:
   - Start with a standard deep architecture (e.g., ResNet18 or a custom 4-layer Conv2D pipeline).
   - Use **Batch Normalization** after each convolutional layer to stabilize learning.
   - Use **Dropout (0.3 - 0.5)** in fully-connected layers to prevent overfitting.
2. **Data Augmentation**:
   - Implement transforms like \`RandomCrop(32, padding=4)\`, \`RandomHorizontalFlip()\`, and \`Normalize((0.5, 0.5, 0.5), (0.5, 0.5, 0.5))\` to improve validation accuracy.
3. **Training & Hyperparameters**:
   - Use Adam optimizer with initial learning rate \`3e-4\`.
   - Apply a learning rate scheduler (e.g., \`ReduceLROnPlateau\` or \`CosineAnnealingLR\`).
   - Run training for at least 25 epochs.

*Reminder: The assignment deadline is July 15th, 2026. Submit your PyTorch/TensorFlow repository link in the Tasks panel.*`;
    }

    // 9. RNN / LSTM Sentiment Analysis Tips
    if (query.includes('rnn') || query.includes('lstm') || query.includes('sentiment')) {
      return `### 📝 RNN/LSTM Sentiment Analysis (Assignment: AD3602)
Here is a conceptual roadmap to implement your Bi-directional LSTM for Movie Reviews:

1. **Text Preprocessing**:
   - Tokenize text data, remove punctuation, and construct a vocabulary map.
   - Use pre-trained embeddings (like GloVe) or learn custom word embeddings in your embedding layer.
   - Pad/truncate sequences to a fixed length (e.g., \`max_length = 150\`).
2. **Model Definition**:
   - Setup a \`nn.LSTM\` block with \`bidirectional=True\`, and \`num_layers=2\`.
   - Pass the final hidden states from both directions into a Linear layer followed by a Sigmoid activation.
3. **Evaluation**:
   - Track Binary Cross-Entropy Loss (\`BCELoss\`) and classification accuracy.

*Warning: The submission is due on July 8th, 2026. The evaluation criteria details 60% for correct PyTorch implementation and 40% for the markdown report. You can ask me to help format your training logs!*`;
    }

    // Default Fallback: summarize their status and ask how to help
    let fallbackText = `Hello ${user.name}! I am your Academic AI Assistant. Here is a summary of your portal status:\n\n`;
    if (isStudent) {
      fallbackText += `- **Attendance**: ${user.attendancePercentage}% (${user.attendancePercentage >= 75 ? '🟢 Eligible for Exams' : '🔴 Shortage Alert'})\n`;
      fallbackText += `- **Arrears**: ${studentArrears.length === 0 ? '🟢 None' : `🔴 ${studentArrears.length} Active`}\n`;
      fallbackText += `- **Coding Track Progress**: ${user.codingProgress}%\n`;
      fallbackText += `- **Current Sem Subjects**:\n`;
      currentSubjects.forEach((s: any) => {
        fallbackText += `  - ${s.name} (${s.code})\n`;
      });
      fallbackText += `\nI can help you review your **internal marks**, check eligibility for Google/Microsoft/Amazon/Meta **placement drives**, retrieve **lecture notes/course PDFs**, or explain DL and ML concepts. What would you like to discuss?`;
    } else {
      fallbackText += `Logged in as: **${user.name}** (Role: \`${user.role.toUpperCase()}\`)\n\nHow can I assist you with portal administration, curriculum management, or reviewing student support tickets?`;
    }

    return fallbackText;
  }

  // 14. Gemini Academic Assistant Chat Endpoint
  app.post('/api/gemini/chat', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const { message, chatHistory, subjectContext, isEscalationRequest } = req.body;
    if (!message) {
      return res.status(400).json({ message: 'Message is required.' });
    }

    // Read DB early so we have it for fallback as well
    const db = readDb();

    // Check if API key is not configured or is a placeholder
    const isApiKeyPlaceholder = !process.env.GEMINI_API_KEY || 
                                process.env.GEMINI_API_KEY.includes('your_actual_gemini') || 
                                process.env.GEMINI_API_KEY.includes('MY_GEMINI');

    if (isApiKeyPlaceholder) {
      console.log('Using local rule-based AI engine fallback (API Key not set up).');
      const responseText = getSimulatedResponse(message, req.user, db, subjectContext);
      
      let ticketId: string | null = null;
      if (isEscalationRequest || responseText.toLowerCase().includes('escalated') || responseText.toLowerCase().includes('support ticket') || responseText.toLowerCase().includes('file a support ticket')) {
        const ticket = {
          id: `t-${Date.now()}`,
          studentId: req.user.id,
          studentName: req.user.name,
          subjectId: subjectContext || 'general',
          query: message,
          answer: '',
          status: 'escalated',
          createdAt: new Date().toISOString()
        };
        db.tickets = db.tickets || [];
        db.tickets.push(ticket);

        // Notify matching faculty members
        const deptCode = req.user.department;
        const matchingStaff = db.users.filter((u: any) => u.role === 'staff' && u.department === deptCode);
        matchingStaff.forEach((st: any) => {
          db.notifications = db.notifications || [];
          db.notifications.push({
            id: `n-${Date.now()}-${st.id}`,
            userId: st.id,
            title: '🎟️ AI Escalation Support Ticket',
            message: `Student ${req.user.name} filed an automated ticket: "${message.slice(0, 50)}..."`,
            type: 'ai',
            read: false,
            createdAt: new Date().toISOString()
          });
        });
        writeDb(db);
        ticketId = ticket.id;
      }

      return res.json({
        response: responseText,
        ticketEscalated: ticketId !== null,
        ticketId
      });
    }

    try {
      // Retrieve the Gemini client dynamically
      const ai = getGeminiClient();

      // Gather matching context for standard RAG
      let materialsSnippet = '';
      if (subjectContext) {
        // Fetch materials for that subject/semester to augment prompt
        const matchingMaterials = (db.materials || []).filter((m: any) => m.subjectId === subjectContext);
        if (matchingMaterials.length > 0) {
          materialsSnippet = `Here are some course material titles and concepts uploaded by our college faculty for this subject:\n` +
            matchingMaterials.map((m: any) => `- ${m.title} (${m.type})`).join('\n') +
            `\nUse this college context to answer accurately in the tone of NovaCore AI Academic Assistant.`;
        }
      }

      // Gather student portal details for deep contextual RAG
      let studentPortalContext = '';
      if (req.user.role === 'student') {
        const studentDept = db.departments.find((d: any) => d.code === req.user.department);
        
        // Current courses
        const currentSubjects = (db.subjects || []).filter((s: any) => 
          s.departmentId === studentDept?.id && s.semester === req.user.semester
        );
        const subjectsStr = currentSubjects.length > 0
          ? currentSubjects.map((s: any) => `- ${s.name} (${s.code})`).join('\n')
          : 'None';

        // Arrears
        const arrearsStr = req.user.arrears && req.user.arrears.length > 0
          ? req.user.arrears.map((a: string) => `- ${a}`).join('\n')
          : 'None (Clear Academic Standing)';

        // Internal Marks
        let internalMarksStr = 'No internal marks logged yet.';
        if (req.user.internalMarks && Object.keys(req.user.internalMarks).length > 0) {
          internalMarksStr = Object.entries(req.user.internalMarks).map(([subjId, m]: [string, any]) => {
            const subj = db.subjects.find((s: any) => s.id === subjId);
            const name = subj ? `${subj.name} (${subj.code})` : subjId;
            return `- ${name}: Test1: ${m.test1}/20, Test2: ${m.test2}/20, Assignment: ${m.assignment}/10, Attendance: ${m.attendance}/5. Total Internal Mark: ${m.total}/55`;
          }).join('\n');
        }

        const activeAssignments = (db.assignments || []).filter((a: any) => 
          (a.departmentId === studentDept?.id || a.departmentId === 'all') && a.semester === req.user.semester
        );
        const assignmentsStr = activeAssignments.length > 0 
          ? activeAssignments.map((a: any) => {
              const isSub = (db.submissions || []).find((s: any) => s.assignmentId === a.id && s.studentId === req.user.id);
              return `- [Assignment] ${a.title} (Points: ${a.points}, Deadline: ${new Date(a.deadline).toLocaleDateString()}, Status: ${isSub ? 'Submitted' : 'Pending'})`;
            }).join('\n')
          : 'None';

        const mockInterviews = (db.mockInterviews || []).filter((m: any) => m.studentId === req.user.id);
        const mocksStr = mockInterviews.length > 0
          ? mockInterviews.map((m: any) => `- [Mock Interview] ${m.company} scheduled for ${m.date} at ${m.time} (Status: ${m.status}, Feedback: "${m.feedback || 'None yet'}")`).join('\n')
          : 'None';

        const leaveRequests = (db.leaveRequests || []).filter((l: any) => l.studentId === req.user.id);
        const leavesStr = leaveRequests.length > 0
          ? leaveRequests.map((l: any) => `- [Leave Request] From ${l.startDate} to ${l.endDate} for reason: "${l.reason}" (Status: ${l.status})`).join('\n')
          : 'None';

        // Placement Cell announcements catalog
        const placementDrivesStr = (db.placementAnnouncements || []).map((p: any) => {
          const hasApplied = p.applicants?.includes(req.user.id) ? 'Applied' : 'Not Applied';
          return `- [Placement Drive] Company: ${p.company}, Role: ${p.role}, Salary: ${p.salary}, Eligibility: "${p.eligibility}", Deadline: ${new Date(p.deadline).toLocaleDateString()}, Status: ${hasApplied}`;
        }).join('\n');

        // Course PDFs / Study materials catalog
        const relatedMaterials = (db.materials || []).filter((m: any) => 
          m.departmentId === 'all' || 
          m.departmentId === studentDept?.id ||
          m.semester === req.user.semester
        );
        const materialsCatalogStr = relatedMaterials.length > 0
          ? relatedMaterials.map((m: any) => {
              const subj = db.subjects.find((s: any) => s.id === m.subjectId);
              return `- [Course PDF/Material] Title: "${m.title}", Type: ${m.type}, Subject: ${subj ? subj.name : 'General'}, File Type: ${m.fileType}, Link: ${m.fileUrl}`;
            }).join('\n')
          : 'None';

        studentPortalContext = `
PERSONAL STUDENT DATA CORRELATION:
- Current Semester Subjects:
${subjectsStr}
- Arrears Status:
${arrearsStr}
- Student's Subject Internal Marks (out of 55 max total):
${internalMarksStr}
- Active Assignments/Challenges:
${assignmentsStr}
- Mock Placement Interviews:
${mocksStr}
- Submitted Leave Requests:
${leavesStr}

PORTAL CATALOG & OPPORTUNITIES:
- Placement Cell Drives:
${placementDrivesStr}
- Course PDFs & Study Materials:
${materialsCatalogStr}
`;
      }

      // System Instructions for a warm, fluent, elite assistant rather than a robotic RAG responder
      const systemInstruction = `You are "NovaCore AI Academic Assistant", a highly articulate, warm, and brilliant academic mentor and portal assistant at NovaCore College.
Your purpose is to assist students and staff in navigating their curriculum, resolving doubts, explaining complex technical concepts, checking portal details, and advising on academic stand/standing.

Current User Profile:
Name: ${req.user.name}
Role: ${req.user.role}
Department: ${req.user.department}
Current Semester: ${req.user.semester}
Attendance: ${req.user.attendancePercentage}%
Coding Progress: ${req.user.codingProgress}%

Current Date & Time: 2026-07-05.

${studentPortalContext}
${materialsSnippet}

CONVERSATIONAL GUIDELINES:
1. Speak naturally and fluently. Do NOT sound like a rigid programmed script. Use phrases a human professor or tutor would use: express encouragement, ask follow-up questions to check comprehension, and use friendly formatting.
2. Address the user by their name ("${req.user.name}") naturally, but do not overdo it.
3. Help students understand concepts by breaking them down step-by-step. If asked about programming (Python, PyTorch, PySpark), include concise, clean code snippets inside proper markdown code blocks.
4. When asked about deadlines, grades, internal marks, arrears, courses, attendance, or eligibility, check the 'PERSONAL STUDENT DATA CORRELATION' and 'PORTAL CATALOG' sections provided above and give precise, helpful responses.
5. If attendance is close to or below 75%, advise them on its urgency and how to recover.
6. If the student has arrears, encourage them, give preparation advice, and suggest resources.
7. If a query requires human intervention, HOD approval, grading changes, or permissions beyond your scope, let them know politely and offer to escalate the conversation by filing a Support Ticket.
8. Keep responses engaging, structured, and easy to read.`;

      // Build history turns for multi-turn conversational chat
      const historyTurns = Array.isArray(chatHistory) ? chatHistory.map((m: any) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      })) : [];

      const contents = [
        ...historyTurns,
        { role: 'user', parts: [{ text: message }] }
      ];

      // Call Gemini 2.5 Flash Model with full conversation history
      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const responseText = geminiResponse.text || 'I apologize, I am unable to generate a response at this moment.';

      // Handle Escalation Ticket if Gemini flags it or if requested explicitly
      let ticketId: string | null = null;
      if (isEscalationRequest || responseText.toLowerCase().includes('escalated') || responseText.toLowerCase().includes('support ticket')) {
        const ticket = {
          id: `t-${Date.now()}`,
          studentId: req.user.id,
          studentName: req.user.name,
          subjectId: subjectContext || 'general',
          query: message,
          answer: '',
          status: 'escalated',
          createdAt: new Date().toISOString()
        };
        db.tickets = db.tickets || [];
        db.tickets.push(ticket);

        // Notify matching faculty members
        const deptCode = req.user.department;
        const matchingStaff = db.users.filter((u: any) => u.role === 'staff' && u.department === deptCode);
        matchingStaff.forEach((st: any) => {
          db.notifications = db.notifications || [];
          db.notifications.push({
            id: `n-${Date.now()}-${st.id}`,
            userId: st.id,
            title: '🎟️ AI Escalation Support Ticket',
            message: `Student ${req.user.name} filed an automated ticket: "${message.slice(0, 50)}..."`,
            type: 'ai',
            read: false,
            createdAt: new Date().toISOString()
          });
        });

        writeDb(db);
        ticketId = ticket.id;
      }

      res.json({
        response: responseText,
        ticketEscalated: ticketId !== null,
        ticketId
      });

    } catch (error: any) {
      console.warn('Gemini API Error (falling back to local AI engine):', error.message);
      const responseText = getSimulatedResponse(message, req.user, db, subjectContext);
      
      let ticketId: string | null = null;
      if (isEscalationRequest || responseText.toLowerCase().includes('escalated') || responseText.toLowerCase().includes('support ticket')) {
        const ticket = {
          id: `t-${Date.now()}`,
          studentId: req.user.id,
          studentName: req.user.name,
          subjectId: subjectContext || 'general',
          query: message,
          answer: '',
          status: 'escalated',
          createdAt: new Date().toISOString()
        };
        db.tickets = db.tickets || [];
        db.tickets.push(ticket);

        // Notify matching faculty members
        const deptCode = req.user.department;
        const matchingStaff = db.users.filter((u: any) => u.role === 'staff' && u.department === deptCode);
        matchingStaff.forEach((st: any) => {
          db.notifications = db.notifications || [];
          db.notifications.push({
            id: `n-${Date.now()}-${st.id}`,
            userId: st.id,
            title: '🎟️ AI Escalation Support Ticket',
            message: `Student ${req.user.name} filed an automated ticket: "${message.slice(0, 50)}..."`,
            type: 'ai',
            read: false,
            createdAt: new Date().toISOString()
          });
        });
        writeDb(db);
        ticketId = ticket.id;
      }

      res.json({
        response: responseText,
        ticketEscalated: ticketId !== null,
        ticketId
      });
    }
  });


  // Serve React Static Files in Production
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(PROJECT_ROOT, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // Vite Dev Server middleware mode
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`NovaCore Fullstack Portal running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NovaCore Portal server:', err);
});
