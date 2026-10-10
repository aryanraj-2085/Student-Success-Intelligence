import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import anime from 'animejs'
import gsap from 'gsap'
import * as THREE from 'three'
import {
  Activity, ArrowLeft, ArrowRight, Bell, BookOpenCheck, Bot, CalendarDays,
  BriefcaseBusiness, Check, ChevronDown, CircleHelp, Download, FileSpreadsheet, Filter,
  GraduationCap, LayoutDashboard, LogIn, LogOut, Menu, MessageCircle, Moon, RotateCcw, Search, Send,
  ShieldCheck, Sparkles, Sun, Target, Users, X,
} from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie,
  PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts'
import { createIntervention, getDashboard, updateIntervention } from './services/api'
import './App.css'

const componentLabels = { academic: 'Academic', attendance: 'Attendance', lms: 'LMS', placement: 'Placement', skills: 'Skills', engagement: 'Engagement' }
const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/segments', label: 'Segments', icon: Target },
  { to: '/insights', label: 'Insights', icon: Sparkles },
  { to: '/interventions', label: 'Interventions', icon: Activity },
]
const segmentGroupNames = ['On track', 'Needs attention', 'High priority']
const segmentClusterColors = ['#00f2fe', '#4facfe', '#bc7bff']

function fmt(value, digits = 0) { return value == null ? '—' : Number(value).toFixed(digits) }
function average(students, key) {
  const values = students.map((student) => Number(student[key])).filter(Number.isFinite)
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}
function shortRisk(value) { return value === 'High priority' ? 'Priority' : value === 'Needs attention' ? 'Review' : 'On track' }

function buildInsights(students) {
  const definitions = [
    ['Attendance support cohort', (student) => student.attendance != null && student.attendance < 65, 'Attendance below 65%', 'Offer a private check-in and identify timetable, access, or wellbeing barriers.', 'High'],
    ['Assignment completion gap', (student) => student.assignment_completion != null && student.assignment_completion < 55, 'Assignment completion below 55%', 'Review assignment expectations and provide structured LMS support.', 'Medium'],
    ['Academic strength, placement gap', (student) => student.cgpa != null && student.cgpa >= 7 && student.placement_readiness != null && student.placement_readiness < 55, 'CGPA at least 7.0 with placement readiness below 55', 'Offer aptitude and coding practice with mock-interview feedback.', 'Medium'],
    ['Students showing improvement', (student) => student.previous_cgpa != null && student.cgpa != null && student.cgpa - student.previous_cgpa >= 0.5, 'CGPA increased by at least 0.5 vs previous semester', 'Recognize progress and ask which supports are working.', 'Positive'],
  ]
  return definitions.flatMap(([title, predicate, metric, action, priority]) => {
    const affected = students.filter(predicate)
    return affected.length ? [{ title, count: affected.length, metric, action, priority, student_ids: affected.map((student) => student.id), kind: 'descriptive' }] : []
  })
}

function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [department, setDepartment] = useState('All departments')
  const [year, setYear] = useState('All years')
  const [program, setProgram] = useState('All programs')
  const [comparison, setComparison] = useState('Current cohort')
  const [selected, setSelected] = useState(null)
  const [interventions, setInterventions] = useState([])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('student-success-theme') || 'light')
  const [demoUser, setDemoUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('student-success-demo-user') || 'null') } catch { return null }
  })
  const [signInOpen, setSignInOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const dashboardRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const isStudentProfile = /^\/students\/[^/]+$/.test(location.pathname)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('student-success-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!dashboardRef.current || !data || reduceMotion) return
    const targets = dashboardRef.current.querySelectorAll('.kpi, .panel, .cohort-pulse')
    if (!targets.length) return
    const tween = gsap.fromTo(targets, { opacity: 0.72, y: 9, scale: 0.99 }, {
      opacity: 1, y: 0, scale: 1, duration: 0.38, stagger: 0.025, ease: 'power2.out', clearProps: 'transform,opacity',
    })
    return () => tween.kill()
  }, [data, department, year, program, comparison, location.pathname, reduceMotion])

  useEffect(() => {
    getDashboard().then((payload) => {
      setData(payload)
      setInterventions(payload.interventions || [])
    }).catch((problem) => setError(problem.message))
  }, [])

  const allStudents = data?.students || []
  const students = allStudents.filter((student) =>
    (department === 'All departments' || student.department === department) &&
    (year === 'All years' || String(student.year) === year) &&
    (program === 'All programs' || student.program === program),
  )
  const filteredInsights = buildInsights(students)
  const departments = [...new Set(allStudents.map((student) => student.department))].sort()
  const years = [...new Set(allStudents.map((student) => String(student.year)))].sort()
  const programs = [...new Set(allStudents.map((student) => student.program).filter(Boolean))].sort()
  const motionProps = reduceMotion ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.28 } }

  async function saveIntervention(payload) {
    const saved = await createIntervention(payload)
    setInterventions((current) => [saved, ...current])
  }

  async function setInterventionStatus(item, status, note = '') {
    const updated = await updateIntervention(item.id, status, note)
    setInterventions((current) => current.map((entry) => entry.id === updated.id ? updated : entry))
  }

  function startDemoSession(name, role) {
    const user = { name: name.trim(), role }
    localStorage.setItem('student-success-demo-user', JSON.stringify(user))
    setDemoUser(user)
    setSignInOpen(false)
  }

  function endDemoSession() {
    localStorage.removeItem('student-success-demo-user')
    setDemoUser(null)
  }

  if (error) return <div className="fatal"><div><FileSpreadsheet size={30} /><h1>Student Success AI</h1><p>{error}</p><code>uvicorn backend.main:app --reload</code></div></div>
  if (!data) return <div className="loading-screen"><span className="spinner" /><span>Connecting the cohort data</span></div>

  return (
    <div className="shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <Link className="brand" to="/" onClick={() => setMobileOpen(false)}>
          <span className="brand-mark"><GraduationCap size={21} /></span>
          <span><b>STUDENT</b><small>SUCCESS INTELLIGENCE</small></span>
        </Link>
        <div className="workspace"><span className="workspace-icon"><Activity size={16} /></span><span><b>Cohort workspace</b><small><i /> CSV cohort snapshot</small></span><ChevronDown size={14} /></div>
        <p className="nav-caption"><span /> YOUR WORKSPACE</p>
        <nav className="nav-list">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
              <span className="nav-icon"><Icon size={17} strokeWidth={1.8} /></span><span className="nav-link-label">{label}</span>
              {label === 'Interventions' && interventions.length > 0 && <i className="nav-count">{interventions.length}</i>}
              <ArrowRight className="nav-arrow" size={13} />
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <button className="sidebar-assistant-link" onClick={() => { setAssistantOpen(true); setMobileOpen(false) }}><span><Bot size={16} /></span><span><b>Ask cohort assistant</b><small>Explore this filtered view</small></span><ArrowRight size={14} /></button>
        <div className="privacy-note"><ShieldCheck size={17} /><span>Support indicators only.<br />Not a student judgment.</span></div>
        <div className="user-row"><span className="avatar">{demoUser ? demoUser.name.slice(0, 2).toUpperCase() : 'DS'}</span><span><b>{demoUser?.name || 'Demo session'}</b><small>{demoUser?.role || 'Not signed in'}</small></span></div>
      </aside>
      {mobileOpen && <button className="scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
      <main ref={dashboardRef} className="main-area bg-slate-50">
        <header className="topbar bg-white/90">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={19} /></button>
          <div className="breadcrumb"><span>Student analytics</span><span>/</span><b>{isStudentProfile ? 'Student profile' : navItems.find((item) => item.to === location.pathname)?.label || 'Overview'}</b></div>
          <div className="top-actions"><span className="data-status"><i /> Snapshot loaded</span><button className="icon-button" aria-label="Help"><CircleHelp size={18} /></button><div className="notification-wrap"><button className="icon-button notification" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Bell size={18} />{students.some((student) => student.overall_risk === 'High priority') && <i />}</button><AnimatePresence>{notificationsOpen && <NotificationPanel students={students} onOpen={(student) => { setSelected(student); setNotificationsOpen(false) }} />}</AnimatePresence></div><button className="icon-button theme-toggle" title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button>{demoUser ? <button className="auth-button auth-button-signed-in" onClick={endDemoSession}><span className="auth-avatar-mini">{demoUser.name.slice(0, 2).toUpperCase()}</span><span className="auth-button-copy"><small>SESSION</small><b>{demoUser.name}</b></span><LogOut size={14} /></button> : <button className="auth-button auth-button-signin" onClick={() => setSignInOpen(true)}><span className="signin-icon"><LogIn size={15} /></span><span className="auth-button-copy"><small>WELCOME</small><b>Sign in</b></span><ArrowRight size={14} className="signin-arrow" /></button>}</div>
        </header>
        <div className="page-wrap">
          {!isStudentProfile && <div className="page-heading">
            <div><p className="eyebrow">STUDENT SUCCESS INTELLIGENCE <span>•</span> COHORT VIEW</p><h1>{navItems.find((item) => item.to === location.pathname)?.label || 'Overview'}</h1><p className="heading-sub">A clearer view of where support can make a difference.</p></div>
            <div className="filters"><label><span>Department</span><select value={department} onChange={(event) => setDepartment(event.target.value)}><option>All departments</option>{departments.map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Program</span><select value={program} onChange={(event) => setProgram(event.target.value)}><option>All programs</option>{programs.map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Year</span><select value={year} onChange={(event) => setYear(event.target.value)}><option>All years</option>{years.map((value) => <option key={value} value={value}>Year {value}</option>)}</select></label></div>
          </div>}
          <AnimatePresence mode="wait"><motion.div key={location.pathname} {...motionProps}>
            <Routes>
              <Route path="/" element={<Overview students={students} allStudents={allStudents} data={data} insights={filteredInsights} onOpen={setSelected} comparison={comparison} onComparisonChange={setComparison} />} />
              <Route path="/students" element={<Directory students={students} onOpen={setSelected} />} />
              <Route path="/students/:studentId" element={<StudentProfilePage students={allStudents} onBack={() => navigate('/students')} />} />
              <Route path="/segments" element={<Segments students={students} onOpen={setSelected} />} />
              <Route path="/insights" element={<Insights insights={filteredInsights} students={students} onOpen={setSelected} />} />
              <Route path="/interventions" element={<Interventions items={interventions} onSave={saveIntervention} onStatus={setInterventionStatus} students={students} />} />
            </Routes>
          </motion.div></AnimatePresence>
          {location.pathname === '/segments' && <SegmentAnalysis students={students} onOpen={setSelected} />}
          <footer className="footnote"><span><ShieldCheck size={14} /> Scores are weighted summaries; risk indicators suggest support, not outcomes.</span><span>Dataset: {data.data_quality.unique_students.toLocaleString()} student records · {data.data_quality.missing_cells} missing cells</span></footer>
        </div>
      </main>
      {selected && <StudentDrawer student={selected} onClose={() => setSelected(null)} onFullProfile={() => { setSelected(null); navigate(`/students/${encodeURIComponent(selected.id)}`) }} onSave={saveIntervention} />}
      <CohortAssistant
        open={assistantOpen}
        onToggle={() => setAssistantOpen((current) => !current)}
        students={students}
        insights={filteredInsights}
        onOpenStudent={(student) => {
          setAssistantOpen(false)
          setSelected(student)
        }}
      />
      <AnimatePresence>{signInOpen && <DemoSignIn onClose={() => setSignInOpen(false)} onSignIn={startDemoSession} />}</AnimatePresence>
    </div>
  )
}

function DemoSignIn({ onClose, onSignIn }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('Faculty')

  return <motion.div className="modal-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <motion.form className="intervention-form signin-form" role="dialog" aria-modal="true" aria-labelledby="signin-title" initial={{ opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98 }} onSubmit={(event) => { event.preventDefault(); onSignIn(name, role) }}>
      <div className="form-head"><div><span className="eyebrow">LOCAL DEMO SESSION</span><h2 id="signin-title">Sign in to the prototype</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close sign-in dialog"><X size={18} /></button></div>
      <p className="signin-explainer">This only personalizes the interface in this browser. It does not authenticate a real account or protect student data.</p>
      <label>Display name<input autoFocus required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Alex Morgan" /></label>
      <label>Demo role<select value={role} onChange={(event) => setRole(event.target.value)}><option>Faculty</option><option>Administrator</option><option>Student support</option></select></label>
      <div className="form-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancel</button><button className="button-primary"><LogIn size={14} /> Start demo session</button></div>
    </motion.form>
  </motion.div>
}

function Kpi({ label, value, suffix = '', detail, icon: Icon, tone = 'green' }) {
  const cardRef = useRef(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!cardRef.current || reduceMotion) return
    const tween = gsap.fromTo(cardRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.42, delay: 0.05, ease: 'power2.out', clearProps: 'transform,opacity' },
    )
    return () => tween.kill()
  }, [reduceMotion])

  return <motion.article ref={cardRef} className="kpi filter-transition-item" whileHover={reduceMotion ? undefined : { y: -3, transition: { duration: 0.18 } }}><div className="kpi-top"><span>{label}</span><span className={`kpi-icon ${tone}`}><Icon size={17} /></span></div><strong><span>{value}</span>{suffix && <small>{suffix}</small>}</strong><p>{detail}</p></motion.article>
}

