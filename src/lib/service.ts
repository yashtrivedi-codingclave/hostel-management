import { db, type Account, type ModuleKey, type RecordItem, type RecordValue, seedDemoData } from './database'
import type { FieldConfig, ModuleConfig } from './modules'

const dataChannel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('haven-house-records')

dataChannel?.addEventListener('message', () => {
  window.dispatchEvent(new Event('haven-data-changed'))
})

function notifyDataChanged() {
  window.dispatchEvent(new Event('haven-data-changed'))
  dataChannel?.postMessage(Date.now())
}

function getLocalDateTime() {
  const now = new Date()
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return { date, time }
}

export async function initializeData() {
  await seedDemoData()
}

export async function authenticate(email: string, password: string): Promise<Account> {
  const account = await db.accounts.where('email').equals(email.trim().toLowerCase()).first()
  if (!account || account.password !== password) throw new Error('The email or password is not correct.')
  if (!account.active) throw new Error('This account has been deactivated. Contact your hostel administrator.')
  return account
}

export async function listRecords(type: ModuleKey): Promise<RecordItem[]> {
  return db.records.where('type').equals(type).reverse().sortBy('createdAt')
}

function isActiveBooking(record: RecordItem) {
  return ['Pending', 'Confirmed', 'Checked in'].includes(String(record.status))
}

function overlaps(startA: string, endA: string, startB: string, endB: string) {
  return startA <= endB && startB <= endA
}

function currentDateKey() {
  const { date } = getLocalDateTime()
  return date
}

function isRoomUnavailable(room: RecordItem) {
  return ['Maintenance', 'Blocked', 'Needs cleaning', 'Cleaning'].includes(String(room.status))
}

function isInDateRange(start: string, end: string, requestedStart: string, requestedEnd: string) {
  return (!start || !requestedEnd || start <= requestedEnd) && (!end || !requestedStart || requestedStart <= end)
}

