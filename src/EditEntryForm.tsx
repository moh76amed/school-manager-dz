import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس']

const TIME_SLOTS = Array.from({ length: 36 }, (_, i) => {
  const startMinutes = 8 * 60 + i * 15
  const fmt = (m: number) => {
    const h = Math.floor(m / 60).toString().padStart(2, '0')
    const min = (m % 60).toString().padStart(2, '0')
    return `${h}:${min}`
  }
  return { index: i + 1, label: fmt(startMinutes) }
})

const END_SLOTS = Array.from({ length: 36 }, (_, i) => {
  const endMinutes = 8 * 60 + (i + 1) * 15
  const fmt = (m: number) => {
    const h = Math.floor(m / 60).toString().padStart(2, '0')
    const min = (m % 60).toString().padStart(2, '0')
    return `${h}:${min}`
  }
  return { index: i + 1, label: fmt(endMinutes) }
})

type ExistingEntry = {
  id: number
  teacher_id: string
  class_id: number
  subject_id: number
  day_of_week: number
  start_slot: number
  duration_slots: number
  room: string | null
}

type Props = {
  entry: ExistingEntry
  onSaved: () => void
  onCancel: () => void
  onDeleted: () => void
}

export function EditEntryForm({ entry, onSaved, onCancel, onDeleted }: Props) {
  const [subjects, setSubjects] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [subjectId, setSubjectId] = useState<number>(entry.subject_id)
  const [teacherId, setTeacherId] = useState<string>(entry.teacher_id)
  const [day, setDay] = useState<number>(entry.day_of_week)
  const [startSlot, setStartSlot] = useState<number>(entry.start_slot)
  const [endSlot, setEndSlot] = useState<number>(entry.start_slot + entry.duration_slots - 1)
  const [room, setRoom] = useState<string>(entry.room || '')
  const [error, setError] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false)

  useEffect(() => {
    async function load() {
      const { data: s } = await supabase.from('subjects').select('*').order('id')
      const { data: t } = await supabase
        .from('teachers')
        .select('*')
        .eq('is_teacher', true)
        .order('last_name')
      setSubjects(s || [])
      setTeachers(t || [])
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!subjectId || !teacherId) {
      setError('يرجى اختيار المادة والأستاذ')
      return
    }
    if (endSlot < startSlot) {
      setError('وقت النهاية يجب أن يكون بعد وقت البداية')
      return
    }
    setSaving(true)
    const { error: updateError } = await supabase
      .from('timetable_entries')
      .update({
        teacher_id: teacherId,
        subject_id: subjectId,
        day_of_week: day,
        start_slot: startSlot,
        duration_slots: endSlot - startSlot + 1,
        room: room || null
      })
      .eq('id', entry.id)
    setSaving(false)
    if (updateError) {
      setError(updateError.message)
    } else {
      onSaved()
    }
  }

  async function handleDelete() {
    setSaving(true)
    const { error: deleteError } = await supabase
      .from('timetable_entries')
      .delete()
      .eq('id', entry.id)
    setSaving(false)
    if (deleteError) {
      setError(deleteError.message)
      setConfirmDelete(false)
    } else {
      onDeleted()
    }
  }

  return (
    <div style={overlayStyle}>
      <form onSubmit={handleSubmit} style={modalStyle}>
        <h2 style={{ marginTop: 0 }}>تعديل حصة</h2>

        <label style={labelStyle}>
          المادة
          <select value={subjectId} onChange={(e) => setSubjectId(Number(e.target.value))} style={inputStyle}>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>

        <label style={labelStyle}>
          الأستاذ
          <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} style={inputStyle}>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          اليوم
          <select value={day} onChange={(e) => setDay(Number(e.target.value))} style={inputStyle}>
            {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </label>

        <label style={labelStyle}>
          وقت البداية
          <select value={startSlot} onChange={(e) => setStartSlot(Number(e.target.value))} style={inputStyle}>
            {TIME_SLOTS.map((s) => (
              <option key={s.index} value={s.index}>{s.label}</option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          وقت النهاية
          <select value={endSlot} onChange={(e) => setEndSlot(Number(e.target.value))} style={inputStyle}>
            {END_SLOTS
              .filter((s) => s.index >= startSlot)
              .map((s) => (
                <option key={s.index} value={s.index}>{s.label}</option>
              ))}
          </select>
        </label>

        <label style={labelStyle}>
          القاعة (اختياري)
          <input
            type="text"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            style={inputStyle}
          />
        </label>

        {error && <div style={errorStyle}>{error}</div>}

        {confirmDelete ? (
          <div style={confirmBoxStyle}>
            <div style={{ marginBottom: 10, fontWeight: 'bold', color: '#991b1b' }}>
              هل أنت متأكد من حذف هذه الحصة؟
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={handleDelete} disabled={saving} style={deleteBtn}>
                {saving ? '...' : 'نعم، احذف'}
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} style={secondaryBtn}>
                إلغاء
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, marginTop: 15, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={saving} style={primaryBtn}>
                {saving ? '...' : 'حفظ التعديلات'}
              </button>
              <button type="button" onClick={onCancel} style={secondaryBtn}>
                إلغاء
              </button>
            </div>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              style={{ ...deleteBtn, background: 'transparent', color: '#dc3545', border: '1px solid #dc3545' }}
            >
              حذف الحصة
            </button>
          </div>
        )}
      </form>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
}
const modalStyle: React.CSSProperties = {
  background: 'white',
  padding: 25,
  borderRadius: 8,
  width: 440,
  maxWidth: '90%',
  direction: 'rtl',
  fontFamily: 'Arial'
}
const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 12,
  fontWeight: 'bold',
  fontSize: 14
}
const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: 8,
  marginTop: 4,
  fontSize: 15,
  border: '1px solid #ccc',
  borderRadius: 4,
  boxSizing: 'border-box'
}
const errorStyle: React.CSSProperties = {
  background: '#ffe0e0',
  color: '#900',
  padding: 8,
  borderRadius: 4,
  fontSize: 13,
  marginTop: 8
}
const confirmBoxStyle: React.CSSProperties = {
  background: '#fee2e2',
  padding: 12,
  borderRadius: 6,
  marginTop: 15
}
const primaryBtn: React.CSSProperties = {
  background: '#007bff',
  color: 'white',
  border: 'none',
  padding: '10px 20px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 15,
  fontWeight: 'bold'
}
const secondaryBtn: React.CSSProperties = {
  background: '#ddd',
  color: '#333',
  border: 'none',
  padding: '10px 20px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 15
}
const deleteBtn: React.CSSProperties = {
  background: '#dc3545',
  color: 'white',
  border: 'none',
  padding: '10px 20px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 15,
  fontWeight: 'bold'
}