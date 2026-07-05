import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Calendar, GraduationCap, Users, LayoutDashboard, FileText, CheckCircle, 
  XCircle, AlertTriangle, Send, Bell, LogOut, Sun, Moon, Upload, Plus, Trash, 
  Search, Check, Briefcase, FileSignature, Clock, Building2, UserCheck, RefreshCw, ChevronRight, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'staff' | 'student';
  name: string;
  department: string;
  year: number;
  semester: number;
  regNo: string;
  avatar: string;
  attendancePercentage?: number;
  codingProgress?: number;
}

function TypingText({ text, speed = 6 }: { text: string; speed?: number }) {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    let index = 0;
    setDisplayedText('');
    const timer = setInterval(() => {
      setDisplayedText((prev) => prev + text.charAt(index));
      index++;
      if (index >= text.length) {
        clearInterval(timer);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return <p className="whitespace-pre-line font-sans">{displayedText}</p>;
}

export default function App() {
  // Theme Management
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('novacore_theme');
    return (saved as 'light' | 'dark') || 'dark';
  });

  // Auth State
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('novacore_token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('novacore_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Auth Input State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Active Tab / Navigation
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data states
  const [departments, setDepartments] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [placementAnnouncements, setPlacementAnnouncements] = useState<any[]>([]);
  const [mockInterviews, setMockInterviews] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // AI Chat States
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'assistant', text: string, ticketCreated?: boolean }>>([
    { sender: 'assistant', text: 'Hello! I am your NovaCore Academic Assistant. Ask me about subject notes, assignments, mock interview schedules, or exam preparation tips!' }
  ]);
  const [userQuery, setUserQuery] = useState('');
  const [selectedSubjectContext, setSelectedSubjectContext] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Form states for creation
  const [uploadLoading, setUploadLoading] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ title: '', type: 'lecture notes', subjectId: '', departmentId: 'all', year: '3', semester: '6', fileType: 'pdf' });
  const [newAssignment, setNewAssignment] = useState({ title: '', description: '', subjectId: '', departmentId: 'all', year: '3', semester: '6', deadline: '2026-07-15T23:59', points: '100', criteria: '', type: 'assignment' });
  const [newSubmission, setNewSubmission] = useState({ assignmentId: '', submissionType: 'github', fileUrl: '', fileName: '', codeProof: '', certProof: '' });
  const [newTicket, setNewTicket] = useState({ subjectId: '', query: '' });
  const [newPlacement, setNewPlacement] = useState({ title: '', company: '', description: '', eligibility: '', role: '', salary: '', deadline: '2026-07-25T23:59' });
  const [newLeave, setNewLeave] = useState({ startDate: '', endDate: '', reason: '' });
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'student', department: 'AI & DS', year: '3', semester: '6', regNo: '' });
  const [newDept, setNewDept] = useState({ name: '', code: '', description: '' });
  const [bulkCsvText, setBulkCsvText] = useState("Name, Email, Role, Department, Year, Semester\nJane Doe, jane@novacore.edu, student, AI & DS, 3, 6\nProf. Severus, severus@novacore.edu, staff, AI & DS, 0, 0");

  // Selection states (for grading, viewing)
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [gradeScore, setGradeScore] = useState('');
  const [gradeRemarks, setGradeRemarks] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('all');
  const [selectedSemFilter, setSelectedSemFilter] = useState('all');

  // Load and apply theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('novacore_theme', theme);
  }, [theme]);

  // Handle Initial fetch on login
  useEffect(() => {
    if (token) {
      fetchCoreData();
    }
  }, [token]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const fetchCoreData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [
        deptsRes, subjectsRes, materialsRes, assignmentsRes, 
        submissionsRes, ticketsRes, placementsRes, mocksRes, 
        attendanceRes, leavesRes, notifsRes
      ] = await Promise.all([
        fetch('/api/departments', { headers }).then(r => r.json()),
        fetch('/api/subjects', { headers }).then(r => r.json()),
        fetch('/api/materials', { headers }).then(r => r.json()),
        fetch('/api/assignments', { headers }).then(r => r.json()),
        fetch('/api/submissions', { headers }).then(r => r.json()),
        fetch('/api/tickets', { headers }).then(r => r.json()),
        fetch('/api/placement/announcements', { headers }).then(r => r.json()),
        fetch('/api/placement/mock-interviews', { headers }).then(r => r.json()),
        fetch('/api/attendance', { headers }).then(r => r.json()),
        fetch('/api/leave-requests', { headers }).then(r => r.json()),
        fetch('/api/notifications', { headers }).then(r => r.json())
      ]);

      setDepartments(deptsRes.departments || []);
      setSubjects(subjectsRes.subjects || []);
      setMaterials(materialsRes.materials || []);
      setAssignments(assignmentsRes.assignments || []);
      setSubmissions(submissionsRes.submissions || []);
      setTickets(ticketsRes.tickets || []);
      setPlacementAnnouncements(placementsRes.announcements || []);
      setMockInterviews(mocksRes.mockInterviews || []);
      setAttendance(attendanceRes.attendance || []);
      setLeaveRequests(leavesRes.leaveRequests || []);
      setNotifications(notifsRes.notifications || []);

      if (user?.role === 'admin') {
        const [usersRes, analyticsRes] = await Promise.all([
          fetch('/api/users', { headers }).then(r => r.json()),
          fetch('/api/analytics', { headers }).then(r => r.json())
        ]);
        setAllUsers(usersRes.users || []);
        setAnalytics(analyticsRes || null);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login failed. Please check credentials.');
      }

      localStorage.setItem('novacore_token', data.token);
      localStorage.setItem('novacore_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setActiveTab('dashboard');
    } catch (err: any) {
      setAuthError(err.message || 'Something went wrong.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Sign out
  const handleLogout = () => {
    localStorage.removeItem('novacore_token');
    localStorage.removeItem('novacore_user');
    setToken(null);
    setUser(null);
    setEmail('');
    setPassword('');
  };

  // Quick Login Buttons
  const handleQuickLogin = async (role: 'admin' | 'staff' | 'student') => {
    let qEmail = 'student.aids@novacore.edu';
    let qPassword = 'student123';
    
    if (role === 'admin') {
      qEmail = 'admin@novacore.edu';
      qPassword = 'admin123';
    } else if (role === 'staff') {
      qEmail = 'staff.aids@novacore.edu';
      qPassword = 'staff123';
    }

    setEmail(qEmail);
    setPassword(qPassword);
    
    // Auto-trigger submission simulation
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: qEmail, password: qPassword })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('novacore_token', data.token);
        localStorage.setItem('novacore_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        setActiveTab('dashboard');
      }
    } catch (e) {
      setAuthError('Quick login failed. Try entering manually.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Create Material Action
  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadLoading(true);
    try {
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newMaterial)
      });
      if (res.ok) {
        alert('Learning material successfully added!');
        fetchCoreData();
        setNewMaterial({ title: '', type: 'lecture notes', subjectId: '', departmentId: 'all', year: '3', semester: '6', fileType: 'pdf' });
      }
    } catch (err) {
      alert('Error uploading material');
    } finally {
      setUploadLoading(false);
    }
  };

  // Add Assignment Action
  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newAssignment)
      });
      if (res.ok) {
        alert('Assignment distributed successfully!');
        fetchCoreData();
        setNewAssignment({ title: '', description: '', subjectId: '', departmentId: 'all', year: '3', semester: '6', deadline: '2026-07-15T23:59', points: '100', criteria: '', type: 'assignment' });
      }
    } catch (err) {
      alert('Error creating assignment');
    }
  };

  // Submit Assignment Action
  const handleAddSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newSubmission)
      });
      if (res.ok) {
        alert('Your proof and files were successfully submitted for grading.');
        fetchCoreData();
        setNewSubmission({ assignmentId: '', submissionType: 'github', fileUrl: '', fileName: '', codeProof: '', certProof: '' });
      }
    } catch (err) {
      alert('Error uploading assignment');
    }
  };

  // Grade Submission Action
  const handleGradeSubmission = async (status: 'approved' | 'rejected') => {
    if (!selectedSubmission) return;
    try {
      const res = await fetch('/api/submissions/grade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: selectedSubmission.id,
          marks: gradeScore,
          remarks: gradeRemarks,
          status
        })
      });
      if (res.ok) {
        alert(`Submission marked as ${status}. Student notified.`);
        setSelectedSubmission(null);
        setGradeScore('');
        setGradeRemarks('');
        fetchCoreData();
      }
    } catch (err) {
      alert('Failed to submit grade review');
    }
  };

  // Apply to placement
  const handleApplyPlacement = async (driveId: string) => {
    try {
      const res = await fetch('/api/placement/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ announcementId: driveId })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Drive application submitted! Good luck!');
        fetchCoreData();
      } else {
        alert(data.message || 'Could not apply.');
      }
    } catch (err) {
      alert('Application process error');
    }
  };

  // File Leave Request
  const handleAddLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newLeave)
      });
      if (res.ok) {
        alert('Leave application submitted for Review.');
        setNewLeave({ startDate: '', endDate: '', reason: '' });
        fetchCoreData();
      }
    } catch (err) {
      alert('Leave submission error');
    }
  };

  // Review Leave
  const handleReviewLeave = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`/api/leave-requests/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchCoreData();
      }
    } catch (err) {
      alert('Error updating leave status');
    }
  };

  // AI Chat Request
  const handleSendMessage = async (e?: React.FormEvent, forceEscalate = false, customQuery?: string) => {
    if (e) e.preventDefault();
    const queryToSend = customQuery || userQuery;
    if (!queryToSend.trim() && !forceEscalate) return;

    const currentQuery = forceEscalate ? `I would like to escalate my previous query to my professor. My question was: ${chatMessages[chatMessages.length - 2]?.text || queryToSend}` : queryToSend;
    
    // Append User query
    setChatMessages(prev => [...prev, { sender: 'user', text: currentQuery }]);
    setUserQuery('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: currentQuery,
          chatHistory: chatMessages, // Pass history for multi-turn conversations
          subjectContext: selectedSubjectContext,
          isEscalationRequest: forceEscalate
        })
      });
      const data = await res.json();
      if (res.ok) {
        setChatMessages(prev => [...prev, { 
          sender: 'assistant', 
          text: data.response, 
          ticketCreated: data.ticketEscalated 
        }]);
        if (data.ticketEscalated) {
          fetchCoreData(); // Refresh tickets list
        }
      } else {
        setChatMessages(prev => [...prev, { 
          sender: 'assistant', 
          text: data.message || 'I faced a temporary error. Let me try that again.' 
        }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { 
        sender: 'assistant', 
        text: 'The academic AI Assistant is currently undergoing scheduled maintenance. Please connect with your course staff directly or try again later.' 
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Admin: Create User Manual
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newUser)
      });
      const data = await res.json();
      if (res.ok) {
        alert(`User registered successfully! Credentials: Email: ${data.user.email}, Temp Password: ${newUser.password}`);
        setNewUser({ name: '', email: '', password: '', role: 'student', department: 'AI & DS', year: '3', semester: '6', regNo: '' });
        fetchCoreData();
      } else {
        alert(data.message || 'Error creating user');
      }
    } catch (err) {
      alert('Error creating user');
    }
  };

  // Admin: Bulk Import Simulation
  const handleBulkImport = async () => {
    try {
      // Parse CSV textarea
      const lines = bulkCsvText.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const parsedUsers = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj: any = {};
        headers.forEach((header, idx) => {
          obj[header] = values[idx];
        });
        return obj;
      });

      const res = await fetch('/api/users/bulk-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ users: parsedUsers })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Import Complete!\nSuccess: ${data.successCount} users registered.\nErrors: ${data.errors.length}`);
        if (data.errors.length > 0) {
          console.warn('Import Errors:', data.errors);
        }
        fetchCoreData();
      }
    } catch (err) {
      alert('Failed to parse and process CSV bulk data');
    }
  };

  // Admin: Delete User
  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this user profile?')) return;
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchCoreData();
      }
    } catch (err) {
      alert('Error deleting user');
    }
  };

  // Notification clear all
  const handleClearNotifs = async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchCoreData();
    } catch (e) {
      console.error(e);
    }
  };

  // Attendance submission helper
  const [attendStudent, setAttendStudent] = useState('');
  const [attendStatus, setAttendStatus] = useState('present');
  const [attendPeriod, setAttendPeriod] = useState('1');
  const handleAddAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attendStudent) return;
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          studentId: attendStudent,
          date: new Date().toISOString().split('T')[0],
          status: attendStatus,
          period: attendPeriod
        })
      });
      if (res.ok) {
        alert('Attendance updated successfully.');
        fetchCoreData();
      }
    } catch (err) {
      alert('Failed to submit attendance registry');
    }
  };

  // Ticket resolution helper
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketResolution, setTicketResolution] = useState('');
  const handleResolveTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !ticketResolution) return;
    try {
      const res = await fetch(`/api/tickets/${selectedTicketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ answer: ticketResolution })
      });
      if (res.ok) {
        alert('Ticket resolved and student notified!');
        setSelectedTicketId(null);
        setTicketResolution('');
        fetchCoreData();
      }
    } catch (err) {
      alert('Error resolving ticket');
    }
  };

  // Add Department helper
  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newDept)
      });
      if (res.ok) {
        alert('Department added successfully!');
        setNewDept({ name: '', code: '', description: '' });
        fetchCoreData();
      }
    } catch (err) {
      alert('Error adding department');
    }
  };

  if (!token || !user) {
    // Premium Glassmorphism Login Portal with animated elements
    return (
      <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-white relative overflow-hidden">
        {/* Dynamic backdrop glows */}
        <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-sky-500/10 blur-[120px] ambient-glow" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-500/5 blur-[120px] ambient-glow" />

        <header className="px-8 py-5 flex items-center justify-between border-b border-slate-800/60 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/20">
              <GraduationCap className="h-6 w-6 text-slate-950 stroke-[2.5]" id="logo-icon" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-extrabold tracking-tight bg-gradient-to-r from-sky-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">NovaCore</h1>
              <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Institution Portal</p>
            </div>
          </div>
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 text-sky-400 hover:text-sky-300 transition-all duration-300 shadow-sm"
            id="theme-toggle"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </header>

        <main className="flex-1 flex flex-col lg:flex-row items-center justify-center p-8 gap-16 max-w-7xl mx-auto w-full z-20">
          <div className="flex-1 text-center lg:text-left space-y-8 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              v2.0 Academic Engine Active
            </div>
            <h2 className="text-4xl lg:text-6xl font-display font-extrabold leading-[1.1] tracking-tight text-white">
              The Intelligent Portal for <span className="bg-gradient-to-r from-sky-400 via-teal-400 to-indigo-400 bg-clip-text text-transparent text-glow">Campus Hubs</span>
            </h2>
            <p className="text-slate-400 leading-relaxed text-base lg:text-lg">
              NovaCore is a state-of-the-art campus solution integrating automated assignment distribution, real-time analytics, leave registry, and a conversational AI academic helper powered by Gemini.
            </p>
            
            {/* Quick access credentials helper */}
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/85 shadow-lg backdrop-blur-md space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 font-mono flex items-center gap-2">
                <Check className="h-4.5 w-4.5 text-sky-400" /> Quick-Access Profiles
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button 
                  onClick={() => handleQuickLogin('student')}
                  className="py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-850 hover:border-sky-500/40 text-xs font-medium text-slate-300 hover:text-sky-400 hover:bg-slate-850/80 transition-all duration-300 flex items-center justify-center gap-2"
                  id="btn-quick-student"
                >
                  🎓 Student Role
                </button>
                <button 
                  onClick={() => handleQuickLogin('staff')}
                  className="py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-850 hover:border-sky-500/40 text-xs font-medium text-slate-300 hover:text-sky-400 hover:bg-slate-850/80 transition-all duration-300 flex items-center justify-center gap-2"
                  id="btn-quick-staff"
                >
                  🧑‍🏫 Faculty Role
                </button>
                <button 
                  onClick={() => handleQuickLogin('admin')}
                  className="py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-850 hover:border-sky-500/40 text-xs font-medium text-slate-300 hover:text-sky-400 hover:bg-slate-850/80 transition-all duration-300 flex items-center justify-center gap-2"
                  id="btn-quick-admin"
                >
                  💼 Admin Role
                </button>
              </div>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="w-full max-w-md p-8 rounded-3xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-xl shadow-2xl space-y-8"
          >
            <div className="space-y-2">
              <h3 className="text-3xl font-display font-extrabold text-white">Sign In</h3>
              <p className="text-slate-400 text-sm">Enter your college credentials to enter the workspace.</p>
            </div>

            {authError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-3" id="login-error">
                <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Institutional Email</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name.dept@novacore.edu"
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 text-white placeholder-slate-600 outline-none transition duration-300 text-sm"
                  required
                  id="login-email"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 text-white placeholder-slate-600 outline-none transition duration-300 text-sm"
                  required
                  id="login-password"
                />
              </div>

              <button 
                type="submit"
                disabled={authLoading}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition duration-300 disabled:opacity-50 hover:shadow-lg hover:shadow-sky-500/10 cursor-pointer"
                id="login-submit"
              >
                {authLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'Enter Platform'}
              </button>
            </form>
          </motion.div>
        </main>

        <footer className="px-8 py-5 text-center text-slate-600 text-[10px] border-t border-slate-900/60 z-20 font-mono">
          © 2026 NovaCore College Systems. ISO27001 & FERPA Academic Compliant.
        </footer>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} transition-colors duration-300 relative`}>
      {/* Glow particles on background */}
      <div className="absolute top-0 right-0 w-[30vw] h-[30vw] rounded-full bg-sky-500/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[30vw] h-[30vw] rounded-full bg-indigo-500/3 blur-[100px] pointer-events-none" />

      {/* Platform Header */}
      <header className={`sticky top-0 z-30 px-6 py-4 flex items-center justify-between border-b ${theme === 'dark' ? 'bg-slate-950/80 border-slate-900' : 'bg-white/80 border-slate-200'} backdrop-blur-md transition-colors duration-300`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 lg:hidden rounded-xl hover:bg-slate-800/40 text-slate-400"
            id="mobile-hamburger"
          >
            <BookOpen className="h-5 w-5 text-sky-400" />
          </button>
          <div className="p-1.5 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600">
            <GraduationCap className="h-6 w-6 text-slate-950" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight flex items-center gap-2">
              NovaCore 
              <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase tracking-wider">
                {user.role}
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">{user.name} • {user.regNo}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Notification bell dropdown */}
          <div className="relative group">
            <button className={`p-2.5 rounded-xl relative ${theme === 'dark' ? 'hover:bg-slate-900 border border-slate-900' : 'hover:bg-slate-100 border border-slate-200'} transition-all`} id="notif-bell">
              <Bell className="h-4.5 w-4.5 text-slate-400 group-hover:text-sky-400 transition-colors" />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>
            
            {/* Notification Dropdown list */}
            <div className={`absolute right-0 mt-2.5 w-80 rounded-2xl shadow-2xl border p-4 hidden group-hover:block z-50 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400">Institutional Alerts</span>
                <button onClick={handleClearNotifs} className="text-[10px] text-sky-400 hover:underline font-bold">Mark all read</button>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2.5">
                {notifications.length === 0 ? (
                  <p className="text-slate-500 text-xs py-4 text-center">No alerts currently.</p>
                ) : (
                  notifications.map((n: any) => (
                    <div key={n.id} className={`p-3 rounded-xl text-xs space-y-1 ${n.read ? 'opacity-50' : 'bg-sky-500/5 border border-sky-500/10'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sky-400">{n.title}</span>
                        <span className="text-[9px] text-slate-500 font-mono">{new Date(n.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-slate-300">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`p-2.5 rounded-xl ${theme === 'dark' ? 'hover:bg-slate-900 border border-slate-900' : 'hover:bg-slate-100 border border-slate-200'} transition-all`}
          >
            {theme === 'dark' ? <Sun className="h-4.5 w-4.5 text-amber-400 animate-pulse" /> : <Moon className="h-4.5 w-4.5 text-slate-600" />}
          </button>

          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-bold transition duration-300 cursor-pointer"
            id="logout-button"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Framework Grid */}
      <div className="flex-1 flex flex-col lg:flex-row">
        
        {/* Responsive Sidebar Navigation */}
        <aside className={`w-full lg:w-64 border-r shrink-0 transition-all ${theme === 'dark' ? 'bg-slate-950/60 border-slate-900' : 'bg-white border-slate-200'} ${sidebarOpen ? 'block' : 'hidden lg:block'}`}>
          <div className="p-4 space-y-6">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/30 border border-slate-900">
              <img src={user.avatar} alt="Profile Avatar" className="h-11 w-11 rounded-full border-2 border-sky-500/30 bg-slate-900" />
              <div>
                <h4 className="text-sm font-bold text-slate-200 leading-tight">{user.name}</h4>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{user.department}</p>
              </div>
            </div>

            <nav className="space-y-1.5">
              {/* Common Student Tabs */}
              {user.role === 'student' && (
                <>
                  <button 
                    onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }} 
                    className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider font-mono transition duration-300 border ${activeTab === 'dashboard' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/40 border-transparent'}`}
                  >
                    <LayoutDashboard className="h-4.5 w-4.5 shrink-0" /> Dashboard
                  </button>
                  <button 
                    onClick={() => { setActiveTab('materials'); setSidebarOpen(false); }} 
                    className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider font-mono transition duration-300 border ${activeTab === 'materials' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/40 border-transparent'}`}
                  >
                    <BookOpen className="h-4.5 w-4.5 shrink-0" /> Study Materials
                  </button>
                  <button 
                    onClick={() => { setActiveTab('assignments'); setSidebarOpen(false); }} 
                    className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider font-mono transition duration-300 border ${activeTab === 'assignments' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/40 border-transparent'}`}
                  >
                    <FileText className="h-4.5 w-4.5 shrink-0" /> Tasks & Proofs
                  </button>
                  <button 
                    onClick={() => { setActiveTab('placement'); setSidebarOpen(false); }} 
                    className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider font-mono transition duration-300 border ${activeTab === 'placement' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/40 border-transparent'}`}
                  >
                    <Briefcase className="h-4.5 w-4.5 shrink-0" /> Placement Cell
                  </button>
                  <button 
                    onClick={() => { setActiveTab('attendance'); setSidebarOpen(false); }} 
                    className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider font-mono transition duration-300 border ${activeTab === 'attendance' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/40 border-transparent'}`}
                  >
                    <UserCheck className="h-4.5 w-4.5 shrink-0" /> Attendance Track
                  </button>
                  <button 
                    onClick={() => { setActiveTab('ai-assistant'); setSidebarOpen(false); }} 
                    className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider font-mono transition duration-300 border bg-gradient-to-r ${activeTab === 'ai-assistant' ? 'from-sky-500/15 to-indigo-500/15 text-sky-400 border-sky-500/30' : 'from-slate-900/20 to-slate-950/20 text-sky-400 border-slate-800 hover:from-slate-900/40'}`}
                  >
                    <GraduationCap className="h-4.5 w-4.5 shrink-0 text-sky-400" /> AI Coach Doubts
                  </button>
                </>
              )}

              {/* Staff / Faculty Navigation Links */}
              {user.role === 'staff' && (
                <>
                  <button 
                    onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }} 
                    className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider font-mono transition duration-300 border ${activeTab === 'dashboard' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/40 border-transparent'}`}
                  >
                    <LayoutDashboard className="h-4.5 w-4.5 shrink-0" /> Faculty Dashboard
                  </button>
                  <button 
                    onClick={() => { setActiveTab('materials'); setSidebarOpen(false); }} 
                    className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider font-mono transition duration-300 border ${activeTab === 'materials' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/40 border-transparent'}`}
                  >
                    <BookOpen className="h-4.5 w-4.5 shrink-0" /> Manage Materials
                  </button>
                  <button 
                    onClick={() => { setActiveTab('assignments'); setSidebarOpen(false); }} 
                    className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider font-mono transition duration-300 border ${activeTab === 'assignments' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/40 border-transparent'}`}
                  >
                    <FileText className="h-4.5 w-4.5 shrink-0" /> Submission Desk
                  </button>
                  <button 
                    onClick={() => { setActiveTab('attendance'); setSidebarOpen(false); }} 
                    className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider font-mono transition duration-300 border ${activeTab === 'attendance' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/40 border-transparent'}`}
                  >
                    <UserCheck className="h-4.5 w-4.5 shrink-0" /> Attendance Roll
                  </button>
                  <button 
                    onClick={() => { setActiveTab('tickets'); setSidebarOpen(false); }} 
                    className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider font-mono transition duration-300 border ${activeTab === 'tickets' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/40 border-transparent'}`}
                  >
                    <HelpCircle className="h-4.5 w-4.5 shrink-0" /> Escalations Desk
                  </button>
                </>
              )}

              {/* Admin Navigation Links */}
              {user.role === 'admin' && (
                <>
                  <button 
                    onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }} 
                    className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider font-mono transition duration-300 border ${activeTab === 'dashboard' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/40 border-transparent'}`}
                  >
                    <LayoutDashboard className="h-4.5 w-4.5 shrink-0" /> System Metrics
                  </button>
                  <button 
                    onClick={() => { setActiveTab('users'); setSidebarOpen(false); }} 
                    className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider font-mono transition duration-300 border ${activeTab === 'users' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/40 border-transparent'}`}
                  >
                    <Users className="h-4.5 w-4.5 shrink-0" /> User Director
                  </button>
                  <button 
                    onClick={() => { setActiveTab('departments'); setSidebarOpen(false); }} 
                    className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider font-mono transition duration-300 border ${activeTab === 'departments' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/40 border-transparent'}`}
                  >
                    <Building2 className="h-4.5 w-4.5 shrink-0" /> Curriculum
                  </button>
                </>
              )}
            </nav>
          </div>
        </aside>

        <main className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full space-y-6">
          {/* 1. STUDENT DASHBOARD */}
          {user.role === 'student' && activeTab === 'dashboard' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Premium Welcome banner with neon glows */}
              <div className="relative overflow-hidden p-8 rounded-3xl premium-glass border border-sky-500/10 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="space-y-2 z-10">
                  <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    Syllabus Portal Active
                  </span>
                  <h2 className="text-3xl font-display font-extrabold text-white tracking-tight">Welcome back, {user.name}!</h2>
                  <p className="text-xs text-slate-400 max-w-xl">
                    Your institutional dashboard is refreshed for Semester {user.semester}. Academic guidelines, tasks, and doubts are fully synced.
                  </p>
                </div>
                <button 
                  onClick={() => setActiveTab('ai-assistant')}
                  className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-sky-400 to-indigo-500 hover:from-sky-350 hover:to-indigo-400 text-slate-950 font-bold text-xs flex items-center gap-2 self-start md:self-auto shadow-lg shadow-sky-500/10 hover:shadow-sky-500/20 transition-all duration-300 z-10 cursor-pointer"
                >
                  <GraduationCap className="h-4.5 w-4.5" /> Ask NovaCore AI
                </button>
              </div>

              {/* Status Metrics Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                
                {/* Attendance Gauge */}
                <div className="p-5 rounded-2xl premium-glass premium-glass-hover flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">Attendance</span>
                    <UserCheck className="h-5 w-5 text-sky-400" />
                  </div>
                  
                  <div className="flex items-center gap-4 py-1">
                    {/* Ring gauge */}
                    <div className="relative flex items-center justify-center h-16 w-16 shrink-0">
                      <svg className="h-16 w-16 transform -rotate-90">
                        <circle cx="32" cy="32" r="26" className="stroke-slate-800/80 fill-transparent" strokeWidth="5" />
                        <circle 
                          cx="32" 
                          cy="32" 
                          r="26" 
                          className={`fill-transparent transition-all duration-1000 ${
                            (user.attendancePercentage || 90) < 75 ? 'stroke-rose-500' : 'stroke-sky-400'
                          }`} 
                          strokeWidth="5" 
                          strokeDasharray={2 * Math.PI * 26}
                          strokeDashoffset={2 * Math.PI * 26 * (1 - (user.attendancePercentage || 90) / 100)}
                        />
                      </svg>
                      <span className="absolute text-xs font-black text-white">{user.attendancePercentage || 90}%</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white leading-tight">Exam Status</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {(user.attendancePercentage || 90) < 75 ? '⚠️ Shortage Risk' : '✓ Fully Eligible'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-[9px] text-slate-500 font-mono">Requires min 75.0% for term exams</div>
                </div>

                {/* Coding challenge metric */}
                <div className="p-5 rounded-2xl premium-glass premium-glass-hover flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">Coding Track</span>
                    <FileSignature className="h-5 w-5 text-indigo-400" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-end mb-1.5">
                      <span className="text-2xl font-black text-white font-mono">{user.codingProgress || 50}%</span>
                      <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider font-mono">
                        {(user.codingProgress || 0) >= 80 ? 'Master' : (user.codingProgress || 0) >= 50 ? 'Expert' : 'Novice'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-sky-400 to-indigo-500 h-full rounded-full" style={{ width: `${user.codingProgress || 50}%` }} />
                    </div>
                  </div>

                  <div className="text-[9px] text-slate-500 font-mono">Total challenge credits unlocked</div>
                </div>

                {/* Active Assignments tracker */}
                <div className="p-5 rounded-2xl premium-glass premium-glass-hover flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">Active Tasks</span>
                    <FileText className="h-5 w-5 text-amber-400" />
                  </div>
                  
                  <div>
                    <h3 className="text-3xl font-black text-white font-mono">{assignments.length}</h3>
                    <p className="text-[10px] text-amber-400 font-bold font-mono mt-1">
                      {assignments.length - submissions.length} pending submission
                    </p>
                  </div>

                  <div className="text-[9px] text-slate-500 font-mono">Checked via college portal</div>
                </div>

                {/* Verification card */}
                <div className="p-5 rounded-2xl premium-glass premium-glass-hover flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">Placements</span>
                    <Briefcase className="h-5 w-5 text-emerald-400" />
                  </div>
                  
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle className="h-4 w-4 shrink-0" /> Eligible Profile
                    </span>
                    <p className="text-[10px] text-slate-400 mt-2">No active academic blocks</p>
                  </div>

                  <div className="text-[9px] text-slate-500 font-mono">Google & Microsoft drives open</div>
                </div>

              </div>

              {/* Core student dashboard content timelines & AI Advisor */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Pending tasks timeline */}
                <div className="lg:col-span-2 p-6 rounded-3xl premium-glass border border-slate-900 shadow-xl space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-extrabold text-white text-base flex items-center gap-2">
                      <Clock className="h-5 w-5 text-amber-400" /> Distributed Assignments & Deadlines
                    </h3>
                    <button onClick={() => setActiveTab('assignments')} className="text-xs text-sky-400 hover:underline font-bold">View all</button>
                  </div>
                  
                  <div className="space-y-3.5">
                    {assignments.slice(0, 3).map((a: any) => {
                      const isSubmitted = submissions.find(s => s.assignmentId === a.id);
                      return (
                        <div key={a.id} className="p-4 rounded-2xl bg-slate-900/40 border border-slate-850 hover:border-slate-800 transition duration-350 flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded">
                              {a.type}
                            </span>
                            <h4 className="text-sm font-bold text-slate-100 mt-1">{a.title}</h4>
                            <p className="text-xs text-slate-400 line-clamp-1">{a.description}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-mono text-slate-300">Due: {new Date(a.deadline).toLocaleDateString()}</p>
                            <span className={`inline-block mt-2 text-[9px] font-bold px-2.5 py-1 rounded-full ${
                              isSubmitted 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                            }`}>
                              {isSubmitted ? '✓ Submitted' : 'Pending Upload'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {assignments.length === 0 && (
                      <p className="text-slate-500 text-xs py-10 text-center">No assignments pending currently.</p>
                    )}
                  </div>
                </div>

                {/* AI Coach Insights Recommendation Panel */}
                <div className="p-6 rounded-3xl premium-glass border border-sky-500/10 shadow-xl flex flex-col justify-between space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                  <div className="space-y-4 z-10">
                    <h3 className="font-display font-extrabold text-white text-base flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-sky-400" /> AI Coach Tip
                    </h3>
                    
                    <div className="p-4 rounded-2xl bg-sky-500/5 border border-sky-500/10 text-xs text-slate-300 leading-relaxed space-y-3">
                      <p>
                        💡 <strong>Syllabus Recommendation:</strong>
                      </p>
                      <p>
                        {user.attendancePercentage && user.attendancePercentage < 75 
                          ? "Alex, your attendance is below 75%. You must prioritize logging in for classes and submitting leave requests immediately to avoid exam blocks."
                          : `Hi ${user.name.split(' ')[0]}, your attendance is healthy (${user.attendancePercentage}%). We recommend focusing on your coding progress (${user.codingProgress}%) to unlock elite job eligibility.`
                        }
                      </p>
                      <p className="text-[10px] text-slate-400 italic">
                        "Try downloading PySpark Cheat Sheets in the Library to tackle assignments early."
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setActiveTab('ai-assistant')}
                    className="w-full py-2.5 rounded-xl border border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/10 text-sky-400 hover:text-sky-300 font-bold text-xs transition duration-300 cursor-pointer"
                  >
                    Open AI Chat Assistant
                  </button>
                </div>

              </div>

              {/* Arrears and Current Semester Courses / Internal Marks */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Current Semester Courses & Internal Marks */}
                <div className="lg:col-span-2 p-6 rounded-3xl premium-glass border border-slate-900 shadow-xl space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-extrabold text-white text-base flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-sky-400" /> Current Semester Courses & Internal Marks
                    </h3>
                    <span className="text-xs text-slate-400 font-mono">Semester {user.semester}</span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-850">
                    <table className="w-full text-left text-xs border-collapse bg-slate-900/10">
                      <thead>
                        <tr className="border-b border-slate-850 text-slate-450 bg-slate-900/60 font-mono uppercase tracking-wider text-[9px]">
                          <th className="py-3 px-4">Subject</th>
                          <th className="py-3 px-4 text-center">Test 1</th>
                          <th className="py-3 px-4 text-center">Test 2</th>
                          <th className="py-3 px-4 text-center">Assignment</th>
                          <th className="py-3 px-4 text-center">Attendance</th>
                          <th className="py-3 px-4 text-right">Total Internal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850 text-slate-300">
                        {subjects
                          .filter(s => s.departmentId === (departments.find(d => d.code === user.department)?.id) && s.semester === user.semester)
                          .map((s: any) => {
                            const marks = user.internalMarks ? user.internalMarks[s.id] : null;
                            return (
                              <tr key={s.id} className="hover:bg-slate-900/40 transition">
                                <td className="py-3 px-4">
                                  <div className="font-bold text-white">{s.name}</div>
                                  <div className="text-[10px] text-slate-500 font-mono">{s.code}</div>
                                </td>
                                <td className="py-3 px-4 text-center font-mono">{marks ? `${marks.test1}/20` : '-'}</td>
                                <td className="py-3 px-4 text-center font-mono">{marks ? `${marks.test2}/20` : '-'}</td>
                                <td className="py-3 px-4 text-center font-mono">{marks ? `${marks.assignment}/10` : '-'}</td>
                                <td className="py-3 px-4 text-center font-mono">{marks ? `${marks.attendance}/5` : '-'}</td>
                                <td className="py-3 px-4 text-right font-bold font-mono">
                                  <span className={marks && marks.total >= 25 ? "text-emerald-400" : "text-amber-400"}>
                                    {marks ? `${marks.total}/55` : '-'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        {subjects.filter(s => s.departmentId === (departments.find(d => d.code === user.department)?.id) && s.semester === user.semester).length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-500">No courses registered for this semester.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Arrears / Academic Standing Status */}
                <div className="p-6 rounded-3xl premium-glass border border-slate-900 shadow-xl flex flex-col justify-between space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                  <div className="space-y-4 z-10">
                    <h3 className="font-display font-extrabold text-white text-base flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" /> Academic Standing (Arrears)
                    </h3>
                    
                    {user.arrears && user.arrears.length > 0 ? (
                      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 leading-relaxed space-y-3">
                        <p className="font-bold">⚠️ Arrear backlogs active ({user.arrears.length}):</p>
                        <ul className="list-disc list-inside space-y-1 text-slate-350">
                          {user.arrears.map((a: string, idx: number) => (
                            <li key={idx}>{a}</li>
                          ))}
                        </ul>
                        <p className="text-[10px] text-slate-400 italic">
                          Important: Clear backlog arrears to restore eligibility for Google AI Residency & Amazon applied scientist roles.
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 leading-relaxed space-y-2">
                        <p className="font-bold flex items-center gap-2">🟢 Clear Academic Standing</p>
                        <p className="text-slate-350">
                          Congratulations! You have 0 active arrears. Your profile is in excellent standing for all campus placement recruitment drives.
                        </p>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => setActiveTab('placement')}
                    className="w-full py-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-850 hover:border-slate-700 text-slate-300 font-bold text-xs transition duration-300 cursor-pointer"
                  >
                    Check Placement Opportunities
                  </button>
                </div>
              </div>

            </motion.div>
          )}

          {/* STAFF DASHBOARD */}
          {user.role === 'staff' && activeTab === 'dashboard' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="p-6 rounded-3xl premium-glass border border-slate-900 shadow-xl">
                <h2 className="text-2xl font-display font-extrabold text-white">Faculty Workspace Dashboard</h2>
                <p className="text-xs text-slate-400 mt-1">Manage learning assets, distribution pipelines, evaluate student solutions, and review AI escalations.</p>
              </div>

              {/* Staff metrics cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="p-5 rounded-2xl premium-glass premium-glass-hover flex flex-col justify-between space-y-3">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">Study Materials</span>
                  <h3 className="text-3xl font-black mt-2 text-white">
                    {materials.filter(m => m.uploadedBy === user.name).length} Uploads
                  </h3>
                  <button onClick={() => setActiveTab('materials')} className="text-xs text-sky-400 hover:underline mt-3 block text-left font-bold">Manage documents →</button>
                </div>

                <div className="p-5 rounded-2xl premium-glass premium-glass-hover flex flex-col justify-between space-y-3">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">Active Challenges</span>
                  <h3 className="text-3xl font-black mt-2 text-white">
                    {assignments.length} Distributed
                  </h3>
                  <button onClick={() => setActiveTab('assignments')} className="text-xs text-sky-400 hover:underline mt-3 block text-left font-bold">Distribute new challenge →</button>
                </div>

                <div className="p-5 rounded-2xl premium-glass premium-glass-hover flex flex-col justify-between space-y-3">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">Pending Evaluation</span>
                  <h3 className="text-3xl font-black mt-2 text-amber-400">
                    {submissions.filter(s => s.status === 'pending').length} Submissions
                  </h3>
                  <button onClick={() => setActiveTab('assignments')} className="text-xs text-sky-400 hover:underline mt-3 block text-left font-bold">Open Evaluation Desk →</button>
                </div>
              </div>

              {/* Submissions desk overview */}
              <div className="p-6 rounded-3xl premium-glass border border-slate-900 shadow-xl space-y-4">
                <h3 className="font-display font-extrabold text-white flex items-center gap-2">
                  <Clock className="h-5 w-5 text-sky-400" /> Pending Evaluation Pipeline
                </h3>
                
                <div className="overflow-x-auto rounded-xl border border-slate-850">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 text-slate-400 bg-slate-900/60 font-mono uppercase tracking-wider text-[10px]">
                        <th className="py-4.5 px-5">Student Name</th>
                        <th className="py-4.5 px-5">Course Task</th>
                        <th className="py-4.5 px-5">Type Format</th>
                        <th className="py-4.5 px-5">Uploaded Date</th>
                        <th className="py-4.5 px-5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 bg-slate-900/10">
                      {submissions.filter(s => s.status === 'pending').map((sub: any) => {
                        const assign = assignments.find(a => a.id === sub.assignmentId);
                        return (
                          <tr key={sub.id} className="hover:bg-slate-900/40 transition">
                            <td className="py-4 px-5 font-bold text-white">{sub.studentName}</td>
                            <td className="py-4 px-5 text-slate-300">{assign?.title || 'Unknown Task'}</td>
                            <td className="py-4 px-5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-indigo-500/10 text-indigo-400">
                                {sub.submissionType}
                              </span>
                            </td>
                            <td className="py-4 px-5 text-slate-400 font-mono">{new Date(sub.submittedAt).toLocaleDateString()}</td>
                            <td className="py-4 px-5 text-right">
                              <button 
                                onClick={() => { setSelectedSubmission(sub); setActiveTab('assignments'); }}
                                className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition duration-300 cursor-pointer"
                              >
                                Evaluate Proofs
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {submissions.filter(s => s.status === 'pending').length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-500 font-medium">All student submissions graded! Excellent work.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* ADMIN ANALYTICS PORTAL */}
          {user.role === 'admin' && activeTab === 'dashboard' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="p-6 rounded-3xl premium-glass border border-slate-900 shadow-xl">
                <h2 className="text-2xl font-display font-extrabold text-white">Institution-Wide Analytics</h2>
                <p className="text-xs text-slate-400 mt-1">Overview of departments, enrollment statistics, active documents, and platform audits.</p>
              </div>

              {/* Institution statistics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="p-5 rounded-2xl premium-glass premium-glass-hover">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">Students Enrolled</span>
                  <h3 className="text-3xl font-black mt-2 text-white font-mono">{analytics?.studentsCount || 0}</h3>
                </div>
                <div className="p-5 rounded-2xl premium-glass premium-glass-hover">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">Faculty Members</span>
                  <h3 className="text-3xl font-black mt-2 text-white font-mono">{analytics?.staffCount || 0}</h3>
                </div>
                <div className="p-5 rounded-2xl premium-glass premium-glass-hover">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">Departments</span>
                  <h3 className="text-3xl font-black mt-2 text-white font-mono">{analytics?.deptsCount || 0}</h3>
                </div>
                <div className="p-5 rounded-2xl premium-glass premium-glass-hover">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">AI Support Queries</span>
                  <h3 className="text-3xl font-black mt-2 text-amber-400 font-mono">{analytics?.pendingTicketsCount || 0} Open</h3>
                </div>
              </div>

              {/* Platform Audit Logs */}
              <div className="p-6 rounded-3xl premium-glass border border-slate-900 shadow-xl space-y-4">
                <h3 className="font-display font-extrabold text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-sky-400" /> Platform Security & Activity Log
                </h3>
                <div className="space-y-2.5 max-h-80 overflow-y-auto">
                  {analytics?.activityLogs?.map((log: any) => (
                    <div key={log.id} className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-850 hover:border-slate-800 transition text-xs flex justify-between items-center gap-4">
                      <div>
                        <span className="font-mono text-[9px] font-bold tracking-wider uppercase text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded">
                          {log.role}
                        </span>
                        <span className="font-bold text-white ml-2">{log.userName}</span>
                        <p className="text-slate-300 mt-1">{log.action}</p>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  ))}
                  {(!analytics?.activityLogs || analytics.activityLogs.length === 0) && (
                    <p className="text-slate-500 text-center py-6 text-xs">No administrative activities logged yet.</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* 2. ACADEMIC MATERIALS LIBRARY */}
          {activeTab === 'materials' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-display font-extrabold text-white flex items-center gap-2">
                    <BookOpen className="h-6 w-6 text-sky-400" /> Digital Academic Library
                  </h2>
                  <p className="text-xs text-slate-400 max-w-xl">
                    Access lecture slides, textbook reference chapters, laboratory models, and previous papers uploaded by faculty.
                  </p>
                </div>

                {/* Upload Action for staff / admins */}
                {(user.role === 'staff' || user.role === 'admin') && (
                  <form onSubmit={handleAddMaterial} className="p-5 rounded-3xl premium-glass border border-sky-500/15 shadow-xl space-y-4 max-w-md w-full shrink-0">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-350 font-mono flex items-center gap-2">
                      <Plus className="h-4 w-4 text-sky-400" /> Upload Curriculum Asset
                    </h4>
                    <div className="grid grid-cols-2 gap-2.5">
                      <input 
                        type="text" 
                        placeholder="Document Title (e.g. CNN basics)" 
                        value={newMaterial.title}
                        onChange={(e) => setNewMaterial({ ...newMaterial, title: e.target.value })}
                        className="col-span-2 px-3 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs outline-none text-white transition placeholder-slate-600"
                        required
                      />
                      <select 
                        value={newMaterial.type}
                        onChange={(e) => setNewMaterial({ ...newMaterial, type: e.target.value })}
                        className="px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none"
                      >
                        <option value="lecture notes">Lecture Notes</option>
                        <option value="books">Reference Book</option>
                        <option value="handouts">Handout / PDF</option>
                        <option value="question banks">Question Bank</option>
                        <option value="PYQs">Previous Paper</option>
                      </select>
                      <select 
                        value={newMaterial.subjectId}
                        onChange={(e) => setNewMaterial({ ...newMaterial, subjectId: e.target.value })}
                        className="px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none"
                        required
                      >
                        <option value="">Subject Course...</option>
                        {subjects.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                        ))}
                      </select>
                      <select 
                        value={newMaterial.departmentId}
                        onChange={(e) => setNewMaterial({ ...newMaterial, departmentId: e.target.value })}
                        className="px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none"
                      >
                        <option value="all">All Departments</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>{d.code}</option>
                        ))}
                      </select>
                      <select 
                        value={newMaterial.semester}
                        onChange={(e) => setNewMaterial({ ...newMaterial, semester: e.target.value })}
                        className="px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                          <option key={s} value={s}>Semester {s}</option>
                        ))}
                      </select>
                    </div>
                    <button 
                      type="submit" 
                      disabled={uploadLoading}
                      className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition duration-300 cursor-pointer shadow-sm hover:shadow-sky-500/10"
                    >
                      {uploadLoading ? <RefreshCw className="h-4.5 w-4.5 animate-spin" /> : <Upload className="h-4.5 w-4.5" />} Share to Department
                    </button>
                  </form>
                )}
              </div>

              {/* Filtering Controls */}
              <div className="flex flex-wrap gap-3 items-center p-4 premium-glass rounded-2xl border border-slate-900">
                <Search className="h-4 w-4 text-slate-500 ml-2" />
                <span className="text-xs text-slate-400 mr-2 font-mono">Curriculum Filter:</span>
                
                <select 
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs text-slate-300 outline-none transition"
                >
                  <option value="all">All Specialties</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.code}</option>
                  ))}
                </select>

                <select 
                  value={selectedSemFilter}
                  onChange={(e) => setSelectedSemFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs text-slate-300 outline-none transition"
                >
                  <option value="all">All Semesters</option>
                  {[1,2,3,4,5,6,7,8].map(s => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
              </div>

              {/* Materials grid display */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {materials
                  .filter(m => selectedDeptId === 'all' || m.departmentId === selectedDeptId || m.departmentId === 'all')
                  .filter(m => selectedSemFilter === 'all' || m.semester === parseInt(selectedSemFilter))
                  .map((m: any) => {
                    const subj = subjects.find(s => s.id === m.subjectId);
                    return (
                      <div key={m.id} className="p-5 rounded-2xl premium-glass premium-glass-hover flex flex-col justify-between space-y-5">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-bold font-mono uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
                              {m.type}
                            </span>
                            <span className="text-[9px] text-slate-500 font-mono uppercase bg-slate-950 border border-slate-900 px-2 py-0.5 rounded">{m.fileType}</span>
                          </div>
                          <h4 className="font-bold text-white text-sm leading-snug">{m.title}</h4>
                          <p className="text-xs text-slate-400">Subject: <span className="text-slate-200 font-medium">{subj?.name || 'Curriculum Core'}</span></p>
                        </div>

                        <div className="border-t border-slate-850 pt-3.5 flex items-center justify-between">
                          <div className="text-[9px] text-slate-500 font-mono space-y-0.5">
                            <p>By: {m.uploadedBy}</p>
                            <p>{new Date(m.uploadedAt).toLocaleDateString()}</p>
                          </div>
                          <a 
                            href={m.fileUrl} 
                            onClick={() => alert('Simulating secure digital document delivery. Your PDF is launching locally.')}
                            className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-750 text-xs text-sky-400 hover:text-sky-300 font-bold transition duration-300 shadow-sm"
                          >
                            Download
                          </a>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          )}

          {/* 3. ASSIGNMENTS & GRADING WORKFLOW */}
          {activeTab === 'assignments' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-display font-extrabold text-white flex items-center gap-2">
                    <FileText className="h-6 w-6 text-sky-400" /> Academic & Coding Challenges
                  </h2>
                  <p className="text-xs text-slate-400 max-w-xl">
                    Submit your completed laboratory programs, homework, project checkpoints, and external certifications for review.
                  </p>
                </div>

                {/* Faculty distribution form */}
                {(user.role === 'staff' || user.role === 'admin') && (
                  <form onSubmit={handleAddAssignment} className="p-5 rounded-3xl premium-glass border border-sky-500/15 shadow-xl space-y-4 max-w-md w-full shrink-0">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-300 font-mono flex items-center gap-2">
                      <Plus className="h-4 w-4 text-sky-400" /> Distribute Syllabus Challenge
                    </h4>
                    <input 
                      type="text" 
                      placeholder="Challenge Title" 
                      value={newAssignment.title}
                      onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs outline-none text-white transition placeholder-slate-600"
                      required
                    />
                    <textarea 
                      placeholder="Task description, deliverables, & expectations..." 
                      value={newAssignment.description}
                      onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs outline-none text-white transition placeholder-slate-600"
                      rows={2}
                    />
                    <div className="grid grid-cols-2 gap-2.5">
                      <select 
                        value={newAssignment.subjectId}
                        onChange={(e) => setNewAssignment({ ...newAssignment, subjectId: e.target.value })}
                        className="px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none"
                        required
                      >
                        <option value="">Course Link...</option>
                        {subjects.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <select 
                        value={newAssignment.type}
                        onChange={(e) => setNewAssignment({ ...newAssignment, type: e.target.value })}
                        className="px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none"
                      >
                        <option value="assignment">Assignment</option>
                        <option value="homework">Homework</option>
                        <option value="coding">Coding Challenge</option>
                        <option value="certification">External Certification</option>
                        <option value="project">Project Phase</option>
                      </select>
                      <input 
                        type="datetime-local" 
                        value={newAssignment.deadline}
                        onChange={(e) => setNewAssignment({ ...newAssignment, deadline: e.target.value })}
                        className="px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-350 outline-none"
                        required
                      />
                      <input 
                        type="number" 
                        placeholder="Max marks points" 
                        value={newAssignment.points}
                        onChange={(e) => setNewAssignment({ ...newAssignment, points: e.target.value })}
                        className="px-3 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs outline-none text-white transition placeholder-slate-600"
                        required
                      />
                    </div>
                    <button type="submit" className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition duration-300 cursor-pointer shadow-sm hover:shadow-sky-500/10">
                      Distribute to Students
                    </button>
                  </form>
                )}
              </div>

              {/* Assignment evaluation panel */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* List of active challenges */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="font-display font-extrabold text-white text-sm">Active College Challenges</h3>
                  
                  {assignments.map((a: any) => {
                    const isSubmitted = submissions.find(s => s.assignmentId === a.id);
                    return (
                      <div key={a.id} className="p-5 rounded-2xl premium-glass border border-slate-900 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="space-y-1">
                            <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-bold font-mono uppercase bg-sky-500/10 text-sky-400 border border-sky-500/25">
                              {a.type}
                            </span>
                            <h4 className="text-base font-bold text-white mt-1 leading-snug">{a.title}</h4>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 bg-slate-950 border border-slate-900 px-3 py-1 rounded-xl">
                            Deadline: {new Date(a.deadline).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{a.description}</p>
                        
                        <div className="flex items-center justify-between border-t border-slate-850/60 pt-3.5">
                          <span className="text-xs font-mono text-slate-400">Maximum score: <strong className="text-white">{a.points} Pts</strong></span>
                          {user.role === 'student' && (
                            <button 
                              onClick={() => setNewSubmission({ ...newSubmission, assignmentId: a.id })}
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition duration-300 cursor-pointer shadow-sm ${
                                isSubmitted 
                                  ? 'bg-slate-950 hover:bg-slate-900 text-slate-400 border border-slate-850' 
                                  : 'bg-sky-500 hover:bg-sky-400 text-slate-950 hover:shadow-sky-500/10'
                              }`}
                            >
                              {isSubmitted ? 'Resubmit Solution Proof' : 'Upload Solution Proof'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Submit action side panel (Student only) */}
                {user.role === 'student' && newSubmission.assignmentId && (
                  <form onSubmit={handleAddSubmission} className="p-6 rounded-3xl premium-glass border border-sky-500/15 shadow-xl space-y-4 h-fit">
                    <h3 className="font-display font-extrabold text-white text-sm flex items-center gap-2">
                      <Upload className="h-4.5 w-4.5 text-sky-400" /> Upload Solution Proof
                    </h3>
                    
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-mono uppercase font-bold text-slate-400">Submission Proof Format</label>
                      <select 
                        value={newSubmission.submissionType}
                        onChange={(e) => setNewSubmission({ ...newSubmission, submissionType: e.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none"
                      >
                        <option value="github">GitHub Repository Link</option>
                        <option value="pdf">PDF Document Report</option>
                        <option value="zip">ZIP Code Folder</option>
                        <option value="image">Certification Snapshot</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-mono uppercase font-bold text-slate-400">Resource / URL Link</label>
                      <input 
                        type="url" 
                        placeholder="https://github.com/myusername/challenge"
                        value={newSubmission.fileUrl}
                        onChange={(e) => setNewSubmission({ ...newSubmission, fileUrl: e.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs outline-none text-white placeholder-slate-650"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-mono uppercase font-bold text-slate-400">Explanatory verification note</label>
                      <textarea 
                        placeholder="Provide repository tags, local compilation test logs, or certification ID numbers..."
                        value={newSubmission.codeProof}
                        onChange={(e) => setNewSubmission({ ...newSubmission, codeProof: e.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs outline-none text-white placeholder-slate-650"
                        rows={3}
                      />
                    </div>

                    <button type="submit" className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition duration-300 cursor-pointer shadow-sm hover:shadow-sky-500/10">
                      Submit Solution
                    </button>
                  </form>
                )}

                {/* Evaluating desk for staff */}
                {(user.role === 'staff' || user.role === 'admin') && selectedSubmission && (
                  <div className="p-6 rounded-3xl premium-glass border border-sky-500/15 shadow-xl space-y-5 h-fit">
                    <h3 className="font-display font-extrabold text-white text-sm flex items-center gap-2">
                      <FileSignature className="h-4.5 w-4.5 text-sky-400" /> Evaluation Desk
                    </h3>
                    <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-900 space-y-2.5 text-xs">
                      <p className="text-slate-400">Student: <span className="text-white font-bold">{selectedSubmission.studentName}</span></p>
                      <p className="text-slate-400">Format: <span className="px-2 py-0.5 rounded font-mono font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">{selectedSubmission.submissionType}</span></p>
                      <p className="text-slate-400">Resource: <a href={selectedSubmission.fileUrl} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline break-all">{selectedSubmission.fileUrl}</a></p>
                      {selectedSubmission.codeProof && (
                        <div className="mt-3 pt-3 border-t border-slate-900">
                          <span className="font-mono text-[9px] text-slate-500 font-bold uppercase tracking-wider">Verification note:</span>
                          <p className="text-slate-300 font-mono mt-1 leading-relaxed bg-slate-900 p-2.5 rounded-lg border border-slate-850 overflow-x-auto">{selectedSubmission.codeProof}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Score Out of Max</label>
                        <input 
                          type="number" 
                          value={gradeScore}
                          onChange={(e) => setGradeScore(e.target.value)}
                          placeholder="e.g. 90"
                          className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs outline-none text-white placeholder-slate-650"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Feedback comments</label>
                        <textarea 
                          value={gradeRemarks}
                          onChange={(e) => setGradeRemarks(e.target.value)}
                          placeholder="Excellent structuring or specific revisions requested..."
                          className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs outline-none text-white placeholder-slate-650"
                          rows={2}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 pt-1.5">
                        <button 
                          onClick={() => handleGradeSubmission('approved')}
                          className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition duration-300 shadow-sm cursor-pointer"
                        >
                          Approve solution
                        </button>
                        <button 
                          onClick={() => handleGradeSubmission('rejected')}
                          className="py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs transition duration-300 shadow-sm cursor-pointer"
                        >
                          Reject Solution
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          )}

          {/* 4. PLACEMENT PREPARATION MODULE */}
          {activeTab === 'placement' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="space-y-1.5">
                <h2 className="text-2xl font-display font-extrabold text-white flex items-center gap-2">
                  <Briefcase className="h-6 w-6 text-sky-400" /> Training & Placement Cell
                </h2>
                <p className="text-xs text-slate-400 max-w-2xl">
                  Register for verification checks, mock technical interviews with faculty panels, and apply for partner placement drives.
                </p>
              </div>

              {/* Recruitment Drives announcements list */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Drives panel */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="font-display font-extrabold text-white text-sm">Partner Placement Drives</h3>
                  
                  <div className="space-y-4">
                    {placementAnnouncements.map((p: any) => {
                      const hasApplied = p.applicants?.includes(user.id);
                      return (
                        <div key={p.id} className="p-5 rounded-2xl premium-glass border border-slate-900 space-y-3.5">
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <h4 className="text-lg font-bold text-white leading-tight">{p.company}</h4>
                              <p className="text-xs text-sky-400 font-mono font-bold mt-1 uppercase tracking-wider">{p.role}</p>
                            </div>
                            <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shrink-0">
                              {p.salary}
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-300 leading-relaxed">{p.description}</p>
                          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-900 text-xs space-y-1.5 text-slate-400">
                            <p>Eligibility criteria: <strong className="text-slate-200">{p.eligibility}</strong></p>
                            <p>Registration deadline: <strong className="text-rose-400 font-mono">{new Date(p.deadline).toLocaleDateString()}</strong></p>
                          </div>

                          <div className="flex justify-between items-center pt-2 border-t border-slate-950">
                            <span className="text-[10px] text-slate-500 font-mono">Current Applicants: {p.applicants?.length || 0} students</span>
                            {user.role === 'student' && (
                              <button 
                                onClick={() => handleApplyPlacement(p.id)}
                                disabled={hasApplied}
                                className={`px-4.5 py-2 rounded-xl text-xs font-bold transition duration-300 cursor-pointer shadow-sm ${
                                  hasApplied 
                                    ? 'bg-slate-950 text-slate-500 border border-slate-850' 
                                    : 'bg-sky-500 hover:bg-sky-400 text-slate-950 hover:shadow-sky-500/10'
                                }`}
                              >
                                {hasApplied ? '✓ Application Submitted' : 'Verify & Register'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Faculty mock interview scheduler */}
                <div className="space-y-4">
                  <h3 className="font-display font-extrabold text-white text-sm">Mock Interview Schedule</h3>
                  
                  {user.role === 'student' ? (
                    <div className="space-y-3.5">
                      {mockInterviews.map((m: any) => (
                        <div key={m.id} className="p-5 rounded-2xl premium-glass border border-slate-900 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white">{m.company} Preparation</span>
                            <span className="text-[9px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/25">{m.status}</span>
                          </div>
                          <p className="text-xs text-slate-400">Slot Date: <span className="text-slate-200 font-mono">{m.date}</span> at <span className="text-slate-200 font-mono">{m.time}</span></p>
                          {m.feedback && (
                            <div className="mt-2.5 pt-2.5 border-t border-slate-850 text-xs text-sky-400 leading-relaxed italic bg-slate-950/60 p-3 rounded-xl border border-slate-900">
                              Feedback: "{m.feedback}"
                            </div>
                          )}
                        </div>
                      ))}
                      {mockInterviews.length === 0 && (
                        <p className="text-slate-500 text-xs text-center py-10">No mock Technical Interviews scheduled yet.</p>
                      )}
                    </div>
                  ) : (
                    // Staff panel to create/evaluate interviews
                    <div className="p-5 rounded-3xl premium-glass border border-slate-900 space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-305 font-mono">📅 Schedule Mock Interview</h4>
                      
                      <div className="space-y-2">
                        <select 
                          onChange={(e) => {
                            const [studentId, company] = e.target.value.split('|');
                            if (studentId) {
                              fetch('/api/placement/mock-interviews', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({ studentId, company, date: '2026-07-10', time: '15:00' })
                              }).then(r => {
                                if (r.ok) { fetchCoreData(); alert('Interview slot booked.'); }
                              });
                            }
                          }}
                          className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none"
                        >
                          <option value="">Choose Student Slot...</option>
                          <option value="u-student-1|Google LLC Drive">Alex Mercer (Google LLC)</option>
                          <option value="u-student-2|Microsoft R&D">Emily Watson (Microsoft)</option>
                        </select>
                      </div>

                      <div className="border-t border-slate-850 pt-4 space-y-3">
                        <span className="text-xs font-bold text-slate-350 block">Active Slot Reviews</span>
                        {mockInterviews.map((m: any) => (
                          <div key={m.id} className="p-3.5 bg-slate-950/80 border border-slate-900 rounded-xl text-xs space-y-2">
                            <p className="font-bold text-white leading-tight">Student: {m.studentId} • {m.company}</p>
                            <input 
                              type="text" 
                              placeholder="Type evaluator feedback notes..." 
                              onBlur={(e) => {
                                fetch(`/api/placement/mock-interviews/${m.id}`, {
                                  method: 'PUT',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                  },
                                  body: JSON.stringify({ status: 'completed', feedback: e.target.value })
                                }).then(r => {
                                  if (r.ok) fetchCoreData();
                                });
                              }}
                              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </motion.div>
          )}

              {/* 5. ATTENDANCE & LEAVE MODULE */}
          {activeTab === 'attendance' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="space-y-1.5">
                <h2 className="text-2xl font-display font-extrabold text-white flex items-center gap-2">
                  <UserCheck className="h-6 w-6 text-sky-400" /> Attendance Registry & Absences
                </h2>
                <p className="text-xs text-slate-400 mt-1">Verify current attendance records. Submit professional leave requests directly for faculty evaluation.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Visualizer and leave registry */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Circular attendance chart using SVG */}
                  <div className="p-6 rounded-3xl premium-glass border border-slate-900 flex items-center gap-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl pointer-events-none" />
                    <div className="relative shrink-0 flex items-center justify-center">
                      <svg className="h-28 w-28 transform -rotate-90">
                        <circle cx="56" cy="56" r="46" className="stroke-slate-800/80 fill-transparent" strokeWidth="8" />
                        <circle 
                          cx="56" 
                          cy="56" 
                          r="46" 
                          className="stroke-sky-400 fill-transparent transition-all duration-1000" 
                          strokeWidth="8" 
                          strokeDasharray={2 * Math.PI * 46}
                          strokeDashoffset={2 * Math.PI * 46 * (1 - (user.attendancePercentage || 90) / 100)}
                        />
                      </svg>
                      <span className="absolute text-lg font-black text-white">{user.attendancePercentage || 90}%</span>
                    </div>

                    <div className="space-y-2 z-10">
                      <h3 className="text-base font-bold text-white">Curriculum Eligibility Tracker</h3>
                      <p className="text-xs text-slate-350 leading-relaxed">
                        NovaCore requires a minimum of <span className="text-sky-400 font-bold">75.0% attendance</span> across circuit lectures to unlock examination hall tickets. Your score is verified.
                      </p>
                      {user.attendancePercentage && user.attendancePercentage >= 75 ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle className="h-4 w-4" /> Exam eligible
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse">
                          <AlertTriangle className="h-4 w-4" /> SHORTAGE RISK
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Previous leave request table */}
                  <div className="p-6 rounded-3xl premium-glass border border-slate-900 shadow-xl space-y-4">
                    <h3 className="font-display font-extrabold text-white text-sm">Professional Leave Logs</h3>
                    <div className="space-y-3">
                      {leaveRequests.map((lr: any) => (
                        <div key={lr.id} className="p-4 rounded-xl bg-slate-900/40 border border-slate-850 flex items-center justify-between gap-4">
                          <div>
                            <span className="text-[9px] font-mono text-slate-500">Duration: {lr.startDate} to {lr.endDate}</span>
                            <h4 className="text-sm font-bold text-slate-200 mt-1">{lr.reason}</h4>
                            {user.role === 'staff' && <p className="text-[10px] text-slate-400 mt-1 font-bold">Submitted by: {lr.studentName}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`inline-block text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                              lr.status === 'approved' 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : lr.status === 'rejected' 
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {lr.status}
                            </span>
                            
                            {/* Faculty controls for pending leaves */}
                            {(user.role === 'staff' || user.role === 'admin') && lr.status === 'pending' && (
                              <div className="flex gap-2 mt-2">
                                <button 
                                  onClick={() => handleReviewLeave(lr.id, 'approved')}
                                  className="px-2 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[9px] cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button 
                                  onClick={() => handleReviewLeave(lr.id, 'rejected')}
                                  className="px-2 py-1 rounded bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-[9px] cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {leaveRequests.length === 0 && (
                        <p className="text-slate-500 text-xs py-6 text-center">No leave applications filed yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Subject Internal Marks Card (Student only) */}
                  {user.role === 'student' && (
                    <div className="p-6 rounded-3xl premium-glass border border-slate-900 shadow-xl space-y-4">
                      <h3 className="font-display font-extrabold text-white text-sm flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-400" /> Semester Course Internal Marks
                      </h3>
                      <div className="overflow-x-auto rounded-xl border border-slate-850">
                        <table className="w-full text-left text-xs border-collapse bg-slate-900/10">
                          <thead>
                            <tr className="border-b border-slate-850 text-slate-450 bg-slate-900/60 font-mono uppercase tracking-wider text-[9px]">
                              <th className="py-3 px-4">Course Name</th>
                              <th className="py-3 px-4 text-center">Cycle Test 1</th>
                              <th className="py-3 px-4 text-center">Cycle Test 2</th>
                              <th className="py-3 px-4 text-center">Assignment</th>
                              <th className="py-3 px-4 text-center">Attendance</th>
                              <th className="py-3 px-4 text-right">Aggregated score</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850 text-slate-300">
                            {subjects
                              .filter(s => s.departmentId === (departments.find(d => d.code === user.department)?.id) && s.semester === user.semester)
                              .map((s: any) => {
                                const marks = user.internalMarks ? user.internalMarks[s.id] : null;
                                return (
                                  <tr key={s.id} className="hover:bg-slate-900/40 transition">
                                    <td className="py-3 px-4">
                                      <div className="font-bold text-white">{s.name}</div>
                                      <div className="text-[10px] text-slate-500 font-mono">{s.code}</div>
                                    </td>
                                    <td className="py-3 px-4 text-center font-mono">{marks ? `${marks.test1}/20` : '-'}</td>
                                    <td className="py-3 px-4 text-center font-mono">{marks ? `${marks.test2}/20` : '-'}</td>
                                    <td className="py-3 px-4 text-center font-mono">{marks ? `${marks.assignment}/10` : '-'}</td>
                                    <td className="py-3 px-4 text-center font-mono">{marks ? `${marks.attendance}/5` : '-'}</td>
                                    <td className="py-3 px-4 text-right font-bold font-mono">
                                      <span className={marks && marks.total >= 25 ? "text-emerald-400" : "text-amber-400"}>
                                        {marks ? `${marks.total}/55` : '-'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>

                {/* Absences leave submission form */}
                <div className="space-y-4">
                  {user.role === 'student' ? (
                    <form onSubmit={handleAddLeave} className="p-6 rounded-3xl premium-glass border border-sky-500/15 shadow-xl space-y-4">
                      <h3 className="font-display font-extrabold text-white text-sm">🎫 File Leave Application</h3>
                      
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Start Date</label>
                          <input 
                            type="date" 
                            value={newLeave.startDate}
                            onChange={(e) => setNewLeave({ ...newLeave, startDate: e.target.value })}
                            className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs outline-none text-slate-300 transition"
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">End Date</label>
                          <input 
                            type="date" 
                            value={newLeave.endDate}
                            onChange={(e) => setNewLeave({ ...newLeave, endDate: e.target.value })}
                            className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs outline-none text-slate-300 transition"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Reason details</label>
                        <textarea 
                          placeholder="e.g. Presenting PyTorch compiler notes at student conference..."
                          value={newLeave.reason}
                          onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                          className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs outline-none text-white transition placeholder-slate-650"
                          rows={3}
                          required
                        />
                      </div>

                      <button type="submit" className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition duration-300 cursor-pointer shadow-sm hover:shadow-sky-500/10">
                        Submit Application
                      </button>
                    </form>
                  ) : (
                    // Staff registry input
                    <form onSubmit={handleAddAttendance} className="p-6 rounded-3xl premium-glass border border-slate-900 shadow-xl space-y-4">
                      <h3 className="font-display font-extrabold text-white text-sm">📝 Live Roll Registry</h3>
                      
                      <div className="space-y-3">
                        <select 
                          value={attendStudent}
                          onChange={(e) => setAttendStudent(e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none"
                          required
                        >
                          <option value="">Choose Student Roll...</option>
                          <option value="u-student-1">Alex Mercer (AI & DS)</option>
                          <option value="u-student-2">Emily Watson (AI & ML)</option>
                        </select>

                        <div className="grid grid-cols-2 gap-2.5">
                          <select 
                            value={attendStatus}
                            onChange={(e) => setAttendStatus(e.target.value)}
                            className="px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none"
                          >
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="late">Late</option>
                          </select>
                          <select 
                            value={attendPeriod}
                            onChange={(e) => setAttendPeriod(e.target.value)}
                            className="px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none"
                          >
                            <option value="1">Period 1</option>
                            <option value="2">Period 2</option>
                            <option value="3">Period 3</option>
                            <option value="4">Period 4</option>
                          </select>
                        </div>
                      </div>

                      <button type="submit" className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition duration-300 cursor-pointer shadow-sm">
                        Confirm Registry
                      </button>
                    </form>
                  )}
                </div>

              </div>
            </motion.div>
          )}

          {/* 6. AI ACADEMIC ASSISTANT DRAWER */}
          {activeTab === 'ai-assistant' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]"
            >
              
              {/* Chat frame */}
              <div className="lg:col-span-3 flex flex-col justify-between border border-slate-900 bg-slate-900/10 rounded-3xl overflow-hidden h-full shadow-2xl relative">
                
                {/* Chat Top Banner */}
                <div className="p-4 bg-slate-900/60 backdrop-blur border-b border-slate-900 flex items-center justify-between z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-gradient-to-tr from-sky-400 to-indigo-500 shadow-md">
                      <GraduationCap className="h-5 w-5 text-slate-950" />
                    </div>
                    <div>
                      <h3 className="font-display font-extrabold text-xs text-white">NovaCore AI Academic Assistant</h3>
                      <p className="text-[9px] text-sky-400 font-mono font-bold tracking-wider uppercase">Powered by Google Gemini 3.5 Flash</p>
                    </div>
                  </div>
                  
                  {/* Select Context */}
                  <select 
                    value={selectedSubjectContext}
                    onChange={(e) => setSelectedSubjectContext(e.target.value)}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-[10px] text-slate-300 outline-none"
                  >
                    <option value="">Global Curriculum Context</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Message display scroll panel */}
                <div className="flex-1 p-6 overflow-y-auto space-y-4">
                  {chatMessages.map((m, idx) => (
                    <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-2xl p-4 rounded-2xl text-xs leading-relaxed space-y-2 shadow-sm ${
                        m.sender === 'user' 
                          ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-slate-950 font-medium' 
                          : 'bg-slate-900/50 border border-slate-900 text-slate-100'
                      }`}>
                        {m.sender === 'assistant' && idx === chatMessages.length - 1 ? (
                          <TypingText text={m.text} speed={8} />
                        ) : (
                          <p className="whitespace-pre-line font-sans">{m.text}</p>
                        )}
                        
                        {/* Escalation button rendered inside AI's text when relevant */}
                        {m.sender === 'assistant' && !m.ticketCreated && idx === chatMessages.length - 1 && (
                          <div className="pt-2">
                            <button 
                              onClick={(e) => handleSendMessage(e, true)}
                              className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 font-bold border border-rose-500/25 transition duration-305 text-[10px] cursor-pointer"
                            >
                              🎟️ Unresolved doubt? Escalate to Professor Kavitha
                            </button>
                          </div>
                        )}

                        {m.ticketCreated && (
                          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/20 text-rose-400 text-[10px] font-mono font-bold tracking-wide">
                            ✓ Support ticket filed successfully. Your Subject Professor was flagged.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-2xl text-xs text-slate-400 flex items-center gap-2.5">
                        <RefreshCw className="h-4 w-4 animate-spin text-sky-400" />
                        Analyzing learning materials & compiling answer...
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Quick Prompts Suggestions bar */}
                <div className="px-6 py-2.5 border-t border-slate-900/40 bg-slate-900/20 flex gap-2 overflow-x-auto select-none no-scrollbar">
                  {[
                    "📋 Explain CNN Image Classification",
                    "🏫 Am I eligible for Google Placement?",
                    "📝 Study plan for Big Data exam",
                    "🎓 Help with Deep Learning coding"
                  ].map((tipText, tid) => (
                    <button 
                      key={tid}
                      onClick={() => handleSendMessage(undefined, false, tipText.substring(2))}
                      className="px-3 py-1.5 rounded-full bg-slate-950 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-medium font-mono shrink-0 transition cursor-pointer"
                    >
                      {tipText}
                    </button>
                  ))}
                </div>

                {/* Message input bar */}
                <form onSubmit={(e) => handleSendMessage(e)} className="p-4 bg-slate-900 border-t border-slate-900 flex gap-2">
                  <input 
                    type="text" 
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder="Ask about exam models, CNN architectures, CIFAR challenge tips, or deadlines..."
                    className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs outline-none text-white focus:border-sky-500 transition duration-300"
                    required
                  />
                  <button type="submit" className="p-3 bg-sky-500 hover:bg-sky-450 text-slate-950 rounded-xl transition duration-300 cursor-pointer shadow-md shadow-sky-500/10">
                    <Send className="h-4.5 w-4.5" />
                  </button>
                </form>

              </div>

              {/* Tickets history panel */}
              <div className="p-5 border border-slate-900 bg-slate-900/10 rounded-3xl space-y-4 h-full overflow-y-auto shadow-md">
                <h3 className="font-display font-extrabold text-white text-xs uppercase tracking-widest font-mono">🎟️ My Doubt Tickets</h3>
                
                <div className="space-y-3.5">
                  {tickets.map((t: any) => (
                    <div key={t.id} className="p-4 bg-slate-950/80 rounded-2xl border border-slate-900 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[9px] text-slate-500">REF: {t.id}</span>
                        <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                          t.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      <p className="text-slate-350 font-mono">Q: "{t.query}"</p>
                      {t.answer && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-900 text-sky-450 leading-relaxed bg-slate-900/40 p-2.5 rounded-xl border border-slate-850">
                          <p className="font-bold text-[9px] font-mono tracking-wider">FACULTY RESOLUTION:</p>
                          <p className="mt-1 text-slate-300 italic">"{t.answer}"</p>
                        </div>
                      )}
                    </div>
                  ))}
                  {tickets.length === 0 && (
                    <p className="text-slate-500 text-xs py-6 text-center">No escalated support tickets found.</p>
                  )}
                </div>
              </div>

            </motion.div>
          )}

          {/* 7. ADMIN: USER DIRECTORY & IMPORT */}
          {activeTab === 'users' && user.role === 'admin' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="flex flex-col lg:flex-row gap-6">
                
                {/* List of enrolled platform users */}
                <div className="flex-1 space-y-4">
                  <h3 className="font-display font-extrabold text-white text-sm">NovaCore User Directory</h3>
                  
                  <div className="overflow-x-auto border border-slate-900 rounded-2xl shadow-xl">
                    <table className="w-full text-left text-xs border-collapse bg-slate-900/10">
                      <thead>
                        <tr className="border-b border-slate-850 text-slate-400 bg-slate-950/80 font-mono uppercase tracking-wider text-[10px]">
                          <th className="py-4.5 px-5">Reg / ID</th>
                          <th className="py-4.5 px-5">Full Name</th>
                          <th className="py-4.5 px-5">Email Address</th>
                          <th className="py-4.5 px-5">System Role</th>
                          <th className="py-4.5 px-5">Department</th>
                          <th className="py-4.5 px-5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {allUsers.map((u: any) => (
                          <tr key={u.id} className="hover:bg-slate-900/40 transition">
                            <td className="py-4 px-5 font-mono text-slate-300">{u.regNo}</td>
                            <td className="py-4 px-5 font-bold text-white flex items-center gap-3">
                              <img src={u.avatar} alt="avatar" className="h-7 w-7 rounded-full bg-slate-900 border border-slate-800" />
                              {u.name}
                            </td>
                            <td className="py-4 px-5 text-slate-400 font-mono">{u.email}</td>
                            <td className="py-4 px-5">
                              <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                                u.role === 'admin' 
                                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                                  : u.role === 'staff' 
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                                  : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="py-4 px-5 text-slate-300 font-bold">{u.department}</td>
                            <td className="py-4 px-5 text-right">
                              <button 
                                onClick={() => handleDeleteUser(u.id)}
                                className="text-rose-500 hover:text-rose-400 transition duration-300 p-2 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                              >
                                <Trash className="h-4.5 w-4.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Actions side panels: manual registry and bulk importer */}
                <div className="w-full lg:w-96 space-y-6 shrink-0">
                  
                  {/* Manual Creation Form */}
                  <form onSubmit={handleAddUser} className="p-5 rounded-3xl premium-glass border border-slate-900 shadow-xl space-y-4">
                    <h3 className="font-display font-extrabold text-white text-xs uppercase tracking-widest font-mono">➕ Add User Profile</h3>
                    
                    <input 
                      type="text" 
                      placeholder="Full Name" 
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs outline-none text-white transition placeholder-slate-600"
                      required
                    />

                    <input 
                      type="email" 
                      placeholder="Email Address" 
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs outline-none text-white transition placeholder-slate-600"
                      required
                    />

                    <input 
                      type="password" 
                      placeholder="Temporary password" 
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs outline-none text-white transition placeholder-slate-600"
                      required
                    />

                    <div className="grid grid-cols-2 gap-2.5">
                      <select 
                        value={newUser.role}
                        onChange={(e: any) => setNewUser({ ...newUser, role: e.target.value })}
                        className="px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none"
                      >
                        <option value="student">Student</option>
                        <option value="staff">Staff / Faculty</option>
                        <option value="admin">Administrator</option>
                      </select>

                      <select 
                        value={newUser.department}
                        onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                        className="px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 outline-none"
                      >
                        {departments.map(d => (
                          <option key={d.id} value={d.code}>{d.code}</option>
                        ))}
                      </select>
                    </div>

                    <button type="submit" className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition duration-300 cursor-pointer shadow-sm">
                      Register User
                    </button>
                  </form>

                  {/* CSV Importer */}
                  <div className="p-5 rounded-3xl premium-glass border border-slate-900 shadow-xl space-y-4">
                    <h3 className="font-display font-extrabold text-white text-xs uppercase tracking-widest font-mono">📊 Bulk Import CSV Data</h3>
                    <p className="text-[10px] text-slate-400">Paste CSV records matching: <code className="text-sky-400 bg-slate-950 px-1 py-0.5 rounded">Name, Email, Role, Department, Year, Semester</code></p>
                    
                    <textarea 
                      value={bulkCsvText}
                      onChange={(e) => setBulkCsvText(e.target.value)}
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[10px] outline-none text-white placeholder-slate-650"
                      rows={5}
                    />

                    <button 
                      onClick={handleBulkImport}
                      className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition duration-300 cursor-pointer shadow-sm"
                    >
                      Execute Bulk Import
                    </button>
                  </div>

                </div>

              </div>
            </motion.div>
          )}

          {/* 8. ADMIN: DEPARTMENTS & SUBJECTS */}
          {activeTab === 'departments' && user.role === 'admin' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="flex flex-col lg:flex-row gap-6">
                
                {/* Departments list */}
                <div className="flex-1 space-y-4">
                  <h3 className="font-display font-extrabold text-white text-sm">Active College Departments</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {departments.map((d: any) => (
                      <div key={d.id} className="p-5 rounded-2xl premium-glass border border-slate-900 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-white text-base leading-tight">{d.name}</h4>
                          <span className="px-2.5 py-0.5 rounded-lg font-mono font-bold text-xs bg-sky-500/10 text-sky-400 border border-sky-500/20">{d.code}</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{d.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Department addition side panel */}
                <div className="w-full lg:w-96 shrink-0">
                  <form onSubmit={handleAddDept} className="p-5 rounded-3xl premium-glass border border-slate-900 shadow-xl space-y-4">
                    <h3 className="font-display font-extrabold text-white text-xs uppercase tracking-widest font-mono">➕ Add Curriculum Specialty</h3>
                    
                    <input 
                      type="text" 
                      placeholder="Specialty Name (e.g. Electrical & Systems)" 
                      value={newDept.name}
                      onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs outline-none text-white transition placeholder-slate-650"
                      required
                    />

                    <input 
                      type="text" 
                      placeholder="Department Code (e.g. EEE)" 
                      value={newDept.code}
                      onChange={(e) => setNewDept({ ...newDept, code: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs outline-none text-white transition placeholder-slate-650"
                      required
                    />

                    <textarea 
                      placeholder="Specialty description and learning focus area..." 
                      value={newDept.description}
                      onChange={(e) => setNewDept({ ...newDept, description: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs outline-none text-white transition placeholder-slate-650"
                      rows={3}
                    />

                    <button type="submit" className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition duration-300 cursor-pointer shadow-sm">
                      Create Department
                    </button>
                  </form>
                </div>

              </div>
            </motion.div>
          )}

          {/* 9. STAFF SUPPORT TICKETS LIST */}
          {activeTab === 'tickets' && (user.role === 'staff' || user.role === 'admin') && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="space-y-1.5">
                <h2 className="text-2xl font-display font-extrabold text-white flex items-center gap-2">
                  <HelpCircle className="h-6 w-6 text-sky-400" /> HOD AI Escalation Desk
                </h2>
                <p className="text-xs text-slate-400 mt-1">Review complex academic doubts and syllabus questions escalated by NovaCore AI Assistant.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Tickets list */}
                <div className="lg:col-span-2 space-y-4">
                  {tickets.map((t: any) => (
                    <div key={t.id} className="p-5 rounded-2xl premium-glass border border-slate-900 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-mono text-slate-500">REF: {t.id}</span>
                          <h4 className="text-sm font-bold text-white mt-1">Escalated by: <span className="text-sky-400">{t.studentName}</span></h4>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                          t.status === 'resolved' 
                            ? 'bg-emerald-500/10 text-emerald-400' 
                            : 'bg-rose-500/10 text-rose-450 animate-pulse'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-950/80 border border-slate-900 rounded-xl text-xs font-mono text-slate-350 leading-relaxed">
                        Query: "{t.query}"
                      </div>
                      {t.answer && (
                        <p className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-900 leading-relaxed italic">Resolution Answer: "{t.answer}"</p>
                      )}
                      
                      {t.status === 'escalated' && (
                        <button 
                          onClick={() => setSelectedTicketId(t.id)}
                          className="px-4.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition duration-300 cursor-pointer shadow-sm"
                        >
                          Resolve & Respond
                        </button>
                      )}
                    </div>
                  ))}
                  {tickets.length === 0 && (
                    <p className="text-slate-500 text-xs text-center py-10">No pending academic tickets currently.</p>
                  )}
                </div>

                {/* Ticket respond drawer */}
                {selectedTicketId && (
                  <form onSubmit={handleResolveTicket} className="p-5 rounded-3xl premium-glass border border-sky-500/15 shadow-xl space-y-4 h-fit">
                    <h3 className="font-display font-extrabold text-white text-xs uppercase tracking-widest font-mono">🎫 Resolve doubt</h3>
                    <textarea 
                      placeholder="Provide precise academic resolution or instructions..." 
                      value={ticketResolution}
                      onChange={(e) => setTicketResolution(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs outline-none text-white transition placeholder-slate-650"
                      rows={4}
                      required
                    />
                    <button type="submit" className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition duration-300 cursor-pointer shadow-sm">
                      Deliver Response
                    </button>
                  </form>
                )}

              </div>
            </motion.div>
          )}

        </main>
      </div>
    </div>
  );
}