function ProgressMetric({ label, value, display, tone }) {
  const fillRef = useRef(null)
  const reduceMotion = useReducedMotion()
  const boundedValue = Math.max(0, Math.min(100, value || 0))

  useEffect(() => {
    if (!fillRef.current) return
    if (reduceMotion) {
      fillRef.current.style.width = `${boundedValue}%`
      return
    }
    const tween = gsap.fromTo(fillRef.current, { width: '0%' }, { width: `${boundedValue}%`, duration: .9, ease: 'power2.out' })
    return () => tween.kill()
  }, [boundedValue, reduceMotion])

  return <div className={`progress-metric ${tone}`}><div><span>{label}</span><b>{display}</b></div><div className="progress-track"><i ref={fillRef} /></div></div>
}

function ScoreHeatmap({ students, onOpen }) {
  const heatmapRef = useRef(null)
  const reduceMotion = useReducedMotion()
  const sorted = [...students].sort((left, right) => left.id.localeCompare(right.id))
  useEffect(() => {
    if (!heatmapRef.current) return
    const cells = heatmapRef.current.querySelectorAll('.score-heat-cell')
    if (!cells.length) return
    if (reduceMotion) {
      gsap.set(cells, { opacity: 1, scale: 1 })
      return
    }
    const tween = gsap.fromTo(cells, { opacity: 0, scale: .35 }, { opacity: 1, scale: 1, duration: .42, stagger: .0015, ease: 'back.out(1.35)' })
    return () => tween.kill()
  }, [students, reduceMotion])

  return <div className="score-heatmap" ref={heatmapRef} role="list" aria-label="Student Success Score heatmap">{sorted.map((student) => {
    const band = (student.success_score ?? 0) >= 75 ? 'heat-high' : (student.success_score ?? 0) >= 50 ? 'heat-mid' : 'heat-low'
    return <button key={student.id} type="button" role="listitem" className={`score-heat-cell ${band}`} title={`${student.id}: ${fmt(student.success_score, 1)} score`} aria-label={`Open ${student.id}, Student Success Score ${fmt(student.success_score, 1)}`} onClick={(event) => { if (!reduceMotion) gsap.fromTo(event.currentTarget, { boxShadow: '0 0 0 0 rgba(120,255,240,0)' }, { boxShadow: '0 0 0 7px rgba(120,255,240,.28)', duration: .28, yoyo: true, repeat: 1, clearProps: 'boxShadow' }); onOpen(student) }} />
  })}</div>
}

const profileTabs = ['Academics', 'Attendance', 'LMS', 'Engagement', 'Placement']

function ProfileFocus({ student, tab }) {
  const academicHistory = [
    { label: 'Previous CGPA', value: student.previous_cgpa, source: 'Previous semester field' },
    { label: 'Current CGPA', value: student.cgpa, source: 'Current cohort field' },
  ].filter((item) => item.value != null)
  const drivers = Object.entries(student.components || {})
    .filter(([, score]) => score != null)
    .map(([key, score]) => ({ name: componentLabels[key] || key, value: score * ({ academic: .3, attendance: .2, lms: .15, placement: .2, skills: .1, engagement: .05 })[key] }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 3)

  if (tab === 'Academics') return <div className="profile-focus"><div className="focus-heading"><h3>Academic performance</h3><span>Observed CGPA fields</span></div><div className="chart-container profile-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={academicHistory} margin={{ top: 14, right: 12, left: -22, bottom: 4 }}><CartesianGrid vertical={false} stroke="#e8edf4" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} /><YAxis domain={[0, 10]} tickLine={false} axisLine={false} tick={{ fontSize: 9 }} /><Tooltip formatter={(value) => [`${Number(value).toFixed(2)} / 10`, 'CGPA']} /><Line type="monotone" dataKey="value" stroke="#3976d2" strokeWidth={3} dot={{ r: 5, fill: '#3976d2' }} /></LineChart></ResponsiveContainer></div><div className="profile-facts"><span>Subject average <b>{fmt(student.subject_performance, 1)}%</b></span><span>Internal marks <b>{fmt(student.internal_marks, 1)}</b></span><span>Backlogs <b>{student.backlogs}</b></span></div></div>
  if (tab === 'Attendance') return <div className="profile-focus"><div className="focus-heading"><h3>Attendance</h3><span>Current cohort snapshot</span></div><ProgressMetric label="Overall attendance" value={student.attendance} display={`${fmt(student.attendance, 1)}%`} tone="blue" /><div className="profile-facts"><span>Attendance trend label <b>{student.attendance_trend || 'Not supplied'}</b></span></div><p className="data-caveat">The file contains a current attendance value and a categorical trend, but no dated attendance series. This view does not imply a time-series chart.</p></div>
  if (tab === 'LMS') return <div className="profile-focus"><div className="focus-heading"><h3>LMS activity</h3><span>Current available indicators</span></div><ProgressMetric label="Assignment completion" value={student.assignment_completion} display={`${fmt(student.assignment_completion, 1)}%`} tone="teal" /><ProgressMetric label="LMS activity index" value={student.components?.lms} display={`${fmt(student.components?.lms, 1)} / 100`} tone="blue" /><div className="profile-facts"><span>Logins / week <b>{fmt(student.lms_logins, 1)}</b></span><span>Quiz average <b>{fmt(student.quiz_average, 1)}%</b></span></div></div>
  if (tab === 'Engagement') return <div className="profile-focus"><div className="focus-heading"><h3>Engagement & feedback</h3><span>Participation is not a proxy for ability</span></div><div className="profile-facts"><span>Extracurricular score <b>{fmt(student.components?.engagement, 1)}</b></span><span>Events <b>{student.events ?? '—'}</b></span><span>Clubs <b>{student.clubs ?? '—'}</b></span><span>Certifications <b>{student.certifications ?? '—'}</b></span><span>Student satisfaction <b>{fmt(student.satisfaction, 1)}</b></span><span>Faculty feedback <b>{fmt(student.faculty_feedback, 1)}</b></span></div></div>
  if (tab === 'Placement') return <div className="profile-focus"><div className="focus-heading"><h3>Placement readiness</h3><span>Observed preparation indicators</span></div><ProgressMetric label="Placement readiness" value={student.placement_readiness} display={`${fmt(student.placement_readiness, 1)} / 100`} tone="amber" /><div className="profile-facts"><span>Aptitude <b>{fmt(student.aptitude, 1)}</b></span><span>Coding <b>{fmt(student.coding, 1)}</b></span><span>Mock interview <b>{fmt(student.mock_interview, 1)}</b></span><span>Technical skills <b>{fmt(student.technical_skills, 1)}</b></span><span>Soft skills <b>{fmt(student.soft_skills, 1)}</b></span></div></div>
  return <div className="profile-focus"><div className="focus-heading"><h3>Top score contributors</h3><span>Normalized component × methodology weight</span></div><div className="explain-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={drivers} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="80%" paddingAngle={4}>{drivers.map((item, index) => <Cell key={item.name} fill={['#3976d2', '#138a98', '#e4a344'][index]} />)}</Pie><Tooltip formatter={(value, name) => [`${Number(value).toFixed(1)} weighted points`, name]} /><Legend iconType="circle" iconSize={7} /></PieChart></ResponsiveContainer></div><div className="profile-facts"><span>Data coverage <b>{student.coverage}%</b></span><span>Lowest component <b>{componentLabels[student.lowest_component] || 'Unavailable'}</b></span><span>Strongest component <b>{componentLabels[student.strongest_component] || 'Unavailable'}</b></span></div></div>
}

function Panel({ title, detail, action, children, className = '' }) {
  return <section className={`panel filter-transition-item ${className}`}><div className="panel-head"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>{children}</section>
}

function Overview({ students, allStudents, data, insights, onOpen, comparison, onComparisonChange }) {
  const reduceMotion = useReducedMotion()
  const needsSupport = students.filter((student) => student.overall_risk !== 'On track')
  const avgScore = average(students, 'success_score')
  const avgAttendance = average(students, 'attendance')
  const cgpaKey = comparison === 'Previous semester' ? 'previous_cgpa' : 'cgpa'
  const avgCgpa = average(students, cgpaKey)
  const placementReady = students.filter((student) => (student.placement_readiness || 0) >= 65).length
  const riskRows = [
    { name: 'On track', value: students.filter((student) => student.overall_risk === 'On track').length },
    { name: 'Needs attention', value: students.filter((student) => student.overall_risk === 'Needs attention').length },
    { name: 'High priority', value: students.filter((student) => student.overall_risk === 'High priority').length },
  ]
  const departments = [...new Set(students.map((student) => student.department))].sort().map((name) => {
    const group = students.filter((student) => student.department === name)
    return { department: name, score: average(group, 'success_score'), placement: average(group, 'placement_readiness'), previousCgpa: average(group, 'previous_cgpa'), cgpa: average(group, 'cgpa'), selectedCgpa: average(group, cgpaKey), count: group.length }
  })
  const scatter = students.map((student) => ({ attendance: student.attendance, cgpa: student.cgpa, student }))
  const attentionList = [...needsSupport].sort((a, b) => (a.success_score || 100) - (b.success_score || 100)).slice(0, 6)
  const metrics = data.model_metrics || {}
  const onTrack = riskRows[0].value
  const needsReview = riskRows[1].value
  const highPriority = riskRows[2].value
  const highPriorityShare = students.length ? Math.round(highPriority / students.length * 100) : 0
  const suggestedActions = [
    { title: 'Academic support', count: students.filter((student) => student.academic_risk !== 'On track').length, action: 'Offer faculty check-ins, attendance support, or targeted remedial sessions.', tone: 'blue' },
    { title: 'Placement preparation', count: students.filter((student) => student.placement_risk !== 'On track').length, action: 'Schedule focused coding practice and structured mock-interview feedback.', tone: 'amber' },
    { title: 'Review data gaps', count: students.filter((student) => student.coverage < 67).length, action: 'Verify missing records before interpreting individual support indicators.', tone: 'teal' },
  ].filter((suggestion) => suggestion.count > 0)

  return <div className="stack">
    <section className="cohort-pulse">
      <div className="pulse-copy">
        <span className="pulse-kicker"><i /> COHORT PULSE <span>·</span> FILTERED VIEW</span>
        <h2>Every student deserves<br />a timely signal.</h2>
        <p>{students.length.toLocaleString()} profiles in view. Use these indicators to start a conversation, not to make a decision about a student.</p>
      </div>
      <div className="pulse-visual" aria-label={`${highPriorityShare}% high priority support signals`}>
        <div className="pulse-ring" style={{ '--pulse-share': `${highPriorityShare}%` }}><div><b>{highPriorityShare}<small>%</small></b><span>high priority</span></div></div>
        <div className="pulse-legend">
          <div><i className="pulse-dot priority" /><span>High priority</span><b>{highPriority}</b></div>
          <div><i className="pulse-dot review" /><span>Needs review</span><b>{needsReview}</b></div>
          <div><i className="pulse-dot track" /><span>On track</span><b>{onTrack}</b></div>
        </div>
      </div>
      <div className="pulse-index">01 <span>/ 05</span></div>
    </section>
    <div className="kpi-grid">
      <Kpi label="Students in view" value={students.length.toLocaleString()} detail={`${data.data_quality.unique_students.toLocaleString()} in cohort snapshot`} icon={Users} />
      <Kpi label="Support signals" value={needsSupport.length.toLocaleString()} detail={`${students.length ? Math.round(needsSupport.length / students.length * 100) : 0}% of filtered cohort`} icon={Activity} tone="amber" />
      <Kpi label="Avg. success score" value={fmt(avgScore, 1)} suffix="/100" detail="Weighted observed indicators" icon={Target} />
      <Kpi label="Avg. attendance" value={fmt(avgAttendance, 1)} suffix="%" detail={`Avg. CGPA ${fmt(avgCgpa, 2)} / 10 · ${comparison}`} icon={BookOpenCheck} tone="blue" />
      <Kpi label="Placement ready" value={students.length ? `${Math.round(placementReady / students.length * 100)}%` : '—'} detail="Readiness score ≥ 65" icon={BriefcaseBusiness} tone="coral" />
    </div>

    <Panel title="Student Success Score · transparent weighted summary" detail="Initial design weights; not a validated prediction" className="score-method-panel">
      <p className="score-formula">Score = 0.30 × Academic + 0.20 × Attendance + 0.15 × LMS + 0.20 × Placement + 0.10 × Skills + 0.05 × Engagement</p>
      <div className="weight-strip">{Object.entries(data.weights).map(([key, weight]) => <div key={key}><span>{componentLabels[key]}</span><b>{Math.round(weight * 100)}%</b><i><em style={{ width: `${weight * 100 * 3.33}%` }} /></i></div>)}</div>
      <p className="score-coverage-note">Each component is normalized to 0–100. Missing components are omitted and remaining weights are renormalized; coverage shows how many of six components are present.</p>
      <div className="metric-progress-grid"><ProgressMetric label="Average CGPA" value={Math.min(100, avgCgpa * 10)} display={`${fmt(avgCgpa, 2)} / 10`} tone="blue" /><ProgressMetric label="Attendance" value={avgAttendance} display={`${fmt(avgAttendance, 1)}%`} tone="teal" /><ProgressMetric label="LMS activity" value={students.length ? students.reduce((total, student) => total + (student.components.lms ?? 0), 0) / students.length : 0} display={`${fmt(students.length ? students.reduce((total, student) => total + (student.components.lms ?? 0), 0) / students.length : 0, 1)} / 100`} tone="amber" /></div>
    </Panel>

    <Panel title="Success score heatmap" detail="Each cell is one student; color indicates the support band" action={<div className="heat-legend"><span><i className="heat-high" />75–100</span><span><i className="heat-mid" />50–74</span><span><i className="heat-low" />0–49</span></div>}>
      <ScoreHeatmap students={students} onOpen={onOpen} />
    </Panel>

    <div className="chart-grid chart-grid-wide">
      <Panel title="Cohort risk distribution" detail="Rule-based support indicators" action={<span className="chart-tag">{students.length.toLocaleString()} students</span>}>
        <div className="risk-chart-wrap"><div className="donut-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={riskRows} dataKey="value" nameKey="name" innerRadius="69%" outerRadius="92%" paddingAngle={3} stroke="none">{riskRows.map((entry, index) => <Cell key={entry.name} fill={['#138a98', '#e4a344', '#db6e78'][index]} />)}</Pie><Tooltip formatter={(value, name) => [value, name]} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{students.length}</strong><small>students</small></div></div><div className="risk-legend">{riskRows.map((row, index) => <div key={row.name}><span className={`legend-dot dot-${index}`} /><span>{row.name}</span><b>{row.value}</b><small>{students.length ? Math.round(row.value / students.length * 100) : 0}%</small></div>)}</div></div>
      </Panel>
      <Panel title="Department performance" detail="Average success and placement readiness">
        <div className="chart-container"><ResponsiveContainer width="100%" height="100%"><BarChart data={departments} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barGap={6}><CartesianGrid vertical={false} stroke="#e8edf4" /><XAxis dataKey="department" tickLine={false} axisLine={false} tick={{ fill: '#718096', fontSize: 11 }} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#8290a4', fontSize: 10 }} /><Tooltip cursor={{ fill: '#f2f6fb' }} formatter={(value) => [`${Number(value).toFixed(1)}`, '']} /><Legend iconType="circle" iconSize={7} /><Bar dataKey="score" name="Success score" fill="#138a98" radius={[4, 4, 0, 0]} maxBarSize={20} /><Bar dataKey="placement" name="Placement readiness" fill="#e4a344" radius={[4, 4, 0, 0]} maxBarSize={20} /></BarChart></ResponsiveContainer></div>
      </Panel>
    </div>

    <div className="chart-grid">
      <Panel title="Semester CGPA comparison" detail="Current vs previous value from the supplied snapshot" action={<label className="compact-select"><CalendarDays size={14} /><select value={comparison} onChange={(event) => onComparisonChange(event.target.value)}><option>Current cohort</option><option>Previous semester</option></select></label>}>
        <div className="chart-container"><ResponsiveContainer width="100%" height="100%"><LineChart data={departments} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e8edf4" /><XAxis dataKey="department" tickLine={false} axisLine={false} tick={{ fill: '#718096', fontSize: 10 }} /><YAxis domain={[0, 10]} tickLine={false} axisLine={false} tick={{ fill: '#8290a4', fontSize: 10 }} /><Tooltip formatter={(value) => [Number(value).toFixed(2), 'CGPA']} /><Legend iconType="circle" iconSize={7} /><Line type="monotone" dataKey="previousCgpa" name="Previous CGPA" stroke="#e4a344" strokeWidth={2} dot={{ r: 3 }} /><Line type="monotone" dataKey="cgpa" name="Current CGPA" stroke="#138a98" strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div>
      </Panel>
      <Panel title="Attendance & academic performance" detail="Each mark is a student; hover to inspect their ID" action={<span className="chart-tag">Descriptive</span>}>
        <div className="chart-container scatter-chart"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 12, right: 15, left: -12, bottom: 0 }}><CartesianGrid stroke="#e8edf4" /><XAxis type="number" dataKey="attendance" name="Attendance" unit="%" domain={[20, 100]} tick={{ fill: '#8290a4', fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis type="number" dataKey="cgpa" name="CGPA" domain={[0, 10]} tick={{ fill: '#8290a4', fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value, name) => [name === 'CGPA' ? Number(value).toFixed(2) : `${Number(value).toFixed(1)}%`, name]} labelFormatter={(_, items) => items?.[0]?.payload?.student?.id || 'Student'} /><Scatter data={scatter} fill="#138a98" fillOpacity={0.47} /></ScatterChart></ResponsiveContainer></div>
      </Panel>
      <Panel title="Priority review queue" detail="Lowest observed success scores in filtered cohort" action={<Link className="text-link" to="/students">All students <ArrowRight size={13} /></Link>}>
        <div className="attention-list">{attentionList.map((student) => <button className="attention-item" key={student.id} onClick={() => onOpen(student)}><span className="id-avatar">{student.id.slice(-2)}</span><span className="attention-main"><b>{student.id}</b><small>{student.department} · Year {student.year}</small></span><span className="attention-score"><b>{fmt(student.success_score, 1)}</b><small>score</small></span><RiskPill value={student.overall_risk} /></button>)}</div>
      </Panel>
    </div>

    <div className="chart-grid insight-band">
      <Panel title="Signals from this cohort" detail="Calculated from currently filtered records" action={<Link className="text-link" to="/insights">View all <ArrowRight size={13} /></Link>}>
        {insights.length ? <div className="insight-row">{insights.slice(0, 3).map((insight) => <article className="mini-insight" key={insight.title}><span className={`insight-priority ${insight.priority.toLowerCase()}`}>{insight.priority}</span><b>{insight.title}</b><p>{insight.count} students · {insight.metric}</p><small>{insight.action}</small></article>)}</div> : <div className="empty-state">No cohort signals match the selected filters.</div>}
      </Panel>
    </div>
    <Panel title="Intervention suggestions" detail="Cohort-derived prompts to review with students and faculty" className="suggestion-panel faculty-suggestions-panel">
      <motion.div className="suggestion-list faculty-suggestion-list" initial={reduceMotion ? false : 'hidden'} animate="visible" variants={{ hidden: {}, visible: { transition: { delayChildren: .08, staggerChildren: .11 } } }}>{suggestedActions.map((suggestion) => <motion.article key={suggestion.title} className={`suggestion-item faculty-suggestion-item ${suggestion.tone}`} variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: .38, ease: 'easeOut' } } }}><span className="suggestion-count">{suggestion.count}</span><div><b>{suggestion.title}</b><p>{suggestion.action}</p></div><span className="suggestion-label">Review prompt</span></motion.article>)}</motion.div>
    </Panel>
    <ModelNote metrics={metrics} count={allStudents.length} />
  </div>
}

