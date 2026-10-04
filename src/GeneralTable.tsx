import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس']

// تعريف الفترات لكل يوم
// day_of_week: 0=الأحد, 1=الاثنين, 2=الثلاثاء, 3=الأربعاء, 4=الخميس
type Period = {
  label: string       // "صباح 1" مثلاً
  startSlot: number
  endSlot: number
}

const PERIODS_BY_DAY: { [day: number]: Period[] } = {
  0: [  // الأحد
    { label: 'صباح 1', startSlot: 1,  endSlot: 10 },
    { label: 'صباح 2', startSlot: 11, endSlot: 20 },
    { label: 'مساء 1', startSlot: 21, endSlot: 28 },
    { label: 'مساء 2', startSlot: 29, endSlot: 36 }
  ],
  1: [  // الاثنين
    { label: 'صباح 1', startSlot: 1,  endSlot: 10 },
    { label: 'صباح 2', startSlot: 11, endSlot: 20 },
    { label: 'مساء 1', startSlot: 21, endSlot: 28 },
    { label: 'مساء 2', startSlot: 29, endSlot: 36 }
  ],
  2: [  // الثلاثاء
    { label: 'صباح',   startSlot: 1,  endSlot: 18 },
    { label: 'مساء',   startSlot: 19, endSlot: 36 }
  ],
  3: [  // الأربعاء
    { label: 'صباح 1', startSlot: 1,  endSlot: 10 },
    { label: 'صباح 2', startSlot: 11, endSlot: 20 },
    { label: 'مساء 1', startSlot: 21, endSlot: 28 },
    { label: 'مساء 2', startSlot: 29, endSlot: 36 }
  ],
  4: [  // الخميس
    { label: 'صباح 1', startSlot: 1,  endSlot: 10 },
    { label: 'صباح 2', startSlot: 11, endSlot: 20 },
    { label: 'مساء 1', startSlot: 21, endSlot: 28 },
    { label: 'مساء 2', startSlot: 29, endSlot: 36 }
  ]
}

// ترميز المادة بالعربية
function getSubjectCode(code: string | null, name: string | null): string {
  const map: { [key: string]: string } = {
    ARB: 'عر', FR: 'فر', EN: 'إن', MATH: 'ري',
    ISL: 'تإ', CIV: 'تم', HG: 'تج', SVT: 'عل',
    ART: 'تف', SPO: 'تب', QUR: 'قر', SOR: 'سر',
    DES: 'رس', MEM: 'مح'
  }
  if (code && map[code]) return map[code]
  return (name || '').substring(0, 2)
}

