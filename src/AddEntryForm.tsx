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

// للاستعمال في "وقت النهاية"
const END_SLOTS = Array.from({ length: 36 }, (_, i) => {
  const endMinutes = 8 * 60 + (i + 1) * 15
  const fmt = (m: number) => {
    const h = Math.floor(m / 60).toString().padStart(2, '0')
    const min = (m % 60).toString().padStart(2, '0')
    return `${h}:${min}`
  }
  return { index: i + 1, label: fmt(endMinutes) }
})

type Props = {
  classId: number
  onSaved: () => void
  onCancel: () => void
  initialDay?: number
  initialStartSlot?: number
}

export function AddEntryForm({ classId, onSaved, onCancel, initialDay = 0, initialStartSlot = 1 }: Props) {
  const [subjects, setSubjects] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [teacherSubjects, setTeacherSubjects] = useState<{ teacher_id: string; subject_id: number }[]>([])
  const [blockedSlots, setBlockedSlots] = useState<Set<number>>(new Set())
  const [subjectId, setSubjectId] = useState<number | null>(null)
  const [teacherId, setTeacherId] = useState<string>('')
  const [day, setDay] = useState<number>(initialDay)
  const [startSlot, setStartSlot] = useState<number>(initialStartSlot)
  const [endSlot, setEndSlot] = useState<number>(3)
  const [room, setRoom] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)

    useEffect(() => {
    async function load() {
      const { data: s } = await supabase.from('subjects').select('*').order('id')
      const { data: t } = await supabase
        .from('teachers')
        .select('*')
        .eq('is_teacher', true)
        .order('last_name')
      const { data: ts } = await supabase
        .from('teacher_subjects')
        .select('teacher_id, subject_id')
      setSubjects(s || [])
      setTeachers(t || [])
      setTeacherSubjects(ts || [])
      if (t && t.length > 0) {
        setTeacherId(t[0].id)
        const firstTeacherSubjects = (ts || [])
          .filter(x => x.teacher_id === t[0].id)
          .map(x => x.subject_id)
        if (firstTeacherSubjects.length > 0) setSubjectId(firstTeacherSubjects[0])
      }
    }
        load()
  }, [])

    // جلب الحصص المسدودة (الأستاذ + القسم) في اليوم المختار
  useEffect(() => {
    async function loadBlocked() {
      if (!teacherId || !classId) return

      const blocked = new Set<number>()

      // حصص الأستاذ في هذا اليوم
      const { data: teacherEntries } = await supabase
        .from('timetable_entries')
        .select('start_slot, duration_slots')
        .eq('teacher_id', teacherId)
        .eq('day_of_week', day)

      // حصص القسم في هذا اليوم
      const { data: classEntries } = await supabase
        .from('timetable_entries')
        .select('start_slot, duration_slots')
        .eq('class_id', classId)
        .eq('day_of_week', day)

      // إضافة كل خانة من الحصص إلى المجموعة
      ;[...(teacherEntries || []), ...(classEntries || [])].forEach((e: any) => {
        for (let i = 0; i < e.duration_slots; i++) {
          blocked.add(e.start_slot + i)
        }
      })

      setBlockedSlots(blocked)
    }
    loadBlocked()
  }, [teacherId, classId, day])

  const availableSubjects = teacherId
    ? subjects.filter(s =>
        teacherSubjects.some(ts => ts.teacher_id === teacherId && ts.subject_id === s.id)
      )
    : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!subjectId || !teacherId) {
      setError('يرجى اختيار المادة والأستاذ')
      return
    }
    setSaving(true)
      const { error: insertError } = await supabase.from('timetable_entries').insert({
      teacher_id: teacherId,
      class_id: classId,
      subject_id: subjectId,
      day_of_week: day,
      start_slot: startSlot,
      duration_slots: endSlot - startSlot + 1,
      room: room || null
    })
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
    } else {
      onSaved()
    }
  }

  return (
    <div style={overlayStyle}>
      <form onSubmit={handleSubmit} style={modalStyle}>
        <h2 style={{ marginTop: 0 }}>إضافة حصة</h2>

                <label style={labelStyle}>
          المادة
          <select value={subjectId || ''} onChange={(e) => setSubjectId(Number(e.target.value))} style={inputStyle}>
            {availableSubjects.length > 0 ? (
              availableSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)
            ) : (
              <option value="">— لا توجد مواد مرتبطة بالأستاذ —</option>
            )}
          </select>
        </label>

                <label style={labelStyle}>
          الأستاذ
          <select
            value={teacherId}
                        onChange={(e) => {
              const newTeacherId = e.target.value
              setTeacherId(newTeacherId)
              const subjectsForNewTeacher = teacherSubjects
                .filter(ts => ts.teacher_id === newTeacherId)
                .map(ts => ts.subject_id)
              setSubjectId(subjectsForNewTeacher.length > 0 ? subjectsForNewTeacher[0] : null)
            }}
            style={inputStyle}
          >  {teachers.map((t) => (
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
            {TIME_SLOTS
              .filter((s) => !blockedSlots.has(s.index))
              .map((s) => (
                <option key={s.index} value={s.index}>{s.label}</option>
              ))}
          </select>
        </label>

                        <label style={labelStyle}>
          وقت النهاية
          <select value={endSlot} onChange={(e) => setEndSlot(Number(e.target.value))} style={inputStyle}>
            {END_SLOTS
              .filter((s) => s.index >= startSlot)
              .filter((s) => {
                // يجب ألا تكون أي خانة بين startSlot و s.index مسدودة
                for (let i = startSlot; i <= s.index; i++) {
                  if (blockedSlots.has(i)) return false
                }
                return true
              })
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

        <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
          <button type="submit" disabled={saving} style={primaryBtn}>
            {saving ? '...' : 'حفظ'}
          </button>
          <button type="button" onClick={onCancel} style={secondaryBtn}>
            إلغاء
          </button>
        </div>
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
  width: 420,
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
  borderRadius: 4
}
const errorStyle: React.CSSProperties = {
  background: '#ffe0e0',
  color: '#900',
  padding: 8,
  borderRadius: 4,
  fontSize: 13
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