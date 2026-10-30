import React, { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowDownToLine, ArrowLeftRight, ArrowUpRight, Bell, BedDouble, Building2, CalendarDays,
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ClipboardCheck, CreditCard,
  DoorOpen, Download, Ellipsis, Eye, FileText, LayoutDashboard, LogIn, LogOut,
  Menu, Pencil, Plus, Trash2,
  Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Users, X, type LucideIcon,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Toaster, toast } from 'sonner'
import { db, type Account, type ModuleKey, type RecordItem, type Role } from './lib/database'
import { getModule, modules, roleLabel, type FieldConfig, type ModuleConfig } from './lib/modules'
import {
  createRecord, deleteRecord, exportBackup, getSettings, importBackup, initializeData,
  listRecords, punchAttendance, resetDemoData, updateRecord, updateSetting,
} from './lib/service'
import { useAuth } from './lib/store'
import './App.css'

const iconMap: Record<string, LucideIcon> = {
  users: Users,
  'id-card': ShieldCheck,
  building: Building2,
  calendar: CalendarDays,
  'credit-card': CreditCard,
  clipboard: ClipboardCheck,
  'calendar-days': CalendarDays,
  contact: Users,
  utensils: BedDouble,
  sparkles: Sparkles,
  wrench: Settings,
  boxes: Building2,
  briefcase: Users,
  wallet: CreditCard,
  bell: Bell,
  settings: Settings,
}

type Permission = 'view' | 'add' | 'edit' | 'delete'
type PermissionMap = Partial<Record<Role, Partial<Record<ModuleKey, Partial<Record<Permission, boolean>>>>>>
const permissionKey = 'haven-demo-permissions'

function hasPermission(role: Role, module: ModuleConfig, action: Permission) {
  if (role === 'admin') return true
  const receptionistAccess = role === 'receptionist' &&
    ['guests', 'bookings', 'attendance', 'visitors'].includes(module.key) &&
    ['view', 'add', 'edit'].includes(action)
  const housekeepingAccess = role === 'housekeeping' && module.key === 'housekeeping' &&
    ['view', 'edit'].includes(action)
  if (receptionistAccess || housekeepingAccess) return true
  const saved = localStorage.getItem(permissionKey)
  const overrides = saved ? JSON.parse(saved) as PermissionMap : {}
  const override = overrides[role]?.[module.key]?.[action]
  return override ?? (module.roles.includes(role) && (action === 'view' || module.key === 'complaints' || module.key === 'leave'))
}

