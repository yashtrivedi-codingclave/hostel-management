import { db, type Account, type ModuleKey, type RecordItem, type RecordValue, seedDemoData } from './database'
import type { FieldConfig, ModuleConfig } from './modules'

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

async function validateBooking(values: Record<string, RecordValue>, exceptId?: string) {
  const room = String(values.room ?? '')
  const bed = String(values.bed ?? '')
  const checkIn = String(values.checkIn ?? '')
  const checkOut = String(values.checkOut ?? '')
  if (checkIn && checkOut && checkOut <= checkIn) throw new Error('Check-out must be after check-in.')
  if (!room || !bed || !checkIn || !checkOut || ['Cancelled', 'Completed'].includes(String(values.status))) return
  const roomRecord = await db.records.where('type').equals('rooms').filter((item) => String(item.roomNumber) === room).first()
  if (!roomRecord) throw new Error('Choose a room that exists in the room register.')
  if (['Maintenance', 'Blocked'].includes(String(roomRecord.status))) throw new Error('This room is not available for bookings.')
  const bedNumber = Number(bed.replace(/^B/i, ''))
  if (!Number.isInteger(bedNumber) || bedNumber < 1 || bedNumber > Number(roomRecord.capacity ?? 0)) {
    throw new Error('Choose a bed within this room’s capacity, for example B1.')
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
  validateFields(module.fields, values)
  const normalized = normalizeValues(module.fields, values)
  const now = new Date().toISOString()
  const item: RecordItem = {
    ...normalized,
    id: crypto.randomUUID(),
    type: module.key,
    createdAt: now,
    updatedAt: now,
    ...(ownerEmail ? { ownerEmail } : {}),
  }

  await db.transaction('rw', db.records, db.accounts, async () => {
    if (module.key === 'bookings') await validateBooking(normalized)
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
    await db.records.add(item)
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
  })
  return item
}

async function adjustRoomOccupancy(roomNumber: string, delta: number) {
  const room = await db.records.where('type').equals('rooms').filter((item) => String(item.roomNumber) === roomNumber).first()
  if (!room) return
  const capacity = Number(room.capacity ?? 0)
  const occupied = Math.min(capacity, Math.max(0, Number(room.occupied ?? 0) + delta))
  const status = occupied > 0 ? 'Occupied' : room.status === 'Maintenance' || room.status === 'Blocked' ? room.status : 'Available'
  await db.records.put({ ...room, occupied, status, updatedAt: new Date().toISOString() })
}

export async function updateRecord(
  module: ModuleConfig,
  id: string,
  values: Record<string, string>,
): Promise<RecordItem> {
  validateFields(module.fields, values)
  const normalized = normalizeValues(module.fields, values)
  return db.transaction('rw', db.records, db.accounts, async () => {
    const existing = await db.records.get(id)
    if (!existing || existing.type !== module.key) throw new Error('This record no longer exists.')
    if (module.key === 'bookings') await validateBooking(normalized, id)
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
    if (module.key === 'bookings') {
      const wasCheckedIn = existing.status === 'Checked in'
      const willBeCheckedIn = normalized.status === 'Checked in'
      const roomChanged = String(existing.room) !== String(normalized.room)
      if (wasCheckedIn && (!willBeCheckedIn || roomChanged)) await adjustRoomOccupancy(String(existing.room), -1)
      if (willBeCheckedIn && (!wasCheckedIn || roomChanged)) await adjustRoomOccupancy(String(normalized.room), 1)
    }
    const updated = { ...existing, ...normalized, updatedAt: new Date().toISOString() }
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
    }
    if (module.key === 'bookings' && isActiveBooking(record)) {
      throw new Error('Cancel this booking before deleting it.')
    }
    if (module.key === 'payments') {
      const invoice = await db.records.where('type').equals('invoices').filter((item) => item.reference === record.reference).first()
      if (invoice) await db.records.delete(invoice.id)
    }
    if (module.key === 'students' || module.key === 'guests') {
      await db.accounts.where('recordId').equals(id).delete()
    }
    await db.records.delete(id)
  })
}

export async function updateSetting(key: string, value: string) {
  await db.settings.put({ key, value })
}

export async function getSettings() {
  return db.settings.toArray()
}

export async function resetDemoData() {
  await seedDemoData(true)
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
}
