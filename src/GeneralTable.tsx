import React, { useEffect, useState } from 'react'
import ExcelJS from 'exceljs'
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
    { label: 'صباحًا', startSlot: 1,  endSlot: 20 },
    { label: 'مساءً',  startSlot: 21, endSlot: 36 }
  ],
  1: [  // الاثنين
    { label: 'صباحًا', startSlot: 1,  endSlot: 20 },
    { label: 'مساءً',  startSlot: 21, endSlot: 36 }
  ],
  2: [  // الثلاثاء
    { label: 'صباحًا', startSlot: 1,  endSlot: 18 },
    { label: 'مساءً',  startSlot: 19, endSlot: 36 }
  ],
  3: [  // الأربعاء
    { label: 'صباحًا', startSlot: 1,  endSlot: 20 },
    { label: 'مساءً',  startSlot: 21, endSlot: 36 }
  ],
  4: [  // الخميس
    { label: 'صباحًا', startSlot: 1,  endSlot: 20 },
    { label: 'مساءً',  startSlot: 21, endSlot: 36 }
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
    subjects: { code: string | null; name: string; color: string } | null
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
                .select('id, class_id, day_of_week, start_slot, duration_slots, teacher_id, teachers(first_name, last_name), subjects(code, name, color)')
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

    // تصدير الجدول إلى Excel
  async function exportToExcel() {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('الجدول العام', {
      views: [{ rightToLeft: true }],
            pageSetup: {
        paperSize: 9,                    // A4
        orientation: 'landscape',        // أفقي
        fitToPage: true,
        fitToWidth: 1,                   // ✅ صفحة واحدة بالعرض
        fitToHeight: 2,                  // ✅ صفحتان بالطول (المفتاح!)
        margins: {
          left: 0.3,
          right: 0.3,
          top: 0.5,                      // ✅ زيادة الهامش العلوي
          bottom: 0.5,                   // ✅ زيادة الهامش السفلي
          header: 0.5,
          footer: 0.5
        },
        horizontalCentered: true,        // ✅ توسيط أفقي
        verticalCentered: false
      }
    })

    // عرض الأعمدة
    worksheet.getColumn(1).width = 7
    classes.forEach((_, idx) => {
      worksheet.getColumn(idx + 2).width = 18
    })

    const totalCols = classes.length + 1
   
    // =========================================================
    // الترويسة الرسمية (3 أقسام: يمين - وسط - يسار)
    // =========================================================
    let currentRow = 1

    const third1 = Math.max(1, Math.floor(totalCols / 3))
    const third2 = Math.max(third1 + 1, Math.floor((totalCols * 2) / 3))

    // ---------- السطر 1: المديرية (يمين) | الجمهورية (وسط) | السنة (يسار) ----------
    worksheet.mergeCells(currentRow, 1, currentRow, third1)
    const dirCell1 = worksheet.getCell(currentRow, 1)
    dirCell1.value = settings?.direction || 'مديرية التربية لولاية ...'
    dirCell1.font = { bold: true, size: 14 } // ✅ حجم 14
    dirCell1.alignment = { horizontal: 'center', vertical: 'middle' }

    worksheet.mergeCells(currentRow, third1 + 1, currentRow, third2)
    const repCell = worksheet.getCell(currentRow, third1 + 1)
    repCell.value = 'الجمهورية الجزائرية الديمقراطية الشعبية'
    repCell.font = { bold: true, size: 14 } // ✅ حجم 14
    repCell.alignment = { horizontal: 'center', vertical: 'middle' }

    worksheet.mergeCells(currentRow, third2 + 1, currentRow, totalCols)
    const yearCell1 = worksheet.getCell(currentRow, third2 + 1)
    yearCell1.value = `السنة الدراسية: ${settings?.academic_year || '...'}`
    yearCell1.font = { bold: true, size: 14 } // ✅ حجم 14
    yearCell1.alignment = { horizontal: 'center', vertical: 'middle' }

    currentRow++

    // ---------- السطر 2: المفتشية | وزارة التربية | الدائرة/البلدية ----------
    worksheet.mergeCells(currentRow, 1, currentRow, third1)
    const inspCell = worksheet.getCell(currentRow, 1)
    inspCell.value = settings?.inspectorate || 'المفتشية'
    inspCell.font = { size: 14 } // ✅ حجم 14
    inspCell.alignment = { horizontal: 'center', vertical: 'middle' }

    worksheet.mergeCells(currentRow, third1 + 1, currentRow, third2)
    const minCell = worksheet.getCell(currentRow, third1 + 1)
    minCell.value = 'وزارة التربية الوطنية'
    minCell.font = { bold: true, size: 14 } // ✅ حجم 14
    minCell.alignment = { horizontal: 'center', vertical: 'middle' }

    worksheet.mergeCells(currentRow, third2 + 1, currentRow, totalCols)
    const dairaCell1 = worksheet.getCell(currentRow, third2 + 1)
    dairaCell1.value = `الدائرة: ${settings?.daira || '...'} | البلدية: ${settings?.commune || '...'}`
    dairaCell1.font = { size: 14 } // ✅ حجم 14
    dairaCell1.alignment = { horizontal: 'center', vertical: 'middle' }

    currentRow++

    // ---------- السطر 3: المدرسة | (فارغ) | المدير ----------
    worksheet.mergeCells(currentRow, 1, currentRow, third1)
    const schoolCell = worksheet.getCell(currentRow, 1)
    schoolCell.value = settings?.school_name || 'اسم المدرسة'
    schoolCell.font = { bold: true, size: 14 } // ✅ حجم 14
    schoolCell.alignment = { horizontal: 'center', vertical: 'middle' }

    worksheet.mergeCells(currentRow, third1 + 1, currentRow, third2)

    worksheet.mergeCells(currentRow, third2 + 1, currentRow, totalCols)
    const dirNameCell = worksheet.getCell(currentRow, third2 + 1)
    dirNameCell.value = `المدير: ${settings?.director_name || '...'}`
    dirNameCell.font = { size: 14 } // ✅ حجم 14
    dirNameCell.alignment = { horizontal: 'center', vertical: 'middle' }

    currentRow++

    // ---------- السطر 4: فارغ ----------
    currentRow++

    // =========================================================
    // جدول الإحصائيات - كل معلومة في خلية مستقلة
    // =========================================================
    const styleStatCell = (
      cell: ExcelJS.Cell,
      value: string | number,
      isHeader: boolean = false
    ) => {
      cell.value = value
      if (isHeader) {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 } // ✅ حجم 11
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
      } else {
        cell.font = { bold: true, size: 11 } // ✅ حجم 11
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } }
      }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      }
    }

    // ---------- السطر 5: الحجرات والمناصب المفتوحة ----------
    let col = 2

    styleStatCell(worksheet.getCell(currentRow, col), 'الحجرات', true)
    col++

    if ((settings?.used_rooms ?? 0) > 0) {
      styleStatCell(worksheet.getCell(currentRow, col), `مستعملة: ${settings.used_rooms}`)
      col++
    }
    if ((settings?.unused_rooms ?? 0) > 0) {
      styleStatCell(worksheet.getCell(currentRow, col), `غير مستعملة: ${settings.unused_rooms}`)
      col++
    }

    styleStatCell(worksheet.getCell(currentRow, col), 'المناصب المفتوحة', true)
    col++

    if ((settings?.position_director ?? 0) > 0) {
      styleStatCell(worksheet.getCell(currentRow, col), `مدر: ${settings.position_director}`)
      col++
    }
    if ((settings?.position_nazir ?? 0) > 0) {
      styleStatCell(worksheet.getCell(currentRow, col), `ناظر: ${settings.position_nazir}`)
      col++
    }
    if ((settings?.position_support ?? 0) > 0) {
      styleStatCell(worksheet.getCell(currentRow, col), `م م د ت: ${settings.position_support}`)
      col++
    }
    if ((settings?.position_other ?? 0) > 0) {
      styleStatCell(worksheet.getCell(currentRow, col), `منصب آخر: ${settings.position_other}`)
      col++
    }
    if ((settings?.position_arabic_teacher ?? 0) > 0) {
      styleStatCell(worksheet.getCell(currentRow, col), `أس عر: ${settings.position_arabic_teacher}`)
      col++
    }
    if ((settings?.position_french_teacher ?? 0) > 0) {
      styleStatCell(worksheet.getCell(currentRow, col), `أس فر: ${settings.position_french_teacher}`)
      col++
    }
    if ((settings?.position_english_teacher ?? 0) > 0) {
      styleStatCell(worksheet.getCell(currentRow, col), `أس إن: ${settings.position_english_teacher}`)
      col++
    }
    if ((settings?.position_pe_teacher ?? 0) > 0) {
      styleStatCell(worksheet.getCell(currentRow, col), `أس ت ب: ${settings.position_pe_teacher}`)
      col++
    }

    currentRow++

    // ---------- السطر 6: التلاميذ والأفواج ----------
    col = 2
    const totalMale = allClassesData.reduce((s, c) => s + (c.male_count || 0), 0)
    const totalFemale = allClassesData.reduce((s, c) => s + (c.female_count || 0), 0)
    const totalStudents = allClassesData.reduce((s, c) => s + (c.student_count || 0), 0)

    styleStatCell(worksheet.getCell(currentRow, col), 'التلاميذ', true)
    col++

    if (totalMale > 0) {
      styleStatCell(worksheet.getCell(currentRow, col), `ذكور: ${totalMale}`)
      col++
    }
    if (totalFemale > 0) {
      styleStatCell(worksheet.getCell(currentRow, col), `إناث: ${totalFemale}`)
      col++
    }
    if (totalStudents > 0) {
      styleStatCell(worksheet.getCell(currentRow, col), `المجموع: ${totalStudents}`)
      col++
    }

    styleStatCell(worksheet.getCell(currentRow, col), 'الأفواج', true)
    col++
    if (allClassesData.length > 0) {
      styleStatCell(worksheet.getCell(currentRow, col), allClassesData.length)
      col++
    }

    currentRow++

    // ---------- السطر 7: فارغ (جديد) ----------
    currentRow++

    // =========================================================
    // عنوان الجدول الرئيسي (السطر 8)
    // =========================================================
    worksheet.mergeCells(currentRow, 1, currentRow, totalCols)
    const titleCell = worksheet.getCell(currentRow, 1)
    titleCell.value = 'الجدول العام لتوزيع الأساتذة'
    titleCell.font = { bold: true, size: 16 } // ✅ حجم 16
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

    currentRow++

    // ---------- السطر 9: فارغ ----------
    currentRow++

    // =========================================================
    // رأس الجدول الرئيسي (السطر 10)
    // =========================================================
    const headerCells = ['اليوم', ...classes.map(c => c.name)]
    headerCells.forEach((text, idx) => {
      const cell = worksheet.getCell(currentRow, idx + 1)
      cell.value = text
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      }
    })
    worksheet.getRow(currentRow).height = 30

    currentRow++

    // بيانات الجدول
    DAYS.forEach((dayName, dayIdx) => {
      const periods = PERIODS_BY_DAY[dayIdx] || []
      periods.forEach((period) => {
        const dayCell = worksheet.getCell(currentRow, 1)
        dayCell.value = `${dayName} ${period.label}`
        dayCell.font = { bold: true, size: 11 }
        dayCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
        dayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } }
        dayCell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        }

        classes.forEach((c, cIdx) => {
          const cell = worksheet.getCell(currentRow, cIdx + 2)
          const cellEntries = getEntriesInPeriod(c.id, dayIdx, period)

          if (cellEntries.length === 0) {
            cell.value = '—'
            cell.font = { size: 11 }
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
          } else {
            const text = cellEntries.map(entry => {
              const time = `${slotToTime(entry.start_slot + entry.duration_slots)}-${slotToTime(entry.start_slot)}`
              const subject = getSubjectCode(entry.subjects?.code || null, entry.subjects?.name || null)
              const teacher = `${entry.teachers?.first_name || ''} ${entry.teachers?.last_name || ''}`
              return `${time} ${subject}\n${teacher}`
            }).join('\n\n')

            cell.value = text
            cell.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } }

            const firstEntry = cellEntries[0]
            const color = firstEntry.subjects?.color || '#CCCCCC'
            const argb = 'FF' + color.replace('#', '').toUpperCase()
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }

            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
          }

          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
          }
        })

        worksheet.getRow(currentRow).height = 77
        currentRow++
      })

      // ✅ إضافة فاصل صفحات بعد يوم الاثنين (dayIdx === 1) ليتم التقسيم إلى صفحتين
      // يمكنك تغيير الرقم (1 = الاثنين، 2 = الثلاثاء، 3 = الأربعاء) حسب رغبتك
      if (dayIdx === 1) {
        worksheet.getRow(currentRow).addPageBreak()
      }
    })

    // =========================================================
    // سطر الإمضاءات (بدون دمج - كل خلية مستقلة)
    // =========================================================
    const signRow = worksheet.getRow(currentRow)
    signRow.height = 27

    // المدير - في العمود B - محاذاة إلى اليمين
    const directorCell = signRow.getCell(2)
    directorCell.value = `مدير المؤسسة: ${settings?.director_name || ''}`
    directorCell.font = { size: 11, bold: true }
    directorCell.alignment = { vertical: 'middle', horizontal: 'right' }

    // المفتشية - في العمود L - محاذاة إلى اليسار
    const inspectorCell = signRow.getCell(12)
    inspectorCell.value = `المفتشية: ${settings?.inspectorate || ''}`
    inspectorCell.font = { size: 11, bold: true }
    inspectorCell.alignment = { vertical: 'middle', horizontal: 'left' }

    // =========================================================
    // ✅ ضبط ارتفاع الأسطر التسعة الأولى إلى 20
    // =========================================================
    for (let r = 1; r <= 9; r++) {
      worksheet.getRow(r).height = 20
    }

        // ✅ تحديد منطقة الطباعة بشكل صريح (لا تُضمّن الأعمدة الزائدة)
    // نحسب آخر عمود استُخدم فعلياً في الصف 5 (الإحصائيات)
    const maxPrintCol = Math.max(totalCols, 12) // ✅ نضمن أن العمود L (12) مُدرج للإمضاءات
    const lastColLetter = String.fromCharCode(64 + maxPrintCol)
    worksheet.pageSetup.printArea = `A1:${lastColLetter}${currentRow}`

     // تنزيل الملف
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `الجدول_العام_${settings?.academic_year?.replace('/', '-') || ''}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <p style={{ padding: 20 }}>جاري التحميل...</p>
   return (
    <div style={{ padding: 20, direction: 'rtl', fontFamily: 'Arial', background: '#f5f5f5' }}>
      {/* زر الطباعة (لا يُطبع) */}
           <div className="no-print" style={{ marginBottom: 15, textAlign: 'center', display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: '10px 24px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 16,
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          🖨️ طباعة الجدول العام
        </button>

        <button
          onClick={exportToExcel}
          style={{
            padding: '10px 24px',
            background: '#16a34a',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 16,
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          📊 تصدير Excel
        </button>
      </div>
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

                {/* الإحصائيات - الصف الأول */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 4 }}>
          <tbody>
            <tr>
              <th style={statHeaderStyle}>الحجرات</th>
              {(settings?.used_rooms ?? 0) > 0 && (
                <td style={statValueStyle}>مستعملة: {settings.used_rooms}</td>
              )}
              {(settings?.unused_rooms ?? 0) > 0 && (
                <td style={statValueStyle}>غير مستعملة: {settings.unused_rooms}</td>
              )}

              <th style={statHeaderStyle}>المناصب المفتوحة</th>
              {(settings?.position_director ?? 0) > 0 && (
                <td style={statValueStyle}>مدر: {settings.position_director}</td>
              )}
              {(settings?.position_nazir ?? 0) > 0 && (
                <td style={statValueStyle}>ناظر: {settings.position_nazir}</td>
              )}
              {(settings?.position_support ?? 0) > 0 && (
                <td style={statValueStyle}>م م د ت: {settings.position_support}</td>
              )}
              {(settings?.position_other ?? 0) > 0 && (
                <td style={statValueStyle}>منصب آخر: {settings.position_other}</td>
              )}
              {(settings?.position_arabic_teacher ?? 0) > 0 && (
                <td style={statValueStyle}>أس عر: {settings.position_arabic_teacher}</td>
              )}
              {(settings?.position_french_teacher ?? 0) > 0 && (
                <td style={statValueStyle}>أس فر: {settings.position_french_teacher}</td>
              )}
              {(settings?.position_english_teacher ?? 0) > 0 && (
                <td style={statValueStyle}>أس إن: {settings.position_english_teacher}</td>
              )}
              {(settings?.position_pe_teacher ?? 0) > 0 && (
                <td style={statValueStyle}>أس ت ب: {settings.position_pe_teacher}</td>
              )}
            </tr>
          </tbody>
        </table>

        {/* الإحصائيات - الصف الثاني */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 10 }}>
          <tbody>
            <tr>
              <th style={statHeaderStyle}>التلاميذ</th>
              <td style={statValueStyle}>
                ذكور: {allClassesData.reduce((s, c) => s + (c.male_count || 0), 0)}
              </td>
              <td style={statValueStyle}>
                إناث: {allClassesData.reduce((s, c) => s + (c.female_count || 0), 0)}
              </td>
              <td style={statValueStyle}>
                المجموع: {allClassesData.reduce((s, c) => s + (c.student_count || 0), 0)}
              </td>
              <th style={statHeaderStyle}>الأفواج</th>
              <td style={statValueStyle}>{allClassesData.length}</td>
            </tr>
          </tbody>
        </table>

        <h2 style={{ textAlign: 'center', fontSize: 16, margin: '15px 0' }}>
          الجدول العام لتوزيع الأساتذة
        </h2>

                {/* الجدول الرئيسي */}
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 9 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, minWidth: 90 }}>اليوم</th>
              {classes.map(c => (
                <th key={c.id} style={thStyle}>{c.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
                        {DAYS.map((dayName, dayIdx) => {
              const periods = PERIODS_BY_DAY[dayIdx] || []
              const breakAfter = dayIdx === 1 || dayIdx === 3
              return (
                <React.Fragment key={dayIdx}>
                  {periods.map((period, pIdx) => (
                    <tr key={`${dayIdx}-${pIdx}`}>
                      <td style={{ ...dayCellStyle, fontWeight: 'bold', whiteSpace: 'nowrap', padding: '1px 2px', minWidth: 32, width: 32 }}>
                        <div style={{ fontSize: 9 }}>{dayName}</div>
                        <div style={{ fontSize: 7, fontWeight: 'normal', color: '#555' }}>
                          {period.label}
                        </div>
                      </td>
                      {classes.map(c => {
                        const cellEntries = getEntriesInPeriod(c.id, dayIdx, period)
                        return (
                          <td key={c.id} style={cellStyle}>
                            {cellEntries.length === 0 ? (
                              <span style={{ color: '#ccc' }}>—</span>
                            ) : (
                              cellEntries.map(entry => (
                                <div key={entry.id} style={entryBoxStyle}>
                                  <div style={{
                                    fontWeight: 'bold',
                                    fontSize: 9,
                                    background: entry.subjects?.color || 'transparent',
                                    color: 'white',
                                    padding: '2px 3px',
                                    borderRadius: 3,
                                    marginBottom: 2
                                  }}>
                                    <span style={{ direction: 'ltr', display: 'inline-block' }}>
                                      {slotToTime(entry.start_slot + entry.duration_slots)}-{slotToTime(entry.start_slot)}
                                    </span>
                                    {' '}
                                    {getSubjectCode(entry.subjects?.code || null, entry.subjects?.name || null)}
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
                  ))}
                  {breakAfter && (
                    <tr style={{ pageBreakAfter: 'always' }}>
                      <td colSpan={classes.length + 1} style={{ border: 'none', height: 0, padding: 0 }}></td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
         </table>

              {/* الإمضاءات */}
        <div style={{ marginTop: 20, fontSize: 12, display: 'flex', justifyContent: 'space-between', pageBreakInside: 'avoid' }}>
          {/* المدير - يمين */}
          <div style={{ textAlign: 'center', minWidth: 250 }}>
            <div style={{ fontWeight: 'bold' }}>
              مدير المؤسسة: {settings?.director_name || ''}
            </div>
          </div>

          {/* المفتشية - يسار */}
          <div style={{ textAlign: 'center', minWidth: 250 }}>
            <div style={{ fontWeight: 'bold' }}>
              {settings?.inspectorate || ''}
            </div>
          </div>
        </div>

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