function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | Haven House`
  }, [title])
}

function App() {
  const [dataReady, setDataReady] = useState(false)
  const restore = useAuth((state) => state.restore)
  const ready = useAuth((state) => state.ready)

  useEffect(() => {
    void initializeData()
      .then(restore)
      .then(() => setDataReady(true))
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Unable to open local data.'))
  }, [restore])

  if (!dataReady || !ready) {
    return <div className="boot-screen"><div className="brand-mark">H</div><span>Opening your workspace…</span></div>
  }

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors theme="dark" />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<ProtectedLayout />} />
      </Routes>
    </BrowserRouter>
  )
}

const demoAccounts = [
  { role: 'Administrator', email: 'admin@hosteldemo.com', password: 'Admin@123', badge: 'Admin' },
  { role: 'Reception', email: 'reception@hosteldemo.com', password: 'Reception@123', badge: 'Reception' },
  { role: 'Housekeeping', email: 'housekeeping@hosteldemo.com', password: 'Cleaning@123', badge: 'Housekeeping' },
  { role: 'Student', email: 'student@hosteldemo.com', password: 'Student@123', badge: 'Student' },
  { role: 'Domestic guest', email: 'guest@hosteldemo.com', password: 'Guest@123', badge: 'Guest' },
  { role: 'International guest', email: 'foreign@hosteldemo.com', password: 'Guest@123', badge: 'Foreign' },
]

function LoginPage() {
  usePageTitle('Sign in')
  const account = useAuth((state) => state.account)
  const signIn = useAuth((state) => state.signIn)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (account) return <Navigate to="/" replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signIn(email, password)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-brand"><span className="brand-mark">H</span><span>haven<span className="brand-light">house</span></span></div>
        <div className="story-copy">
          <div className="eyebrow"><span className="live-dot" /> RESIDENTIAL MANAGEMENT, MADE SIMPLE</div>
          <h1>A better way to<br />run your <em>hostel.</em></h1>
          <p>One calm place to manage residents, rooms, reservations and the details that make a stay feel like home.</p>
        </div>
        <div className="story-footer"><div className="avatar-stack"><span>AS</span><span>MK</span><span>JR</span><span>+</span></div><div><strong>Made for better stays</strong><small>Everything in its right place.</small></div></div>
        <span className="story-orb orb-one" /><span className="story-orb orb-two" />
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={(event) => void submit(event)}>
          <div className="mobile-login-brand"><span className="brand-mark">H</span><strong>havenhouse</strong></div>
          <div className="eyebrow muted">WELCOME BACK</div>
          <h2>Sign in to your account</h2>
          <p className="login-subtitle">Use one of the demo accounts to explore the portal.</p>
          <label className="form-label">Email address<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@hosteldemo.com" required /></label>
          <label className="form-label">Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /></label>
          {error && <div className="form-error">{error}</div>}
          <button className="button button-primary login-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowUpRight size={16} /></button>
          <div className="demo-heading"><span>DEMO ACCOUNTS</span><span className="demo-safe"><ShieldCheck size={12} /> Simulation only</span></div>
          <div className="demo-list">
            {demoAccounts.map((demo) => (
              <button type="button" className="demo-account" key={demo.email} onClick={() => { setEmail(demo.email); setPassword(demo.password); setError('') }}>
                <span className={`demo-badge ${demo.badge.toLowerCase()}`}>{demo.badge.slice(0, 1)}</span>
                <span className="demo-account-text"><strong>{demo.role}</strong><small>{demo.email}</small></span>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
          <p className="login-footnote">All data and authentication are simulated locally in your browser.</p>
        </form>
      </section>
    </main>
  )
}

function ProtectedLayout() {
  const account = useAuth((state) => state.account)
  if (!account) return <Navigate to="/login" replace />
  return <Workspace account={account} />
}

function Workspace({ account }: { account: Account }) {
  const location = useLocation()
  const navigate = useNavigate()
  const signOut = useAuth((state) => state.signOut)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [globalQuery, setGlobalQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<{ module: ModuleConfig; record: RecordItem }[]>([])
  const [notices, setNotices] = useState<RecordItem[]>([])
  const searchInput = useRef<HTMLInputElement>(null)
  const moduleKey = location.pathname.startsWith('/module/') ? location.pathname.split('/')[2] : ''
  const activeModule = getModule(moduleKey)
  const isAdmin = account.role === 'admin'
  const isOperationsStaff = account.role === 'receptionist' || account.role === 'housekeeping'
  const visibleLinks = modules.filter((module) => module.key !== 'settings' && hasPermission(account.role, module, 'view'))
  const title = activeModule?.label ?? (isAdmin ? 'Overview' : isOperationsStaff ? `${roleLabel[account.role]} dashboard` : `${account.role === 'student' ? 'Student' : 'Guest'} dashboard`)
  usePageTitle(title)

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInput.current?.focus()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setNotificationOpen(false)
        setGlobalQuery('')
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    const query = globalQuery.trim().toLowerCase()
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    let active = true
    void db.records.toArray().then((records) => {
      if (!active) return
      const results: { module: ModuleConfig; record: RecordItem }[] = []
      for (const record of records) {
        const module = getModule(record.type)
        if (!module || !hasPermission(account.role, module, 'view')) continue
        if (account.role !== 'admin' && !isOperationsStaff && !['mess', 'notifications'].includes(module.key) && record.ownerEmail !== account.email) continue
        if (module.key === 'notifications' && account.role !== 'admin' && record.ownerEmail !== account.email &&
          !['All residents', account.role === 'student' ? 'Students' : 'Guests'].includes(String(record.audience))) continue
        const searchable = module.searchKeys.map((key) => String(record[key] ?? '')).join(' ').toLowerCase()
        if (searchable.includes(query)) results.push({ module, record })
        if (results.length === 6) break
      }
      setSearchResults(results)
    }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Search failed.'))
    return () => { active = false }
  }, [account.email, account.role, globalQuery, isOperationsStaff])

  async function toggleNotifications() {
    if (!notificationOpen) {
      setSearchOpen(false)
      setProfileOpen(false)
      try {
        const allNotices = await listRecords('notifications')
        setNotices(allNotices.filter((notice) => account.role === 'admin' ||
          notice.ownerEmail === account.email ||
          ['All residents', account.role === 'student' ? 'Students' : 'Guests'].includes(String(notice.audience))))
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Notifications could not be loaded.')
      }
    }
    setNotificationOpen((open) => !open)
  }

  function openSearchResult(result: { module: ModuleConfig; record: RecordItem }) {
    navigate(`/module/${result.module.key}`, { state: { search: globalQuery.trim() } })
    setGlobalQuery('')
    setSearchOpen(false)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <Link to="/" className="sidebar-brand"><span className="brand-mark">H</span><span>haven<span className="brand-light">house</span><small>STAY MANAGEMENT</small></span></Link>
        <div className="sidebar-scroll">
          <p className="nav-caption">WORKSPACE</p>
          <Link to="/" onClick={() => setSidebarOpen(false)} className={`nav-item ${!activeModule ? 'active' : ''}`}><LayoutDashboard size={17} /><span>{isAdmin ? 'Overview' : isOperationsStaff ? `${roleLabel[account.role]} dashboard` : 'My dashboard'}</span></Link>
          <p className="nav-caption nav-caption-gap">{isAdmin ? 'MANAGEMENT' : isOperationsStaff ? 'OPERATIONS' : 'MY STAY'}</p>
          {visibleLinks.map((module) => {
            const Icon = iconMap[module.icon] ?? FileText
            return <Link key={module.key} to={`/module/${module.key}`} onClick={() => setSidebarOpen(false)} className={`nav-item ${activeModule?.key === module.key ? 'active' : ''}`}><Icon size={17} /><span>{module.label}</span>{module.key === 'complaints' && <span className="nav-count">2</span>}</Link>
          })}
          {isAdmin && <div className="sidebar-bottom">
            <div className="help-card"><div className="help-icon"><CircleHelp size={16} /></div><strong>Need a hand?</strong><span>Explore your demo workspace.</span><button type="button" onClick={() => toast.info('This is a local demonstration. No external help service is connected.')}>View guide <ArrowUpRight size={13} /></button></div>
            <Link to="/module/settings" className={`nav-item ${activeModule?.key === 'settings' ? 'active' : ''}`}><Settings size={17} /><span>Settings</span></Link>
          </div>}
        </div>
        <div className="sidebar-account"><div className="profile-avatar">{account.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div className="sidebar-person"><strong>{account.name}</strong><span>{roleLabel[account.role]}</span></div><button className="icon-button sidebar-more" aria-label="Sign out" onClick={() => signOut()}><Ellipsis size={18} /></button></div>
      </aside>
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button><div className="breadcrumbs"><span>{isAdmin || isOperationsStaff ? 'Workspace' : 'Resident portal'}</span><ChevronRight size={14} /><strong>{title}</strong></div></div>
          <div className="topbar-actions"><div className="global-search-wrap"><div className="top-search"><Search size={16} /><input ref={searchInput} value={globalQuery} onFocus={() => { setNotificationOpen(false); setProfileOpen(false); setSearchOpen(true) }} onChange={(event) => { setNotificationOpen(false); setGlobalQuery(event.target.value); setSearchOpen(true) }} onKeyDown={(event) => { if (event.key === 'Enter' && searchResults[0]) openSearchResult(searchResults[0]) }} placeholder="Search residents, rooms..." /><kbd>Ctrl K</kbd></div>{searchOpen && globalQuery.trim().length >= 2 && <div className="search-results">{searchResults.length ? searchResults.map((result) => <button key={`${result.module.key}-${result.record.id}`} onMouseDown={(event) => event.preventDefault()} onClick={() => openSearchResult(result)}><span className="search-result-icon"><Search size={14} /></span><span><strong>{String(result.record[result.module.searchKeys[0]] ?? result.module.label)}</strong><small>{result.module.label} · {result.record.status ?? 'Record'}</small></span><ArrowUpRight size={14} /></button>) : <div className="search-no-results">{globalQuery.trim().length < 2 ? 'Type at least 2 characters' : 'No matching records'}</div>}</div>}{searchOpen && globalQuery.length === 0 && <div className="search-hint"><Search size={13} /> Search across the records you can access</div>}</div><div className="notification-wrap"><button className={`icon-button notification-button ${notificationOpen ? 'selected' : ''}`} aria-label="Notifications" onClick={() => void toggleNotifications()}><Bell size={18} /><i /></button>{notificationOpen && <div className="notification-popover"><div className="notification-heading"><span><strong>Notifications</strong><small>Recent hostel updates</small></span><button onClick={() => { setNotificationOpen(false); navigate('/module/notifications') }}>View all</button></div>{notices.length ? notices.slice(0, 5).map((notice) => <button className="notification-item" key={notice.id} onClick={() => { setNotificationOpen(false); navigate('/module/notifications') }}><span className="notification-icon"><Bell size={14} /></span><span><strong>{notice.title}</strong><small>{notice.message}</small><time>{notice.date}</time></span></button>) : <div className="notification-empty"><Bell size={17} />You’re all caught up.</div>}</div>}</div><div className="topbar-divider" /><div className="profile-wrap"><button className="profile-trigger" onClick={() => { setProfileOpen(!profileOpen); setSearchOpen(false); setNotificationOpen(false) }}><span className="profile-avatar">{account.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span className="profile-trigger-name"><strong>{account.name}</strong><small>{roleLabel[account.role]}</small></span><ChevronDown size={14} /></button>{profileOpen && <div className="profile-menu"><div className="profile-menu-user"><strong>{account.name}</strong><small>{account.email}</small></div><button onClick={() => { setProfileOpen(false); toast.info('Profile details are available on your dashboard.') }}><Users size={15} /> My profile</button><button onClick={() => signOut()}><LogOut size={15} /> Sign out</button></div>}</div></div>
        </header>
        <div className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard account={account} />} />
            <Route path="/module/:moduleKey" element={<ModulePage account={account} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <footer className="app-footer"><span>© 2026 Haven House <span className="footer-dot">·</span> Demo environment</span><span><ShieldCheck size={13} /> Browser storage only <span className="footer-dot">·</span> Not production secure</span></footer>
      </main>
    </div>
  )
}

type DashboardData = {
  studentCount: number
  guestCount: number
  roomCount: number
  rooms: RecordItem[]
  beds: number
  occupied: number
  bookings: RecordItem[]
  payments: RecordItem[]
  expenses: RecordItem[]
  attendanceToday: RecordItem[]
}

function useDashboardData() {
  const [data, setData] = useState<DashboardData>({ studentCount: 0, guestCount: 0, roomCount: 0, rooms: [], beds: 0, occupied: 0, bookings: [], payments: [], expenses: [], attendanceToday: [] })
  const refresh = useCallback(async () => {
    const records = await db.records.toArray()
    const ofType = (type: ModuleKey) => records.filter((record) => record.type === type)
    const rooms = ofType('rooms')
    const today = localDateKey(new Date())
    setData({
      studentCount: ofType('students').filter((record) => record.status === 'Active').length,
      guestCount: ofType('guests').filter((record) => record.status !== 'Checked out').length,
      roomCount: rooms.length,
      rooms,
      beds: rooms.reduce((sum, room) => sum + Number(room.capacity ?? 0), 0),
      occupied: rooms.reduce((sum, room) => sum + Number(room.occupied ?? 0), 0),
      bookings: ofType('bookings'),
      payments: ofType('payments'),
      expenses: ofType('expenses'),
      attendanceToday: ofType('attendance').filter((record) => record.date === today),
    })
  }, [])
  useEffect(() => {
    void refresh()
    window.addEventListener('haven-data-changed', refresh)
    return () => window.removeEventListener('haven-data-changed', refresh)
  }, [refresh])
  return { data, refresh }
}

const pieColors = ['#287345', '#cf8a2e', '#397cb6']
const currency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

function Dashboard({ account }: { account: Account }) {
  const { data } = useDashboardData()
  const [range, setRange] = useState('This month')
  const [today] = useState(() => new Date())
  const navigate = useNavigate()
  const isAdmin = account.role === 'admin'
  const isStudent = account.role === 'student'
  const [profile, setProfile] = useState<RecordItem | undefined>()

  useEffect(() => {
    if (!isAdmin && account.recordId) void db.records.get(account.recordId).then(setProfile)
  }, [account, isAdmin])

  const reservedBeds = data.bookings.filter((booking) => ['Confirmed', 'Pending'].includes(String(booking.status))).length
  const roomsDistribution = [
    { name: 'Occupied', value: data.occupied },
    { name: 'Reserved', value: Math.min(reservedBeds, Math.max(data.beds - data.occupied, 0)) },
    { name: 'Available', value: Math.max(data.beds - data.occupied - Math.min(reservedBeds, Math.max(data.beds - data.occupied, 0)), 0) },
  ]
  const rangeStart = useMemo(() => {
    const start = new Date(today)
    if (range === 'This week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    else if (range === 'This month') start.setDate(1)
    else if (range === 'This year') start.setMonth(0, 1)
    return localDateKey(start)
  }, [range, today])
  const rangeEnd = localDateKey(today)
  const selectedPayments = data.payments.filter((payment) => String(payment.date ?? '') >= rangeStart && String(payment.date ?? '') <= rangeEnd)
  const selectedExpenses = data.expenses.filter((expense) => String(expense.date ?? '') >= rangeStart && String(expense.date ?? '') <= rangeEnd)
  const monthlyRevenue = selectedPayments.filter((payment) => payment.status === 'Demo paid').reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0)
  const pendingPayments = selectedPayments.filter((payment) => payment.status === 'Pending').length
  const totalExpenses = selectedExpenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0)
  const trendData = useMemo(() => {
    const bucketDates = range === 'Today'
      ? [today]
      : range === 'This week'
        ? Array.from({ length: (today.getDay() + 6) % 7 + 1 }, (_, index) => {
          const date = new Date(today)
          date.setDate(date.getDate() - ((date.getDay() + 6) % 7) + index)
          return date
        })
        : range === 'This month'
          ? Array.from({ length: Math.ceil(today.getDate() / 7) }, (_, index) => new Date(today.getFullYear(), today.getMonth(), index * 7 + 1))
          : Array.from({ length: today.getMonth() + 1 }, (_, index) => new Date(today.getFullYear(), index, 1))

    return bucketDates.map((bucketDate, index) => {
      const key = range === 'This year'
        ? `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, '0')}`
        : range === 'This month'
          ? `week-${index + 1}`
          : localDateKey(bucketDate)
      const inBucket = (record: RecordItem) => {
        const date = String(record.date ?? '')
        if (range === 'This year') return date.startsWith(key)
        if (range === 'This month') {
          const day = Number(date.slice(8, 10))
          return date.startsWith(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`) && Math.ceil(day / 7) === index + 1
        }
        return date === key
      }
      const monthPayments = data.payments.filter((payment) => inBucket(payment) && payment.status === 'Demo paid')
      const monthExpenses = data.expenses.filter(inBucket)
      return {
        month: range === 'This year'
          ? new Intl.DateTimeFormat('en', { month: 'short' }).format(bucketDate)
          : range === 'This month'
            ? `Week ${index + 1}`
            : range === 'Today'
              ? 'Today'
              : new Intl.DateTimeFormat('en', { weekday: 'short' }).format(bucketDate),
        revenue: Math.round(monthPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0) / 1000),
        expenses: Math.round(monthExpenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0) / 1000),
      }
    })
  }, [data.expenses, data.payments, range, today])
  const occupancyRate = data.beds ? Math.round((data.occupied / data.beds) * 100) : 0

  if (account.role === 'receptionist' || account.role === 'housekeeping') {
    const primaryModule = account.role === 'receptionist' ? 'attendance' : 'housekeeping'
    const primaryLabel = account.role === 'receptionist' ? 'Open attendance register' : 'Open cleaning tasks'
    return (
      <div className="dashboard-page">
        <div className="page-heading"><div><div className="eyebrow muted">STAFF WORKSPACE</div><h1>Welcome, {account.name.split(' ')[0]}</h1><p>{account.role === 'receptionist' ? 'Record resident arrivals and departures, and manage guest check-ins.' : 'Update room cleaning progress so the admin knows which rooms are ready.'}</p></div></div>
        <section className="metric-grid">
          <MetricCard title={account.role === 'receptionist' ? 'Punched in today' : 'Rooms to clean'} value={account.role === 'receptionist' ? data.attendanceToday.filter((record) => record.checkIn && !record.checkOut).length.toString() : data.rooms.filter((room) => ['Needs cleaning', 'Cleaning'].includes(String(room.status))).length.toString()} note={account.role === 'receptionist' ? `${data.attendanceToday.length} resident punches today` : 'Pending or in progress'} icon={account.role === 'receptionist' ? DoorOpen : Sparkles} tint="sage" onClick={() => navigate(account.role === 'receptionist' ? '/module/attendance' : '/module/housekeeping')} />
          <MetricCard title="Bookings" value={data.bookings.filter((booking) => ['Pending', 'Confirmed'].includes(String(booking.status))).length.toString()} note="Upcoming and pending" icon={CalendarDays} tint="blue" onClick={() => navigate('/module/bookings')} />
        </section>
        {account.role === 'receptionist' && <AttendanceLive records={data.attendanceToday} />}
        <button className="button button-primary" onClick={() => navigate(`/module/${primaryModule}`)}>{primaryLabel}<ArrowUpRight size={15} /></button>
      </div>
    )
  }

  if (!isAdmin) {
    return <ResidentDashboard account={account} profile={profile} isStudent={isStudent} />
  }

  return (
    <div className="dashboard-page">
      <div className="page-heading heading-row">
        <div><div className="eyebrow muted">{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(today).toUpperCase()}</div><h1>Good morning, {account.name.split(' ')[0]} <span className="heading-wave">✳</span></h1><p>Here’s what’s happening across your property today.</p></div>
        <div className="heading-actions"><select aria-label="Dashboard date range" value={range} onChange={(event) => setRange(event.target.value)}><option>This month</option><option>Today</option><option>This week</option><option>This year</option></select><button className="button button-primary" onClick={() => navigate('/module/bookings')}><Plus size={16} /> New booking</button></div>
      </div>
      <section className="welcome-strip"><div className="welcome-icon"><Sparkles size={18} /></div><div><strong>Your house is in good shape.</strong><span>Occupancy is up 8.2% compared to last month. Keep it going.</span></div><button onClick={() => navigate('/module/reports')}>View report <ArrowUpRight size={14} /></button><span className="welcome-art">⌂</span></section>
      <section className="metric-grid">
        <MetricCard title="Active students" value={data.studentCount.toString()} note="+2 this month" positive icon={Users} tint="sage" onClick={() => navigate('/module/students')} />
        <MetricCard title="Current guests" value={data.guestCount.toString()} note={`${data.bookings.filter((booking) => booking.status === 'Pending').length} bookings pending`} icon={DoorOpen} tint="sand" onClick={() => navigate('/module/guests')} />
        <MetricCard title="Room occupancy" value={`${occupancyRate}%`} note={`${data.occupied} of ${data.beds} beds`} positive icon={BedDouble} tint="blue" onClick={() => navigate('/module/rooms')} />
        <MetricCard title={`Revenue · ${range.toLowerCase()}`} value={currency(monthlyRevenue)} note={`${pendingPayments} pending payments`} positive icon={CreditCard} tint="rose" onClick={() => navigate('/module/payments')} />
      </section>
      <AttendanceLive records={data.attendanceToday} />
      <section className="dashboard-grid">
        <div className="panel revenue-panel">
          <div className="panel-heading"><div><h2>Financial overview</h2><p>Income and expenses over time · {range.toLowerCase()}</p></div><button className="select-button" onClick={() => navigate('/module/expenses')}>This year <ChevronDown size={14} /></button></div>
          <div className="chart-legend"><span><i className="legend-dot income" /> Income</span><span><i className="legend-dot expense" /> Expenses</span><strong>{currency(monthlyRevenue)} <small>total received</small></strong></div>
          <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}><defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#18704a" stopOpacity={0.3} /><stop offset="90%" stopColor="#18704a" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#dce6ed" strokeDasharray="3 4" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#526b80', fontSize: 11 }} dy={12} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#526b80', fontSize: 10 }} tickFormatter={(value: number) => `${value}k`} /><Tooltip formatter={(value) => [`₹${Number(value)}k`, '']} contentStyle={{ borderRadius: 10, border: '1px solid #cbd9e4', fontSize: 12 }} /><Area type="monotone" dataKey="revenue" stroke="#18704a" strokeWidth={2.5} fill="url(#revenueFill)" /><Area type="monotone" dataKey="expenses" stroke="#ca8731" strokeWidth={2} fill="transparent" strokeDasharray="4 4" /></AreaChart></ResponsiveContainer></div>
          <div className="chart-footnote"><span><i className="legend-dot expense" /> Expenses: {currency(totalExpenses)}</span><button onClick={() => navigate('/module/reports')}>See financial reports <ArrowUpRight size={13} /></button></div>
        </div>
        <div className="panel occupancy-panel">
          <div className="panel-heading"><div><h2>Bed occupancy</h2><p>Live room availability</p></div><button className="icon-button" aria-label="Open room management" onClick={() => navigate('/module/rooms')}><Ellipsis size={18} /></button></div>
          <div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={roomsDistribution} innerRadius={66} outerRadius={86} paddingAngle={4} dataKey="value" stroke="none" startAngle={90} endAngle={-270}><Cell fill={pieColors[0]} /><Cell fill={pieColors[1]} /><Cell fill={pieColors[2]} /></Pie><Tooltip formatter={(value) => [`${value} beds`, '']} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{occupancyRate}%</strong><span>occupied</span></div></div>
          <div className="occupancy-legend">{roomsDistribution.map((item, index) => <div key={item.name}><span><i style={{ background: pieColors[index] }} />{item.name}</span><strong>{item.value}</strong></div>)}</div>
          <button className="text-link full-link" onClick={() => navigate('/module/rooms')}>View room availability <ArrowUpRight size={13} /></button>
        </div>
      </section>
      <section className="dashboard-grid lower-grid">
        <div className="panel arrivals-panel"><div className="panel-heading"><div><h2>Upcoming arrivals</h2><p>Residents checking in soon</p></div><button className="text-link" onClick={() => navigate('/module/bookings')}>View all <ArrowUpRight size={13} /></button></div>
          <div className="mini-table"><div className="mini-table-head"><span>RESIDENT</span><span>ROOM</span><span>ARRIVAL</span><span>STATUS</span></div>
            {data.bookings.filter((booking) => ['Confirmed', 'Pending'].includes(String(booking.status))).slice(0, 4).map((booking, index) => <div className="mini-table-row" key={booking.id}><div className="resident-cell"><span className={`tiny-avatar avatar-${index + 1}`}>{String(booking.customer ?? 'G').slice(0, 1)}</span><span><strong>{booking.customer}</strong><small>{booking.customerType}</small></span></div><span>Room {booking.room}</span><span>{booking.checkIn}</span><StatusBadge status={String(booking.status)} /></div>)}
          </div>
        </div>
        <div className="panel activity-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Common tasks, one click away</p></div></div>
          <div className="quick-actions"><button onClick={() => navigate('/module/students')}><span className="quick-icon sage"><Users size={17} /></span><span><strong>Add a student</strong><small>Create a resident profile</small></span><ChevronRight size={15} /></button><button onClick={() => navigate('/module/rooms')}><span className="quick-icon blue"><BedDouble size={17} /></span><span><strong>Manage rooms</strong><small>Review occupancy and beds</small></span><ChevronRight size={15} /></button><button onClick={() => navigate('/module/payments')}><span className="quick-icon sand"><CreditCard size={17} /></span><span><strong>Record a payment</strong><small>Update a resident balance</small></span><ChevronRight size={15} /></button><button onClick={() => navigate('/module/reports')}><span className="quick-icon violet"><FileText size={17} /></span><span><strong>Run a report</strong><small>Explore your property data</small></span><ChevronRight size={15} /></button></div>
        </div>
      </section>
      <div className="demo-banner"><ShieldCheck size={15} /><span>Demonstration workspace</span><i /> All figures are calculated from local sample data. Payments are simulated and not verified.</div>
    </div>
  )
}