function RiskPill({ value, reasons = [] }) {
  const klass = value === 'High priority' ? 'risk-high' : value === 'Needs attention' ? 'risk-review' : 'risk-good'
  const explanation = reasons.length ? reasons.join('; ') : value === 'On track' ? 'No current threshold crossed.' : 'Open the student profile to review the contributing rules.'
  return <span className={`risk-pill ${klass}`} tabIndex={0} title={explanation} aria-label={`${value}. ${explanation}`}><i />{shortRisk(value)}</span>
}

function NotificationPanel({ students, onOpen }) {
  const alerts = students.filter((student) => student.overall_risk === 'High priority').sort((left, right) => (left.success_score ?? 100) - (right.success_score ?? 100)).slice(0, 5)
  const reduceMotion = useReducedMotion()
  return <motion.div className="notification-panel admin-glass-panel" initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }} transition={{ duration: .24, ease: 'easeOut' }} role="region" aria-label="High priority student notifications"><div className="notification-title"><span><Bell size={14} /> Faculty alerts</span><b>{alerts.length}</b></div>{alerts.length ? <motion.div className="admin-alert-list" initial={reduceMotion ? false : 'hidden'} animate="visible" variants={{ hidden: {}, visible: { transition: { delayChildren: .06, staggerChildren: .065 } } }}>{alerts.map((student) => <motion.button key={student.id} variants={{ hidden: { opacity: 0, y: 9 }, visible: { opacity: 1, y: 0, transition: { duration: .2 } } }} onClick={() => onOpen(student)}><i /><span><b>{student.id}</b><small>{student.department} · {shortRisk(student.overall_risk)} · {fmt(student.success_score, 1)} score</small></span><ArrowRight size={14} /></motion.button>)}</motion.div> : <p className="notification-empty">No high-priority support signals in this filtered cohort.</p>}<small className="notification-disclaimer">Support prompts only · Review context before action</small></motion.div>
}

function ModelNote({ metrics, count }) {
  return <div className="model-note"><span><Sparkles size={16} /></span><div><b>Baseline models · Demonstration only</b><p>Logistic regression estimates the cohort’s existing risk flags. Those flags are proxy labels, not independently verified future outcomes. Evaluation uses a stratified 75/25 split; do not interpret these metrics as deployment-ready accuracy.</p><div className="model-metrics">{Object.entries(metrics).map(([area, values]) => <small key={area}>{area} proxy · {values.test_rows}/{count} holdout · balanced accuracy {values.balanced_accuracy} · AUC {values.roc_auc}</small>)}</div></div></div>
}

function Directory({ students, onOpen }) {
  const [search, setSearch] = useState('')
  const [risk, setRisk] = useState('All risk levels')
  const [sort, setSort] = useState('success_score')
  const [page, setPage] = useState(1)
  const pageSize = 14
  const rows = students.filter((student) => (student.id.toLowerCase().includes(search.toLowerCase()) || student.department.toLowerCase().includes(search.toLowerCase())) && (risk === 'All risk levels' || student.overall_risk === risk)).sort((a, b) => (Number(b[sort]) || 0) - (Number(a[sort]) || 0))
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize)

  function exportCsv() {
    const columns = ['id', 'department', 'year', 'cgpa', 'attendance', 'assignment_completion', 'placement_readiness', 'success_score', 'overall_risk', 'segment']
    const csv = [columns.join(','), ...rows.map((row) => columns.map((key) => JSON.stringify(row[key] ?? '')).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'student-success-filtered.csv'; anchor.click(); URL.revokeObjectURL(url)
  }

  return <div className="stack admin-tooling">
    <div className="directory-toolbar"><div className="search-field"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search student ID or department" /></div><label className="compact-select"><Filter size={15} /><select value={risk} onChange={(event) => { setRisk(event.target.value); setPage(1) }}><option>All risk levels</option><option>High priority</option><option>Needs attention</option><option>On track</option></select></label><label className="compact-select"><span>Sort:</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="success_score">Success score</option><option value="cgpa">CGPA</option><option value="attendance">Attendance</option><option value="placement_readiness">Placement readiness</option></select></label><RippleExportButton onExport={exportCsv} /></div>
    <Panel title="Student directory" detail={`${rows.length} records · Names are not exposed in this prototype`} className="table-panel">
      <div className="table-scroll"><table><thead><tr><th>Student ID</th><th>Department / Year</th><th>CGPA</th><th>Attendance</th><th>Assignments</th><th>Placement</th><th>Success score</th><th>Support signal</th><th>Suggested action</th><th /></tr></thead><tbody>{pageRows.map((student) => <tr key={student.id} onClick={() => onOpen(student)}><td><b className="student-code">{student.id}</b></td><td>{student.department}<small className="cell-sub">Year {student.year}</small></td><td>{fmt(student.cgpa, 2)}</td><td>{fmt(student.attendance, 1)}%</td><td>{fmt(student.assignment_completion, 1)}%</td><td>{fmt(student.placement_readiness, 1)}</td><td><span className="score-cell">{fmt(student.success_score, 1)}</span><div className="tiny-meter"><i style={{ width: `${student.success_score || 0}%` }} /></div></td><td><RiskPill value={student.overall_risk} /></td><td className="action-cell">{student.academic_risk !== 'On track' ? 'Faculty check-in / remedial support' : student.placement_risk !== 'On track' ? 'Coding practice / mock interview' : student.coverage < 67 ? 'Review data completeness' : 'Continue current support'}</td><td><ArrowRight size={15} className="row-arrow" /></td></tr>)}</tbody></table>{!pageRows.length && <div className="empty-state">No students match those filters.</div>}</div>
      <div className="pagination"><span>Showing {rows.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, rows.length)} of {rows.length}</span><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>{page} / {pageCount}</span><button disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
    </Panel>
    <p className="small-note"><ShieldCheck size={14} /> Risk indicators are configurable prototype rules and should be reviewed with faculty before operational use.</p>
  </div>
}

function RippleExportButton({ onExport }) {
  const [rippleKey, setRippleKey] = useState(0)
  const reduceMotion = useReducedMotion()
  function handleExport() {
    onExport()
    if (!reduceMotion) setRippleKey((key) => key + 1)
  }
  return <motion.button className="button-secondary export-action-button" onClick={handleExport} whileHover={reduceMotion ? undefined : { y: -1 }} whileTap={reduceMotion ? undefined : { scale: .97 }}><AnimatePresence>{rippleKey > 0 && <motion.span key={rippleKey} className="export-ripple" aria-hidden="true" initial={{ scale: 0, opacity: .34 }} animate={{ scale: 16, opacity: 0 }} transition={{ duration: .5, ease: 'easeOut' }} />}</AnimatePresence><Download size={15} /><span>Export CSV</span></motion.button>
}

