import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { ConfirmDialog } from './ConfirmDialog'

type Subject = {
  id: number
  name: string
}

type Teacher = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  is_teacher: boolean | null
  teacher_subjects: { subjects: { id: number; name: string } | null }[] | null
}

export function TeachersSubjects() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [error, setError] = useState('')

  // نافذة تأكيد
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogTitle, setDialogTitle] = useState('')
  const [dialogMessage, setDialogMessage] = useState<React.ReactNode>('')
  const [dialogVariant, setDialogVariant] = useState<'confirm' | 'info' | 'danger'>('confirm')
  const [dialogOnConfirm, setDialogOnConfirm] = useState<(() => void) | null>(null)

  async function loadData() {
    setLoading(true)
        const { data: teachersData, error: e1 } = await supabase
      .from('teachers')
      .select('id, first_name, last_name, email, phone, is_teacher, teacher_subjects(subjects(id, name))')
      .eq('is_teacher', true)
    const { data: subjectsData, error: e2 } = await supabase
      .from('subjects')
      .select('id, name')
      .order('id')
    if (e1) setError(e1.message)
    if (e2) setError(e2.message)
      const sortedTeachers = (teachersData || []).sort((a: any, b: any) => {
      const lastNameA = a.last_name || ''
      const lastNameB = b.last_name || ''
      const cmp = lastNameA.localeCompare(lastNameB, 'ar')
      if (cmp !== 0) return cmp
      return (a.first_name || '').localeCompare(b.first_name || '', 'ar')
    })
    setTeachers(sortedTeachers as any)
    setSubjects(subjectsData || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  function openEdit(t: Teacher) {
    setEditing(t)
    setError('')
    setShowForm(true)
  }

  function openGuide() {
    setShowGuide(true)
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

  async function handleDelete(t: Teacher) {
    const { count, error: checkError } = await supabase
      .from('timetable_entries')
      .select('*', { count: 'exact', head: true })
      .eq('teacher_id', t.id)

    if (checkError) {
      showDialog('خطأ في الفحص', checkError.message, 'info')
      return
    }

    if (count && count > 0) {
      showDialog(
        'لا يمكن الحذف',
        `الأستاذ "${t.first_name} ${t.last_name}" مرتبط بـ ${count} حصة.\n\nاحذف الحصص المرتبطة به أولًا.`,
        'info'
      )
      return
    }

    showDialog(
      'تأكيد الحذف',
      `هل أنت متأكد من حذف الأستاذ "${t.first_name} ${t.last_name}"؟`,
      'danger',
      async () => {
        closeDialog()
        await supabase.from('teacher_subjects').delete().eq('teacher_id', t.id)
        const { error } = await supabase.from('teachers').delete().eq('id', t.id)
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
        <h1>الأساتذة والمواد ({teachers.length})</h1>
        <button onClick={openGuide} style={primaryBtn}>+ أستاذ جديد</button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}
      {loading && <p>جاري التحميل...</p>}

      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 20 }}>
        <thead>
          <tr>
            <th style={thStyle}>الاسم واللقب</th>
            <th style={thStyle}>المواد التي يدرّسها</th>
            <th style={thStyle}>الهاتف</th>
            <th style={thStyle}>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {teachers.map((t) => (
            <tr key={t.id}>
              <td style={tdStyle}>{t.first_name} {t.last_name}</td>
              <td style={tdStyle}>
                {t.teacher_subjects && t.teacher_subjects.length > 0
                  ? t.teacher_subjects
                      .map(ts => ts.subjects?.name)
                      .filter(Boolean)
                      .join('، ')
                  : '—'
                }
              </td>
              <td style={tdStyle}>{t.phone || '—'}</td>
              <td style={tdStyle}>
                <button onClick={() => openEdit(t)} style={smallBtn}>تعديل</button>
                <button
                  onClick={() => handleDelete(t)}
                  style={{ ...smallBtn, background: '#dc3545', marginRight: 6 }}
                >
                  حذف
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {teachers.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
          لا يوجد أساتذة بعد. اضغط <strong>"+ أستاذ جديد"</strong> لرؤية طريقة الإضافة.
        </div>
      )}

      {showForm && editing && (
        <TeacherForm
          teacher={editing}
          subjects={subjects}
          onSaved={() => {
            setShowForm(false)
            loadData()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {showGuide && (
        <GuideDialog
          subjects={subjects}
          onClose={() => setShowGuide(false)}
          onAdded={() => {
            setShowGuide(false)
            loadData()
          }}
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

// ============================================================
// نموذج تعديل الأستاذ + المواد
// ============================================================
function TeacherForm({
  teacher,
  subjects,
  onSaved,
  onCancel
}: {
  teacher: Teacher
  subjects: Subject[]
  onSaved: () => void
  onCancel: () => void
}) {
  const [firstName, setFirstName] = useState(teacher.first_name)
  const [lastName, setLastName] = useState(teacher.last_name)
  const [email, setEmail] = useState(teacher.email || '')
  const [phone, setPhone] = useState(teacher.phone || '')
  const [selectedSubjects, setSelectedSubjects] = useState<number[]>(
    teacher.teacher_subjects
      ? teacher.teacher_subjects.map(ts => ts.subjects?.id).filter((id): id is number => id !== undefined)
      : []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleSubject(id: number) {
    setSelectedSubjects(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!firstName.trim() || !lastName.trim()) {
      setError('الاسم واللقب مطلوبان')
      return
    }
    setSaving(true)

    const { error: updErr } = await supabase
      .from('teachers')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null
      })
      .eq('id', teacher.id)

    if (updErr) {
      setSaving(false)
      setError(updErr.message)
      return
    }

    // حذف كل الربطات القديمة
    await supabase.from('teacher_subjects').delete().eq('teacher_id', teacher.id)

    // إضافة الربطات الجديدة
    if (selectedSubjects.length > 0) {
      const { error: linkErr } = await supabase
        .from('teacher_subjects')
        .insert(selectedSubjects.map(sid => ({
          teacher_id: teacher.id,
          subject_id: sid
        })))
      if (linkErr) {
        setSaving(false)
        setError(linkErr.message)
        return
      }
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div style={overlayStyle}>
      <form onSubmit={handleSubmit} style={{ ...modalStyle, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ marginTop: 0 }}>تعديل بيانات أستاذ</h2>

        <label style={labelStyle}>
          الاسم *
          <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} autoFocus />
        </label>

        <label style={labelStyle}>
          اللقب *
          <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          البريد الإلكتروني (اختياري)
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          الهاتف (اختياري)
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
        </label>

        <div style={{ marginTop: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>المواد التي يدرّسها:</div>
          <div style={{
            border: '1px solid #ccc',
            borderRadius: 6,
            padding: 10,
            maxHeight: 180,
            overflowY: 'auto',
            background: '#f9f9f9'
          }}>
            {subjects.map(s => (
              <label key={s.id} style={{ display: 'block', marginBottom: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedSubjects.includes(s.id)}
                  onChange={() => toggleSubject(s.id)}
                  style={{ marginLeft: 8 }}
                />
                {s.name}
              </label>
            ))}
          </div>
        </div>

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

// ============================================================
// نافذة إضافة أستاذ جديد (مع UID من Supabase)
// ============================================================
function GuideDialog({
  subjects,
  onClose,
  onAdded
}: {
  subjects: Subject[]
  onClose: () => void
  onAdded: () => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedSubjects, setSelectedSubjects] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleSubject(id: number) {
    setSelectedSubjects(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!firstName.trim() || !lastName.trim()) {
      setError('الاسم واللقب مطلوبان')
      return
    }
    setSaving(true)

    const { data: newTeacher, error: insErr } = await supabase
      .from('teachers')
      .insert({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        is_teacher: true
      })
      .select()
      .single()

    if (insErr || !newTeacher) {
      setSaving(false)
      setError(insErr?.message || 'فشل الإنشاء')
      return
    }

    if (selectedSubjects.length > 0) {
      const { error: linkErr } = await supabase
        .from('teacher_subjects')
        .insert(selectedSubjects.map(sid => ({
          teacher_id: newTeacher.id,
          subject_id: sid
        })))
      if (linkErr) {
        setSaving(false)
        setError(linkErr.message)
        return
      }
    }

    setSaving(false)
    onAdded()
  }

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, width: 600, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ marginTop: 0 }}>إضافة أستاذ جديد</h2>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>
            الاسم *
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} autoFocus />
          </label>

          <label style={labelStyle}>
            اللقب *
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
          </label>

          <label style={labelStyle}>
            البريد الإلكتروني (اختياري)
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          </label>

          <label style={labelStyle}>
            الهاتف (اختياري)
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
          </label>

          <div style={{ marginTop: 10, marginBottom: 10 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>المواد التي يدرّسها:</div>
            <div style={{
              border: '1px solid #ccc',
              borderRadius: 6,
              padding: 10,
              maxHeight: 180,
              overflowY: 'auto',
              background: '#f9f9f9'
            }}>
              {subjects.map(s => (
                <label key={s.id} style={{ display: 'block', marginBottom: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedSubjects.includes(s.id)}
                    onChange={() => toggleSubject(s.id)}
                    style={{ marginLeft: 8 }}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>

          {error && <div style={errorStyle}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
            <button type="submit" disabled={saving} style={primaryBtn}>
              {saving ? '...' : 'إضافة الأستاذ'}
            </button>
            <button type="button" onClick={onClose} style={secondaryBtn}>إغلاق</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==================== الأنماط ====================
const thStyle: React.CSSProperties = {
  border: '1px solid #999', padding: 10, background: '#333',
  color: 'white', textAlign: 'right'
}
const tdStyle: React.CSSProperties = {
  border: '1px solid #ccc', padding: 8, fontSize: 14
}
const primaryBtn: React.CSSProperties = {
  background: '#007bff', color: 'white', border: 'none',
  padding: '10px 18px', borderRadius: 4, cursor: 'pointer',
  fontSize: 15, fontWeight: 'bold'
}
const secondaryBtn: React.CSSProperties = {
  background: '#ddd', color: '#333', border: 'none',
  padding: '10px 18px', borderRadius: 4, cursor: 'pointer', fontSize: 15
}
const smallBtn: React.CSSProperties = {
  background: '#28a745', color: 'white', border: 'none',
  padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13
}
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, overflowY: 'auto', padding: 20
}
const modalStyle: React.CSSProperties = {
  background: 'white', padding: 25, borderRadius: 8,
  width: 500, maxWidth: '90%', direction: 'rtl', fontFamily: 'Arial'
}
const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 12, fontWeight: 'bold', fontSize: 14
}
const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: 8, marginTop: 4,
  fontSize: 15, border: '1px solid #ccc', borderRadius: 4,
  boxSizing: 'border-box', fontFamily: 'inherit'
}
const errorStyle: React.CSSProperties = {
  background: '#ffe0e0', color: '#900', padding: 8,
  borderRadius: 4, fontSize: 13
}