function MetricCard({ title, value, note, positive, icon: Icon, tint, onClick }: { title: string; value: string; note: string; positive?: boolean; icon: LucideIcon; tint: string; onClick: () => void }) {
  return <button className="metric-card" onClick={onClick}><div className="metric-top"><span>{title}</span><span className={`metric-icon ${tint}`}><Icon size={17} /></span></div><strong className="metric-value">{value}</strong><div className="metric-note">{positive && <span className="trend-up"><ArrowUpRight size={12} /></span>}{note}</div><span className="metric-arrow"><ArrowUpRight size={15} /></span></button>
}

function AttendanceLive({ records }: { records: RecordItem[] }) {
  const sorted = [...records].sort((a, b) => String(b.checkIn ?? '').localeCompare(String(a.checkIn ?? '')))
  return <section className="panel attendance-live">
    <div className="panel-heading"><div><h2>Today’s attendance</h2><p>Live punch-in and punch-out register</p></div><StatusBadge status={`${records.filter((record) => record.checkIn && !record.checkOut).length} currently in`} /></div>
    {sorted.length ? <div className="attendance-live-list">{sorted.slice(0, 6).map((record) => <div className="attendance-live-row" key={record.id}><strong>{String(record.resident)}</strong><span>In <b>{String(record.checkIn || '—')}</b></span><span>Out <b>{String(record.checkOut || '—')}</b></span><StatusBadge status={String(record.status)} /></div>)}</div> : <EmptyState title="No punches recorded today" description="Reception punch-ins will appear here as soon as they are recorded." />}
  </section>
}