// تحويل رقم الخانة إلى وقت
function slotToTime(slot: number): string {
  const totalMin = 8 * 60 + (slot - 1) * 15
  const h = Math.floor(totalMin / 60).toString().padStart(2, '0')
  const m = (totalMin % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

type ClassRow = {
  id: number
  name: string
  level_id: number
  levels: { name: string; order_index: number } | null
}

type Entry = {
  id: number
  class_id: number
  day_of_week: number
  start_slot: number
  duration_slots: number
  teacher_id: string
  teachers: { first_name: string; last_name: string } | null
  subjects: { code: string | null; name: string } | null
}

export function GeneralTable() {
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [allClassesData, setAllClassesData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: c } = await supabase
        .from('classes')
        .select('id, name, level_id, levels(name, order_index)')
      const { data: e } = await supabase
        .from('timetable_entries')
        .select('id, class_id, day_of_week, start_slot, duration_slots, teacher_id, teachers(first_name, last_name), subjects(code, name)')
      const { data: s } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single()
      const { data: cStats } = await supabase
        .from('classes')
        .select('male_count, female_count, student_count')

      // ترتيب الأقسام حسب السنة ثم الاسم
      const sortedClasses = (c || []).sort((a: any, b: any) => {
        const orderA = a.levels?.order_index ?? 999
        const orderB = b.levels?.order_index ?? 999
        if (orderA !== orderB) return orderA - orderB
        return (a.name || '').localeCompare(b.name || '', 'ar')
      })

      setClasses(sortedClasses as any)
      setEntries((e as any) || [])
      setSettings(s)
      setAllClassesData(cStats || [])
      setLoading(false)
    }
    load()
  }, [])

  // جلب حصص قسم معيّن في يوم معيّن في فترة معيّنة
  function getEntriesInPeriod(classId: number, day: number, period: Period) {
    return entries
      .filter(e =>
        e.class_id === classId &&
        e.day_of_week === day &&
        e.start_slot >= period.startSlot &&
        e.start_slot <= period.endSlot
      )
      .sort((a, b) => a.start_slot - b.start_slot)
  }

  if (loading) return <p style={{ padding: 20 }}>جاري التحميل...</p>

  return (
    <div style={{ padding: 20, direction: 'rtl', fontFamily: 'Arial', background: '#f5f5f5' }}>
      <div className="print-area" style={{ background: 'white', padding: 15, border: '1px solid #ddd' }}>
                {/* الرأس الرسمي */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 11, lineHeight: 1.7 }}>
          {/* يمين */}
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div>{settings?.direction || 'مديرية التربية لولاية ...'}</div>
            <div>{settings?.inspectorate || 'المفتشية'}</div>
            <div style={{ fontWeight: 'bold' }}>{settings?.school_name || 'اسم المدرسة'}</div>
          </div>

          {/* وسط */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontWeight: 'bold', fontSize: 12 }}>
              الجمهورية الجزائرية الديمقراطية الشعبية
            </div>
            <div>وزارة التربية الوطنية</div>
            <div>&nbsp;</div>
          </div>

          {/* يسار */}
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div>السنة الدراسية: <strong>{settings?.academic_year || '...'}</strong></div>
            <div>
              الدائرة: <strong>{settings?.daira || '...'}</strong>
              {' | '}
              البلدية: <strong>{settings?.commune || '...'}</strong>
            </div>
            <div>المدير: <strong>{settings?.director_name || '...'}</strong></div>
          </div>
        </div>

        {/* الإحصائيات */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 10 }}>
          <thead>
            <tr>
              <th style={statHeaderStyle}>الحجرات</th>
              <th style={statValueStyle}>{settings?.used_rooms ?? 0} مستعملة</th>
              <th style={statValueStyle}>{settings?.empty_rooms ?? 0} فارغة</th>
              <th style={statHeaderStyle}>المناصب</th>
              <th style={statValueStyle}>{settings?.teaching_positions ?? 0} تدريس</th>
              <th style={statValueStyle}>{settings?.other_positions ?? 0} أخرى</th>
              <th style={statValueStyle}>{settings?.vacant_positions ?? 0} شاغرة</th>
            </tr>
            <tr>
              <th style={statHeaderStyle}>التلاميذ</th>
              <th style={statValueStyle}>ذكور: {allClassesData.reduce((s, c) => s + (c.male_count || 0), 0)}</th>
              <th style={statValueStyle}>إناث: {allClassesData.reduce((s, c) => s + (c.female_count || 0), 0)}</th>
              <th style={statHeaderStyle}>الأقسام</th>
              <th style={statValueStyle} colSpan={3}>{allClassesData.length} قسم</th>
            </tr>
          </thead>
        </table>

        <h2 style={{ textAlign: 'center', fontSize: 16, margin: '15px 0' }}>
          الجدول العام لتوزيع الأساتذة
        </h2>

        {/* الجدول الرئيسي */}
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 9 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, minWidth: 70 }}>اليوم</th>
              <th style={{ ...thStyle, minWidth: 50 }}>الفترة</th>
              {classes.map(c => (
                <th key={c.id} style={thStyle}>{c.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((dayName, dayIdx) => {
              const periods = PERIODS_BY_DAY[dayIdx] || []
              return periods.map((period, pIdx) => (
                <tr key={`${dayIdx}-${pIdx}`}>
                  {pIdx === 0 && (
                    <td
                      rowSpan={periods.length}
                      style={{ ...dayCellStyle, fontWeight: 'bold' }}
                    >
                      {dayName}
                    </td>
                  )}
                  <td style={periodCellStyle}>{period.label}</td>
                  {classes.map(c => {
                    const cellEntries = getEntriesInPeriod(c.id, dayIdx, period)
                    return (
                      <td key={c.id} style={cellStyle}>
                        {cellEntries.length === 0 ? (
                          <span style={{ color: '#ccc' }}>—</span>
                        ) : (
                          cellEntries.map(entry => (
                            <div key={entry.id} style={entryBoxStyle}>
                                                            <div style={{ fontWeight: 'bold', fontSize: 9 }}>
                                <span style={{ direction: 'ltr', display: 'inline-block' }}>
                                  {slotToTime(entry.start_slot + entry.duration_slots)}-{slotToTime(entry.start_slot)}
                                </span>
                                {' '}
                                <span style={{ color: '#1e40af' }}>
                                  {getSubjectCode(entry.subjects?.code || null, entry.subjects?.name || null)}
                                </span>
                              </div>
                              <div style={{ fontSize: 8, color: '#555' }}>
                                {entry.teachers?.first_name} {entry.teachers?.last_name}
                              </div>
                            </div>
                          ))
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// الأنماط
const thStyle: React.CSSProperties = {
  border: '1px solid #000',
  padding: 3,
  background: '#1e293b',
  color: 'white',
  fontSize: 10,
  textAlign: 'center'
}

const dayCellStyle: React.CSSProperties = {
  border: '1px solid #000',
  padding: 3,
  background: '#f0f0f0',
  textAlign: 'center',
  verticalAlign: 'middle',
  fontSize: 10
}

const periodCellStyle: React.CSSProperties = {
  border: '1px solid #000',
  padding: 2,
  background: '#f9f9f9',
  textAlign: 'center',
  fontSize: 9,
  fontWeight: 'bold',
  whiteSpace: 'nowrap'
}

const cellStyle: React.CSSProperties = {
  border: '1px solid #000',
  padding: 2,
  textAlign: 'center',
  verticalAlign: 'middle',
  minWidth: 80
}

const entryBoxStyle: React.CSSProperties = {
  borderBottom: '1px dashed #ccc',
  padding: '1px 0'
}

const statHeaderStyle: React.CSSProperties = {
  border: '1px solid #999',
  padding: 3,
  background: '#1e293b',
  color: 'white',
  fontSize: 10,
  textAlign: 'center',
  width: 70
}

const statValueStyle: React.CSSProperties = {
  border: '1px solid #ccc',
  padding: 3,
  background: '#f9f9f9',
  fontSize: 10,
  textAlign: 'center',
  fontWeight: 'bold'
}