function SegmentAnalysis({ students, onOpen }) {
  const [compareA, setCompareA] = useState(students[0]?.id || '')
  const [compareB, setCompareB] = useState(students[1]?.id || '')
  const uniqueYears = [...new Set(students.map((student) => student.year).filter((year) => year != null))].sort((a, b) => a - b)
  const selectedCompareA = students.some((student) => student.id === compareA) ? compareA : students[0]?.id || ''
  const selectedCompareB = students.some((student) => student.id === compareB) ? compareB : students[1]?.id || ''
  const studentA = students.find((student) => student.id === selectedCompareA)
  const studentB = students.find((student) => student.id === selectedCompareB)
  const metrics = studentA && studentB ? [
    { metric: 'Success', first: studentA.success_score, second: studentB.success_score },
    { metric: 'Academic', first: studentA.components.academic, second: studentB.components.academic },
    { metric: 'Attendance', first: studentA.attendance, second: studentB.attendance },
    { metric: 'Placement', first: studentA.placement_readiness, second: studentB.placement_readiness },
  ] : []
  const trends = uniqueYears.map((year) => {
    const cohort = students.filter((student) => student.year === year)
    return {
      year: `Year ${year}`,
      cgpa: average(cohort, 'cgpa'),
      previousCgpa: average(cohort, 'previous_cgpa'),
      attendance: average(cohort, 'attendance'),
      criticalAttendance: average(cohort, 'critical_attendance'),
      count: cohort.length,
    }
  })

  return <div className="segmentation-module">
    <section className="segment-hero">
      <div><span className="segment-eyebrow"><i /> COHORT INTELLIGENCE · LIVE VIEW</span><h2>Segmentation <em>&</em> insights</h2><p>Explore student support clusters, compare observed indicators, and scan cohort patterns.</p></div>
      <div className="segment-hero-stat"><span>FILTERED COHORT</span><b>{students.length.toLocaleString()}</b><small>student records</small></div>
    </section>
    <div className="segment-primary-grid">
      <Panel title="3D student clusters" detail="Drag to orbit · Hover a node for its support snapshot · Click to open profile" className="segment-dark-panel">
        <ThreeSegmentMap students={students} onOpen={onOpen} />
      </Panel>
      <Panel title="Compare students" detail="Side-by-side observed indicators" className="segment-dark-panel segment-compare-panel">
        <div className="compare-selects"><label>STUDENT A<select value={selectedCompareA} onChange={(event) => setCompareA(event.target.value)}>{students.map((student) => <option key={student.id} value={student.id}>{student.id}</option>)}</select></label><span className="segment-compare-vs">VS</span><label>STUDENT B<select value={selectedCompareB} onChange={(event) => setCompareB(event.target.value)}>{students.map((student) => <option key={student.id} value={student.id}>{student.id}</option>)}</select></label></div>
        {metrics.length ? <motion.div key={`${studentA.id}-${studentB.id}`} className="segment-compare-result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
          <div className="segment-compare-identities"><button onClick={() => onOpen(studentA)}><i className="segment-legend-dot on-track" />{studentA.id}<ArrowRight size={13} /></button><button onClick={() => onOpen(studentB)}><i className="segment-legend-dot needs-attention" />{studentB.id}<ArrowRight size={13} /></button></div>
          <div className="chart-container compare-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={metrics} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><CartesianGrid vertical={false} stroke="rgba(136,194,219,.14)" /><XAxis dataKey="metric" tick={{ fill: '#90aabd', fontSize: 9 }} axisLine={{ stroke: 'rgba(136,194,219,.2)' }} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fill: '#90aabd', fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: '#0d1d31', border: '1px solid rgba(0,242,254,.28)', borderRadius: 8, color: '#d7faff' }} /><Legend iconType="circle" iconSize={7} /><Bar dataKey="first" name={studentA.id} fill="#00f2fe" fillOpacity={.86} radius={[4, 4, 0, 0]} animationDuration={650} /><Bar dataKey="second" name={studentB.id} fill="#4facfe" fillOpacity={.86} radius={[4, 4, 0, 0]} animationDuration={650} /></BarChart></ResponsiveContainer></div>
          <div className="segment-compare-foot"><span>Scores normalized to 0–100 where available.</span><button onClick={() => onOpen(studentA)}>Open profiles <ArrowRight size={13} /></button></div>
        </motion.div> : <div className="segment-empty">Select students to compare their observed signals.</div>}
      </Panel>
    </div>
    <CohortTrendAnalysis trends={trends} />
  </div>
}

function ThreeSegmentMap({ students, onOpen }) {
  const mountRef = useRef(null)
  const [hovered, setHovered] = useState(null)
  const reduceMotion = useReducedMotion()
  const colors = segmentClusterColors
  const groupNames = segmentGroupNames
  const nodeCount = groupNames.reduce((total, groupName) => {
    const count = students.filter((student) => student.overall_risk === groupName && student.success_score != null && student.placement_readiness != null).length
    return total + Math.ceil(count / Math.max(1, Math.ceil(count / 85)))
  }, 0)

  useEffect(() => {
    if (!mountRef.current) return undefined
    const host = mountRef.current
    let renderer
    let frame = 0
    let resizeObserver
    try {
      const scene = new THREE.Scene()
      scene.background = new THREE.Color('#071321')
      scene.fog = new THREE.FogExp2('#071321', .035)
      const camera = new THREE.PerspectiveCamera(48, 1, .1, 100)
      camera.position.set(0, 1.15, 13.8)
      renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: 'low-power' })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.setClearColor('#071321', 1)
      renderer.domElement.className = 'segment-three-canvas'
      renderer.domElement.setAttribute('aria-label', 'Interactive 3D student support segment clusters')
      host.appendChild(renderer.domElement)

      const root = new THREE.Group()
      scene.add(root)
      scene.add(new THREE.AmbientLight('#a9d8ff', 1.3))
      const keyLight = new THREE.PointLight('#00f2fe', 130, 24)
      keyLight.position.set(-4, 5, 5)
      scene.add(keyLight)
      const fillLight = new THREE.PointLight('#4facfe', 95, 24)
      fillLight.position.set(4, -2, 3)
      scene.add(fillLight)

      const starPositions = new Float32Array(900 * 3)
      for (let i = 0; i < starPositions.length; i += 3) {
        starPositions[i] = Math.sin((i + 1) * 12.9898) * 13.5
        starPositions[i + 1] = Math.sin((i + 1) * 78.233) * 7.5
        starPositions[i + 2] = Math.sin((i + 1) * 39.425) * 6.5 - 2
      }
      const starGeometry = new THREE.BufferGeometry()
      starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
      const starMaterial = new THREE.PointsMaterial({ color: '#83dfff', size: .025, transparent: true, opacity: .68, sizeAttenuation: true })
      const stars = new THREE.Points(starGeometry, starMaterial)
      scene.add(stars)

      const centers = [new THREE.Vector3(-3.55, -.05, 0), new THREE.Vector3(0, .2, -.35), new THREE.Vector3(3.55, -.05, 0)]
      const nodeGeometry = new THREE.SphereGeometry(.075, 9, 7)
      const nodeMeshes = []
      const animatedNodes = []
      groupNames.forEach((groupName, groupIndex) => {
        const material = new THREE.MeshStandardMaterial({
          color: colors[groupIndex],
          emissive: colors[groupIndex],
          emissiveIntensity: .88,
          roughness: .25,
          metalness: .35,
          transparent: true,
          opacity: .91,
        })
        const orbit = new THREE.Mesh(
          new THREE.TorusGeometry(1.45, .008, 5, 110),
          new THREE.MeshBasicMaterial({ color: colors[groupIndex], transparent: true, opacity: .3 }),
        )
        orbit.position.copy(centers[groupIndex])
        orbit.rotation.set(.94 + groupIndex * .16, groupIndex * .65, .28)
        root.add(orbit)
        const innerOrbit = new THREE.Mesh(
          new THREE.TorusGeometry(.94, .005, 4, 90),
          new THREE.MeshBasicMaterial({ color: colors[groupIndex], transparent: true, opacity: .18 }),
        )
        innerOrbit.position.copy(centers[groupIndex])
        innerOrbit.rotation.set(.5, .3 + groupIndex * .8, .8)
        root.add(innerOrbit)

        const groupStudents = students.filter((student) => student.overall_risk === groupName && student.success_score != null && student.placement_readiness != null)
        const stride = Math.max(1, Math.ceil(groupStudents.length / 85))
        groupStudents.filter((_, index) => index % stride === 0).forEach((student, index) => {
          const angle = index * 2.399963 + groupIndex * 1.7
          const radius = .36 + .88 * Math.sqrt((index + .5) / Math.max(1, Math.ceil(groupStudents.length / stride)))
          const vertical = ((Number(student.success_score) || 0) - 50) / 88 + Math.sin(angle * .65) * .22
          const basePosition = new THREE.Vector3(
            centers[groupIndex].x + Math.cos(angle) * radius,
            centers[groupIndex].y + vertical,
            centers[groupIndex].z + Math.sin(angle) * radius * .72,
          )
          const node = new THREE.Mesh(nodeGeometry, material)
          node.position.copy(basePosition)
          node.scale.setScalar(.62 + Math.max(0, Math.min(100, student.success_score || 0)) / 260)
          node.userData.student = student
          root.add(node)
          nodeMeshes.push(node)
          animatedNodes.push({ node, basePosition, center: centers[groupIndex], phase: angle, speed: .11 + (index % 7) * .009 })
        })
      })

      const raycaster = new THREE.Raycaster()
      raycaster.params.Mesh.threshold = .15
      const pointer = new THREE.Vector2()
      let dragging = false
      let lastX = 0
      let lastY = 0
      const handlePointerMove = (event) => {
        const rect = renderer.domElement.getBoundingClientRect()
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        if (dragging) {
          root.rotation.y += (event.clientX - lastX) * .006
          root.rotation.x = Math.max(-.42, Math.min(.42, root.rotation.x + (event.clientY - lastY) * .004))
        } else {
          pointer.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1)
          raycaster.setFromCamera(pointer, camera)
          const hit = raycaster.intersectObjects(nodeMeshes, false)[0]?.object
          renderer.domElement.style.cursor = hit ? 'pointer' : 'grab'
          const student = hit?.userData.student
          setHovered((current) => student && current?.id === student.id ? current : student ? {
            id: student.id,
            risk: student.overall_risk,
            cgpa: fmt(student.cgpa, 2),
            readiness: fmt(student.placement_readiness, 1),
            x: Math.max(8, Math.min(rect.width - 150, x + 13)),
            y: Math.max(8, Math.min(rect.height - 68, y - 55)),
          } : null)
        }
        lastX = event.clientX
        lastY = event.clientY
      }
      const handlePointerDown = (event) => {
        dragging = true
        lastX = event.clientX
        lastY = event.clientY
        renderer.domElement.setPointerCapture?.(event.pointerId)
      }
      const handlePointerUp = () => { dragging = false }
      const handleClick = (event) => {
        const rect = renderer.domElement.getBoundingClientRect()
        pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
        raycaster.setFromCamera(pointer, camera)
        const student = raycaster.intersectObjects(nodeMeshes, false)[0]?.object.userData.student
        if (student) onOpen(student)
      }
      renderer.domElement.addEventListener('pointermove', handlePointerMove)
      renderer.domElement.addEventListener('pointerdown', handlePointerDown)
      renderer.domElement.addEventListener('pointerup', handlePointerUp)
      renderer.domElement.addEventListener('pointerleave', handlePointerUp)
      renderer.domElement.addEventListener('click', handleClick)

      const resize = () => {
        const width = Math.max(1, host.clientWidth)
        const height = Math.max(1, host.clientHeight)
        camera.aspect = width / height
        camera.position.z = width < 540 ? 18 : width < 760 ? 16 : 13.8
        camera.updateProjectionMatrix()
        renderer.setSize(width, height, false)
        renderer.render(scene, camera)
      }
      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(host)
      resize()
      const startedAt = performance.now()
      const render = () => {
        frame = requestAnimationFrame(render)
        const elapsed = (performance.now() - startedAt) / 1000
        if (!reduceMotion) {
          if (!dragging) root.rotation.y += .0009
          animatedNodes.forEach(({ node, basePosition, center, phase, speed }) => {
            const angle = elapsed * speed
            const dx = basePosition.x - center.x
            const dz = basePosition.z - center.z
            node.position.x = center.x + dx * Math.cos(angle * .18) - dz * Math.sin(angle * .18)
            node.position.z = center.z + dx * Math.sin(angle * .18) + dz * Math.cos(angle * .18)
            node.position.y = basePosition.y + Math.sin(elapsed * .7 + phase) * .035
          })
          stars.rotation.y = elapsed * .008
          stars.rotation.x = Math.sin(elapsed * .11) * .025
        }
        renderer.render(scene, camera)
      }
      if (reduceMotion) renderer.render(scene, camera)
      else render()

      return () => {
        cancelAnimationFrame(frame)
        resizeObserver?.disconnect()
        renderer.domElement.removeEventListener('pointermove', handlePointerMove)
        renderer.domElement.removeEventListener('pointerdown', handlePointerDown)
        renderer.domElement.removeEventListener('pointerup', handlePointerUp)
        renderer.domElement.removeEventListener('pointerleave', handlePointerUp)
        renderer.domElement.removeEventListener('click', handleClick)
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
            object.geometry.dispose()
            if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose())
            else object.material.dispose()
          }
        })
        renderer.dispose()
        renderer.domElement.remove()
      }
    } catch (error) {
      renderer?.dispose()
      const message = document.createElement('div')
      message.className = 'segment-three-error'
      message.textContent = `3D visualization unavailable: ${error instanceof Error ? error.message : String(error)}`
      host.replaceChildren(message)
      return undefined
    }
  }, [students, onOpen, reduceMotion, colors, groupNames])

  return <div className="segment-three-wrap">
    <div className="segment-three-legend">{groupNames.map((name, index) => <span key={name}><i style={{ backgroundColor: colors[index], boxShadow: `0 0 10px ${colors[index]}` }} />{name}</span>)}</div>
    <div className="segment-three-stage" ref={mountRef}>{hovered && <div className="segment-node-tooltip" style={{ left: hovered.x, top: hovered.y }}><b>{hovered.id}</b><span>{hovered.risk}</span><small>CGPA {hovered.cgpa} · Readiness {hovered.readiness}</small></div>}</div>
    <div className="segment-three-axis"><span>SUCCESS & READINESS SIGNALS</span><span>{students.length.toLocaleString()} STUDENTS · {nodeCount.toLocaleString()} NODES</span></div>
  </div>
}