function ResidentDashboard({ account, profile, isStudent }: { account: Account; profile?: RecordItem; isStudent: boolean }) {
  const navigate = useNavigate()
  const ownRecords = useCallback(async (type: ModuleKey) => {
    if (type === 'mess' || type === 'notifications') return listRecords(type)
    return db.records.where('type').equals(type).filter((record) => record.ownerEmail === account.email).toArray()
  }, [account.email])
  const [myComplaints, setMyComplaints] = useState<RecordItem[]>([])
  const [announcements, setAnnouncements] = useState<RecordItem[]>([])
  const [myLeave, setMyLeave] = useState<RecordItem[]>([])
  const [myAttendance, setMyAttendance] = useState<RecordItem[]>([])
  useEffect(() => {
    async function refreshResidentRecords() {
      const [complaints, notices, leave, attendance] = await Promise.all([ownRecords('complaints'), ownRecords('notifications'), ownRecords('leave'), ownRecords('attendance')])
      setMyComplaints(complaints)
      setAnnouncements(notices.filter((notice) => notice.ownerEmail === account.email || ['All residents', isStudent ? 'Students' : 'Guests'].includes(String(notice.audience))))
      setMyLeave(leave)
      setMyAttendance(attendance.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 5))
    }
    void refreshResidentRecords()
    window.addEventListener('haven-data-changed', refreshResidentRecords)
    return () => window.removeEventListener('haven-data-changed', refreshResidentRecords)
  }, [account.email, ownRecords, isStudent])

  return (
    <div className="dashboard-page resident-page">
      <div className="page-heading"><div><div className="eyebrow muted">YOUR HAVEN HOUSE ACCOUNT</div><h1>Welcome home, {account.name.split(' ')[0]} <span className="heading-wave">✳</span></h1><p>Here’s your personal stay information and everything you need.</p></div></div>
      <section className="resident-hero">
        <div className="resident-hero-copy"><span className="resident-chip">{isStudent ? 'STUDENT RESIDENT' : 'GUEST STAY'}</span><h2>{profile?.fullName ?? account.name}</h2><p>{isStudent ? String(profile?.course ?? 'Resident') : `${String(profile?.nationality ?? 'Guest')} · ${String(profile?.bookingReference ?? 'Your stay')}`}</p><div className="resident-room"><BedDouble size={16} /><span>Room <strong>{profile?.room ?? '—'}</strong></span><i /><span>{isStudent ? `Bed ${profile?.bed ?? '—'}` : `Departure ${profile?.departure ?? '—'}`}</span></div></div>
        <div className="resident-house-art"><span>⌂</span><small>YOUR SPACE, YOUR PLACE</small></div>
      </section>
      <section className="resident-metrics"><div className="resident-stat"><span className="metric-icon sage"><BedDouble size={17} /></span><small>{isStudent ? 'MONTHLY FEE' : 'STAY STATUS'}</small><strong>{isStudent ? currency(Number(profile?.monthlyFee ?? 0)) : String(profile?.status ?? 'Reserved')}</strong><span>{isStudent ? 'Due on the 1st of each month' : `Arrival ${profile?.arrival ?? '—'}`}</span></div><div className="resident-stat"><span className="metric-icon sand"><CalendarDays size={17} /></span><small>{isStudent ? 'LATEST ATTENDANCE' : 'BOOKING REFERENCE'}</small><strong>{isStudent ? (myAttendance[0]?.checkIn ? `Punched in ${myAttendance[0].checkIn}` : 'No punch recorded') : String(profile?.bookingReference ?? '—')}</strong><span>{isStudent ? `${myAttendance[0]?.date ?? 'Today'} · ${myAttendance[0]?.status ?? 'Awaiting check-in'}` : 'Keep this handy at check-in'}</span></div><div className="resident-stat"><span className="metric-icon blue"><Bell size={17} /></span><small>OPEN REQUESTS</small><strong>{myComplaints.filter((item) => item.status !== 'Resolved').length}</strong><span>{myLeave.length} leave applications</span></div></section>
      <section className="dashboard-grid resident-grid"><div className="panel"><div className="panel-heading"><div><h2>Useful links</h2><p>Manage your hostel stay</p></div></div><div className="portal-link-grid">{(isStudent ? ['leave', 'attendance', 'mess', 'complaints'] : ['bookings', 'payments', 'complaints', 'notifications']).map((key) => { const module = getModule(key); if (!module) return null; const Icon = iconMap[module.icon] ?? FileText; return <button key={key} onClick={() => navigate(`/module/${key}`)}><span className="quick-icon sage"><Icon size={17} /></span><strong>{module.label}</strong><ArrowUpRight size={14} /></button> })}</div></div><div className="panel"><div className="panel-heading"><div><h2>House announcements</h2><p>Updates from your hostel team</p></div></div><div className="notice-list">{announcements.length ? announcements.slice(0, 3).map((notice) => <article key={notice.id}><span className="notice-icon"><Bell size={15} /></span><div><strong>{notice.title}</strong><p>{notice.message}</p><small>{notice.date}</small></div></article>) : <EmptyState title="No announcements yet" description="New updates will appear here." />}</div></div></section>
      <div className="demo-banner"><ShieldCheck size={15} /><span>Your privacy matters</span><i /> You can only access information associated with your account. This is a local demo.</div>
    </div>
  )
}

