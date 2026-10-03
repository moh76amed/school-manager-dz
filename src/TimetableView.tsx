import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { AddEntryForm } from './AddEntryForm'
import { EditEntryForm } from './EditEntryForm'

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس']

const TIME_SLOTS = Array.from({ length: 36 }, (_, i) => {
  const startMinutes = 8 * 60 + i * 15
  const endMinutes = startMinutes + 15
  const fmt = (m: number) => {
    const h = Math.floor(m / 60).toString().padStart(2, '0')
    const min = (m % 60).toString().padStart(2, '0')
    return `${h}:${min}`
  }
  return { index: i + 1, start: fmt(startMinutes), end: fmt(endMinutes) }
})

type Entry = {
  id: number
  teacher_id: string
  class_id: number
  day_of_week: number
  start_slot: number
  duration_slots: number
  room: string | null
  subject_id: number
  subjects: { name: string; color: string } | null
  teachers: { first_name: string; last_name: string } | null
}

export function TimetableView() {
  const [classes, setClasses] = useState<any[]>([])
  const [selectedClass, setSelectedClass] = useState<number | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formDay, setFormDay] = useState<number>(0)
  const [formStartSlot, setFormStartSlot] = useState<number>(1)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)

  useEffect(() => {
    async function loadClasses() {
      const { data } = await supabase
        .from('classes')
        .select('id, name, level_id, levels(name, order_index)')
      // الترتيب حسب order_index للسنة، ثم حسب اسم القسم
      const sorted = (data || []).sort((a: any, b: any) => {
        const orderA = a.levels?.order_index ?? 999
        const orderB = b.levels?.order_index ?? 999
        if (orderA !== orderB) return orderA - orderB
        return (a.name || '').localeCompare(b.name || '', 'ar')
      })
      setClasses(sorted)
      if (sorted.length > 0) setSelectedClass(sorted[0].id)
    }
    loadClasses()
  }, [])

  async function loadEntries() {
    if (!selectedClass) return
    setLoading(true)
    const { data } = await supabase
      .from('timetable_entries')
      .select('id, teacher_id, class_id, day_of_week, start_slot, duration_slots, room, subject_id, subjects(name, color), teachers(first_name, last_name)')
      .eq('class_id', selectedClass)
    setEntries((data as any) || [])
    setLoading(false)
  }

  useEffect(() => {
    loadEntries()
  }, [selectedClass])

  const getEntryAt = (day: number, slotIndex: number) => {
    return entries.find(e => e.day_of_week === day && e.start_slot === slotIndex)
  }

  const isCoveredByPrevious = (day: number, slotIndex: number) => {
    return entries.some(e =>
      e.day_of_week === day &&
      e.start_slot < slotIndex &&
      e.start_slot + e.duration_slots > slotIndex
    )
  }

  const handleCellClick = (day: number, slotIndex: number) => {
    setFormDay(day)
    setFormStartSlot(slotIndex)
    setShowForm(true)
  }

  const handleEntryClick = (entry: Entry) => {
    setEditingEntry(entry)
  }

  function openAddEmpty() {
    setFormDay(0)
    setFormStartSlot(1)
    setShowForm(true)
  }
  return (
    <div style={{ padding: 20, fontFamily: 'Arial', direction: 'rtl' }}>
      <h1>جدول التوقيت</h1>

      <div style={{ display: 'flex', gap: 15, alignItems: 'center', marginBottom: 20 }}>
        <label>
          <strong>القسم: </strong>
          <select
            value={selectedClass || ''}
            onChange={(e) => setSelectedClass(Number(e.target.value))}
            style={{ padding: 6, fontSize: 16 }}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.levels?.name ? `— ${c.levels.name}` : ''}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={openAddEmpty}
          disabled={!selectedClass}
          style={{
            padding: '8px 16px',
            fontSize: 15,
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          + إضافة حصة
        </button>
      </div>

      {loading && <p>جاري التحميل...</p>}

      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 10 }}>
        <thead>
          <tr>
            <th style={thStyle}>الوقت</th>
            {DAYS.map((d) => (
              <th key={d} style={thStyle}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIME_SLOTS.map((slot) => (
            <tr key={slot.index}>
              <td style={timeCellStyle}>
                {slot.start} - {slot.end}
              </td>
              {DAYS.map((_, dayIdx) => {
                if (isCoveredByPrevious(dayIdx, slot.index)) return null

                const entry = getEntryAt(dayIdx, slot.index)
                if (entry) {
                  return (
                    <td
                      key={dayIdx}
                      rowSpan={entry.duration_slots}
                      style={{
                        ...cellStyle,
                        background: entry.subjects?.color || '#ddd',
                        color: 'white',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleEntryClick(entry)}
                      title="اضغط لتعديل أو حذف الحصة"
                    >
                      <div>{entry.subjects?.name}</div>
                      <div style={{ fontSize: 11, opacity: 0.9 }}>
                        {entry.teachers?.first_name} {entry.teachers?.last_name}
                      </div>
                    </td>
                  )
                }
                return (
                  <td
                    key={dayIdx}
                    style={{ ...cellStyle, cursor: 'pointer' }}
                    onClick={() => handleCellClick(dayIdx, slot.index)}
                    title="اضغط لإضافة حصة"
                  ></td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {showForm && selectedClass && (
        <AddEntryForm
          classId={selectedClass}
          initialDay={formDay}
          initialStartSlot={formStartSlot}
          onSaved={() => {
            setShowForm(false)
            loadEntries()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingEntry && (
        <EditEntryForm
          entry={editingEntry}
          onSaved={() => {
            setEditingEntry(null)
            loadEntries()
          }}
          onDeleted={() => {
            setEditingEntry(null)
            loadEntries()
          }}
          onCancel={() => setEditingEntry(null)}
        />
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  border: '1px solid #999',
  padding: 8,
  background: '#333',
  color: 'white'
}
const cellStyle: React.CSSProperties = {
  border: '1px solid #ccc',
  padding: 4,
  textAlign: 'center',
  height: 22,
  fontSize: 13
}
const timeCellStyle: React.CSSProperties = {
  ...cellStyle,
  background: '#f0f0f0',
  fontSize: 11,
  whiteSpace: 'nowrap'
}