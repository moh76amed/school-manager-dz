import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { ConfirmDialog } from './ConfirmDialog'

type Level = {
  id: number
  name: string
  code: string | null
}

type ClassRow = {
  id: number
  name: string
  level_id: number
  student_count: number | null
  male_count: number | null
  female_count: number | null
  levels: { name: string } | null
}

export function ClassesManager() {
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [levels, setLevels] = useState<Level[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ClassRow | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  // حالة نافذة التأكيد
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogTitle, setDialogTitle] = useState('')
  const [dialogMessage, setDialogMessage] = useState<React.ReactNode>('')
  const [dialogVariant, setDialogVariant] = useState<'confirm' | 'info' | 'danger'>('confirm')
  const [dialogOnConfirm, setDialogOnConfirm] = useState<(() => void) | null>(null)

    async function loadData() {
    setLoading(true)
      const { data: classesData, error: err1 } = await supabase
      .from('classes')
      .select('id, name, level_id, student_count, male_count, female_count, levels(name, order_index)')
    const { data: levelsData, error: err2 } = await supabase
      .from('levels')
      .select('id, name, code')
      .order('order_index')
    if (err1) setError(err1.message)
    if (err2) setError(err2.message)
        const sorted = (classesData || []).sort((a: any, b: any) => {
      const orderA = a.levels?.order_index ?? 999
      const orderB = b.levels?.order_index ?? 999
      if (orderA !== orderB) return orderA - orderB
      return (a.name || '').localeCompare(b.name || '', 'ar')
    })
    setClasses(sorted as any)
    setLevels(levelsData || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  function openAdd() {
    setEditing(null)
    setError('')
    setShowForm(true)
  }

  function openEdit(c: ClassRow) {
    setEditing(c)
    setError('')
    setShowForm(true)
  }

  function showDialog(
    title: string,
    message: React.ReactNode,
    variant: 'confirm' | 'info' | 'danger',
    onConfirm: (() => void) | null = null
  ) {
    setDialogTitle(title)
    setDialogMessage(message)
    setDialogVariant(variant)
    setDialogOnConfirm(() => onConfirm)
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setDialogOnConfirm(null)
  }

  async function handleDelete(c: ClassRow) {
    // فحص هل القسم مرتبط بحصص؟
    const { count, error: checkError } = await supabase
      .from('timetable_entries')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', c.id)

    if (checkError) {
      showDialog('خطأ في الفحص', checkError.message, 'info')
      return
    }

    if (count && count > 0) {
      showDialog(
        'لا يمكن الحذف',
        `القسم "${c.name}" مرتبط بـ ${count} حصة في جدول التوقيت.\n\nاحذف الحصص المرتبطة به أولًا.`,
        'info'
      )
      return
    }

    // اطلب تأكيدًا
    showDialog(
      'تأكيد الحذف',
      `هل أنت متأكد من حذف القسم "${c.name}"؟\n\nلا يمكن التراجع عن هذه العملية.`,
      'danger',
      async () => {
        closeDialog()
        const { error } = await supabase.from('classes').delete().eq('id', c.id)
        if (error) {
          showDialog('فشل الحذف', error.message, 'info')
          return
        }
        loadData()
      }
    )
  }

  return (
    <div style={{ padding: 20, fontFamily: 'Arial', direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>إدارة الأقسام ({classes.length})</h1>
        <button onClick={openAdd} style={primaryBtn}>+ قسم جديد</button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}
      {loading && <p>جاري التحميل...</p>}

      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 20 }}>
        <thead>
                    <tr>
            <th style={thStyle}>القسم</th>
            <th style={thStyle}>السنة</th>
            <th style={thStyle}>ذكور</th>
            <th style={thStyle}>إناث</th>
            <th style={thStyle}>المجموع</th>
            <th style={thStyle}>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {classes.map((c) => (
              <tr key={c.id}>
              <td style={tdStyle}>{c.name}</td>
              <td style={tdStyle}>{c.levels?.name || '—'}</td>
              <td style={tdStyle}>{c.male_count ?? 0}</td>
              <td style={tdStyle}>{c.female_count ?? 0}</td>
              <td style={tdStyle}>{c.student_count ?? 0}</td>
              <td style={tdStyle}>
                <button onClick={() => openEdit(c)} style={smallBtn}>تعديل</button>
                <button
                  onClick={() => handleDelete(c)}
                  style={{ ...smallBtn, background: '#dc3545', marginRight: 6 }}
                >
                  حذف
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showForm && (
        <ClassForm
          classRow={editing}
          levels={levels}
          onSaved={() => {
            setShowForm(false)
            loadData()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <ConfirmDialog
        open={dialogOpen}
        title={dialogTitle}
        message={dialogMessage}
        variant={dialogVariant}
        onConfirm={dialogOnConfirm || closeDialog}
        onCancel={closeDialog}
      />
    </div>
  )
}

function ClassForm({
  classRow,
  levels,
  onSaved,
  onCancel
}: {
  classRow: ClassRow | null
  levels: Level[]
  onSaved: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(classRow?.name || '')
  const [levelId, setLevelId] = useState<number | null>(classRow?.level_id || (levels[0]?.id ?? null))
  
  const [maleCount, setMaleCount] = useState<number>(classRow?.male_count || 0)
  const [femaleCount, setFemaleCount] = useState<number>(classRow?.female_count || 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('اسم القسم مطلوب')
      return
    }
    if (!levelId) {
      setError('يجب اختيار السنة')
      return
    }
    setSaving(true)

      const payload = {
      name: name.trim(),
      level_id: levelId,
      student_count: maleCount + femaleCount,
      male_count: maleCount,
      female_count: femaleCount
    }  

    let result
    if (classRow) {
      result = await supabase.from('classes').update(payload).eq('id', classRow.id)
    } else {
      result = await supabase.from('classes').insert(payload)
    }

    setSaving(false)
    if (result.error) {
      setError(result.error.message)
    } else {
      onSaved()
    }
  }

  return (
    <div style={overlayStyle}>
      <form onSubmit={handleSubmit} style={modalStyle}>
        <h2 style={{ marginTop: 0 }}>
          {classRow ? 'تعديل قسم' : 'قسم جديد'}
        </h2>

        <label style={labelStyle}>
          اسم القسم *
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
            autoFocus
          />
        </label>

            <label style={labelStyle}>
          عدد الذكور
          <input
            type="number"
            value={maleCount}
            onChange={(e) => setMaleCount(Number(e.target.value))}
            style={inputStyle}
            min={0}
          />
        </label>

        <label style={labelStyle}>
          عدد الإناث
          <input
            type="number"
            value={femaleCount}
            onChange={(e) => setFemaleCount(Number(e.target.value))}
            style={inputStyle}
            min={0}
          />
        </label>

        <label style={labelStyle}>
          المجموع (يُحسب تلقائيًا)
          <input
            type="number"
            value={maleCount + femaleCount}
            style={{ ...inputStyle, background: '#f0f0f0' }}
            disabled
          />
        </label>

        <label style={labelStyle}>
          السنة *
          <select
            value={levelId || ''}
            onChange={(e) => setLevelId(Number(e.target.value))}
            style={inputStyle}
          >
            {levels.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>

        
        {error && <div style={errorStyle}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
          <button type="submit" disabled={saving} style={primaryBtn}>
            {saving ? '...' : 'حفظ'}
          </button>
          <button type="button" onClick={onCancel} style={secondaryBtn}>إلغاء</button>
        </div>
      </form>
    </div>
  )
}

// الأنماط
const thStyle: React.CSSProperties = {
  border: '1px solid #999',
  padding: 10,
  background: '#333',
  color: 'white',
  textAlign: 'right'
}
const tdStyle: React.CSSProperties = {
  border: '1px solid #ccc',
  padding: 8,
  fontSize: 14
}
const primaryBtn: React.CSSProperties = {
  background: '#007bff',
  color: 'white',
  border: 'none',
  padding: '10px 18px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 15,
  fontWeight: 'bold'
}
const secondaryBtn: React.CSSProperties = {
  background: '#ddd',
  color: '#333',
  border: 'none',
  padding: '10px 18px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 15
}
const smallBtn: React.CSSProperties = {
  background: '#28a745',
  color: 'white',
  border: 'none',
  padding: '6px 12px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13
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
  borderRadius: 4,
  boxSizing: 'border-box'
}
const errorStyle: React.CSSProperties = {
  background: '#ffe0e0',
  color: '#900',
  padding: 8,
  borderRadius: 4,
  fontSize: 13
}