function ModulePage({ account }: { account: Account }) {
  const { moduleKey } = useParams()
  const location = useLocation()
  const module = getModule(moduleKey)
  const navigate = useNavigate()
  const [items, setItems] = useState<RecordItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState(() => (location.state as { search?: string } | null)?.search ?? '')
  const [statusFilter, setStatusFilter] = useState('All status')
  const [sortKey, setSortKey] = useState('')
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const [selected, setSelected] = useState<string[]>([])
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view' | null>(null)
  const [editing, setEditing] = useState<RecordItem | undefined>()
  const [settings, setSettings] = useState<{ key: string; value: string }[]>([])
  const [savingSettings, setSavingSettings] = useState(false)
  const [buildingFilter, setBuildingFilter] = useState('All buildings')

  useEffect(() => {
    const search = (location.state as { search?: string } | null)?.search
    setQuery(search ?? '')
  }, [location.state, moduleKey])

  const refresh = useCallback(async () => {
    if (!module) return
    setLoading(true)
    try {
      if (module.key === 'settings') setSettings(await getSettings())
      else {
        const all = await listRecords(module.key)
        const isOperationsStaff = account.role === 'receptionist' || account.role === 'housekeeping'
        const safeItems = account.role === 'admin' || isOperationsStaff
          ? all
          : module.key === 'mess'
            ? all.filter((record) => module.key === 'mess' || ['All residents', account.role === 'student' ? 'Students' : 'Guests'].includes(String(record.audience)))
            : module.key === 'notifications'
              ? all.filter((record) => record.ownerEmail === account.email || ['All residents', account.role === 'student' ? 'Students' : 'Guests'].includes(String(record.audience)))
          : all.filter((record) => record.ownerEmail === account.email)
        setItems(safeItems)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load records.')
    } finally {
      setLoading(false)
    }
  }, [account.email, account.role, module])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    window.addEventListener('haven-data-changed', refresh)
    return () => window.removeEventListener('haven-data-changed', refresh)
  }, [refresh])

  const visibleItems = useMemo(() => {
    let result = items.filter((item) => {
      const searchMatch = !query || module?.searchKeys.some((key) => String(item[key] ?? '').toLowerCase().includes(query.toLowerCase()))
      const statusMatch = statusFilter === 'All status' || String(item.status ?? '') === statusFilter
      return searchMatch && statusMatch
    })
    if (sortKey) result = [...result].sort((a, b) => String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), undefined, { numeric: true }) * (sortAsc ? 1 : -1))
    return result
  }, [items, module, query, sortAsc, sortKey, statusFilter])

  if (!module) return <div className="not-found"><div className="empty-icon"><FileText size={22} /></div><h2>Page not found</h2><p>This area is not part of the current demo.</p><button className="button button-primary" onClick={() => navigate('/')}>Back to dashboard</button></div>
  if (!hasPermission(account.role, module, 'view')) return <div className="not-found"><div className="empty-icon"><ShieldCheck size={22} /></div><h2>Access restricted</h2><p>Your account does not have permission to view this section.</p><button className="button button-primary" onClick={() => navigate('/')}>Back to dashboard</button></div>

  const totalPages = Math.max(1, Math.ceil(visibleItems.length / pageSize))
  const pageItems = visibleItems.slice((page - 1) * pageSize, page * pageSize)
  const fields = module.fields
  const statusOptions = [...new Set(items.map((item) => String(item.status ?? '')).filter(Boolean))]

  function openForm(mode: 'create' | 'edit' | 'view', record?: RecordItem) {
    setEditing(record)
    setFormMode(mode)
  }

  async function handleSave(values: Record<string, string>) {
    if (!module || !hasPermission(account.role, module, formMode === 'edit' ? 'edit' : 'add')) throw new Error('You do not have permission to make this change.')
    const isOperationsStaff = account.role === 'receptionist' || account.role === 'housekeeping'
    const ownerEmail = account.role === 'admin' || isOperationsStaff ? undefined : account.email
    const submittedValues = { ...values }
    if (account.role !== 'admin') {
      if (module.key === 'complaints') submittedValues.reportedBy = account.name
      if (module.key === 'leave') submittedValues.resident = account.name
    }
    if (formMode === 'edit' && editing) {
      if (account.role !== 'admin' && !isOperationsStaff && editing.ownerEmail !== account.email) throw new Error('You can only edit your own records.')
      await updateRecord(module, editing.id, submittedValues)
      toast.success(`${module.singular} updated.`)
    } else {
      await createRecord(module, submittedValues, ownerEmail)
      toast.success(`${module.singular} created.`)
    }
    setFormMode(null)
    await refresh()
  }

  async function handlePunch(resident: string, direction: 'in' | 'out') {
    try {
      await punchAttendance(resident, direction)
      toast.success(`${resident} punched ${direction} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`)
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Attendance could not be recorded.')
    }
  }

  async function removeRecord(record: RecordItem) {
    if (!module || !hasPermission(account.role, module, 'delete')) {
      toast.error('You do not have permission to delete this record.')
      return
    }
    if (account.role !== 'admin' && record.ownerEmail !== account.email) {
      toast.error('You can only delete your own records.')
      return
    }
    if (!window.confirm(`Delete this ${module.singular}? This action cannot be undone.`)) return
    try {
      await deleteRecord(module, record.id)
      setSelected((current) => current.filter((id) => id !== record.id))
      toast.success(`${module.singular} deleted.`)
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete this record.')
    }
  }

  async function bulkDelete() {
    if (!module || !hasPermission(account.role, module, 'delete')) return
    if (!window.confirm(`Delete ${selected.length} selected records?`)) return
    try {
      for (const id of selected) await deleteRecord(module, id)
      setSelected([])
      toast.success('Selected records deleted.')
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete selected records.')
      await refresh()
    }
  }

  function exportCsv() {
    const columns = [...new Set([...fields.map((field) => field.key), 'status'])]
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const csv = [columns.map(escape).join(','), ...visibleItems.map((item) => columns.map((key) => escape(item[key])).join(','))].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `haven-${moduleKey ?? 'data'}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`${visibleItems.length} rows exported.`)
  }

  if (module.key === 'settings') {
    return <SettingsPage settings={settings} reload={refresh} saving={savingSettings} setSaving={setSavingSettings} />
  }
  if (module.key === 'reports') return <ReportsPage />

  const canAdd = hasPermission(account.role, module, 'add')
  const canEdit = hasPermission(account.role, module, 'edit')
  const canDelete = hasPermission(account.role, module, 'delete')
  const selectable = account.role === 'admin' && canDelete

  return (
    <section className="module-page">
      <div className="page-heading module-heading"><div><div className="eyebrow muted">PROPERTY MANAGEMENT</div><h1>{module.label}</h1><p>{module.description}</p></div>{canAdd && <button className="button button-primary" onClick={() => openForm('create')}><Plus size={16} /> Add {module.singular}</button>}</div>
      {module.key === 'rooms' && <RoomFloorPlan rooms={items} buildingFilter={buildingFilter} setBuildingFilter={setBuildingFilter} onSelect={(room) => openForm('view', room)} />}
      {module.key === 'attendance' && <AttendanceLive records={items.filter((record) => record.date === localDateKey(new Date()))} />}
      <div className="panel table-panel">
        <div className="table-toolbar"><div className="table-toolbar-left"><label className="table-search"><Search size={16} /><input aria-label={`Search ${module.label}`} placeholder={`Search ${module.label.toLowerCase()}...`} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} /></label><select aria-label="Filter by status" className="filter-select" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}><option>All status</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></div><div className="table-toolbar-right">{selected.length > 0 && <button className="button button-danger subtle-button" onClick={() => void bulkDelete()}><X size={14} /> Delete {selected.length}</button>}<button className="button button-secondary" onClick={exportCsv}><Download size={15} /> Export CSV</button><button className="icon-button filter-button" aria-label="Filter options" onClick={() => toast.info('Use the search and status filters to narrow this list.')}><SlidersHorizontal size={16} /></button></div></div>
        <div className="table-scroll"><table className="data-table"><thead><tr>{selectable && <th className="check-col"><input type="checkbox" aria-label="Select all rows" checked={pageItems.length > 0 && pageItems.every((item) => selected.includes(item.id))} onChange={(event) => setSelected(event.target.checked ? [...new Set([...selected, ...pageItems.map((item) => item.id)])] : selected.filter((id) => !pageItems.some((item) => item.id === id)))} /></th>}{fields.slice(0, 5).map((field) => <th key={field.key}><button className="sort-button" onClick={() => { setSortAsc(sortKey === field.key ? !sortAsc : true); setSortKey(field.key) }}>{field.label}{sortKey === field.key && <span>{sortAsc ? '↑' : '↓'}</span>}</button></th>)}<th>Status</th><th className="actions-heading">ACTIONS</th></tr></thead><tbody>
          {loading ? <tr><td colSpan={fields.length + 3} className="table-message"><div className="loading-spinner" /> Loading records…</td></tr> : pageItems.map((record) => {
            const todayPunch = items.find((item) => item.type === 'attendance' && item.resident === record.resident && item.date === localDateKey(new Date()))
            const punchDirection = todayPunch?.checkIn ? todayPunch.checkOut ? null : 'out' : 'in'
            return <tr key={record.id}>{selectable && <td><input type="checkbox" aria-label={`Select ${String(record[fields[0]?.key] ?? 'record')}`} checked={selected.includes(record.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, record.id] : selected.filter((id) => id !== record.id))} /></td>}{fields.slice(0, 5).map((field, index) => <td key={field.key}>{index === 0 ? <button className="table-primary-cell" onClick={() => openForm('view', record)}>{String(record[field.key] ?? '—')}</button> : <span className={field.type === 'number' ? 'tabular' : ''}>{field.key === 'amount' || field.key === 'price' || field.key === 'monthlyFee' || field.key === 'salary' ? currency(Number(record[field.key] ?? 0)) : String(record[field.key] ?? '—')}</span>}</td>)}<td><StatusBadge status={String(record.status ?? 'Recorded')} /></td><td><div className="row-actions"><button aria-label={`View ${module.singular}`} title="View details" onClick={() => openForm('view', record)}><Eye size={15} /></button>{canEdit && (account.role === 'admin' || account.role === 'receptionist' || account.role === 'housekeeping' || record.ownerEmail === account.email) && <button aria-label={`Edit ${module.singular}`} title="Edit record" onClick={() => openForm('edit', record)}><Pencil size={15} /></button>}{module.key === 'attendance' && canEdit && punchDirection && <button className="punch-action" aria-label={`${punchDirection === 'in' ? 'Punch in' : 'Punch out'} ${String(record.resident)}`} title={punchDirection === 'in' ? 'Punch in now' : 'Punch out now'} onClick={() => void handlePunch(String(record.resident), punchDirection)}>{punchDirection === 'in' ? <LogIn size={15} /> : <LogOut size={15} />}</button>}{module.key === 'attendance' && todayPunch?.checkOut && <span className="punch-complete" title="Attendance completed today"><Check size={14} /></span>}{canDelete && (account.role === 'admin' || record.ownerEmail === account.email) && <button className="row-delete" aria-label={`Delete ${module.singular}`} title="Delete record" onClick={() => void removeRecord(record)}><Trash2 size={15} /></button>}</div></td></tr>
          })}
          {!loading && pageItems.length === 0 && <tr><td colSpan={fields.length + 3}><EmptyState title={query || statusFilter !== 'All status' ? 'No matching records' : `No ${module.label.toLowerCase()} yet`} description={query || statusFilter !== 'All status' ? 'Try another search or clear the status filter.' : `Add a ${module.singular} to get started.`} action={canAdd && !query ? <button className="button button-secondary" onClick={() => openForm('create')}><Plus size={15} /> Add {module.singular}</button> : undefined} /></td></tr>}
        </tbody></table></div>
        <div className="table-pagination"><span>Showing <strong>{visibleItems.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, visibleItems.length)}</strong> of <strong>{visibleItems.length}</strong> records</span><div className="pagination-controls"><span>Rows per page</span><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} aria-label="Rows per page"><option value={8}>8</option><option value={15}>15</option><option value={30}>30</option></select><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={15} /></button><span className="page-count">{page} / {totalPages}</span><button aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={15} /></button></div></div>
      </div>
      <div className="module-note"><ShieldCheck size={14} /> Changes are saved to this browser’s IndexedDB. This demo does not connect to a server.</div>
      {formMode && <RecordDialog module={module} mode={formMode} record={editing} onClose={() => setFormMode(null)} onSave={handleSave} />}
    </section>
  )
}

function RoomFloorPlan({ rooms, buildingFilter, setBuildingFilter, onSelect }: { rooms: RecordItem[]; buildingFilter: string; setBuildingFilter: (building: string) => void; onSelect: (room: RecordItem) => void }) {
  const [bookings, setBookings] = useState<RecordItem[]>([])
  const refreshBookings = useCallback(async () => setBookings(await listRecords('bookings')), [])
  useEffect(() => {
    void refreshBookings()
    window.addEventListener('haven-data-changed', refreshBookings)
    return () => window.removeEventListener('haven-data-changed', refreshBookings)
  }, [refreshBookings])
  const buildings = [...new Set(rooms.map((room) => String(room.building ?? 'Unassigned')))]
  const visibleRooms = rooms.filter((room) => buildingFilter === 'All buildings' || room.building === buildingFilter)
  const today = localDateKey(new Date())
  const roomState = (room: RecordItem) => {
    if (['Maintenance', 'Blocked', 'Needs cleaning', 'Cleaning'].includes(String(room.status))) return String(room.status)
    const active = bookings.filter((booking) => String(booking.room) === String(room.roomNumber) &&
      ['Pending', 'Confirmed'].includes(String(booking.status)) && String(booking.checkOut ?? '') >= today)
    if (active.some((booking) => booking.status === 'Confirmed')) return 'Booked'
    if (active.some((booking) => booking.status === 'Pending')) return 'Reserved'
    if (Number(room.occupied ?? 0) > 0 || room.status === 'Occupied') return 'Occupied'
    return String(room.status)
  }
  const classifiedRooms = visibleRooms.map((room) => ({ room, state: roomState(room) }))
  const available = classifiedRooms.filter(({ state }) => state === 'Available').length
  const occupied = classifiedRooms.filter(({ state }) => state === 'Occupied').length
  const booked = classifiedRooms.filter(({ state }) => state === 'Booked').length
  const reserved = classifiedRooms.filter(({ state }) => state === 'Reserved').length
  const cleaning = classifiedRooms.filter(({ state }) => ['Needs cleaning', 'Cleaning'].includes(state)).length
  const maintenance = classifiedRooms.filter(({ state }) => ['Maintenance', 'Blocked'].includes(state)).length
  return <section className="panel floor-plan">
    <div className="floor-plan-heading"><div><span className="eyebrow muted">AT A GLANCE</span><h2>Room floor plan</h2><p>Select a room to view its occupancy and facilities.</p></div><label className="floor-building"><Building2 size={14} /><select aria-label="Filter floor plan by building" value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}><option>All buildings</option>{buildings.map((building) => <option key={building}>{building}</option>)}</select><ChevronDown size={13} /></label></div>
    <div className="floor-plan-summary"><span><i className="room-key available-key" />{available} available</span><span><i className="room-key occupied-key" />{occupied} occupied</span><span><i className="room-key booked-key" />{booked} booked</span><span><i className="room-key reserved-key" />{reserved} reserved</span><span><i className="room-key cleaning-key" />{cleaning} cleaning</span><span><i className="room-key maintenance-key" />{maintenance} maintenance / blocked</span></div>
    <div className="room-grid">{classifiedRooms.map(({ room, state }) => <button key={room.id} className={`room-tile ${state.toLowerCase().replaceAll(' ', '-')}`} title={`${room.roomNumber} · ${state} · ${room.occupied}/${room.capacity} beds`} onClick={() => onSelect(room)}><strong>{room.roomNumber}</strong><span>{state} · {room.occupied}/{room.capacity}</span></button>)}</div>
  </section>
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  const tone = normalized.includes('pending') || normalized.includes('maintenance') || normalized.includes('late') || normalized.includes('high') || normalized.includes('needs cleaning') || normalized.includes('cleaning')
    ? 'warning'
    : normalized.includes('resolved') || normalized.includes('active') || normalized.includes('paid') || normalized.includes('present') || normalized.includes('available') || normalized.includes('confirmed') || normalized.includes('published')
      ? 'success'
      : normalized.includes('reject') || normalized.includes('cancel') || normalized.includes('absent') || normalized.includes('inactive')
        ? 'danger'
        : 'neutral'
  return <span className={`status-badge ${tone}`}><i />{status}</span>
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Search size={19} /></div><strong>{title}</strong><span>{description}</span>{action}</div>
}

function RecordDialog({ module, mode, record, onClose, onSave }: { module: ModuleConfig; mode: 'create' | 'edit' | 'view'; record?: RecordItem; onClose: () => void; onSave: (values: Record<string, string>) => Promise<void> }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(module.fields.map((field) => [field.key, String(record?.[field.key] ?? (field.type === 'date' && mode === 'create' ? new Date().toISOString().slice(0, 10) : ''))])))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [rooms, setRooms] = useState<RecordItem[]>([])
  const [residents, setResidents] = useState<RecordItem[]>([])
  const isView = mode === 'view'

  useEffect(() => {
    if (module.key === 'guests') {
      void listRecords('rooms').then(setRooms).catch((issue: unknown) => toast.error(issue instanceof Error ? issue.message : 'Rooms could not be loaded.'))
    }
    if (module.key === 'attendance') {
      void Promise.all([listRecords('students'), listRecords('guests')])
        .then(([students, guests]) => setResidents([...students, ...guests]))
        .catch((issue: unknown) => toast.error(issue instanceof Error ? issue.message : 'Residents could not be loaded.'))
    }
  }, [module.key])

  const selectedRoom = rooms.find((room) => String(room.roomNumber) === values.room)
  const luxuryRoom = selectedRoom && ['premium', 'deluxe', 'luxury'].includes(String(selectedRoom.category).toLowerCase())
  const mealFields = new Set(['foodService', 'mealPreferences', 'mealTimes', 'teaCoffee', 'teaCoffeeTime'])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      await onSave(values)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Unable to save this record.')
    } finally {
      setSaving(false)
    }
  }

  function inputField(field: FieldConfig) {
    const common = { id: field.key, value: values[field.key] ?? '', disabled: isView, readOnly: field.autoGenerated, required: field.required, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value
      setValues((current) => {
        const next = { ...current, [field.key]: value }
        if (module.key === 'guests' && field.key === 'room') {
          const room = rooms.find((item) => String(item.roomNumber) === value)
          if (!['premium', 'deluxe', 'luxury'].includes(String(room?.category).toLowerCase())) {
            for (const key of mealFields) next[key] = ''
          }
        }
        return next
      })
    } }
    if (module.key === 'guests' && field.key === 'room') {
      return <select {...common}><option value="">Select a room…</option>{rooms.map((room) => <option value={String(room.roomNumber)} key={room.id}>{String(room.roomNumber)} · {String(room.category)} · {String(room.status)}</option>)}</select>
    }
    if (module.key === 'attendance' && field.key === 'resident') {
      const names = [...new Set(residents.map((resident) => String(resident.fullName ?? '')).filter(Boolean))]
      return <select {...common}><option value="">Select resident…</option>{values.resident && !names.includes(values.resident) && <option value={values.resident}>{values.resident} · existing record</option>}{names.map((name) => <option key={name}>{name}</option>)}</select>
    }
    if (field.type === 'select') return <select {...common}><option value="">Select…</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>
    if (field.type === 'textarea') return <textarea {...common} rows={3} />
    return <input {...common} placeholder={field.autoGenerated && mode === 'create' ? 'Generated automatically when saved' : undefined} type={field.type ?? 'text'} min={field.type === 'number' ? 0 : undefined} />
  }

  return <div className="dialog-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="record-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="dialog-heading"><div><div className="eyebrow muted">{mode === 'view' ? 'RECORD DETAILS' : mode === 'edit' ? 'UPDATE RECORD' : 'NEW ENTRY'}</div><h2 id="dialog-title">{mode === 'view' ? `View ${module.singular}` : `${mode === 'edit' ? 'Edit' : 'Add'} ${module.singular}`}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div><form onSubmit={(event) => void submit(event)}><div className="dialog-fields">{module.fields.filter((field) => !mealFields.has(field.key) || luxuryRoom).map((field) => <React.Fragment key={field.key}>{module.key === 'guests' && field.key === 'foodService' && <div className="form-section-title form-wide"><strong>Luxury room food service</strong><span>Set meal preferences and the preferred service times for this guest.</span></div>}<label className={`form-label ${field.type === 'textarea' ? 'form-wide' : ''}`} htmlFor={field.key}>{field.label}{inputField(field)}</label></React.Fragment>)}</div>{module.fields.some((field) => field.autoGenerated) && mode === 'create' && <p className="form-help">The {module.singular} ID is assigned automatically when this record is saved.</p>}{error && <div className="form-error">{error}</div>}<div className="dialog-footer"><button type="button" className="button button-secondary" onClick={onClose}>{isView ? 'Close' : 'Cancel'}</button>{!isView && <button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : `Create ${module.singular}`}<Check size={15} /></button>}</div></form></section></div>
}

function SettingsPage({ settings, reload, saving, setSaving }: { settings: { key: string; value: string }[]; reload: () => Promise<void>; saving: boolean; setSaving: (value: boolean) => void }) {
  const [permissionsState, setPermissionsState] = useState<PermissionMap>(() => {
    const saved = localStorage.getItem(permissionKey)
    return saved ? JSON.parse(saved) as PermissionMap : {}
  })
  const [hostelName, setHostelName] = useState('')
  const [currencyCode, setCurrencyCode] = useState('')
  const [storageUsage, setStorageUsage] = useState(0)
  useEffect(() => {
    setHostelName(settings.find((item) => item.key === 'hostelName')?.value ?? 'Haven House')
    setCurrencyCode(settings.find((item) => item.key === 'currency')?.value ?? 'INR')
    void db.records.count().then(setStorageUsage)
  }, [settings])

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      await Promise.all([updateSetting('hostelName', hostelName), updateSetting('currency', currencyCode)])
      await reload()
      toast.success('Hostel settings saved.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  function savePermissions(next: PermissionMap) {
    setPermissionsState(next)
    localStorage.setItem(permissionKey, JSON.stringify(next))
    toast.success('Portal permissions saved.')
  }

  async function downloadBackup() {
    try {
      const data = await exportBackup()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `haven-house-backup-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Local backup exported.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Backup export failed.')
    }
  }

  async function restoreBackup(file?: File) {
    if (!file) return
    if (!window.confirm('Restore this backup? Current local data will be replaced.')) return
    try {
      await importBackup(file)
      await reload()
      toast.success('Backup restored.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Backup restore failed.')
    }
  }

  async function resetData() {
    if (!window.confirm('Reset all local data to the original demo dataset? This cannot be undone.')) return
    try {
      await resetDemoData()
      localStorage.removeItem(permissionKey)
      setPermissionsState({})
      await reload()
      toast.success('Demo data has been reset.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to reset demo data.')
    }
  }

  return <section className="module-page settings-page"><div className="page-heading"><div><div className="eyebrow muted">WORKSPACE CONFIGURATION</div><h1>Settings & permissions</h1><p>Manage local workspace preferences and resident portal access.</p></div></div>
    <div className="settings-layout">
      <div className="settings-main">
        <form className="panel settings-card" onSubmit={(event) => void saveProfile(event)}><div className="settings-card-heading"><div className="settings-icon sage"><Building2 size={17} /></div><div><h2>Hostel profile</h2><p>Basic details shown across your workspace.</p></div></div><div className="settings-fields"><label className="form-label">Hostel name<input value={hostelName} onChange={(event) => setHostelName(event.target.value)} required /></label><label className="form-label">Currency<select value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value)}><option value="INR">Indian Rupee (INR)</option><option value="USD">US Dollar (USD)</option><option value="GBP">British Pound (GBP)</option></select></label></div><div className="settings-card-footer"><span>Saved to browser storage</span><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div></form>
        <div className="panel settings-card permissions-card"><div className="settings-card-heading"><div className="settings-icon blue"><ShieldCheck size={17} /></div><div><h2>Portal permissions</h2><p>Choose which sections residents can view in their portal.</p></div></div><div className="permission-table"><div className="permission-row permission-head"><span>MODULE</span><span>STUDENT</span><span>GUEST</span></div>{modules.filter((module) => module.key !== 'settings' && module.key !== 'students' && module.key !== 'guests').map((module) => <div className="permission-row" key={module.key}><strong>{module.label}</strong>{(['student', 'domestic_guest'] as const).map((role) => { const isGuest = role !== 'student'; const roleKey: Role = isGuest ? 'domestic_guest' : 'student'; const defaultAllowed = module.roles.includes(roleKey); const allowed = permissionsState[roleKey]?.[module.key]?.view ?? defaultAllowed; return <label className="toggle" key={role} aria-label={`${isGuest ? 'Guest' : 'Student'} access for ${module.label}`}><input type="checkbox" checked={allowed} onChange={(event) => { const next = { ...permissionsState, [roleKey]: { ...permissionsState[roleKey], [module.key]: { ...permissionsState[roleKey]?.[module.key], view: event.target.checked } } }; if (isGuest) next.foreign_guest = { ...next.foreign_guest, [module.key]: { ...next.foreign_guest?.[module.key], view: event.target.checked } }; savePermissions(next) }} /><span /></label> })}</div>)}</div><div className="permission-note"><ShieldCheck size={14} /> Access checks are also enforced on navigation and record actions.</div></div>
      </div>
      <aside className="settings-aside"><div className="panel settings-card data-card"><div className="settings-card-heading"><div className="settings-icon sand"><ArrowDownToLine size={17} /></div><div><h2>Demo data</h2><p>Export, restore or reset this local workspace.</p></div></div><div className="storage-meter"><div className="storage-label"><span>Stored records</span><strong>{storageUsage}</strong></div><div className="meter-track"><span style={{ width: `${Math.min(storageUsage / 3, 100)}%` }} /></div><small>IndexedDB · This browser only</small></div><button className="button button-secondary full-button" onClick={() => void downloadBackup()}><Download size={15} /> Export backup</button><label className="button button-secondary full-button upload-button"><ArrowLeftRight size={15} /> Restore backup<input type="file" accept="application/json,.json" onChange={(event) => void restoreBackup(event.target.files?.[0])} /></label><div className="danger-zone"><strong>Reset demo data</strong><p>Restore the original sample records and demo accounts.</p><button className="button button-danger" onClick={() => void resetData()}>Reset workspace</button></div></div><div className="settings-disclaimer"><ShieldCheck size={16} /><strong>Demo-only security</strong><p>Authentication and permissions run entirely in your browser. This setup is for demonstration and is not production-secure.</p></div></aside>
    </div>
  </section>
}

