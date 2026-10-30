import type { ModuleKey, Role } from './database'

export type FieldConfig = {
  key: string
  label: string
  type?: 'text' | 'number' | 'date' | 'email' | 'select' | 'textarea'
  options?: string[]
  required?: boolean
}

export type ModuleConfig = {
  key: ModuleKey
  label: string
  singular: string
  description: string
  icon: string
  roles: Role[]
  fields: FieldConfig[]
  searchKeys: string[]
}

const adminOnly: Role[] = ['admin']
const everyone: Role[] = ['admin', 'student', 'domestic_guest', 'foreign_guest']
const adminsAndStudents: Role[] = ['admin', 'student']
const adminsAndGuests: Role[] = ['admin', 'domestic_guest', 'foreign_guest']

export const modules: ModuleConfig[] = [
  { key: 'students', label: 'Students', singular: 'student', description: 'Manage admissions, resident profiles and fee plans.', icon: 'users', roles: adminOnly, searchKeys: ['fullName', 'studentId', 'email', 'room'], fields: [
    { key: 'studentId', label: 'Student ID', required: true }, { key: 'fullName', label: 'Full name', required: true }, { key: 'email', label: 'Email', type: 'email', required: true }, { key: 'mobile', label: 'Mobile' }, { key: 'college', label: 'College / university' }, { key: 'course', label: 'Course' }, { key: 'room', label: 'Room' }, { key: 'bed', label: 'Bed' }, { key: 'admissionDate', label: 'Admission date', type: 'date' }, { key: 'monthlyFee', label: 'Monthly fee', type: 'number' }, { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive', 'Pending'] },
  ] },
  { key: 'guests', label: 'Guests', singular: 'guest', description: 'Track domestic and international guest stays and compliance.', icon: 'id-card', roles: adminOnly, searchKeys: ['fullName', 'guestId', 'email', 'category', 'room'], fields: [
    { key: 'guestId', label: 'Guest ID', required: true }, { key: 'fullName', label: 'Full name', required: true }, { key: 'email', label: 'Email', type: 'email', required: true }, { key: 'category', label: 'Guest category', type: 'select', options: ['Domestic', 'Foreign'], required: true }, { key: 'nationality', label: 'Nationality' }, { key: 'mobile', label: 'Mobile' }, { key: 'passport', label: 'Passport number' }, { key: 'arrival', label: 'Arrival', type: 'date' }, { key: 'departure', label: 'Departure', type: 'date' }, { key: 'room', label: 'Room' }, { key: 'formCStatus', label: 'Form C status', type: 'select', options: ['Pending', 'Submitted', 'Not required'] }, { key: 'paymentStatus', label: 'Payment status', type: 'select', options: ['Paid', 'Pending', 'Partially paid'] }, { key: 'status', label: 'Stay status', type: 'select', options: ['Reserved', 'Checked in', 'Checked out'] },
  ] },
  { key: 'rooms', label: 'Rooms & beds', singular: 'room', description: 'Room inventory, occupancy and maintenance overview.', icon: 'building', roles: adminOnly, searchKeys: ['roomNumber', 'building', 'floor', 'category', 'status'], fields: [
    { key: 'roomNumber', label: 'Room number', required: true }, { key: 'building', label: 'Building', required: true }, { key: 'floor', label: 'Floor' }, { key: 'category', label: 'Category', type: 'select', options: ['Standard', 'Premium', 'Deluxe'] }, { key: 'capacity', label: 'Bed capacity', type: 'number', required: true }, { key: 'occupied', label: 'Occupied beds', type: 'number' }, { key: 'facilities', label: 'Facilities', type: 'textarea' }, { key: 'price', label: 'Monthly rate', type: 'number' }, { key: 'status', label: 'Status', type: 'select', options: ['Available', 'Occupied', 'Maintenance', 'Blocked'] },
  ] },
  { key: 'bookings', label: 'Bookings', singular: 'booking', description: 'Review reservations, availability and upcoming arrivals.', icon: 'calendar', roles: adminsAndGuests, searchKeys: ['bookingReference', 'customer', 'customerType', 'room', 'status'], fields: [
    { key: 'bookingReference', label: 'Booking reference', required: true }, { key: 'customerType', label: 'Customer type', type: 'select', options: ['Student', 'Guest'], required: true }, { key: 'customer', label: 'Customer', required: true }, { key: 'room', label: 'Room', required: true }, { key: 'bed', label: 'Bed', required: true }, { key: 'checkIn', label: 'Check-in', type: 'date', required: true }, { key: 'checkOut', label: 'Check-out', type: 'date', required: true }, { key: 'amount', label: 'Booking amount', type: 'number' }, { key: 'status', label: 'Status', type: 'select', options: ['Pending', 'Confirmed', 'Checked in', 'Completed', 'Cancelled'], required: true },
  ] },
  { key: 'payments', label: 'Payments', singular: 'payment', description: 'Demo-only payment ledger and outstanding balances.', icon: 'credit-card', roles: everyone, searchKeys: ['reference', 'payer', 'method', 'status'], fields: [
    { key: 'reference', label: 'Reference', required: true }, { key: 'payer', label: 'Payer', required: true }, { key: 'amount', label: 'Amount', type: 'number', required: true }, { key: 'method', label: 'Method', type: 'select', options: ['Cash', 'UPI', 'Card', 'Bank transfer', 'Online demo'] }, { key: 'date', label: 'Payment date', type: 'date' }, { key: 'note', label: 'Note', type: 'textarea' }, { key: 'status', label: 'Status', type: 'select', options: ['Demo paid', 'Pending', 'Refunded'] },
  ] },
  { key: 'invoices', label: 'Invoices', singular: 'invoice', description: 'Stored billing records with clearly labeled demo payment status.', icon: 'wallet', roles: everyone, searchKeys: ['invoiceNumber', 'reference', 'customer', 'status'], fields: [
    { key: 'invoiceNumber', label: 'Invoice number', required: true }, { key: 'reference', label: 'Payment reference' }, { key: 'customer', label: 'Customer', required: true }, { key: 'amount', label: 'Amount', type: 'number', required: true }, { key: 'date', label: 'Invoice date', type: 'date' }, { key: 'note', label: 'Note', type: 'textarea' }, { key: 'status', label: 'Status', type: 'select', options: ['Demo paid', 'Pending', 'Refunded'] },
  ] },
  { key: 'attendance', label: 'Attendance', singular: 'attendance record', description: 'Daily student attendance and presence trends.', icon: 'clipboard', roles: adminsAndStudents, searchKeys: ['resident', 'date', 'status'], fields: [
    { key: 'resident', label: 'Resident', required: true }, { key: 'date', label: 'Date', type: 'date', required: true }, { key: 'checkIn', label: 'Check-in time' }, { key: 'status', label: 'Status', type: 'select', options: ['Present', 'Absent', 'Late'] },
  ] },
  { key: 'leave', label: 'Leave requests', singular: 'leave request', description: 'Review resident leave requests and late returns.', icon: 'calendar-days', roles: adminsAndStudents, searchKeys: ['resident', 'reason', 'status'], fields: [
    { key: 'resident', label: 'Resident', required: true }, { key: 'startDate', label: 'Start date', type: 'date', required: true }, { key: 'endDate', label: 'End date', type: 'date', required: true }, { key: 'reason', label: 'Reason', type: 'textarea', required: true }, { key: 'status', label: 'Status', type: 'select', options: ['Pending', 'Approved', 'Rejected'] },
  ] },
  { key: 'visitors', label: 'Visitors', singular: 'visitor', description: 'Visitor register, purpose and entry/exit status.', icon: 'contact', roles: adminOnly, searchKeys: ['visitorName', 'visiting', 'purpose', 'status'], fields: [
    { key: 'visitorName', label: 'Visitor name', required: true }, { key: 'visiting', label: 'Visiting resident', required: true }, { key: 'purpose', label: 'Purpose', required: true }, { key: 'entryTime', label: 'Entry time' }, { key: 'exitTime', label: 'Exit time' }, { key: 'status', label: 'Status', type: 'select', options: ['Inside', 'Checked out'] },
  ] },
  { key: 'mess', label: 'Food & mess', singular: 'menu entry', description: 'Weekly meal schedule and meal plan publishing.', icon: 'utensils', roles: everyone, searchKeys: ['day', 'breakfast', 'lunch', 'dinner'], fields: [
    { key: 'day', label: 'Day', type: 'select', options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], required: true }, { key: 'breakfast', label: 'Breakfast', type: 'textarea' }, { key: 'lunch', label: 'Lunch', type: 'textarea' }, { key: 'dinner', label: 'Dinner', type: 'textarea' }, { key: 'status', label: 'Status', type: 'select', options: ['Published', 'Draft'] },
  ] },
  { key: 'housekeeping', label: 'Housekeeping', singular: 'task', description: 'Cleaning schedules and assigned service tasks.', icon: 'sparkles', roles: adminOnly, searchKeys: ['task', 'room', 'assignedTo', 'status'], fields: [
    { key: 'task', label: 'Task', required: true }, { key: 'room', label: 'Room' }, { key: 'assignedTo', label: 'Assigned to' }, { key: 'dueDate', label: 'Due date', type: 'date' }, { key: 'status', label: 'Status', type: 'select', options: ['Scheduled', 'In progress', 'Completed'] },
  ] },
  { key: 'complaints', label: 'Complaints & maintenance', singular: 'complaint', description: 'Track issues, assign follow-ups and record resolutions.', icon: 'wrench', roles: everyone, searchKeys: ['subject', 'room', 'category', 'reportedBy', 'status'], fields: [
    { key: 'subject', label: 'Subject', required: true }, { key: 'room', label: 'Room' }, { key: 'category', label: 'Category', type: 'select', options: ['Maintenance', 'Internet', 'Electrical', 'Housekeeping', 'Other'] }, { key: 'priority', label: 'Priority', type: 'select', options: ['Normal', 'High', 'Urgent'] }, { key: 'reportedBy', label: 'Reported by' }, { key: 'date', label: 'Date', type: 'date' }, { key: 'resolution', label: 'Resolution notes', type: 'textarea' }, { key: 'status', label: 'Status', type: 'select', options: ['Open', 'In progress', 'Resolved'] },
  ] },
  { key: 'inventory', label: 'Inventory & assets', singular: 'asset', description: 'Track property assets, stock levels and condition.', icon: 'boxes', roles: adminOnly, searchKeys: ['item', 'category', 'location', 'condition'], fields: [
    { key: 'item', label: 'Asset', required: true }, { key: 'category', label: 'Category' }, { key: 'quantity', label: 'Quantity', type: 'number' }, { key: 'location', label: 'Location' }, { key: 'condition', label: 'Condition', type: 'select', options: ['Good', 'Repair required', 'Damaged'] }, { key: 'status', label: 'Status', type: 'select', options: ['In stock', 'Low stock', 'Ordered'] },
  ] },
  { key: 'staff', label: 'Staff', singular: 'employee', description: 'Employee directory, teams and employment status.', icon: 'briefcase', roles: adminOnly, searchKeys: ['employeeId', 'fullName', 'role', 'status'], fields: [
    { key: 'employeeId', label: 'Employee ID', required: true }, { key: 'fullName', label: 'Full name', required: true }, { key: 'role', label: 'Department / role' }, { key: 'phone', label: 'Phone' }, { key: 'joiningDate', label: 'Joining date', type: 'date' }, { key: 'salary', label: 'Monthly salary', type: 'number' }, { key: 'status', label: 'Status', type: 'select', options: ['Active', 'On leave', 'Inactive'] },
  ] },
  { key: 'expenses', label: 'Expenses & accounting', singular: 'expense', description: 'Operating costs and the hostel cashbook.', icon: 'wallet', roles: adminOnly, searchKeys: ['description', 'category', 'vendor', 'status'], fields: [
    { key: 'description', label: 'Description', required: true }, { key: 'category', label: 'Category', type: 'select', options: ['Utilities', 'Mess', 'Maintenance', 'Salary', 'Other'] }, { key: 'amount', label: 'Amount', type: 'number', required: true }, { key: 'date', label: 'Date', type: 'date' }, { key: 'vendor', label: 'Vendor' }, { key: 'status', label: 'Status', type: 'select', options: ['Recorded', 'Pending'] },
  ] },
  { key: 'reports', label: 'Reports & analytics', singular: 'report', description: 'Explore occupancy, finance and resident data from local records.', icon: 'clipboard', roles: adminOnly, searchKeys: ['title', 'description'], fields: [
    { key: 'title', label: 'Report title', required: true }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'status', label: 'Status', type: 'select', options: ['Ready', 'Scheduled'] },
  ] },
  { key: 'notifications', label: 'Announcements', singular: 'announcement', description: 'Publish notices and targeted resident updates.', icon: 'bell', roles: everyone, searchKeys: ['title', 'audience', 'message'], fields: [
    { key: 'title', label: 'Title', required: true }, { key: 'audience', label: 'Audience', type: 'select', options: ['All residents', 'Students', 'Guests'] }, { key: 'message', label: 'Message', type: 'textarea', required: true }, { key: 'date', label: 'Date', type: 'date' }, { key: 'status', label: 'Status', type: 'select', options: ['Published', 'Draft'] },
  ] },
  { key: 'settings', label: 'Settings & permissions', singular: 'setting', description: 'Hostel profile, demo data and browser storage controls.', icon: 'settings', roles: adminOnly, searchKeys: ['key', 'value'], fields: [
    { key: 'key', label: 'Setting', required: true }, { key: 'value', label: 'Value', required: true },
  ] },
]

export function getModule(key: string | undefined) {
  return modules.find((item) => item.key === key)
}

export const portalLinks: Record<'student' | 'guest', ModuleKey[]> = {
  student: ['complaints', 'leave', 'attendance', 'mess', 'payments', 'invoices', 'notifications'],
  guest: ['complaints', 'bookings', 'payments', 'invoices', 'notifications'],
}

export const roleLabel: Record<Role, string> = {
  admin: 'Administrator',
  student: 'Student',
  domestic_guest: 'Domestic guest',
  foreign_guest: 'International guest',
}