function CohortTrendAnalysis({ trends }) {
  const trendRef = useRef(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!trendRef.current || reduceMotion) return undefined
    const paths = trendRef.current.querySelectorAll('.segment-trend-line .recharts-line-curve')
    const validPaths = [...paths].filter((path) => typeof path.getTotalLength === 'function')
    validPaths.forEach((path) => {
      const length = path.getTotalLength()
      path.style.strokeDasharray = `${length}`
      path.style.strokeDashoffset = `${length}`
    })
    const animation = anime({
      targets: validPaths,
      strokeDashoffset: [anime.setDashoffset, 0],
      duration: 1350,
      delay: anime.stagger(180),
      easing: 'easeInOutSine',
    })
    return () => animation.pause()
  }, [trends, reduceMotion])

  return <section className="segment-trend-panel" ref={trendRef}>
    <div className="segment-section-heading"><div><span className="segment-eyebrow"><i /> SIGNALS ACROSS THE COHORT</span><h2>Trend analysis</h2><p>Compare current indicators by study year. Values are grouped snapshots—not a timeline.</p></div><span className="segment-trend-tag">COHORT BREAKDOWN</span></div>
    <div className="segment-trend-grid">
      <article className="segment-trend-card">
        <div className="segment-trend-card-head"><div><span>ACADEMICS</span><h3>CGPA by year</h3></div><div className="segment-chart-legend"><span><i className="trend-dot current" />Current</span><span><i className="trend-dot previous" />Previous</span></div></div>
        <div className="segment-trend-chart">{trends.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trends} margin={{ top: 13, right: 15, left: -17, bottom: 0 }}><CartesianGrid vertical={false} stroke="rgba(136,194,219,.13)" strokeDasharray="4 5" /><XAxis dataKey="year" tick={{ fill: '#93aabd', fontSize: 9 }} tickLine={false} axisLine={{ stroke: 'rgba(136,194,219,.2)' }} /><YAxis domain={[0, 10]} tick={{ fill: '#7891a6', fontSize: 9 }} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => [`${Number(value).toFixed(2)} / 10`]} labelFormatter={(label, rows) => `${label} · ${rows?.[0]?.payload?.count || 0} students`} contentStyle={{ background: '#0d1d31', border: '1px solid rgba(0,242,254,.28)', borderRadius: 8, color: '#d7faff' }} /><Line className="segment-trend-line" type="monotone" dataKey="cgpa" name="Current CGPA" stroke="#00f2fe" strokeWidth={2.5} dot={{ r: 3, fill: '#071321', stroke: '#00f2fe', strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls /><Line className="segment-trend-line" type="monotone" dataKey="previousCgpa" name="Previous CGPA" stroke="#bc7bff" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5, fill: '#071321', stroke: '#bc7bff', strokeWidth: 2 }} connectNulls /></LineChart></ResponsiveContainer> : <div className="segment-empty">No year-level records are available.</div>}</div>
      </article>
      <article className="segment-trend-card">
        <div className="segment-trend-card-head"><div><span>ATTENDANCE</span><h3>Attendance by year</h3></div><div className="segment-chart-legend"><span><i className="trend-dot current" />Overall</span><span><i className="trend-dot critical" />Critical subject</span></div></div>
        <div className="segment-trend-chart">{trends.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trends} margin={{ top: 13, right: 15, left: -17, bottom: 0 }}><CartesianGrid vertical={false} stroke="rgba(136,194,219,.13)" strokeDasharray="4 5" /><XAxis dataKey="year" tick={{ fill: '#93aabd', fontSize: 9 }} tickLine={false} axisLine={{ stroke: 'rgba(136,194,219,.2)' }} /><YAxis domain={[0, 100]} tick={{ fill: '#7891a6', fontSize: 9 }} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`]} labelFormatter={(label, rows) => `${label} · ${rows?.[0]?.payload?.count || 0} students`} contentStyle={{ background: '#0d1d31', border: '1px solid rgba(0,242,254,.28)', borderRadius: 8, color: '#d7faff' }} /><Line className="segment-trend-line" type="monotone" dataKey="attendance" name="Overall attendance" stroke="#4facfe" strokeWidth={2.5} dot={{ r: 3, fill: '#071321', stroke: '#4facfe', strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls /><Line className="segment-trend-line" type="monotone" dataKey="criticalAttendance" name="Critical-subject attendance" stroke="#ff8dba" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5, fill: '#071321', stroke: '#ff8dba', strokeWidth: 2 }} connectNulls /></LineChart></ResponsiveContainer> : <div className="segment-empty">No year-level records are available.</div>}</div>
      </article>
    </div>
    <p className="segment-trend-caveat">Only a current cohort snapshot and previous-semester CGPA are supplied. Lines compare year-level averages and must not be read as longitudinal or causal trends.</p>
  </section>
}

function Segments({ students, onOpen }) {
  const [active, setActive] = useState(null)
  const segmentInfo = {
    'Strong academics, low placement readiness': ['Practice coding and aptitude; add guided mock interviews.', 'High academic component with placement readiness below 55.'],
    'High attendance, academic support': ['Review subject-level understanding and offer faculty mentoring.', 'Attendance at least 80 with academic component below 60.'],
    'Low attendance and academic concern': ['Offer a private check-in to understand attendance barriers and learning needs.', 'Attendance below 65 and academic component below 60.'],
    'Technical strengths, communication practice': ['Build confidence through mock interviews and communication practice.', 'Technical skills are strong while soft-skill or interview score is below 55.'],
    'Low LMS engagement': ['Check access and course expectations, then offer structured LMS support.', 'Low assignment completion or LMS login frequency.'],
    'Improving performance': ['Recognize progress and learn which supports should continue.', 'CGPA increased at least 0.5 vs previous semester.'],
    'Strong academics and placement readiness': ['Maintain momentum and offer advanced opportunities.', 'High academic and placement readiness components.'],
    'Insufficient data': ['Improve record coverage before interpreting support indicators.', 'Fewer than four of six weighted components are available.'],
    'Broad-based support': ['Review the individual profile and ask the student what would help.', 'No specific segment rule was met.'],
  }
  const grouped = [...new Set(students.map((student) => student.segment))].map((name) => ({ name, members: students.filter((student) => student.segment === name) })).sort((a, b) => b.members.length - a.members.length)
  const current = grouped.find((group) => group.name === active)
  return <div className="stack"><div className="section-intro"><Target size={19} /><p>Transparent segments identify shared support needs, not fixed student types. Segment rules can overlap; the first matching rule is shown.</p></div><div className="segment-grid">{grouped.map(({ name, members }, index) => <button key={name} className={`segment-card ${active === name ? 'segment-active' : ''}`} onClick={() => setActive(active === name ? null : name)}><div className="segment-top"><span className="segment-index">0{index + 1}</span><span className="segment-count">{members.length}<small> students</small></span></div><b>{name}</b><p>{segmentInfo[name]?.[0]}</p><div className="segment-bottom"><span>Avg. score <b>{fmt(average(members, 'success_score'), 1)}</b></span><span className="text-link">View group <ArrowRight size={13} /></span></div></button>)}</div>{current && <Panel title={current.name} detail={`${current.members.length} students · ${segmentInfo[current.name]?.[1]}`}><div className="segment-students">{current.members.slice(0, 40).map((student) => <button key={student.id} onClick={() => onOpen(student)}><span>{student.id}</span><span>{student.department} · Year {student.year}</span><b>{fmt(student.success_score, 1)}</b><RiskPill value={student.overall_risk} /></button>)}</div></Panel>}</div>
}

function Insights({ insights, students, onOpen }) {
  const [kind, setKind] = useState('All signals')
  const shown = insights.filter((insight) => kind === 'All signals' || insight.priority === kind)
  return <div className="stack"><div className="section-intro"><Sparkles size={19} /><p>Observations below are calculated from the current cohort. They are descriptive, not causal; use the linked records to review context before acting.</p></div><div className="insights-filter">{['All signals', 'High', 'Medium', 'Positive'].map((option) => <button className={kind === option ? 'filter-active' : ''} key={option} onClick={() => setKind(option)}>{option}</button>)}</div>{shown.length ? <div className="insights-list">{shown.map((insight, index) => <article className="insight-card" key={insight.title}><div className="insight-number">{String(index + 1).padStart(2, '0')}</div><div className="insight-content"><div className="insight-title-row"><h2>{insight.title}</h2><span className={`insight-priority ${insight.priority.toLowerCase()}`}>{insight.priority} priority</span></div><p className="insight-observation">{insight.count} students · {insight.metric}</p><div className="insight-action"><ArrowRight size={15} /><span>{insight.action}</span></div><small>Descriptive cohort signal · Review student context before acting</small></div><div className="insight-students"><b>{insight.count}</b><small>records</small><div>{insight.student_ids.slice(0, 5).map((id) => <button key={id} onClick={() => { const found = students.find((student) => student.id === id); if (found) onOpen(found) }}>{id}</button>)}</div></div></article>)}</div> : <div className="empty-state">No signals in this priority group.</div>}</div>
}

function Interventions({ items, onSave, onStatus, students }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ student_id: students[0]?.id || '', mentor: '', action: '', follow_up: '', reason: '' })
  const [message, setMessage] = useState('')
  const reduceMotion = useReducedMotion()
  async function submit(event) {
    event.preventDefault()
    try { await onSave(form); setShowForm(false); setMessage('Support plan recorded.'); setForm({ student_id: students[0]?.id || '', mentor: '', action: '', follow_up: '', reason: '' }) } catch (error) { setMessage(error.message) }
  }
  return <div className="stack admin-tooling"><div className="intervention-header"><div><h2>Support plans</h2><p>Record a follow-up action, owner, and date. Demo storage resets when the API restarts.</p></div><button className="button-primary" onClick={() => setShowForm(true)}><Activity size={15} /> New support plan</button></div>{message && <div className="toast"><Check size={15} />{message}<button onClick={() => setMessage('')}><X size={14} /></button></div>}{showForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowForm(false)}><form className="intervention-form" onSubmit={submit}><div className="form-head"><div><span className="eyebrow">SUPPORT WORKFLOW</span><h2>New support plan</h2></div><button type="button" className="icon-button" onClick={() => setShowForm(false)}><X size={18} /></button></div><label>Student ID<select value={form.student_id} onChange={(event) => setForm({ ...form, student_id: event.target.value })}>{students.map((student) => <option key={student.id}>{student.id}</option>)}</select></label><label>Assigned faculty mentor<input required value={form.mentor} onChange={(event) => setForm({ ...form, mentor: event.target.value })} placeholder="Mentor name" /></label><label>Intervention action<input required value={form.action} onChange={(event) => setForm({ ...form, action: event.target.value })} placeholder="e.g. Weekly coding practice" /></label><label>Follow-up date<input required type="date" value={form.follow_up} onChange={(event) => setForm({ ...form, follow_up: event.target.value })} /></label><label>Reason for support<textarea required value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Observed indicator and student context" /></label><div className="form-actions"><button type="button" className="button-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="button-primary"><Check size={15} /> Create plan</button></div></form></div>}<Panel title="Active plans" detail={`${items.length} recorded · local prototype workflow`}>{items.length ? <motion.div className="intervention-list faculty-plan-list" initial={reduceMotion ? false : 'hidden'} animate="visible" variants={{ hidden: {}, visible: { transition: { delayChildren: .04, staggerChildren: .075 } } }}>{items.map((item) => <motion.article className="intervention-item" key={item.id} variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: .32, ease: 'easeOut' } } }}><span className="intervention-icon"><Activity size={16} /></span><div className="intervention-main"><div className="intervention-title"><b>{item.student_id}</b><span>{item.status}</span></div><p>{item.action}</p><small>{item.reason}</small><div className="intervention-meta"><span>Mentor: {item.mentor}</span><span>Follow-up: {item.follow_up}</span></div></div><label className="status-select"><span>Update status</span><select value={item.status} onChange={(event) => onStatus(item, event.target.value)}><option>Pending</option><option>In progress</option><option>Completed</option></select></label><label className="progress-note"><span>Add progress note</span><input aria-label={`Progress note for ${item.student_id}`} placeholder="Brief note" onKeyDown={(event) => { if (event.key === 'Enter' && event.currentTarget.value.trim()) { event.preventDefault(); onStatus(item, item.status, event.currentTarget.value.trim()); event.currentTarget.value = '' } }} /></label><div className="progress-notes">{(item.notes || []).map((note, index) => <small key={`${item.id}-${index}`}>{note}</small>)}</div></motion.article>)}</motion.div> : <div className="empty-state"><Activity size={24} /><b>No plans recorded yet</b><span>Create a support plan from an insight or student profile.</span></div>}</Panel><p className="small-note"><ShieldCheck size={14} /> This prototype stores intervention plans in API process memory. Persistent, multi-user records need authenticated backend storage.</p></div>
}

function CohortAssistant({ open, onToggle, students, insights, onOpenStudent }) {
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const [messages, setMessages] = useState([{
    role: 'assistant',
    text: 'Hi, I’m your cohort assistant. I can summarize the filtered records, explain support signals, or look up a Student_ID.',
  }])
  const listRef = useRef(null)
  const reduceMotion = useReducedMotion()
  const prompts = ['Summarize this cohort', 'Attendance support needs', 'Compare departments']

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [messages, typing, open, reduceMotion])

  function answerQuestion(question) {
    const normalized = question.toLowerCase().replace(/[^\w\s.-]/g, ' ')
    const studentId = question.match(/\bSTU\d{4}\b/i)?.[0]?.toUpperCase()
    if (studentId) {
      const student = students.find((entry) => entry.id === studentId)
      if (!student) return { text: `${studentId} is not in the currently filtered cohort of ${students.length} students. Check the department, program, or year filters, or confirm the ID.`, followUps: ['Summarize this cohort', 'Who needs support?'] }
      const reasons = [...(student.academic_reasons || []), ...(student.placement_reasons || [])]
      return {
        text: `${studentId} · ${student.department}, Year ${student.year}\nSuccess score ${fmt(student.success_score, 1)}/100 with ${fmt(student.coverage)}% data coverage.\nSupport signals: academic ${student.academic_risk.toLowerCase()}; placement ${student.placement_risk.toLowerCase()}.${reasons.length ? `\nObserved reasons: ${reasons.join('; ')}.` : '\nNo current academic or placement rule thresholds crossed.'}\nConsider reviewing these signals in a supportive check-in; the dataset does not establish their cause.`,
        student,
        followUps: ['What shapes the score?', 'Who needs support?', 'Show attendance gaps'],
      }
    }
    if (!students.length) return { text: 'No student records match the active filters, so there is no cohort data to summarize. Try widening the department, program, or year filters.', followUps: ['Summarize this cohort'] }

    const countBelow = (key, threshold) => students.filter((student) => student[key] != null && Number(student[key]) < threshold)
    const support = students.filter((student) => student.overall_risk !== 'On track').sort((left, right) => (left.success_score ?? 101) - (right.success_score ?? 101))
    const response = (text, followUps = []) => ({ text, followUps })
    const pct = (count, total = students.length) => total ? `${Math.round(count / total * 100)}%` : '0%'

    if (normalized.includes('summar') || normalized.includes('overview') || normalized.includes('cohort') || normalized.includes('how many')) {
      const highPriority = students.filter((student) => student.overall_risk === 'High priority').length
      const needsAttention = students.filter((student) => student.overall_risk === 'Needs attention').length
      const averageCoverage = average(students, 'coverage')
      const delta = average(students, 'cgpa') - average(students, 'previous_cgpa')
      const deltaText = Number.isFinite(delta) ? `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} vs previous-semester CGPA` : 'no previous-semester comparison available'
      return response(`Filtered cohort · ${students.length.toLocaleString()} students\nAverage CGPA ${fmt(average(students, 'cgpa'), 2)}/10 (${deltaText}). Average attendance ${fmt(average(students, 'attendance'), 1)}% and placement readiness ${fmt(average(students, 'placement_readiness'), 1)}/100.\nSupport rules: ${highPriority} high priority, ${needsAttention} needs attention, ${support.length} with any support flag (${pct(support.length)}). Average component coverage is ${fmt(averageCoverage, 0)}%.\nThese are descriptive snapshots—not causal findings or outcome predictions.`, ['Who needs support?', 'Show attendance gaps', 'Compare departments'])
    }
    if (normalized.includes('score') || normalized.includes('weight') || normalized.includes('formula')) {
      const weakest = [
        ['Academic', 'academic'], ['Attendance', 'attendance'], ['LMS', 'lms'],
        ['Placement', 'placement'], ['Skills', 'skills'], ['Engagement', 'engagement'],
      ].map(([label, key]) => {
        const values = students.map((student) => Number(student.components?.[key])).filter(Number.isFinite)
        return { label, value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null }
      })
      const componentMeans = weakest.map(({ label, value }) => `${label} ${fmt(value, 1)}`).join(' · ')
      return response(`The Student Success Score is a weighted summary: 30% academic, 20% attendance, 15% LMS, 20% placement readiness, 10% skills, and 5% engagement. Components are normalized to 0–100; missing components are excluded and remaining weights are renormalized.\nCurrent filtered component averages: ${componentMeans}. Coverage varies by record. The score is a design summary—not a validated prediction or student judgment.`, ['Summarize this cohort', 'Show data gaps'])
    }
    if (normalized.includes('attendance') || normalized.includes('absen')) {
      const low = countBelow('attendance', 65).sort((left, right) => left.attendance - right.attendance)
      const critical = countBelow('critical_attendance', 65).sort((left, right) => left.critical_attendance - right.critical_attendance)
      const examples = low.slice(0, 4).map((student) => `${student.id} (${fmt(student.attendance, 1)}%)`).join(', ')
      const criticalExamples = critical.slice(0, 3).map((student) => `${student.id} (${fmt(student.critical_attendance, 1)}%)`).join(', ')
      return { text: `${low.length} of ${students.length} students have overall attendance below 65% (${pct(low.length)}). The cohort average is ${fmt(average(students, 'attendance'), 1)}%.\n${examples ? `Lowest overall examples: ${examples}.` : 'No overall-attendance values are below 65%.'}${criticalExamples ? `\nCritical-subject attendance below 65%: ${critical.length}; examples: ${criticalExamples}.` : ''}\nA useful next step is a private check-in about access and circumstances before recommending support.`, student: low[0] || critical[0], followUps: ['Who needs support?', 'Compare departments', 'Summarize this cohort'] }
    }
    if (normalized.includes('placement') || normalized.includes('coding') || normalized.includes('interview')) {
      const atRisk = students.filter((student) => student.placement_risk !== 'On track').sort((left, right) => (left.placement_readiness ?? 101) - (right.placement_readiness ?? 101))
      const mean = average(students, 'placement_readiness')
      const examples = atRisk.slice(0, 4).map((student) => `${student.id} (${fmt(student.placement_readiness, 1)})`).join(', ')
      const lowCoding = countBelow('coding', 50).length
      const lowInterview = countBelow('mock_interview', 50).length
      return { text: `${atRisk.length} of ${students.length} students have a placement support signal (${pct(atRisk.length)}); average readiness is ${fmt(mean, 1)}/100.\n${examples ? `Lowest readiness examples: ${examples}.` : 'No placement support signals in this filtered cohort.'}\nObserved preparation indicators below 50: coding ${lowCoding}, mock interview ${lowInterview}. Offer targeted practice and feedback based on student goals.`, student: atRisk[0], followUps: ['Compare departments', 'Who needs support?', 'Summarize this cohort'] }
    }
    if (normalized.includes('segment') || normalized.includes('group')) {
      const groups = Object.entries(students.reduce((result, student) => { (result[student.segment] ||= []).push(student); return result }, {}))
        .sort((left, right) => right[1].length - left[1].length)
        .slice(0, 5)
      return response(groups.length ? `Largest segments in this view:\n${groups.map(([name, members]) => `• ${name}: ${members.length} students (${pct(members.length)}) · avg score ${fmt(average(members, 'success_score'), 1)}`).join('\n')}\nSegments are transparent organizing rules, not fixed student labels. Review individual context before acting.` : 'No records match the current filters.', ['Summarize this cohort', 'Compare departments'])
    }
    if (normalized.includes('data gap') || normalized.includes('missing') || normalized.includes('coverage')) {
      const incomplete = students.filter((student) => student.coverage < 67).sort((left, right) => left.coverage - right.coverage)
      const examples = incomplete.slice(0, 4).map((student) => `${student.id} (${fmt(student.coverage)}% coverage)`).join(', ')
      return { text: `${incomplete.length} of ${students.length} student records have under 67% weighted-component coverage (${pct(incomplete.length)}). Average coverage is ${fmt(average(students, 'coverage'), 0)}%.\n${examples ? `Lowest coverage examples: ${examples}.` : 'Every record meets the 67% coverage threshold.'}\nVerify source records before interpreting scores; missing components are not treated as zero.`, student: incomplete[0], followUps: ['What shapes the score?', 'Summarize this cohort'] }
    }
    if (normalized.includes('academic') || normalized.includes('cgpa') || normalized.includes('backlog') || normalized.includes('grade')) {
      const academic = students.filter((student) => student.academic_risk !== 'On track').sort((left, right) => (left.cgpa ?? 11) - (right.cgpa ?? 11))
      const lowCgpa = countBelow('cgpa', 6)
      const examples = academic.slice(0, 4).map((student) => `${student.id} (${fmt(student.cgpa, 2)} CGPA)`).join(', ')
      const change = average(students, 'cgpa') - average(students, 'previous_cgpa')
      return { text: `${academic.length} of ${students.length} students have an academic support flag (${pct(academic.length)}); average CGPA is ${fmt(average(students, 'cgpa'), 2)}/10. ${lowCgpa.length} records have CGPA below 6.0. The current-vs-previous cohort mean difference is ${change >= 0 ? '+' : ''}${fmt(change, 2)}.\n${examples ? `Lowest academic examples: ${examples}.` : 'No academic support flags in this filtered cohort.'}\nCheck the supplied reasons and ask what learning support would help.`, student: academic[0], followUps: ['Who needs support?', 'Show attendance gaps', 'Compare departments'] }
    }
    if (normalized.includes('lms') || normalized.includes('assignment') || normalized.includes('quiz') || normalized.includes('login')) {
      const lowAssignments = countBelow('assignment_completion', 55).sort((left, right) => left.assignment_completion - right.assignment_completion)
      const lowLogins = countBelow('lms_logins', 2)
      const examples = lowAssignments.slice(0, 4).map((student) => `${student.id} (${fmt(student.assignment_completion, 1)}%)`).join(', ')
      return { text: `Average assignment completion is ${fmt(average(students, 'assignment_completion'), 1)}%; average quiz score is ${fmt(average(students, 'quiz_average'), 1)}% and average logins are ${fmt(average(students, 'lms_logins'), 1)} per week.\n${lowAssignments.length} students are below 55% assignment completion; ${lowLogins.length} have fewer than 2 LMS logins per week.${examples ? `\nLowest assignment examples: ${examples}.` : ''}\nCheck access and course expectations before interpreting activity as engagement or effort.`, student: lowAssignments[0], followUps: ['Show data gaps', 'Who needs support?', 'Summarize this cohort'] }
    }
    if (normalized.includes('department') || normalized.includes('compare') || normalized.includes('year')) {
      const dimension = normalized.includes('year') && !normalized.includes('department') ? 'year' : 'department'
      const groups = [...new Set(students.map((student) => student[dimension]).filter((value) => value != null))]
        .map((value) => {
          const members = students.filter((student) => student[dimension] === value)
          return { value, members, cgpa: average(members, 'cgpa'), attendance: average(members, 'attendance'), readiness: average(members, 'placement_readiness') }
        })
        .sort((left, right) => right.cgpa - left.cgpa)
      return response(`${dimension === 'year' ? 'Year-level' : 'Department'} snapshot (${groups.length} groups):\n${groups.slice(0, 6).map((group) => `• ${dimension === 'year' ? `Year ${group.value}` : group.value}: ${group.members.length} students · CGPA ${fmt(group.cgpa, 2)} · attendance ${fmt(group.attendance, 1)}% · placement ${fmt(group.readiness, 1)}`).join('\n')}\nGroup averages describe this filtered snapshot; they do not explain causes or individual outcomes.`, ['Show attendance gaps', 'Show placement readiness gaps', 'Summarize this cohort'])
    }
    if (normalized.includes('insight') || normalized.includes('trend')) {
      return response(insights.length ? `Signals calculated for this filtered view:\n${insights.map((insight) => `• ${insight.title}: ${insight.count} students (${insight.metric})`).join('\n')}\nThese are descriptive rules-based observations, not causal findings.` : 'There are no generated signals for the current filter selection.', ['Compare departments', 'Summarize this cohort'])
    }
    if (normalized.includes('who') || normalized.includes('risk') || normalized.includes('support') || normalized.includes('attention') || normalized.includes('at risk')) {
      const high = support.filter((student) => student.overall_risk === 'High priority')
      const review = support.filter((student) => student.overall_risk === 'Needs attention')
      const examples = support.slice(0, 5).map((student) => `${student.id} (${fmt(student.success_score, 1)} score · ${student.overall_risk})`).join('\n')
      return { text: `${support.length} of ${students.length} students currently trigger at least one support rule (${pct(support.length)}): ${high.length} high priority and ${review.length} needing attention.\n${examples ? `Lowest-score examples:\n${examples}` : 'No support flags in this filtered cohort.'}\nUse these as prompts for a supportive review—not predictions or permanent labels.`, student: support[0], followUps: ['Show attendance gaps', 'Show placement readiness gaps', 'Show data gaps'] }
    }
    return response(`I can answer questions about this filtered cohort (${students.length} students):\n• Ask for a cohort summary, attendance, academic, placement, LMS, or data-coverage review.\n• Compare departments or years, list rule-based support flags, or explore segments.\n• Enter a Student_ID such as STU0001 for its observed profile signals.\nI use only the loaded data and do not infer causes, predict outcomes, or make decisions about students.`, ['Summarize this cohort', 'Who needs support?', 'Compare departments'])
  }

  function sendMessage(value = draft) {
    const question = value.trim()
    if (!question || typing) return
    setMessages((current) => [...current, { role: 'user', text: question }])
    setDraft('')
    setTyping(true)
    window.setTimeout(() => {
      const answer = answerQuestion(question)
      setMessages((current) => [...current, { role: 'assistant', ...answer }])
      setTyping(false)
    }, reduceMotion ? 0 : 420)
  }

  return <div className="assistant-root">
    <AnimatePresence>
      {open && <motion.section
        className="assistant-panel"
        initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        aria-label="Cohort assistant"
      >
        <header className="assistant-head">
          <span className="assistant-avatar"><Bot size={19} /></span>
          <div><b>Cohort copilot</b><small><i /> Data-grounded · {students.length.toLocaleString()} filtered records</small></div>
          <button className="icon-button assistant-reset" onClick={() => { setMessages([{ role: 'assistant', text: 'Hi, I’m your cohort copilot. Ask for a filtered cohort summary, support patterns, group comparisons, or an individual Student_ID.' }]); setDraft('') }} aria-label="Reset assistant conversation" title="Reset conversation"><RotateCcw size={15} /></button>
          <button className="icon-button" onClick={onToggle} aria-label="Close assistant"><X size={17} /></button>
        </header>
        <div className="assistant-disclaimer"><Sparkles size={13} /> Answers use visible cohort data and support rules—not external AI. Verify context before action.</div>
        <div className="assistant-messages" ref={listRef} aria-live="polite">
          {messages.map((message, index) => <motion.div
            key={`${message.role}-${index}`}
            className={`chat-message ${message.role}`}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            {message.role === 'assistant' && <span className="chat-mark"><Sparkles size={12} /></span>}
            <div className="chat-bubble"><p>{message.text}</p>{message.student && <button className="chat-profile-link" onClick={() => onOpenStudent(message.student)}>Open {message.student.id} profile <ArrowRight size={13} /></button>}</div>
            {message.role === 'assistant' && message.followUps?.length > 0 && <div className="assistant-followups">{message.followUps.map((prompt) => <button key={`${index}-${prompt}`} onClick={() => sendMessage(prompt)}>{prompt}<ArrowRight size={11} /></button>)}</div>}
          </motion.div>)}
          {typing && <div className="chat-message assistant"><span className="chat-mark"><Sparkles size={12} /></span><div className="chat-bubble typing-dots" aria-label="Assistant is responding"><i /><i /><i /></div></div>}
        </div>
        {messages.length === 1 && <div className="assistant-prompts">{prompts.map((prompt) => <button key={prompt} onClick={() => sendMessage(prompt)}>{prompt}<ArrowRight size={12} /></button>)}</div>}
        <form className="assistant-composer" onSubmit={(event) => { event.preventDefault(); sendMessage() }}>
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask a cohort question or enter a Student_ID…" aria-label="Ask the cohort assistant" />
          <button type="submit" disabled={!draft.trim() || typing} aria-label="Send message"><Send size={16} /></button>
        </form>
        <div className="assistant-foot">No external AI service connected. Responses are computed from cohort data.</div>
      </motion.section>}
    </AnimatePresence>
    <motion.button className={`assistant-launcher ${open ? 'assistant-launcher-open' : ''}`} onClick={onToggle} whileHover={reduceMotion ? undefined : { y: -2 }} whileTap={reduceMotion ? undefined : { scale: 0.96 }} aria-label={open ? 'Close success assistant' : 'Open success assistant'}>
      {open ? <X size={19} /> : <><MessageCircle size={19} /><span>Cohort AI</span></>}
      {!open && <i />}
    </motion.button>
  </div>
}

function StudentProfilePage({ students, onBack }) {
  const { studentId } = useParams()
  const student = students.find((item) => item.id.toLowerCase() === studentId?.toLowerCase())
  const [tab, setTab] = useState(profileTabs[0])
  const pageRef = useRef(null)
  const tabContentRef = useRef(null)
  const pieRef = useRef(null)
  const reduceMotion = useReducedMotion()
  const drivers = Object.entries(student?.components || {})
    .filter(([, score]) => score != null)
    .map(([key, score]) => ({ name: componentLabels[key] || key, value: score * ({ academic: .3, attendance: .2, lms: .15, placement: .2, skills: .1, engagement: .05 })[key] }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 4)
  const driverColors = ['#fb7185', '#8b7cf6', '#42cbb4', '#f5b75e']

  useEffect(() => {
    if (!pageRef.current || reduceMotion) return undefined
    const animation = anime({
      targets: pageRef.current.querySelectorAll('[data-profile-enter]'),
      opacity: [0, 1],
      translateY: [14, 0],
      delay: anime.stagger(65),
      duration: 620,
      easing: 'easeOutCubic',
    })
    return () => animation.pause()
  }, [student?.id, reduceMotion])

  useEffect(() => {
    if (!tabContentRef.current || reduceMotion) return undefined
    const animation = anime({
      targets: tabContentRef.current,
      opacity: [0, 1],
      translateX: [22, 0],
      duration: 420,
      easing: 'easeOutCubic',
    })
    return () => animation.pause()
  }, [tab, reduceMotion])

  useEffect(() => {
    if (!tabContentRef.current || reduceMotion || (tab !== 'Academics' && tab !== 'Attendance')) return undefined
    const paths = tabContentRef.current.querySelectorAll('.profile-chart-line .recharts-line-curve')
    if (!paths.length) return undefined
    paths.forEach((path) => {
      const length = path.getTotalLength()
      path.style.strokeDasharray = `${length}`
      path.style.strokeDashoffset = `${length}`
    })
    const animation = anime({
      targets: paths,
      strokeDashoffset: [anime.setDashoffset, 0],
      duration: 1250,
      delay: anime.stagger(140),
      easing: 'easeInOutSine',
    })
    return () => animation.pause()
  }, [tab, student?.id, reduceMotion])

  useEffect(() => {
    if (!pieRef.current || reduceMotion) return undefined
    const pie = pieRef.current.querySelector('.recharts-pie')
    if (!pie) return undefined
    const animation = anime({
      targets: pie,
      rotate: [0, 360],
      duration: 1150,
      easing: 'easeOutCubic',
    })
    return () => animation.pause()
  }, [student?.id, reduceMotion])

  function bounceRisk(event) {
    if (reduceMotion) return
    anime.remove(event.currentTarget)
    anime({
      targets: event.currentTarget,
      scale: [1, 1.1, 1],
      duration: 640,
      easing: 'easeOutElastic(1, .65)',
    })
  }

  if (!student) return <div className="student-profile-page profile-not-found"><button className="profile-back-link" onClick={onBack}><ArrowLeft size={16} /> Back to students</button><h1>Student profile unavailable</h1><p>This student is not present in the currently loaded cohort.</p></div>

  const cgpaHistory = [
    { label: 'Previous semester', value: student.previous_cgpa },
    { label: 'Current semester', value: student.cgpa },
  ].filter((point) => point.value != null)
  const attendanceSnapshot = [
    { label: 'Overall attendance', value: student.attendance },
    { label: 'Critical subject', value: student.critical_attendance },
  ].filter((point) => point.value != null)
  const riskFlags = [
    { label: 'Academic', value: student.academic_risk, detail: student.academic_reasons?.join(' · ') || 'No current academic threshold crossed.' },
    { label: 'Attendance', value: student.attendance != null && student.attendance < 65 ? 'Needs attention' : 'On track', detail: student.attendance != null && student.attendance < 65 ? `Attendance is ${fmt(student.attendance, 1)}%, below the 65% support threshold.` : 'No current attendance threshold crossed.' },
    { label: 'Placement', value: student.placement_risk, detail: student.placement_reasons?.join(' · ') || 'No current placement threshold crossed.' },
  ]

  return <div className="student-profile-page" ref={pageRef}>
    <button className="profile-back-link" onClick={onBack}><ArrowLeft size={16} /> Student directory</button>
    <section className="profile-hero profile-glass-card" data-profile-enter>
      <div className="profile-hero-orbit profile-orbit-one" /><div className="profile-hero-orbit profile-orbit-two" />
      <div className="profile-identity">
        <span className="profile-monogram"><GraduationCap size={27} /></span>
        <div><span className="profile-eyebrow">STUDENT PROFILE <i /> SUPPORT SNAPSHOT</span><h1>{student.id}</h1><p>{student.department} <i /> {student.program} <i /> Year {student.year}</p></div>
      </div>
      <div className="profile-hero-meta"><span className="profile-status-dot" /> Cohort snapshot <span className="profile-meta-divider" /> Profile ID <b>{student.id}</b></div>
      <div className="profile-hero-note"><Sparkles size={16} /><span>Explore the signals. Start a conversation. Every indicator is here to guide support—not define a student.</span></div>
    </section>

    <section className="profile-stat-grid" aria-label="Student summary metrics">
      {[
        { label: 'Current CGPA', value: fmt(student.cgpa, 2), unit: '/ 10', icon: BookOpenCheck, tint: 'pink' },
        { label: 'Attendance', value: fmt(student.attendance, 1), unit: '%', icon: CalendarDays, tint: 'peach' },
        { label: 'Placement ready', value: fmt(student.placement_readiness, 1), unit: '/ 100', icon: BriefcaseBusiness, tint: 'lavender' },
        { label: 'Success score', value: fmt(student.success_score, 1), unit: '/ 100', icon: Sparkles, tint: 'mint' },
      ].map(({ label, value, unit, icon: Icon, tint }) => <article key={label} className={`profile-stat-card profile-glass-card ${tint}`} data-profile-enter>
        <span className="profile-stat-icon"><Icon size={17} /></span><span className="profile-stat-label">{label}</span><strong>{value}<small>{unit}</small></strong>
      </article>)}
    </section>

    <section className="profile-risk-grid" aria-label="Student support flags">
      {riskFlags.map((flag) => <button key={flag.label} type="button" className={`profile-risk-flag ${flag.value === 'High priority' ? 'flag-high' : flag.value === 'Needs attention' ? 'flag-watch' : 'flag-good'}`} title={flag.detail} onMouseEnter={bounceRisk} onFocus={bounceRisk} data-profile-enter>
        <span className="risk-flag-pulse" /><span className="risk-flag-copy"><small>{flag.label} signal</small><b>{shortRisk(flag.value)}</b><em>{flag.detail}</em></span><ArrowRight size={16} />
      </button>)}
    </section>

    <div className="profile-main-grid">
      <section className="profile-data-column profile-glass-card" data-profile-enter>
        <div className="student-profile-tabs" role="tablist" aria-label={`${student.id} profile sections`}>
          {profileTabs.map((section, index) => {
            const TabIcon = [BookOpenCheck, CalendarDays, Activity, Sparkles, BriefcaseBusiness][index]
            return <button key={section} type="button" role="tab" aria-selected={tab === section} className={tab === section ? 'student-tab-active' : ''} onClick={() => setTab(section)}><TabIcon size={15} />{section}</button>
          })}
        </div>
        <div className="profile-tab-content" ref={tabContentRef} role="tabpanel" key={tab}>
          {tab === 'Academics' && <div className="profile-tab-layout">
            <article className="profile-info-card profile-chart-card">
              <div className="profile-card-heading"><div><span>ACADEMIC JOURNEY</span><h2>CGPA progression</h2></div><b>{fmt(student.cgpa, 2)} <small>/ 10</small></b></div>
              {cgpaHistory.length ? <div className="profile-line-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={cgpaHistory} margin={{ top: 14, right: 18, left: -16, bottom: 2 }}><CartesianGrid vertical={false} stroke="#f1e5e7" strokeDasharray="4 5" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#988a98', fontSize: 10 }} /><YAxis domain={[0, 10]} tickLine={false} axisLine={false} tick={{ fill: '#988a98', fontSize: 9 }} /><Tooltip formatter={(value) => [`${Number(value).toFixed(2)} / 10`, 'CGPA']} contentStyle={{ borderRadius: 12, border: '1px solid #f1dbe0', boxShadow: '0 8px 24px #f2dfe4' }} /><Line className="profile-chart-line" type="monotone" dataKey="value" stroke="#e8728b" strokeWidth={3} dot={{ r: 5, fill: '#fff', stroke: '#e8728b', strokeWidth: 3 }} activeDot={{ r: 7 }} /></LineChart></ResponsiveContainer></div> : <p className="profile-empty-chart">No CGPA observations are available.</p>}
              <p className="profile-chart-footnote">Current and previous semester values from the cohort record.</p>
            </article>
            <article className="profile-info-card profile-detail-card"><span className="profile-card-kicker">ACADEMIC SNAPSHOT</span><h2>Learning, at a glance</h2>
              <ProfileDetail label="Subject average" value={student.subject_performance == null ? '—' : `${fmt(student.subject_performance, 1)}%`} />
              <ProfileDetail label="Internal marks" value={fmt(student.internal_marks, 1)} />
              <ProfileDetail label="External marks" value={fmt(student.external_marks, 1)} />
              <ProfileDetail label="Backlogs" value={student.backlogs ?? '—'} />
              <ProfileDetail label="Previous CGPA" value={fmt(student.previous_cgpa, 2)} />
            </article>
          </div>}
          {tab === 'Attendance' && <div className="profile-tab-layout">
            <article className="profile-info-card profile-chart-card">
              <div className="profile-card-heading"><div><span>ATTENDANCE SNAPSHOT</span><h2>Attendance by measure</h2></div><b>{fmt(student.attendance, 1)}<small>% overall</small></b></div>
              {attendanceSnapshot.length ? <div className="profile-line-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={attendanceSnapshot} margin={{ top: 14, right: 18, left: -16, bottom: 2 }}><CartesianGrid vertical={false} stroke="#f1e5e7" strokeDasharray="4 5" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#988a98', fontSize: 10 }} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#988a98', fontSize: 9 }} /><Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Attendance']} contentStyle={{ borderRadius: 12, border: '1px solid #f1dbe0', boxShadow: '0 8px 24px #f2dfe4' }} /><Line className="profile-chart-line" type="monotone" dataKey="value" stroke="#a279eb" strokeWidth={3} dot={{ r: 5, fill: '#fff', stroke: '#a279eb', strokeWidth: 3 }} activeDot={{ r: 7 }} /></LineChart></ResponsiveContainer></div> : <p className="profile-empty-chart">No attendance observations are available.</p>}
              <p className="profile-chart-footnote">Snapshot measures only—not a historical attendance trend. {student.attendance_trend ? `Supplied trend label: ${student.attendance_trend}.` : ''}</p>
            </article>
            <article className="profile-info-card profile-detail-card"><span className="profile-card-kicker">ATTENDANCE CHECK-IN</span><h2>Support with context</h2>
              <ProfileDetail label="Overall attendance" value={`${fmt(student.attendance, 1)}%`} />
              <ProfileDetail label="Critical subject" value={student.critical_attendance == null ? 'Not supplied' : `${fmt(student.critical_attendance, 1)}%`} />
              <ProfileDetail label="Trend label" value={student.attendance_trend || 'Not supplied'} />
              <p className="profile-note">An attendance flag is an invitation to ask what support would help—not an assumption about the reason.</p>
            </article>
          </div>}
          {tab === 'LMS' && <div className="profile-detail-grid">
            <article className="profile-info-card"><span className="profile-card-kicker">LEARNING ACTIVITY</span><h2>Course engagement</h2><ProfileMeter label="Assignment completion" value={student.assignment_completion} suffix="%" tone="rose" /><ProfileMeter label="Quiz average" value={student.quiz_average} suffix="%" tone="violet" /><ProfileMeter label="LMS activity index" value={student.components?.lms} suffix=" / 100" tone="mint" /></article>
            <article className="profile-info-card profile-detail-card"><span className="profile-card-kicker">PLATFORM RHYTHM</span><h2>Weekly learning signals</h2><ProfileDetail label="Logins per week" value={fmt(student.lms_logins, 1)} /><ProfileDetail label="Content hours" value={fmt(student.content_engagement_hours, 1)} /><p className="profile-note">Activity signals show platform use; they do not measure effort, access, or understanding on their own.</p></article>
          </div>}
          {tab === 'Engagement' && <div className="profile-detail-grid">
            <article className="profile-info-card"><span className="profile-card-kicker">CAMPUS LIFE</span><h2>Participation & community</h2><ProfileDetail label="Events attended" value={student.events ?? '—'} /><ProfileDetail label="Clubs joined" value={student.clubs ?? '—'} /><ProfileDetail label="Hackathons" value={student.hackathons ?? '—'} /><ProfileDetail label="Certifications" value={student.certifications ?? '—'} /></article>
            <article className="profile-info-card profile-detail-card"><span className="profile-card-kicker">STUDENT VOICE</span><h2>Feedback & connection</h2><ProfileDetail label="Satisfaction" value={fmt(student.satisfaction, 1)} /><ProfileDetail label="Faculty feedback" value={fmt(student.faculty_feedback, 1)} /><ProfileDetail label="Engagement score" value={fmt(student.components?.engagement, 1)} /><p className="profile-note">Participation is personal and contextual; it is not a proxy for ability or commitment.</p></article>
          </div>}
          {tab === 'Placement' && <div className="profile-detail-grid">
            <article className="profile-info-card"><span className="profile-card-kicker">CAREER PREPARATION</span><h2>Readiness signals</h2><ProfileMeter label="Placement readiness" value={student.placement_readiness} suffix=" / 100" tone="rose" /><ProfileDetail label="Aptitude" value={fmt(student.aptitude, 1)} /><ProfileDetail label="Coding" value={fmt(student.coding, 1)} /><ProfileDetail label="Mock interview" value={fmt(student.mock_interview, 1)} /></article>
            <article className="profile-info-card profile-detail-card"><span className="profile-card-kicker">SKILLS & EXPERIENCE</span><h2>Strengths to build on</h2><ProfileDetail label="Technical skills" value={fmt(student.technical_skills, 1)} /><ProfileDetail label="Soft skills" value={fmt(student.soft_skills, 1)} /><ProfileDetail label="Internships" value={student.internships ?? '—'} /><ProfileDetail label="Certifications" value={student.certifications ?? '—'} /><p className="profile-note">Use preparation indicators to offer practice and feedback aligned with the student's goals.</p></article>
          </div>}
        </div>
      </section>

      <aside className="profile-explain-card profile-glass-card" data-profile-enter>
        <div className="profile-explain-heading"><span className="profile-explain-icon"><Sparkles size={17} /></span><div><span>MADE EXPLAINABLE</span><h2>What shapes the score?</h2></div></div>
        <p className="profile-explain-intro">A transparent look at the strongest weighted signals in this snapshot.</p>
        <div className="profile-pie-chart" ref={pieRef}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={drivers} dataKey="value" nameKey="name" innerRadius="57%" outerRadius="82%" paddingAngle={4} stroke="none">{drivers.map((driver, index) => <Cell key={driver.name} fill={driverColors[index]} />)}</Pie><Tooltip formatter={(value, name) => [`${Number(value).toFixed(1)} weighted points`, name]} contentStyle={{ borderRadius: 12, border: '1px solid #f1dbe0' }} /></PieChart></ResponsiveContainer><div className="profile-pie-center"><strong>{fmt(student.success_score, 0)}</strong><span>score / 100</span></div></div>
        <div className="profile-driver-list">{drivers.map((driver, index) => <div key={driver.name}><i style={{ backgroundColor: driverColors[index] }} /><span>{driver.name}</span><b>{fmt(driver.value, 1)} pts</b></div>)}</div>
        <div className="profile-method-note"><span><Sparkles size={14} /></span><p>Weights are renormalized across available data. This score is a support summary—not a prediction or student judgment.</p></div>
        <div className="profile-coverage"><span>Data coverage</span><b>{fmt(student.coverage, 0)}%</b><i><em style={{ width: `${Math.max(0, Math.min(100, student.coverage || 0))}%` }} /></i></div>
        {Object.keys(student.proxy_probabilities || {}).length > 0 && <p className="profile-model-caveat">Baseline proxy-flag estimates are unvalidated and are not future-outcome predictions.</p>}
      </aside>
    </div>
  </div>
}

function ProfileDetail({ label, value }) {
  return <div className="profile-detail-row"><span>{label}</span><b>{value}</b></div>
}

function ProfileMeter({ label, value, suffix, tone }) {
  const bounded = Math.max(0, Math.min(100, Number(value) || 0))
  return <div className={`profile-meter ${tone}`}><div><span>{label}</span><b>{value == null ? '—' : `${fmt(value, 1)}${suffix}`}</b></div><i><em style={{ width: `${bounded}%` }} /></i></div>
}

function StudentDrawer({ student, onClose, onFullProfile, onSave }) {
  const [tab, setTab] = useState('Academics')
  const components = Object.entries(student.components || {}).map(([key, value]) => ({ name: componentLabels[key] || key, score: value, weight: `${Math.round(({ academic: .3, attendance: .2, lms: .15, placement: .2, skills: .1, engagement: .05 })[key] * 100)}%` }))
  const [form, setForm] = useState({ mentor: '', action: '', follow_up: '', reason: '' })
  const [saved, setSaved] = useState('')
  async function submit(event) {
    event.preventDefault()
    try { await onSave({ ...form, student_id: student.id }); setSaved('Support plan recorded.'); setForm({ mentor: '', action: '', follow_up: '', reason: '' }) } catch (error) { setSaved(error.message) }
  }
  return <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><motion.aside className="student-drawer" initial={{ x: 35, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 35, opacity: 0 }}><div className="drawer-head"><div><span className="eyebrow">STUDENT PROFILE</span><h2>{student.id}</h2><p>{student.department} · {student.program} · Year {student.year}</p></div><div className="drawer-head-actions"><button className="button-secondary" onClick={onFullProfile}>Full profile <ArrowRight size={14} /></button><button className="icon-button" onClick={onClose} aria-label="Close profile"><X size={19} /></button></div></div><div className="drawer-score"><div><small>Student Success Score</small><strong>{fmt(student.success_score, 1)}<i>/100</i></strong></div><div className="score-ring" style={{ '--score': `${student.success_score || 0}%` }}><b>{fmt(student.success_score, 0)}</b></div></div><div className="drawer-risk"><div><span>Academic support</span><RiskPill value={student.academic_risk} reasons={student.academic_reasons} /></div><p>{student.academic_reasons?.length ? student.academic_reasons.join(' · ') : 'No current rule threshold crossed.'}</p><div><span>Placement support</span><RiskPill value={student.placement_risk} reasons={student.placement_reasons} /></div><p>{student.placement_reasons?.length ? student.placement_reasons.join(' · ') : 'No current rule threshold crossed.'}</p></div><div className="drawer-tabs" role="tablist" aria-label="Student profile sections">{[...profileTabs, 'Explainability', 'Intervene'].map((value) => <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? 'drawer-tab-active' : ''} onClick={() => setTab(value)}>{value}</button>)}</div>{tab !== 'Intervene' && <AnimatePresence mode="wait"><motion.div key={tab} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: .18 }}><ProfileFocus student={student} tab={tab === 'Explainability' ? 'Explainability' : tab} /></motion.div></AnimatePresence>}{tab !== 'Intervene' ? <div className="drawer-content"><h3>Score component breakdown</h3>
      <p>Components normalized to 0–100; weights renormalized over available data. Coverage {student.coverage}%.</p>
      <div className="component-bars">{components.map((component) => <div key={component.name} className="component-row"><div><span>{component.name}</span><small>{component.weight} weight</small></div><b>{fmt(component.score, 1)}</b><div className="component-meter"><i style={{ width: `${component.score ?? 0}%` }} /></div></div>)}</div>
      <h3>Observed profile</h3>
      <div className="fact-grid">{[['Previous CGPA', fmt(student.previous_cgpa, 2)], ['Backlogs', student.backlogs], ['Assignments', `${fmt(student.assignment_completion, 1)}%`], ['LMS logins / week', fmt(student.lms_logins, 1)], ['Aptitude', fmt(student.aptitude, 1)], ['Coding', fmt(student.coding, 1)], ['Mock interview', fmt(student.mock_interview, 1)], ['Certifications', student.certifications], ['Satisfaction', fmt(student.satisfaction, 1)], ['Attendance trend', student.attendance_trend]].map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</div>
      <div className="explain-block"><Sparkles size={15} /><span>Lowest component: <b>{componentLabels[student.lowest_component] || student.lowest_component || 'Not available'}</b>. Strongest component: <b>{componentLabels[student.strongest_component] || student.strongest_component || 'Not available'}</b>.</span></div>
      {Object.keys(student.proxy_probabilities || {}).length > 0 && <div className="prediction-block"><b>Baseline model estimate</b>{Object.entries(student.proxy_probabilities).map(([area, probability]) => <span key={area}>{area} proxy-flag probability <b>{Math.round(probability * 100)}%</b></span>)}<small>Estimates mimic supplied risk flags. They are not validated predictions.</small></div>}</div> : <form className="drawer-content drawer-form" onSubmit={submit}><h3>Plan a support action</h3>
      <p>Base follow-up on observed indicators and a conversation with the student.</p>
      {[['mentor', 'Assigned mentor'], ['action', 'Action'], ['follow_up', 'Follow-up date'], ['reason', 'Reason']].map(([key, label]) => <label key={key}>{label}{key === 'reason' ? <textarea required value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /> : <input required type={key === 'follow_up' ? 'date' : 'text'} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />}</label>)}<button className="button-primary"><Check size={15} /> Save support plan</button>{saved && <small>{saved}</small>}</form>}</motion.aside></div>
}

export default App