function ReportsPage() {
  const [records, setRecords] = useState<RecordItem[]>([])
  const [range, setRange] = useState('This month')
  const [today] = useState(() => new Date())
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void db.records.toArray().then(setRecords).catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Could not load reports.')
    }).finally(() => setLoading(false))
  }, [])

  const startDate = useMemo(() => {
    const date = new Date(today)
    if (range === 'This week') date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
    else if (range === 'This month') date.setDate(1)
    else if (range === 'This year') date.setMonth(0, 1)
    else return null
    return localDateKey(date)
  }, [range, today])
  const endDate = localDateKey(today)

  const reports = useMemo(() => {
    const inRange = (record: RecordItem, keys: string[]) => {
      if (!startDate) return true
      const dateValue = keys.map((key) => record[key]).find((value) => typeof value === 'string' && value.length >= 10)
      return typeof dateValue === 'string' && dateValue.slice(0, 10) >= startDate && dateValue.slice(0, 10) <= endDate
    }
    const data: { title: string; type: ModuleKey; description: string; dateKeys: string[] }[] = [
      { title: 'Student directory', type: 'students', description: 'Admissions, courses and resident status.', dateKeys: ['admissionDate', 'createdAt'] },
      { title: 'Guest stays', type: 'guests', description: 'Domestic and international guest records.', dateKeys: ['arrival', 'createdAt'] },
      { title: 'Room occupancy', type: 'rooms', description: 'Capacity, occupancy and room availability.', dateKeys: ['updatedAt', 'createdAt'] },
      { title: 'Bookings', type: 'bookings', description: 'Reservations, arrivals and booking status.', dateKeys: ['checkIn', 'createdAt'] },
      { title: 'Payments & invoices', type: 'payments', description: 'Payment ledger. All payment statuses are demo-only.', dateKeys: ['date', 'createdAt'] },
      { title: 'Operating expenses', type: 'expenses', description: 'Recorded hostel and property expenses.', dateKeys: ['date', 'createdAt'] },
      { title: 'Attendance', type: 'attendance', description: 'Daily resident attendance records.', dateKeys: ['date', 'createdAt'] },
      { title: 'Complaints', type: 'complaints', description: 'Resident service and maintenance requests.', dateKeys: ['date', 'createdAt'] },
    ]
    return data.map((report) => {
      const entries = records.filter((record) => record.type === report.type && inRange(record, report.dateKeys))
      const matches = !query || report.title.toLowerCase().includes(query.toLowerCase()) || report.description.toLowerCase().includes(query.toLowerCase())
      return { ...report, entries, matches }
    }).filter((report) => report.matches)
  }, [query, records, startDate, endDate])

  function download(report: (typeof reports)[number]) {
    const keys = [...new Set(report.entries.flatMap((entry) => Object.keys(entry)).filter((key) => !['id', 'type'].includes(key)))]
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const csv = [keys.map(escape).join(','), ...report.entries.map((entry) => keys.map((key) => escape(entry[key])).join(','))].join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `haven-${report.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}-${localDateKey(today)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success(`${report.entries.length} report rows exported.`)
  }

  const totalEntries = reports.reduce((sum, report) => sum + report.entries.length, 0)
  const paymentTotal = records.filter((record) => record.type === 'payments' && record.status === 'Demo paid').reduce((sum, record) => sum + Number(record.amount ?? 0), 0)
  const expenseTotal = records.filter((record) => record.type === 'expenses').reduce((sum, record) => sum + Number(record.amount ?? 0), 0)

  return <section className="module-page reports-page">
    <div className="page-heading heading-row"><div><div className="eyebrow muted">PROPERTY INSIGHTS</div><h1>Reports & analytics</h1><p>Explore report-ready data from your local records.</p></div><div className="heading-actions"><select aria-label="Report date range" value={range} onChange={(event) => setRange(event.target.value)}><option>This month</option><option>Today</option><option>This week</option><option>This year</option><option>All time</option></select><button className="button button-secondary" onClick={() => window.print()}><FileText size={15} /> Print</button></div></div>
    <div className="metric-grid report-metrics"><MetricCard title="Records in reports" value={String(totalEntries)} note={range.toLowerCase()} icon={FileText} tint="sage" onClick={() => setRange('All time')} /><MetricCard title="Demo payments received" value={currency(paymentTotal)} note="Not independently verified" icon={CreditCard} tint="blue" onClick={() => setQuery('payment')} /><MetricCard title="Recorded expenses" value={currency(expenseTotal)} note="From local expense records" icon={ArrowDownToLine} tint="sand" onClick={() => setQuery('expenses')} /><MetricCard title="Available report types" value={String(reports.length)} note="Export as CSV" icon={ClipboardCheck} tint="rose" onClick={() => setQuery('')} /></div>
    <div className="panel reports-panel"><div className="table-toolbar"><div><strong className="reports-panel-title">Report library</strong><span className="reports-panel-subtitle">Choose a report to download its current data.</span></div><label className="table-search"><Search size={16} /><input placeholder="Search reports..." value={query} onChange={(event) => setQuery(event.target.value)} /></label></div><div className="report-list">{loading ? <div className="table-message"><span className="loading-spinner" /> Loading reports…</div> : reports.map((report) => <div className="report-row" key={report.title}><div className="report-icon"><FileText size={17} /></div><div className="report-info"><strong>{report.title}</strong><span>{report.description}</span></div><span className="report-count">{report.entries.length} records</span><button className="button button-secondary" onClick={() => download(report)}><Download size={14} /> Export CSV</button></div>)}{!loading && reports.length === 0 && <EmptyState title="No reports found" description="Try a different search." />}</div></div>
    <div className="demo-banner"><ShieldCheck size={15} /><span>Report data is local</span><i /> Payment records display simulated statuses; no transaction is verified or processed.</div>
  </section>
}

export default App
