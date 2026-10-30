import Dexie, { type Table } from 'dexie'

export type Role = 'admin' | 'student' | 'domestic_guest' | 'foreign_guest' | 'receptionist' | 'housekeeping'
export type ModuleKey =
  | 'students'
  | 'guests'
  | 'rooms'
  | 'bookings'
  | 'payments'
  | 'invoices'
  | 'attendance'
  | 'leave'
  | 'visitors'
  | 'mess'
  | 'housekeeping'
  | 'complaints'
  | 'inventory'
  | 'staff'
  | 'expenses'
  | 'reports'
  | 'notifications'
  | 'settings'

export type RecordValue = string | number | boolean | null
export type RecordItem = {
  id: string
  type: ModuleKey
  createdAt: string
  updatedAt: string
  ownerEmail?: string
  [key: string]: RecordValue | undefined
}

export type Account = {
  id: string
  email: string
  password: string
  name: string
  role: Role
  active: boolean
  recordId?: string
}

export type AppSetting = { key: string; value: string }

class HostelDatabase extends Dexie {
  records!: Table<RecordItem, string>
  accounts!: Table<Account, string>
  settings!: Table<AppSetting, string>

  constructor() {
    super('HavenHostelDemo')
    this.version(1).stores({
      records: 'id, type, status, ownerEmail, createdAt',
      accounts: 'id, &email, role, active',
      settings: 'key',
    })
    this.version(2).stores({
      records: 'id, type, status, ownerEmail, createdAt',
      accounts: 'id, &email, role, active, recordId',
      settings: 'key',
    })
  }
}

export const db = new HostelDatabase()

const now = new Date()
const iso = (date: Date) => date.toISOString().slice(0, 10)
const pastDate = (days: number) => {
  const date = new Date(now)
  date.setDate(date.getDate() - days)
  return iso(date)
}
const futureDate = (days: number) => {
  const date = new Date(now)
  date.setDate(date.getDate() + days)
  return iso(date)
}

const makeRecord = (
  type: ModuleKey,
  id: string,
  values: Omit<RecordItem, 'id' | 'type' | 'createdAt' | 'updatedAt'>,
): RecordItem => ({
  ...values,
  id,
  type,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
})

async function ensureDemoStaffAccounts() {
  const demoStaff = [
    { id: 'staff-demo-reception', email: 'reception@hosteldemo.com', name: 'Asha Reception', role: 'Reception', accessRole: 'receptionist' as const, password: 'Reception@123' },
    { id: 'staff-demo-housekeeping', email: 'housekeeping@hosteldemo.com', name: 'Ravi Housekeeping', role: 'Housekeeping', accessRole: 'housekeeping' as const, password: 'Cleaning@123' },
  ]
  for (const staff of demoStaff) {
    if (!await db.records.get(staff.id)) {
      await db.records.add(makeRecord('staff', staff.id, {
        employeeId: staff.id === 'staff-demo-reception' ? 'EMP-RECEPTION' : 'EMP-CLEAN',
        fullName: staff.name,
        role: staff.role,
        accessRole: staff.accessRole,
        email: staff.email,
        status: 'Active',
      }))
    }
    if (!await db.accounts.where('email').equals(staff.email).first()) {
      const accountId = staff.accessRole === 'receptionist' ? 'account-demo-reception' : 'account-demo-housekeeping'
      await db.accounts.add({
        id: await db.accounts.get(accountId) ? crypto.randomUUID() : accountId,
        email: staff.email,
        password: staff.password,
        name: staff.name,
        role: staff.accessRole,
        active: true,
        recordId: staff.id,
      })
    }
  }
}

