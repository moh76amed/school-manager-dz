import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس']

type Entry = {
  id: number
  day_of_week: number
  start_slot: number
  duration_slots: number
  room: string | null
  is_break: boolean | null
  subject_id: number
  subjects: { name: string; color: string } | null
  teachers: { first_name: string; last_name: string } | null
}

type ClassRow = {
  id: number
  name: string
  levels: { name: string } | null
}

// ✅ 38 خانة: من 08:00 إلى 17:30 (تضمن ظهور 16:45-17:00)
const TIME_SLOTS = Array.from({ length: 38 }, (_, i) => {
  const startMin = 8 * 60 + i * 15
  const endMin   = startMin + 15
  const fmt = (x: number) =>
    `${Math.floor(x / 60).toString().padStart(2, '0')}:${(x % 60).toString().padStart(2, '0')}`
  return {
    index: i + 1,
    label: `${fmt(startMin)}-${fmt(endMin)}`,
  }
})

export function PrintTimetableView() {
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [selectedClass, setSelectedClass] = useState<number | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, name, levels(name)')
        .order('id')
      const { data: settingsData } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single()
      setClasses((classesData as any) || [])
      setSettings(settingsData)
      if (classesData && classesData.length > 0) setSelectedClass(classesData[0].id)
      setLoading(false)
    }
    loadData()
  }, [])

  useEffect(() => {
    if (!selectedClass) return
    async function loadEntries() {
      const { data } = await supabase
        .from('timetable_entries')
        .select('id, day_of_week, start_slot, duration_slots, room, is_break, subject_id, subjects(name, color), teachers(first_name, last_name)')
        .eq('class_id', selectedClass)
      setEntries((data as any) || [])
    }
    loadEntries()
  }, [selectedClass])

  const getEntryAt = (day: number, slotIndex: number) =>
    entries.find(e => e.day_of_week === day && e.start_slot === slotIndex)

  const isCoveredByPrevious = (day: number, slotIndex: number) =>
    entries.some(e =>
      e.day_of_week === day &&
      e.start_slot < slotIndex &&
      e.start_slot + e.duration_slots > slotIndex
    )

  // ✅ أول خانة فيها حصة
  const firstUsedSlot = entries.length > 0
    ? Math.min(...entries.map(e => e.start_slot))
    : 1

  // ✅ آخر خانة تنتهي فيها حصة
  const lastUsedSlot = entries.length > 0
    ? Math.max(...entries.map(e => e.start_slot + e.duration_slots - 1))
    : 0

  // ✅ فقط الخانات المستخدمة — بدون فراغات في البداية أو النهاية
  const visibleSlots = TIME_SLOTS.filter(
    slot => slot.index >= firstUsedSlot && slot.index <= lastUsedSlot
  )

  const selectedClassObj = classes.find(c => c.id === selectedClass)
    // استخراج اسم أستاذ اللغة العربية للقسم المختار
  const arabicTeacherName = (() => {
    // البحث عن حصة اللغة العربية (subject code = ARB) في القسم
    const arbSubjectId = entries.find(e => e.subjects?.name === 'اللغة العربية')?.subject_id
    if (!arbSubjectId) return null
    const arbEntry = entries.find(e => e.subject_id === arbSubjectId)
    if (!arbEntry) return null
    return `${arbEntry.teachers?.first_name || ''} ${arbEntry.teachers?.last_name || ''}`.trim()
  })()
  const useHorizontalTime = visibleSlots.length < 8

  const dynamicFontSize =
    visibleSlots.length <= 6  ? 13 :
    visibleSlots.length <= 8  ? 12 :
    visibleSlots.length <= 10 ? 11 :
    visibleSlots.length <= 14 ? 10 :
    visibleSlots.length <= 18 ? 9  :
    visibleSlots.length <= 24 ? 8  : 7

  // ✅ ارتفاع رأس الجدول أكبر لاستيعاب الوقت بصيغة XX:XX-XX:XX
  const dynamicRowHeight    = dynamicFontSize + 20
  const dynamicHeaderHeight = dynamicFontSize + 70

  if (loading) return <p style={{ padding: 20 }}>جاري التحميل...</p>

  return (
    <div style={{ padding: 20, fontFamily: 'Arial', direction: 'rtl', background: '#f5f5f5' }}>
      {/* شريط التحكم (لا يُطبع) */}
      <div className="no-print" style={{ marginBottom: 20, display: 'flex', gap: 15, alignItems: 'center' }}>
        <label>
          <strong>القسم: </strong>
          <select
            value={selectedClass || ''}
            onChange={(e) => setSelectedClass(Number(e.target.value))}
            style={{ padding: 8, fontSize: 16 }}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.levels?.name ? `— ${c.levels.name}` : ''}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => window.print()}
          style={{
            padding: '10px 20px', background: '#007bff', color: 'white',
            border: 'none', borderRadius: 6, fontSize: 16,
            fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          🖨️ طباعة
        </button>
      </div>

      {/* منطقة الطباعة */}
      <div className="print-area" style={pageStyle}>
        {/* الرأس */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15, fontSize: 11, lineHeight: 1.7 }}>
          {/* يمين */}
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div>{settings?.direction || 'مديرية التربية لولاية ...'}</div>
            <div>{settings?.inspectorate || 'المفتشية'}</div>
          </div>

          {/* وسط */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontWeight: 'bold', fontSize: 12 }}>
              الجمهورية الجزائرية الديمقراطية الشعبية
            </div>
            <div>وزارة التربية الوطنية</div>
          </div>

          {/* يسار */}
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div>السنة الدراسية: <strong>{settings?.academic_year || '...'}</strong></div>
            <div style={{ fontWeight: 'bold' }}>{settings?.school_name || 'اسم المدرسة'}</div>
          </div>
        </div>

        {/* العنوان */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 'bold', textDecoration: 'underline' }}>
            التوقيت الأسبوعي لـ: {selectedClassObj?.levels?.name || ''} {selectedClassObj?.name?.split(' ').pop() || '...'}
          </div>
        </div>

        {/* الجدول */}
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={cornerCellStyle}></th>
              {visibleSlots.map((slot) => (
                <th
                  key={slot.index}
                  style={{
                    border: '1px solid #000',
                    background: '#f0f0f0',
                    height: dynamicHeaderHeight,
                    padding: 0,
                    position: 'relative',
                    overflow: 'hidden',
                    fontSize: dynamicFontSize,
                    fontWeight: 'bold',
                    verticalAlign: 'middle',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {useHorizontalTime ? (
                    slot.label
                  ) : (
                    <span style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%) rotate(-90deg)',
                      transformOrigin: 'center',
                      whiteSpace: 'nowrap',
                      fontSize: dynamicFontSize,
                      fontWeight: 'bold',
                      display: 'inline-block',
                    }}>
                      {slot.label}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((dayName, dayIdx) => (
              <tr key={dayIdx}>
                {/* ✅ خط أكبر لأسماء الأيام */}
                <td style={{ ...dayCellStyle, fontSize: dynamicFontSize + 3 }}>{dayName}</td>
                {visibleSlots.map((slot) => {
                  if (isCoveredByPrevious(dayIdx, slot.index)) return null
                  const entry = getEntryAt(dayIdx, slot.index)
                  if (entry) {
                    const remainingCols = visibleSlots.filter(s => s.index >= slot.index).length
                    const colSpan = Math.min(entry.duration_slots, remainingCols)
                    return (
                      <td
                        key={slot.index}
                        colSpan={colSpan}
                        style={{
                          border: '1px solid #000',
                          padding: '2px 3px',
                          // ✅ خط أكبر لأسماء المواد
                          fontSize: dynamicFontSize + 2,
                          textAlign: 'center',
                          background: '#f9f9f9',
                          verticalAlign: 'middle',
                          fontWeight: 'bold',
                          height: dynamicRowHeight,
                        }}
                      >
                        {entry.is_break ? 'غداء' : entry.subjects?.name || ''}
                      </td>
                    )
                  }
                  return (
                    <td
                      key={slot.index}
                      style={{ border: '1px solid #000', height: dynamicRowHeight }}
                    />
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* التذييل */}
            <div style={{ marginTop: 15, fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
          <div>
            الأستاذ(ة): {arabicTeacherName || '...'}
          </div>
          <div>
            مدير المؤسسة: {settings?.director_name || '...'}
          </div>
        </div>

      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  background: 'white',
  padding: '15mm 10mm',
  maxWidth: 1100,
  margin: '0 auto',
  border: '1px solid #ddd',
  boxSizing: 'border-box',
}
const tableStyle: React.CSSProperties = {
  borderCollapse: 'collapse',
  width: '100%',
  tableLayout: 'fixed',
  fontSize: 10,
}
const cornerCellStyle: React.CSSProperties = {
  border: '1px solid #000',
  width: 55,
  background: '#f0f0f0',
}
const dayCellStyle: React.CSSProperties = {
  border: '1px solid #000',
  padding: '2px 4px',
  fontSize: 11,
  fontWeight: 'bold',
  textAlign: 'center',
  background: '#f0f0f0',
  width: 55,
}