export async function getRoomBedAvailability(
  startDate = currentDateKey(),
  endDate = startDate,
  excludeBookingId?: string,
  excludeResidentId?: string,
): Promise<{ room: RecordItem; beds: string[] }[]> {
  const [rooms, students, guests, bookings, housekeeping] = await Promise.all([
    listRecords('rooms'),
    listRecords('students'),
    listRecords('guests'),
    listRecords('bookings'),
    listRecords('housekeeping'),
  ])
  const today = currentDateKey()
  return rooms.map((room) => {
    const roomNumber = String(room.roomNumber)
    if (isRoomUnavailable(room)) return { room, beds: [] }
    const capacity = Number(room.capacity ?? 0)
    if (!Number.isInteger(capacity) || capacity < 1) return { room, beds: [] }
    if (housekeeping.some((task) => String(task.room) === roomNumber && ['Needs cleaning', 'In progress'].includes(String(task.status)))) {
      return { room, beds: [] }
    }

    const assignedBeds = new Set<string>()
    const currentlyOccupiedBeds = new Set<string>()
    const addBed = (bed: unknown, target: Set<string>) => {
      const label = String(bed ?? '').trim().toUpperCase()
      const number = Number(label.replace(/^B/, ''))
      if (Number.isInteger(number) && number > 0 && number <= capacity) target.add(`B${number}`)
    }

    for (const student of students) {
      if (student.id === excludeResidentId) continue
      const bookingStatus = String(student.bookingStatus ?? '')
      const active = bookingStatus
        ? bookingStatus === 'Checked in'
        : String(student.status ?? 'Active') === 'Active'
      if (!active || String(student.room ?? '') !== roomNumber) continue
      const start = String(student.stayStart ?? student.admissionDate ?? '')
      const end = String(student.stayEnd ?? '')
      if (isInDateRange(start, end, today, today)) addBed(student.bed, currentlyOccupiedBeds)
      if (isInDateRange(start, end, startDate, endDate)) addBed(student.bed, assignedBeds)
    }

    for (const guest of guests) {
      if (guest.id === excludeResidentId || String(guest.status) !== 'Checked in' || String(guest.room ?? '') !== roomNumber) continue
      const start = String(guest.arrival ?? '')
      const end = String(guest.departure ?? '')
      if (isInDateRange(start, end, today, today)) addBed(guest.bed, currentlyOccupiedBeds)
      if (isInDateRange(start, end, startDate, endDate)) addBed(guest.bed, assignedBeds)
    }

    for (const booking of bookings) {
      if (booking.id === excludeBookingId || String(booking.room ?? '') !== roomNumber ||
        !isActiveBooking(booking) || !isInDateRange(String(booking.checkIn ?? ''), String(booking.checkOut ?? ''), startDate, endDate)) continue
      addBed(booking.bed, assignedBeds)
      if (String(booking.status) === 'Checked in' &&
        isInDateRange(String(booking.checkIn ?? ''), String(booking.checkOut ?? ''), today, today)) {
        addBed(booking.bed, currentlyOccupiedBeds)
      }
    }

    const excludedStudent = students.find((student) => student.id === excludeResidentId &&
      String(student.room ?? '') === roomNumber &&
      (student.bookingStatus ? student.bookingStatus === 'Checked in' : String(student.status ?? 'Active') === 'Active') &&
      isInDateRange(String(student.stayStart ?? student.admissionDate ?? ''), String(student.stayEnd ?? ''), today, today))
    const excludedGuest = guests.find((guest) => guest.id === excludeResidentId && String(guest.room ?? '') === roomNumber &&
      String(guest.status) === 'Checked in' &&
      isInDateRange(String(guest.arrival ?? ''), String(guest.departure ?? ''), today, today))
    const excludedCurrentOccupant = excludedStudent || excludedGuest ? 1 : 0
    const untrackedOccupancy = Math.max(0, Number(room.occupied ?? 0) - currentlyOccupiedBeds.size - excludedCurrentOccupant)
    let filledUnknownBeds = 0
    for (let number = 1; number <= capacity && filledUnknownBeds < untrackedOccupancy; number += 1) {
      const bed = `B${number}`
      if (!assignedBeds.has(bed)) {
        assignedBeds.add(bed)
        currentlyOccupiedBeds.add(bed)
        filledUnknownBeds += 1
      }
    }

    const beds = Array.from({ length: capacity }, (_, index) => `B${index + 1}`)
      .filter((bed) => !assignedBeds.has(bed))
    return { room, beds }
  })
}

export async function getAvailableBeds(
  roomNumber: string,
  startDate = currentDateKey(),
  endDate = startDate,
  excludeBookingId?: string,
  excludeResidentId?: string,
): Promise<string[]> {
  const availability = await getRoomBedAvailability(startDate, endDate, excludeBookingId, excludeResidentId)
  return availability.find(({ room }) => String(room.roomNumber) === roomNumber)?.beds ?? []
}

function validateFields(fields: FieldConfig[], values: Record<string, string>) {
  for (const field of fields) {
    const value = values[field.key]?.trim() ?? ''
    if (field.required && !value) throw new Error(`${field.label} is required.`)
    if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new Error(`Enter a valid ${field.label.toLowerCase()}.`)
    }
    if (field.type === 'number' && value && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
      throw new Error(`${field.label} must be a non-negative number.`)
    }
  }
}

function normalizeValues(fields: FieldConfig[], values: Record<string, string>) {
  const result: Record<string, RecordValue> = {}
  for (const field of fields) {
    const value = values[field.key]?.trim() ?? ''
    result[field.key] = field.type === 'number' && value ? Number(value) : value
  }
  return result
}

