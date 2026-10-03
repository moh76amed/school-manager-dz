import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const WILAYAS = [
  'أدرار', 'الشلف', 'الأغواط', 'أم البواقي', 'باتنة', 'بجاية',
  'بسكرة', 'بشار', 'البليدة', 'البويرة', 'تمنراست', 'تبسة',
  'تلمسان', 'تيارت', 'تيزي وزو', 'الجزائر', 'الجلفة', 'جيجل',
  'سطيف', 'سعيدة', 'سكيكدة', 'سيدي بلعباس', 'عنابة', 'قالمة',
  'قسنطينة', 'المدية', 'مستغانم', 'المسيلة', 'معسكر', 'ورقلة',
  'وهران', 'البيض', 'إليزي', 'برج بوعريريج', 'بومرداس', 'الطارف',
  'تندوف', 'تيسمسيلت', 'الوادي', 'خنشلة', 'سوق أهراس', 'تيبازة',
  'ميلة', 'عين الدفلى', 'النعامة', 'عين تموشنت', 'غرداية', 'غليزان',
  'تيميمون', 'برج باجي مختار', 'أولاد جلال', 'بني عباس',
  'عين صالح', 'عين قزام', 'تقرت', 'جانت', 'المغير', 'المنيعة'
]

type Settings = {
  id: number
  school_name: string | null
  school_type: string | null
  wilaya: string | null
  commune: string | null
  daira: string | null
  direction: string | null
  academic_year: string | null
  inspectorate: string | null
  director_name: string | null
  stone_rooms: number | null
  wooden_rooms: number | null
  other_rooms: number | null
  used_rooms: number | null
  empty_rooms: number | null
  teaching_positions: number | null
  other_positions: number | null
  vacant_positions: number | null
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single()
      if (error) setError(error.message)
      setSettings(data)
      setLoading(false)
    }
    load()
  }, [])

  function updateField(field: keyof Settings, value: any) {
    if (!settings) return
    setSettings({ ...settings, [field]: value })
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!settings) return
    setError('')
    setSaving(true)

    const autoDirection = settings.wilaya
      ? `مديرية التربية لولاية ${settings.wilaya}`
      : settings.direction

    const { error } = await supabase
      .from('settings')
      .update({
        school_name: settings.school_name,
        school_type: settings.school_type,
        wilaya: settings.wilaya,
        commune: settings.commune,
        daira: settings.daira,
        direction: autoDirection,
        academic_year: settings.academic_year,
        inspectorate: settings.inspectorate,
        director_name: settings.director_name,
        stone_rooms: settings.stone_rooms,
        wooden_rooms: settings.wooden_rooms,
        other_rooms: settings.other_rooms,
        used_rooms: settings.used_rooms,
        empty_rooms: settings.empty_rooms,
        teaching_positions: settings.teaching_positions,
        other_positions: settings.other_positions,
        vacant_positions: settings.vacant_positions
      })
      .eq('id', 1)

    setSaving(false)
    if (error) {
      setError(error.message)
    } else {
      setSettings({ ...settings, direction: autoDirection })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  if (loading) return <p style={{ padding: 20 }}>جاري التحميل...</p>
  if (!settings) return <p style={{ padding: 20 }}>لا توجد إعدادات.</p>

  return (
    <div style={{ padding: 20, fontFamily: 'Arial', direction: 'rtl', maxWidth: 700 }}>
      <h1>إعدادات المؤسسة</h1>

      <form onSubmit={handleSubmit}>
        {/* 1. المرحلة التعليمية */}
        <label style={labelStyle}>
          المرحلة التعليمية *
          <select
            value={settings.school_type || 'primary'}
            onChange={(e) => updateField('school_type', e.target.value)}
            style={inputStyle}
          >
            <option value="primary">ابتدائي</option>
            <option value="middle">متوسط</option>
            <option value="secondary">ثانوي</option>
          </select>
        </label>

        {/* 2. الولاية */}
        <label style={labelStyle}>
          الولاية *
          <select
            value={settings.wilaya || ''}
            onChange={(e) => updateField('wilaya', e.target.value)}
            style={inputStyle}
          >
            <option value="">-- اختر الولاية --</option>
            {WILAYAS.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </label>

        {/* 3. مديرية التربية (تلقائي) */}
        <label style={labelStyle}>
          مديرية التربية (تلقائي)
          <input
            type="text"
            value={settings.wilaya ? `مديرية التربية لولاية ${settings.wilaya}` : ''}
            style={{ ...inputStyle, background: '#f0f0f0' }}
            disabled
          />
        </label>

        {/* 4. المفتشية */}
        <label style={labelStyle}>
          المفتشية
          <input
            type="text"
            value={settings.inspectorate || ''}
            onChange={(e) => updateField('inspectorate', e.target.value)}
            style={inputStyle}
          />
        </label>

        {/* 5. السنة الدراسية */}
        <label style={labelStyle}>
          السنة الدراسية
          <input
            type="text"
            value={settings.academic_year || ''}
            onChange={(e) => updateField('academic_year', e.target.value)}
            style={inputStyle}
            placeholder="مثال: 2025/2026"
          />
        </label>

        {/* 6. الدائرة */}
        <label style={labelStyle}>
          الدائرة
          <input
            type="text"
            value={settings.daira || ''}
            onChange={(e) => updateField('daira', e.target.value)}
            style={inputStyle}
          />
        </label>

        {/* 7. البلدية */}
        <label style={labelStyle}>
          البلدية
          <input
            type="text"
            value={settings.commune || ''}
            onChange={(e) => updateField('commune', e.target.value)}
            style={inputStyle}
          />
        </label>

        {/* 8. اسم المدرسة */}
        <label style={labelStyle}>
          اسم المدرسة *
          <input
            type="text"
            value={settings.school_name || ''}
            onChange={(e) => updateField('school_name', e.target.value)}
            style={inputStyle}
          />
        </label>

        {/* 9. اسم المدير */}
        <label style={labelStyle}>
          اسم المدير
          <input
            type="text"
            value={settings.director_name || ''}
            onChange={(e) => updateField('director_name', e.target.value)}
            style={inputStyle}
          />
        </label>

        <hr style={{ margin: '20px 0', border: '1px solid #eee' }} />
        <h3 style={{ marginBottom: 15 }}>الحجرات</h3>

        {/* 10. الحجرات المستعملة */}
        <label style={labelStyle}>
          الحجرات المستعملة
          <input
            type="number"
            value={settings.used_rooms ?? 0}
            onChange={(e) => updateField('used_rooms', Number(e.target.value))}
            style={inputStyle}
            min={0}
          />
        </label>

        {/* 11. الحجرات الفارغة */}
        <label style={labelStyle}>
          الحجرات الفارغة
          <input
            type="number"
            value={settings.empty_rooms ?? 0}
            onChange={(e) => updateField('empty_rooms', Number(e.target.value))}
            style={inputStyle}
            min={0}
          />
        </label>

         <hr style={{ margin: '20px 0', border: '1px solid #eee' }} />
        <h3 style={{ marginBottom: 15 }}>المناصب</h3>

        {/* 15. مناصب التدريس */}
        <label style={labelStyle}>
          مناصب التدريس
          <input
            type="number"
            value={settings.teaching_positions ?? 0}
            onChange={(e) => updateField('teaching_positions', Number(e.target.value))}
            style={inputStyle}
            min={0}
          />
        </label>

        {/* 16. مناصب أخرى */}
        <label style={labelStyle}>
          مناصب أخرى
          <input
            type="number"
            value={settings.other_positions ?? 0}
            onChange={(e) => updateField('other_positions', Number(e.target.value))}
            style={inputStyle}
            min={0}
          />
        </label>

        {/* 17. مناصب شاغرة */}
        <label style={labelStyle}>
          مناصب شاغرة
          <input
            type="number"
            value={settings.vacant_positions ?? 0}
            onChange={(e) => updateField('vacant_positions', Number(e.target.value))}
            style={inputStyle}
            min={0}
          />
        </label>

        {error && <div style={errorStyle}>{error}</div>}
        {success && <div style={successStyle}>✅ تم حفظ الإعدادات بنجاح</div>}

        <button type="submit" disabled={saving} style={primaryBtn}>
          {saving ? '...' : 'حفظ الإعدادات'}
        </button>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 14,
  fontWeight: 'bold',
  fontSize: 14
}
const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: 10,
  marginTop: 6,
  fontSize: 15,
  border: '1px solid #ccc',
  borderRadius: 6,
  boxSizing: 'border-box',
  fontFamily: 'inherit'
}
const errorStyle: React.CSSProperties = {
  background: '#ffe0e0',
  color: '#900',
  padding: 10,
  borderRadius: 4,
  fontSize: 13,
  marginBottom: 10
}
const successStyle: React.CSSProperties = {
  background: '#dcfce7',
  color: '#166534',
  padding: 10,
  borderRadius: 4,
  fontSize: 14,
  marginBottom: 10
}
const primaryBtn: React.CSSProperties = {
  background: '#007bff',
  color: 'white',
  border: 'none',
  padding: '12px 24px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 15,
  fontWeight: 'bold'
}