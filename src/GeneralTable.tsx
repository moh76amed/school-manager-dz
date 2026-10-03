import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس']

const MORNING_RANGES: { [day: number]: [number, number] } = {
  0: [1, 16],
  1: [1, 16],
  2: [1, 16],
  3: [1, 16],
  4: [1, 16]
}

type Teacher = {
  id: string
  first_name: string
  last_name: string
}

type Entry = {
  id: number
  teacher_id: string
  day_of_week: number
  start_slot: number
  duration_slots: number
  classes: { name: string; levels: { name: string } | null } | null
  subjects: { code: string | null; color: string; name: string } | null
}

export function GeneralTable() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: t } = await supabase
        .from('teachers')
        .select('id, first_name, last_name')
        .eq('is_teacher', true)
        .order('last_name')
      const { data: e } = await supabase
        .from('timetable_entries')
        .select('id, teacher_id, day_of_week, start_slot, duration_slots, classes(name, levels(name)), subjects(code, color, name)')
      const { data: s } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single()
      const { data: c } = await supabase
        .from('classes')
        .select('male_count, female_count, student_count')
      setTeachers(t || [])
      setEntries((e as any) || [])
      setSettings(s)
      setClasses((c as any) || [])
      setLoading(false)
    }
    load()
  }, [])

  function getEntriesFor(teacherId: string, day: number) {
    return entries
      .filter(e => e.teacher_id === teacherId && e.day_of_week === day)
      .sort((a, b) => a.start_slot - b.start_slot)
  }

  function getClassCode(entry: Entry) {
    if (!entry.classes) return '?'
    const levelName = entry.classes.levels?.name || ''
    const levelMap: { [key: string]: string } = {
      'السنة التحضيرية': '0',
      'السنة الأولى': '1',
      'السنة الثانية': '2',
      'السنة الثالثة': '3',
      'السنة الرابعة': '4',
      'السنة الخامسة': '5'
    }
    const yearNum = levelMap[levelName] || '?'
    const classNum = entry.classes.name?.split(' ').pop() || '?'
    return `${yearNum}-${classNum}`
  }

  if (loading) return <p style={{ padding: 20 }}>جاري التحميل...</p>

  return (
    <div style={{ padding: 20, direction: 'rtl', fontFamily: 'Arial', background: '#f5f5f5' }}>
      {/* الرأس الرسمي */}
      <div style={{ background: 'white', padding: 15, marginBottom: 15, border: '1px solid #ddd' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 11, lineHeight: 1.6, flex: 1 }}>
            <div style={{ fontWeight: 'bold' }}>وزارة التربية الوطنية</div>
            <div>{settings?.direction || 'مديرية التربية لولاية ...'}</div>
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.6, flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>
              الجمهورية الجزائرية الديمقراطية الشعبية
            </div>
            <div>
              المدير: <strong>{settings?.director_name || '...'}</strong>
              {'  |  '}
              البلدية: <strong>{settings?.commune || '...'}</strong>
            </div>
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.6, flex: 1, textAlign: 'left' }}>
            <div style={{ fontWeight: 'bold' }}>{settings?.school_name || 'اسم المدرسة'}</div>
            <div>السنة الدراسية: {settings?.academic_year || '...'}</div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={statHeaderStyle}>الحجرات</th>
              <th style={statValueStyle}>{settings?.stone_rooms ?? 0} حجرية</th>
              <th style={statValueStyle}>{settings?.wooden_rooms ?? 0} خشبية</th>
              <th style={statValueStyle}>{settings?.other_rooms ?? 0} أخرى</th>
              <th style={statHeaderStyle}>المناصب</th>
              <th style={statValueStyle}>{settings?.teaching_positions ?? 0} تدريس</th>
              <th style={statValueStyle}>{settings?.other_positions ?? 0} أخرى</th>
              <th style={statValueStyle}>{settings?.vacant_positions ?? 0} شاغرة</th>
            </tr>
            <tr>
              <th style={statHeaderStyle}>التلاميذ</th>
              <th style={statValueStyle}>ذكور: {classes.reduce((s, c) => s + (c.male_count || 0), 0)}</th>
              <th style={statValueStyle}>إناث: {classes.reduce((s, c) => s + (c.female_count || 0), 0)}</th>
              <th style={statValueStyle}>المجموع: {classes.reduce((s, c) => s + (c.student_count || 0), 0)}</th>
              <th style={statHeaderStyle}>الأقسام</th>
              <th style={statValueStyle} colSpan={3}>{classes.length} قسم</th>
            </tr>
          </thead>
        </table>
      </div>

      <h1 style={{ textAlign: 'center', fontSize: 18 }}>الجدول العام لتوزيع الأساتذة</h1>

      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 20 }}>
        <thead>
          <tr>
            <th style={thStyle}>الأستاذ</th>
            {DAYS.map(d => (
              <th key={d} style={thStyle}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teachers.map(teacher => (
            <tr key={teacher.id}>
              <td style={teacherCellStyle}>
                {teacher.first_name} {teacher.last_name}
              </td>
              {DAYS.map((_, dayIdx) => {
                const dayEntries = getEntriesFor(teacher.id, dayIdx)
                const morningRange = MORNING_RANGES[dayIdx] || [1, 16]
                const morningEntries = dayEntries.filter(
                  e => e.start_slot >= morningRange[0] && e.start_slot <= morningRange[1]
                )
                const eveningEntries = dayEntries.filter(
                  e => e.start_slot > morningRange[1]
                )
                return (
                  <td key={dayIdx} style={cellStyle}>
                    {dayEntries.length === 0 ? (
                      <span style={{ color: '#ccc' }}>—</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={morningLabelStyle}>صباح</div>
                        {morningEntries.map(entry => (
                          <div key={entry.id} style={{ ...entryBoxStyle, background: entry.subjects?.color || '#ddd' }}>
                            {getClassCode(entry)} {entry.subjects?.code || ''}
                          </div>
                        ))}
                        <div style={eveningLabelStyle}>مساء</div>
                        {eveningEntries.map(entry => (
                          <div key={entry.id} style={{ ...entryBoxStyle, background: entry.subjects?.color || '#ddd' }}>
                            {getClassCode(entry)} {entry.subjects?.code || ''}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  border: '1px solid #999',
  padding: 8,
  background: '#333',
  color: 'white',
  textAlign: 'center',
  fontSize: 13
}

const teacherCellStyle: React.CSSProperties = {
  border: '1px solid #ccc',
  padding: '6px 10px',
  background: '#f0f0f0',
  fontWeight: 'bold',
  fontSize: 12,
  textAlign: 'right'
}

const cellStyle: React.CSSProperties = {
  border: '1px solid #ccc',
  padding: 4,
  textAlign: 'center',
  verticalAlign: 'top',
  minWidth: 100
}

const morningLabelStyle: React.CSSProperties = {
  background: '#fef3c7',
  padding: 2,
  borderRadius: 3,
  fontSize: 9,
  fontWeight: 'bold',
  color: '#92400e'
}

const eveningLabelStyle: React.CSSProperties = {
  background: '#dbeafe',
  padding: 2,
  borderRadius: 3,
  fontSize: 9,
  fontWeight: 'bold',
  color: '#1e40af',
  marginTop: 3
}

const entryBoxStyle: React.CSSProperties = {
  color: 'white',
  padding: '3px 5px',
  borderRadius: 3,
  fontSize: 11,
  fontWeight: 'bold',
  whiteSpace: 'nowrap'
}

const statHeaderStyle: React.CSSProperties = {
  border: '1px solid #999',
  padding: 4,
  background: '#1e293b',
  color: 'white',
  fontSize: 11,
  textAlign: 'center',
  width: 80
}

const statValueStyle: React.CSSProperties = {
  border: '1px solid #ccc',
  padding: 4,
  background: '#f9f9f9',
  fontSize: 11,
  textAlign: 'center',
  fontWeight: 'bold'
}