function accommodationBooking(module: ModuleConfig, values: Record<string, RecordValue>, id: string, timestamp: string): RecordItem | null {
  const isStudent = module.key === 'students'
  if (!isStudent && module.key !== 'guests') return null
  const allocation = String(isStudent ? values.bookingStatus ?? 'No booking' : values.status)
  if (isStudent && !['Reserved', 'Checked in'].includes(allocation)) return null
  if (!isStudent && !['Reserved', 'Checked in'].includes(allocation)) return null

  const room = String(values.room ?? '')
  const bed = String(values.bed ?? '')
  const checkIn = String(isStudent ? values.stayStart ?? '' : values.arrival ?? '')
  const checkOut = String(isStudent ? values.stayEnd ?? '' : values.departure ?? '')
  if (!room || !bed || !checkIn || !checkOut) {
    throw new Error('Choose a room and available bed, and enter the stay start and end dates.')
  }
  if (checkOut <= checkIn) throw new Error('Stay end date must be after the start date.')

  return {
    id,
    type: 'bookings',
    bookingReference: `BK-${new Date().getFullYear()}-${id.slice(0, 6).toUpperCase()}`,
    customerType: isStudent ? 'Student' : 'Guest',
    customer: String(values.fullName ?? ''),
    room,
    bed,
    checkIn,
    checkOut,
    amount: 0,
    status: allocation === 'Reserved' ? 'Confirmed' : 'Checked in',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

async function validateBooking(values: Record<string, RecordValue | undefined>, exceptId?: string, exceptResidentId?: string) {
  const room = String(values.room ?? '')
  const bed = String(values.bed ?? '')
  const checkIn = String(values.checkIn ?? '')
  const checkOut = String(values.checkOut ?? '')
  if (checkIn && checkOut && checkOut <= checkIn) throw new Error('Check-out must be after check-in.')
  if (!room || !bed || !checkIn || !checkOut || ['Cancelled', 'Completed'].includes(String(values.status))) return
  const roomRecord = await db.records.where('type').equals('rooms').filter((item) => String(item.roomNumber) === room).first()
  if (!roomRecord) throw new Error('Choose a room that exists in the room register.')
  if (isRoomUnavailable(roomRecord)) {
    throw new Error('This room is not available for bookings until it is clean and ready.')
  }
  const bedNumber = Number(bed.replace(/^B/i, ''))
  if (!Number.isInteger(bedNumber) || bedNumber < 1 || bedNumber > Number(roomRecord.capacity ?? 0)) {
    throw new Error('Choose a bed within this room’s capacity, for example B1.')
  }
  const availableBeds = await getAvailableBeds(room, checkIn, checkOut, exceptId, exceptResidentId)
  if (!availableBeds.includes(`B${bedNumber}`)) {
    throw new Error(`Bed B${bedNumber} is not available for the selected dates. Choose another available bed.`)
  }
  const bookings = await db.records.where('type').equals('bookings').toArray()
  const duplicate = bookings.some((booking) =>
    booking.id !== exceptId &&
    isActiveBooking(booking) &&
    String(booking.room) === room &&
    String(booking.bed) === bed &&
    overlaps(checkIn, checkOut, String(booking.checkIn ?? ''), String(booking.checkOut ?? '')),
  )
  if (duplicate) throw new Error('That bed already has an active booking for the selected dates.')
}

export async function createRecord(
  module: ModuleConfig,
  values: Record<string, string>,
  ownerEmail?: string,
): Promise<RecordItem> {
  const submittedValues = { ...values }
  for (const field of module.fields.filter((item) => item.autoGenerated)) {
    const records = await db.records.where('type').equals(module.key).toArray()
    const prefix = module.key === 'students' ? 'STU' : 'GST'
    const year = new Date().getFullYear()
    const highest = records.reduce((max, record) => {
      const code = String(record[field.key] ?? '')
      const match = new RegExp(`^${prefix}-${year}-(\\d+)$`).exec(code)
      const legacyMatch = new RegExp(`^${prefix}-${year}(\\d+)$`).exec(code)
      const sequence = legacyMatch ? Number(legacyMatch[1]) : match ? Number(match[1]) : 0
      return Math.max(max, sequence)
    }, 0)
    submittedValues[field.key] = `${prefix}-${year}-${String(highest + 1).padStart(4, '0')}`
  }
  validateFields(module.fields, submittedValues)
  const normalized = normalizeValues(module.fields, submittedValues)
  const now = new Date().toISOString()
  const booking = accommodationBooking(module, normalized, crypto.randomUUID(), now)
  const item: RecordItem = {
    ...normalized,
    id: crypto.randomUUID(),
    type: module.key,
    createdAt: now,
    updatedAt: now,
    ...(ownerEmail ? { ownerEmail } : {}),
    ...(booking ? { bookingId: booking.id } : {}),
  }

  await db.transaction('rw', db.records, db.accounts, async () => {
    if (module.key === 'bookings') await validateBooking(normalized)
    if (booking) await validateBooking(booking)
    if (module.key === 'rooms' && Number(normalized.occupied ?? 0) > Number(normalized.capacity ?? 0)) {
      throw new Error('Occupied beds cannot exceed the room capacity.')
    }
    if (module.key === 'rooms') {
      const roomNumber = String(normalized.roomNumber ?? '').toLowerCase()
      const duplicateRoom = await db.records.where('type').equals('rooms').filter((room) => String(room.roomNumber).toLowerCase() === roomNumber).first()
      if (duplicateRoom) throw new Error('A room with that number already exists.')
    }
    if (module.key === 'payments') {
      const reference = String(normalized.reference ?? '').toLowerCase()
      const duplicatePayment = await db.records.where('type').equals('payments').filter((payment) => String(payment.reference).toLowerCase() === reference).first()
      if (duplicatePayment) throw new Error('A payment already uses that reference.')
    }
    if (['students', 'guests'].includes(module.key)) {
      const email = String(normalized.email ?? '').toLowerCase()
      if (await db.accounts.where('email').equals(email).first()) throw new Error('An account already exists for that email.')
      const name = String(normalized.fullName ?? 'Resident')
      const role = module.key === 'students'
        ? 'student'
        : String(normalized.category).toLowerCase() === 'foreign'
          ? 'foreign_guest'
          : 'domestic_guest'
      await db.accounts.add({
        id: crypto.randomUUID(),
        email,
        password: 'Welcome@123',
        name,
        role,
        active: true,
        recordId: item.id,
      })
    }
    if (module.key === 'staff' && ['receptionist', 'housekeeping'].includes(String(normalized.accessRole))) {
      const email = String(normalized.email ?? '').trim().toLowerCase()
      if (!email) throw new Error('A login email is required when portal access is enabled.')
      if (await db.accounts.where('email').equals(email).first()) throw new Error('An account already exists for that email.')
      await db.accounts.add({
        id: crypto.randomUUID(),
        email,
        password: 'Welcome@123',
        name: String(normalized.fullName ?? 'Staff member'),
        role: normalized.accessRole as Account['role'],
        active: normalized.status !== 'Inactive',
        recordId: item.id,
      })
    }
    await db.records.add(item)
    if (booking) await db.records.add(booking)
    if (module.key === 'payments') {
      await db.records.add({
        id: crypto.randomUUID(),
        type: 'invoices',
        invoiceNumber: `INV-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
        reference: normalized.reference ?? '',
        customer: normalized.payer ?? '',
        amount: normalized.amount ?? 0,
        date: normalized.date ?? new Date().toISOString().slice(0, 10),
        status: normalized.status ?? 'Pending',
        note: 'Demo invoice — payment status is not independently verified',
        ...(ownerEmail ? { ownerEmail } : {}),
        createdAt: now,
        updatedAt: now,
      })
    }
    if (module.key === 'bookings' && normalized.status === 'Checked in') {
      await adjustRoomOccupancy(String(normalized.room), 1)
    }
    if (module.key === 'guests' && normalized.status === 'Checked in') {
      await adjustRoomOccupancy(String(normalized.room), 1)
    }
    if (module.key === 'students' && normalized.bookingStatus === 'Checked in') {
      await adjustRoomOccupancy(String(normalized.room), 1)
    }
    if (module.key === 'attendance') {
      const resident = String(normalized.resident ?? '')
      const person = await db.records.where('type').anyOf('students', 'guests')
        .filter((record) => String(record.fullName) === resident).first()
      if (person?.ownerEmail) {
        await db.records.put({ ...item, ownerEmail: person.ownerEmail })
      }
    }
  })
  notifyDataChanged()
  return item
}

export async function punchAttendance(resident: string, direction: 'in' | 'out') {
  const name = resident.trim()
  if (!name) throw new Error('Choose a resident before recording attendance.')
  const { date, time } = getLocalDateTime()
  const todayRecord = await db.records.where('type').equals('attendance')
    .filter((record) => String(record.resident).toLowerCase() === name.toLowerCase() && String(record.date) === date)
    .first()
  const residentRecord = await db.records.where('type').anyOf('students', 'guests')
    .filter((record) => String(record.fullName).toLowerCase() === name.toLowerCase()).first()
  if (direction === 'in') {
    if (todayRecord?.checkIn) throw new Error(`${name} is already punched in today.`)
    const record: RecordItem = {
      ...(todayRecord ?? {}),
      id: todayRecord?.id ?? crypto.randomUUID(),
      type: 'attendance',
      resident: name,
      date,
      checkIn: time,
      checkOut: '',
      status: 'Present',
      ...(residentRecord?.ownerEmail ? { ownerEmail: residentRecord.ownerEmail } : {}),
      createdAt: todayRecord?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await db.records.put(record)
  } else {
    if (!todayRecord?.checkIn) throw new Error(`${name} must punch in before punching out.`)
    if (todayRecord.checkOut) throw new Error(`${name} has already punched out today.`)
    await db.records.put({
      ...todayRecord,
      checkOut: time,
      status: 'Checked out',
      updatedAt: new Date().toISOString(),
    })
  }
  notifyDataChanged()
}

async function adjustRoomOccupancy(roomNumber: string, delta: number) {
  const room = await db.records.where('type').equals('rooms').filter((item) => String(item.roomNumber) === roomNumber).first()
  if (!room) return
  const capacity = Number(room.capacity ?? 0)
  const occupied = Math.min(capacity, Math.max(0, Number(room.occupied ?? 0) + delta))
  const status = occupied > 0 ? 'Occupied' : room.status === 'Maintenance' || room.status === 'Blocked' ? room.status : 'Available'
  await db.records.put({ ...room, occupied, status, updatedAt: new Date().toISOString() })
}

async function scheduleRoomCleaning(roomNumber: string, task: string) {
  const room = await db.records.where('type').equals('rooms')
    .filter((record) => String(record.roomNumber) === roomNumber).first()
  const openTask = await db.records.where('type').equals('housekeeping')
    .filter((record) => String(record.room) === roomNumber && ['Needs cleaning', 'In progress'].includes(String(record.status))).first()
  const now = new Date().toISOString()
  if (!openTask) {
    await db.records.add({
      id: crypto.randomUUID(),
      type: 'housekeeping',
      task,
      room: roomNumber,
      dueDate: now.slice(0, 10),
      status: 'Needs cleaning',
      createdAt: now,
      updatedAt: now,
    })
  }
  if (room && !['Maintenance', 'Blocked'].includes(String(room.status))) {
    await db.records.put({ ...room, status: 'Needs cleaning', updatedAt: now })
  }
}

export async function updateRecord(
  module: ModuleConfig,
  id: string,
  values: Record<string, string>,
): Promise<RecordItem> {
  validateFields(module.fields, values)
  const normalized = normalizeValues(module.fields, values)
  const updatedRecord = await db.transaction('rw', db.records, db.accounts, async () => {
    const existing = await db.records.get(id)
    if (!existing || existing.type !== module.key) throw new Error('This record no longer exists.')
    if (module.key === 'bookings') await validateBooking(normalized, id)
    const accommodationModule = module.key === 'students' || module.key === 'guests'
    const linkedBookingId = accommodationModule ? String(existing.bookingId ?? '') : ''
    const linkedBooking = linkedBookingId ? await db.records.get(linkedBookingId) : undefined
    const nextBooking = accommodationModule
      ? accommodationBooking(module, normalized, linkedBookingId || crypto.randomUUID(), new Date().toISOString())
      : null
    if (nextBooking) {
      await validateBooking(nextBooking, linkedBooking?.id, existing.id)
      await db.records.put({
        ...(linkedBooking ?? nextBooking),
        ...nextBooking,
        ...(linkedBooking ? { bookingReference: linkedBooking.bookingReference, createdAt: linkedBooking.createdAt } : {}),
      })
    } else if (linkedBooking && isActiveBooking(linkedBooking)) {
      await db.records.put({
        ...linkedBooking,
        status: module.key === 'guests' && normalized.status === 'Checked out' ? 'Completed' : 'Cancelled',
        updatedAt: new Date().toISOString(),
      })
    }
    if (module.key === 'rooms') {
      if (Number(normalized.occupied ?? 0) > Number(normalized.capacity ?? 0)) {
        throw new Error('Occupied beds cannot exceed the room capacity.')
      }
      const existingRoom = await db.records.where('type').equals('rooms').filter((room) =>
        room.id !== id && String(room.roomNumber).toLowerCase() === String(normalized.roomNumber).toLowerCase(),
      ).first()
      if (existingRoom) throw new Error('A room with that number already exists.')
    }
    if (module.key === 'payments') {
      const reference = String(normalized.reference ?? '').toLowerCase()
      const duplicatePayment = await db.records.where('type').equals('payments').filter((payment) =>
        payment.id !== id && String(payment.reference).toLowerCase() === reference,
      ).first()
      if (duplicatePayment) throw new Error('A payment already uses that reference.')
    }
    if (module.key === 'students' || module.key === 'guests') {
      const account = await db.accounts.where('recordId').equals(id).first()
      const email = String(normalized.email ?? '').toLowerCase()
      const existingAccount = await db.accounts.where('email').equals(email).first()
      if (existingAccount && existingAccount.id !== account?.id) throw new Error('An account already exists for that email.')
      if (account) await db.accounts.put({ ...account, email, name: String(normalized.fullName ?? account.name) })
    }
    if (module.key === 'staff') {
      const account = await db.accounts.where('recordId').equals(id).first()
      if (['receptionist', 'housekeeping'].includes(String(normalized.accessRole))) {
        const email = String(normalized.email ?? '').trim().toLowerCase()
        if (!email) throw new Error('A login email is required when portal access is enabled.')
        const existingAccount = await db.accounts.where('email').equals(email).first()
        if (existingAccount && existingAccount.id !== account?.id) throw new Error('An account already exists for that email.')
        await db.accounts.put({
          id: account?.id ?? crypto.randomUUID(),
          email,
          password: account?.password ?? 'Welcome@123',
          name: String(normalized.fullName ?? 'Staff member'),
          role: normalized.accessRole as Account['role'],
          active: normalized.status !== 'Inactive',
          recordId: id,
        })
      } else if (account) {
        await db.accounts.delete(account.id)
      }
    }
    if (module.key === 'bookings') {
      const wasCheckedIn = existing.status === 'Checked in'
      const willBeCheckedIn = normalized.status === 'Checked in'
      const roomChanged = String(existing.room) !== String(normalized.room)
      if (wasCheckedIn && (!willBeCheckedIn || roomChanged)) await adjustRoomOccupancy(String(existing.room), -1)
      if (willBeCheckedIn && (!wasCheckedIn || roomChanged)) await adjustRoomOccupancy(String(normalized.room), 1)
      if (wasCheckedIn && (!willBeCheckedIn || roomChanged)) {
        const roomNumber = String(existing.room)
        await scheduleRoomCleaning(roomNumber, `Room ${roomNumber} cleaning after checkout`)
      }
    }
    if (module.key === 'guests' || module.key === 'students') {
      const wasCheckedIn = module.key === 'guests'
        ? existing.status === 'Checked in'
        : existing.bookingStatus
          ? existing.bookingStatus === 'Checked in'
          : existing.status === 'Active'
      const willBeCheckedIn = module.key === 'guests'
        ? normalized.status === 'Checked in'
        : normalized.bookingStatus
          ? normalized.bookingStatus === 'Checked in'
          : !existing.bookingStatus && normalized.status === 'Active'
      const oldRoom = String(existing.room ?? '')
      const newRoom = String(normalized.room ?? '')
      if (wasCheckedIn && (!willBeCheckedIn || oldRoom !== newRoom)) {
        await adjustRoomOccupancy(oldRoom, -1)
        await scheduleRoomCleaning(oldRoom, `Room ${oldRoom} cleaning after ${module.key === 'guests' ? 'guest' : 'student'} checkout`)
      }
      if (willBeCheckedIn && (!wasCheckedIn || oldRoom !== newRoom)) {
        await adjustRoomOccupancy(newRoom, 1)
      }
    }
    if (module.key === 'housekeeping' && existing.status !== normalized.status && normalized.status === 'Completed') {
      const roomNumber = String(existing.room ?? '')
      const room = await db.records.where('type').equals('rooms')
        .filter((record) => String(record.roomNumber) === roomNumber).first()
      if (room && !['Maintenance', 'Blocked'].includes(String(room.status))) {
        await db.records.put({
          ...room,
          status: Number(room.occupied ?? 0) > 0 ? 'Occupied' : 'Available',
          updatedAt: new Date().toISOString(),
        })
      }
    } else if (module.key === 'housekeeping' && existing.status !== normalized.status && normalized.status === 'In progress') {
      const roomNumber = String(existing.room ?? '')
      const room = await db.records.where('type').equals('rooms')
        .filter((record) => String(record.roomNumber) === roomNumber).first()
      if (room && !['Maintenance', 'Blocked'].includes(String(room.status))) {
        await db.records.put({ ...room, status: 'Cleaning', updatedAt: new Date().toISOString() })
      }
    }
    const updated = {
      ...existing,
      ...normalized,
      ...(accommodationModule ? { bookingId: nextBooking?.id ?? linkedBookingId } : {}),
      updatedAt: new Date().toISOString(),
    }
    await db.records.put(updated)
    if (module.key === 'payments') {
      const invoice = await db.records.where('type').equals('invoices').filter((item) => item.reference === existing.reference).first()
      if (invoice) {
        await db.records.put({
          ...invoice,
          reference: normalized.reference ?? '',
          customer: normalized.payer ?? '',
          amount: normalized.amount ?? 0,
          date: normalized.date ?? '',
          status: normalized.status ?? 'Pending',
          updatedAt: new Date().toISOString(),
        })
      }
    }
    if (module.key === 'complaints' && existing.status !== normalized.status) {
      const timestamp = new Date().toISOString()
      await db.records.add({
        id: crypto.randomUUID(),
        type: 'notifications',
        title: `Complaint ${String(normalized.status).toLowerCase()}`,
        audience: existing.ownerEmail ? 'Resident update' : 'All residents',
        message: `Update on “${String(normalized.subject ?? 'your complaint')}”: status changed to ${String(normalized.status)}.`,
        date: timestamp.slice(0, 10),
        status: 'Published',
        ...(existing.ownerEmail ? { ownerEmail: existing.ownerEmail } : {}),
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    }
    return updated
  })
  notifyDataChanged()
  return updatedRecord
}

export async function deleteRecord(module: ModuleConfig, id: string) {
  await db.transaction('rw', db.records, db.accounts, async () => {
    const record = await db.records.get(id)
    if (!record || record.type !== module.key) throw new Error('This record no longer exists.')
    if (module.key === 'rooms') {
      const occupied = Number(record.occupied ?? 0) > 0
      const activeBooking = await db.records.where('type').equals('bookings').filter((booking) =>
        String(booking.room) === String(record.roomNumber) && isActiveBooking(booking),
      ).first()
      if (occupied || activeBooking) throw new Error('This room cannot be deleted while it has occupants or active bookings.')
      const activeCleaning = await db.records.where('type').equals('housekeeping').filter((task) =>
        String(task.room) === String(record.roomNumber) && ['Needs cleaning', 'In progress'].includes(String(task.status)),
      ).first()
      if (activeCleaning || ['Needs cleaning', 'Cleaning'].includes(String(record.status))) {
        throw new Error('Complete the room cleaning task before deleting this room.')
      }
    }
    if (module.key === 'bookings' && isActiveBooking(record)) {
      throw new Error('Cancel this booking before deleting it.')
    }
    if (module.key === 'payments') {
      const invoice = await db.records.where('type').equals('invoices').filter((item) => item.reference === record.reference).first()
      if (invoice) await db.records.delete(invoice.id)
    }
    if (module.key === 'students' || module.key === 'guests') {
      const booking = record.bookingId ? await db.records.get(String(record.bookingId)) : undefined
      if (booking && isActiveBooking(booking)) {
        await db.records.put({ ...booking, status: 'Cancelled', updatedAt: new Date().toISOString() })
      }
      const checkedIn = module.key === 'guests'
        ? record.status === 'Checked in'
        : record.bookingStatus
          ? record.bookingStatus === 'Checked in'
          : record.status === 'Active'
      if (checkedIn && record.room) {
        const roomNumber = String(record.room)
        await adjustRoomOccupancy(roomNumber, -1)
        await scheduleRoomCleaning(roomNumber, `Room ${roomNumber} cleaning after resident checkout`)
      }
    }
    if (module.key === 'students' || module.key === 'guests' || module.key === 'staff') {
      await db.accounts.where('recordId').equals(id).delete()
    }
    await db.records.delete(id)
  })
  notifyDataChanged()
}

export async function updateSetting(key: string, value: string) {
  await db.settings.put({ key, value })
}

export async function getSettings() {
  return db.settings.toArray()
}

export async function resetDemoData() {
  await seedDemoData(true)
  notifyDataChanged()
}

export async function exportBackup() {
  const [records, accounts, settings] = await Promise.all([
    db.records.toArray(),
    db.accounts.toArray(),
    db.settings.toArray(),
  ])
  return { version: 1, exportedAt: new Date().toISOString(), records, accounts, settings }
}

export async function importBackup(file: File) {
  const parsed: unknown = JSON.parse(await file.text())
  if (!parsed || typeof parsed !== 'object' || !('records' in parsed) || !('accounts' in parsed) || !('settings' in parsed)) {
    throw new Error('This file is not a valid Haven House backup.')
  }
  const backup = parsed as { records: RecordItem[]; accounts: Account[]; settings: { key: string; value: string }[] }
  if (!Array.isArray(backup.records) || !Array.isArray(backup.accounts) || !Array.isArray(backup.settings)) {
    throw new Error('The backup file contains invalid data.')
  }
  await db.transaction('rw', db.records, db.accounts, db.settings, async () => {
    await Promise.all([db.records.clear(), db.accounts.clear(), db.settings.clear()])
    await Promise.all([
      db.records.bulkAdd(backup.records),
      db.accounts.bulkAdd(backup.accounts),
      db.settings.bulkAdd(backup.settings),
    ])
  })
  notifyDataChanged()
}