export async function seedDemoData(force = false) {
  const count = await db.records.count()
  if (count && !force) {
    await ensureDemoStaffAccounts()
    return
  }

  await db.transaction('rw', db.records, db.accounts, db.settings, async () => {
    await Promise.all([db.records.clear(), db.accounts.clear(), db.settings.clear()])
    const records: RecordItem[] = []

    for (let index = 1; index <= 30; index += 1) {
      const floor = Math.ceil(index / 8)
      const roomNo = `${floor}${String(100 + index).slice(-2)}`
      const capacity = index <= 20 ? 3 : 2
      records.push(
        makeRecord('rooms', `room-${index}`, {
          roomNumber: roomNo,
          building: index <= 15 ? 'Maple House' : 'Cedar House',
          floor: `Floor ${floor}`,
          category: index % 3 === 0 ? 'Premium' : 'Standard',
          capacity,
          occupied: index <= 18 ? (index % 2) + 1 : 0,
          status: index === 29 ? 'Maintenance' : index <= 18 ? 'Occupied' : 'Available',
          facilities: index % 2 === 0 ? 'AC, attached bath' : 'Study desk, Wi-Fi',
          price: index % 3 === 0 ? 12500 : 9500,
        }),
      )
    }

    for (let index = 1; index <= 20; index += 1) {
      const names = ['Aarav Sharma', 'Diya Patel', 'Ishaan Mehta', 'Ananya Rao', 'Kabir Singh']
      const email = index === 1 ? 'student@hosteldemo.com' : `student${index}@hosteldemo.com`
      const room = String(101 + ((index - 1) % 18))
      const record = makeRecord('students', `student-${index}`, {
        studentId: `STU-${String(2026_000 + index)}`,
        fullName: names[(index - 1) % names.length] + (index > names.length ? ` ${index}` : ''),
        email,
        mobile: `+91 98${String(10000000 + index).slice(-8)}`,
        college: ['Northbridge University', 'City Institute of Technology', 'Lakeside College'][index % 3],
        course: ['B.Sc. Computer Science', 'B.Com', 'B.Arch'][index % 3],
        room,
        bed: `B${(index % 3) + 1}`,
        admissionDate: pastDate(index * 18),
        feePlan: 'Monthly',
        monthlyFee: 9500,
        status: 'Active',
        ownerEmail: email,
      })
      records.push(record)
      if (index === 1) {
        await db.accounts.add({
          id: 'account-student',
          email,
          password: 'Student@123',
          name: record.fullName as string,
          role: 'student',
          active: true,
          recordId: record.id,
        })
      }
    }

    const guestNames = ['Maya Kapoor', 'Oliver James', 'Sofia Martin', 'Arjun Nair']
    for (let index = 1; index <= 18; index += 1) {
      const isForeign = index > 10
      const email = index === 1
        ? 'guest@hosteldemo.com'
        : index === 11
          ? 'foreign@hosteldemo.com'
          : `guest${index}@hosteldemo.com`
      const record = makeRecord('guests', `guest-${index}`, {
        guestId: `GST-${String(2026_000 + index)}`,
        fullName: guestNames[(index - 1) % guestNames.length] + (index > guestNames.length ? ` ${index}` : ''),
        email,
        category: isForeign ? 'Foreign' : 'Domestic',
        nationality: isForeign ? ['United Kingdom', 'France', 'Australia'][index % 3] : 'Indian',
        mobile: `+${isForeign ? '44' : '91'} 7700${String(100000 + index).slice(-6)}`,
        passport: isForeign ? `P${String(51000000 + index)}` : '—',
        arrival: pastDate(index),
        departure: futureDate(index + 3),
        room: String(101 + index),
        bookingReference: `BK-26-${String(1000 + index)}`,
        formCStatus: isForeign ? (index % 2 ? 'Submitted' : 'Pending') : 'Not required',
        paymentStatus: index % 4 === 0 ? 'Pending' : 'Paid',
        status: index % 3 === 0 ? 'Checked out' : 'Checked in',
        ownerEmail: email,
      })
      records.push(record)
      if (index === 1 || index === 11) {
        await db.accounts.add({
          id: `account-${index === 1 ? 'guest' : 'foreign'}`,
          email,
          password: 'Guest@123',
          name: record.fullName as string,
          role: isForeign ? 'foreign_guest' : 'domestic_guest',
          active: true,
          recordId: record.id,
        })
      }
    }

    for (let index = 1; index <= 15; index += 1) {
      records.push(
        makeRecord('bookings', `booking-${index}`, {
          bookingReference: `BK-26-${String(1000 + index)}`,
          customerType: index % 3 === 0 ? 'Guest' : 'Student',
          customer: index % 3 === 0 ? `Guest ${index}` : `Student ${index}`,
          room: String(101 + index),
          bed: `B${(index % 3) + 1}`,
          checkIn: pastDate(index * 2),
          checkOut: futureDate(index + 2),
          amount: 9500 + index * 450,
          status: index % 5 === 0 ? 'Pending' : index % 4 === 0 ? 'Completed' : 'Confirmed',
          ...((index === 1) ? { ownerEmail: 'student@hosteldemo.com' } : {}),
          ...((index === 3) ? { ownerEmail: 'guest@hosteldemo.com' } : {}),
          ...((index === 12) ? { ownerEmail: 'foreign@hosteldemo.com' } : {}),
        }),
      )
    }

    for (let index = 1; index <= 24; index += 1) {
      const payment = makeRecord('payments', `payment-${index}`, {
          reference: `PAY-26-${String(3000 + index)}`,
          payer: index % 2 ? `Student ${index}` : `Guest ${index}`,
          amount: [9500, 12000, 3800, 6500][index % 4],
          method: ['UPI', 'Bank transfer', 'Cash', 'Card'][index % 4],
          date: pastDate(index * 3),
          status: index % 6 === 0 ? 'Pending' : 'Demo paid',
          note: 'Simulation only — not a verified payment',
          ...((index === 1) ? { ownerEmail: 'student@hosteldemo.com' } : {}),
          ...((index === 3) ? { ownerEmail: 'guest@hosteldemo.com' } : {}),
          ...((index === 12) ? { ownerEmail: 'foreign@hosteldemo.com' } : {}),
        })
      records.push(payment)
      records.push(makeRecord('invoices', `invoice-${index}`, {
        invoiceNumber: `INV-26-${String(4000 + index)}`,
        reference: payment.reference as string,
        customer: payment.payer as string,
        amount: payment.amount as number,
        date: payment.date as string,
        status: payment.status as string,
        note: 'Demo invoice — payment status is not independently verified',
        ...((index === 1) ? { ownerEmail: 'student@hosteldemo.com' } : {}),
        ...((index === 3) ? { ownerEmail: 'guest@hosteldemo.com' } : {}),
        ...((index === 12) ? { ownerEmail: 'foreign@hosteldemo.com' } : {}),
      }))
    }

    for (let index = 1; index <= 14; index += 1) {
      records.push(
        makeRecord('complaints', `complaint-${index}`, {
          subject: ['Leaking tap', 'Wi-Fi connectivity', 'Fan repair', 'Room cleaning'][index % 4],
          room: String(101 + (index % 18)),
          category: ['Maintenance', 'Internet', 'Electrical', 'Housekeeping'][index % 4],
          priority: index % 4 === 0 ? 'High' : 'Normal',
          reportedBy: `Resident ${index}`,
          date: pastDate(index),
          status: index % 3 === 0 ? 'Resolved' : index % 2 === 0 ? 'In progress' : 'Open',
          resolution: index % 3 === 0 ? 'Completed by facilities team' : '',
          ...((index === 1) ? { ownerEmail: 'student@hosteldemo.com' } : {}),
          ...((index === 2) ? { ownerEmail: 'guest@hosteldemo.com' } : {}),
        }),
      )
    }

    for (let index = 1; index <= 24; index += 1) {
      records.push(
        makeRecord('attendance', `attendance-${index}`, {
          resident: `Student ${((index - 1) % 20) + 1}`,
          date: pastDate(index % 12),
          checkIn: '08:05',
          status: index % 7 === 0 ? 'Late' : index % 11 === 0 ? 'Absent' : 'Present',
          ...((index === 1) ? { ownerEmail: 'student@hosteldemo.com' } : {}),
        }),
      )
    }

    for (let index = 1; index <= 10; index += 1) {
      records.push(
        makeRecord('expenses', `expense-${index}`, {
          description: ['Electricity', 'Water supply', 'Internet', 'Groceries', 'Repairs'][index % 5],
          category: ['Utilities', 'Utilities', 'Utilities', 'Mess', 'Maintenance'][index % 5],
          amount: [18500, 6200, 4800, 14200, 3500][index % 5],
          date: pastDate(index * 2),
          vendor: ['City Power Co.', 'ClearFlow Services', 'FiberLink', 'Fresh Basket'][index % 4],
          status: 'Recorded',
        }),
      )
    }

    for (let index = 1; index <= 8; index += 1) {
      records.push(
        makeRecord('staff', `staff-${index}`, {
          employeeId: `EMP-${String(100 + index)}`,
          fullName: ['Neha Verma', 'Rohan Das', 'Pooja Menon', 'Samir Khan'][index % 4] + (index > 4 ? ` ${index}` : ''),
          role: ['Housekeeping', 'Security', 'Facilities', 'Kitchen'][index % 4],
          phone: `+91 98900${String(1000 + index)}`,
          joiningDate: pastDate(index * 90),
          salary: 22000 + index * 1500,
          status: 'Active',
        }),
      )
    }

    for (let index = 1; index <= 10; index += 1) {
      records.push(
        makeRecord('leave', `leave-${index}`, {
          resident: `Student ${index}`,
          startDate: futureDate(index),
          endDate: futureDate(index + 2),
          reason: ['Family visit', 'Medical appointment', 'Personal work'][index % 3],
          status: index % 3 === 0 ? 'Pending' : 'Approved',
          ...((index === 1) ? { ownerEmail: 'student@hosteldemo.com' } : {}),
        }),
      )
    }

    for (let index = 1; index <= 8; index += 1) {
      records.push(
        makeRecord('visitors', `visitor-${index}`, {
          visitorName: ['Aditi Shah', 'Rahul Gupta', 'Priya Bose', 'Nikhil Rao'][index % 4],
          visiting: `Student ${index}`,
          purpose: 'Family visit',
          entryTime: '14:30',
          exitTime: index % 2 ? '15:20' : '—',
          status: index % 2 ? 'Checked out' : 'Inside',
        }),
      )
    }

    for (let index = 1; index <= 8; index += 1) {
      records.push(
        makeRecord('inventory', `asset-${index}`, {
          item: ['Mattress', 'Study desk', 'Ceiling fan', 'Water purifier'][index % 4],
          category: ['Furniture', 'Furniture', 'Electrical', 'Kitchen'][index % 4],
          quantity: 12 - index,
          location: `${index % 2 ? 'Maple' : 'Cedar'} House`,
          condition: index % 4 === 0 ? 'Repair required' : 'Good',
          status: 'In stock',
        }),
      )
    }

    for (let index = 1; index <= 7; index += 1) {
      records.push(
        makeRecord('mess', `menu-${index}`, {
          day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index - 1],
          breakfast: 'Oatmeal, fruit, tea',
          lunch: 'Rice, seasonal vegetables, dal',
          dinner: 'Flatbread, paneer curry, salad',
          status: 'Published',
        }),
      )
    }

    for (let index = 1; index <= 6; index += 1) {
      records.push(
        makeRecord('housekeeping', `cleaning-${index}`, {
          task: `Room ${100 + index} weekly cleaning`,
          room: String(100 + index),
          assignedTo: ['Ravi', 'Neha', 'Pooja'][index % 3],
          dueDate: futureDate(index),
          status: index % 3 === 0 ? 'Completed' : 'Scheduled',
        }),
      )
    }

    records.push(
      makeRecord('notifications', 'notice-1', {
        title: 'Welcome to Haven House',
        audience: 'All residents',
        message: 'Please review the updated quiet hours and visitor guidelines.',
        date: iso(now),
        status: 'Published',
      }),
    )

    records.push(
      makeRecord('staff', 'staff-demo-reception', {
        employeeId: 'EMP-RECEPTION',
        fullName: 'Asha Reception',
        role: 'Reception',
        accessRole: 'receptionist',
        email: 'reception@hosteldemo.com',
        phone: '+91 9890011001',
        joiningDate: iso(now),
        status: 'Active',
      }),
      makeRecord('staff', 'staff-demo-housekeeping', {
        employeeId: 'EMP-CLEAN',
        fullName: 'Ravi Housekeeping',
        role: 'Housekeeping',
        accessRole: 'housekeeping',
        email: 'housekeeping@hosteldemo.com',
        phone: '+91 9890011002',
        joiningDate: iso(now),
        status: 'Active',
      }),
    )

    await db.records.bulkAdd(records)
    await db.accounts.add({
      id: 'account-admin',
      email: 'admin@hosteldemo.com',
      password: 'Admin@123',
      name: 'Olivia Bennett',
      role: 'admin',
      active: true,
    })
    await db.accounts.bulkAdd([
      {
        id: 'account-demo-reception',
        email: 'reception@hosteldemo.com',
        password: 'Reception@123',
        name: 'Asha Reception',
        role: 'receptionist',
        active: true,
        recordId: 'staff-demo-reception',
      },
      {
        id: 'account-demo-housekeeping',
        email: 'housekeeping@hosteldemo.com',
        password: 'Cleaning@123',
        name: 'Ravi Housekeeping',
        role: 'housekeeping',
        active: true,
        recordId: 'staff-demo-housekeeping',
      },
    ])
    await db.settings.bulkAdd([
      { key: 'hostelName', value: 'Haven House' },
      { key: 'currency', value: 'INR' },
      { key: 'demoOnly', value: 'true' },
    ])
  })
}
