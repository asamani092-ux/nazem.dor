// ==========================================
// دوال مساعدة عامة لمعالجة أرقام الجوال
// ==========================================
function formatPhoneForStorage(p) {
  let str = String(p || '').trim();
  if (str.length === 9 && str.startsWith('5')) {
    str = '0' + str;
  }
  return "'" + str; 
}

function formatPhoneForReading(p) {
  let str = String(p || '').trim();
  if (str.startsWith("'")) {
    str = str.substring(1);
  }
  if (str.length === 9 && str.startsWith('5')) {
    str = '0' + str;
  }
  return str;
}

// ==========================================
// دالة التشغيل الأساسية لتطبيق الويب (Router)
// ==========================================
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  template.APP_NAME = CONFIG.APP_NAME;
  template.LABELS = CONFIG.LABELS;
  return template.evaluate()
      .setTitle(CONFIG.APP_NAME)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}

function include(filename) { 
  return HtmlService.createHtmlOutputFromFile(filename).getContent(); 
}

// ==========================================
// نظام تسجيل الدخول المطور
// ==========================================
function verifyUserLogin(phone) {
  try {
    const masterDb = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID);

    const superSheet = masterDb.getSheetByName('التحكم_العالي');
    if (superSheet) {
      const superData = superSheet.getDataRange().getValues();
      for (let i = 1; i < superData.length; i++) {
        if (formatPhoneForReading(superData[i][0]) === phone) {
          return { status: 'success', role: 'super_master' };
        }
      }
    }

    const adminSheet = masterDb.getSheetByName('الإشراف');
    if (adminSheet) {
      const adminData = adminSheet.getDataRange().getValues();
      for (let i = 1; i < adminData.length; i++) {
        if (formatPhoneForReading(adminData[i][2]) === phone && String(adminData[i][3]).trim() === 'نشط') {
          return { status: 'success', role: 'master' };
        }
      }
    }

    const darSheet = masterDb.getSheetByName('الدور');
    if (!darSheet) return { status: 'error', message: 'خطأ في إعداد قاعدة البيانات: ورقة الدور غير موجودة' };

    const darsData = darSheet.getDataRange().getValues();
    for (let i = 1; i < darsData.length; i++) {
      if (formatPhoneForReading(darsData[i][4]) === phone && String(darsData[i][7]).trim() !== 'محذوف') {
        return { status: 'success', role: 'manager', darId: darsData[i][0], darName: darsData[i][1], managerName: darsData[i][3] };
      }
    }

    for (let i = 1; i < darsData.length; i++) {
      let darId = darsData[i][0];
      if (darsData[i][7] === 'محذوف' || darsData[i][7] === 'معلق') continue;
      try {
        let darDb = SpreadsheetApp.openById(darId);
        let classSheet = darDb.getSheetByName('الفصول_والمعلمات');
        if (classSheet) {
          let cData = classSheet.getDataRange().getValues();
          for (let j = 1; j < cData.length; j++) {
            if (formatPhoneForReading(cData[j][4]) === phone && String(cData[j][5]).trim() !== 'موقوف') {
              return { status: 'success', role: 'teacher', darId: darId, classId: cData[j][0], className: cData[j][1], classLevel: cData[j][2], teacherName: cData[j][3] };
            }
          }
        }
      } catch (e) { continue; }
    }

    return { status: 'error', message: 'رقم الجوال غير مسجل في النظام' };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

// ==========================================
// وظائف السوبر ماستر والمشرفة العامة
// ==========================================
function getSupervisors() {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID).getSheetByName('الإشراف');
    const data = sheet.getDataRange().getValues();
    const supervisors = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][3] !== 'محذوف') {
        supervisors.push({ id: data[i][0], name: data[i][1], phone: formatPhoneForReading(data[i][2]), status: data[i][3] });
      }
    }
    return { status: 'success', data: supervisors };
  } catch (e) { return { status: 'error', message: e.message }; }
}

function saveSupervisorToDb(name, phone) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID).getSheetByName('الإشراف');
    sheet.appendRow(['ADM-' + Date.now(), name, formatPhoneForStorage(phone), 'نشط']);
    return { status: 'success' };
  } catch (e) { return { status: 'error', message: e.message }; }
}

function updateSupervisorInDb(id, name, phone, status) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID).getSheetByName('الإشراف');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        sheet.getRange(i + 1, 2, 1, 3).setValues([[name, formatPhoneForStorage(phone), status]]);
        return { status: 'success' };
      }
    }
    return { status: 'error', message: 'المشرفة غير موجودة' }; 
  } catch (e) { return { status: 'error', message: e.message }; }
}
function getDarsForMaster() {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID).getSheetByName('الدور');
    const data = sheet.getDataRange().getValues();
    const dars = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][7] !== 'محذوف') { 
        dars.push({ id: data[i][0], name: data[i][1], curriculum: data[i][2], managerName: data[i][3], managerPhone: formatPhoneForReading(data[i][4]), darLink: data[i][5], location: data[i][6], status: data[i][7] });
      }
    }
    return { status: 'success', data: dars };
  } catch (error) { return { status: 'error', message: error.message }; }
}

function addNewDarToDb(darName, curriculum, managerName, managerPhone, location) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID).getSheetByName('الدور');
    const data = sheet.getDataRange().getValues();
    for(let i = 1; i < data.length; i++) { 
      if(data[i][1].trim() === darName.trim() && data[i][7] !== 'محذوف') return { status: 'error', message: 'اسم الدار مسجل لدينا مسبقاً.' }; 
    }

    const templateFile = DriveApp.getFileById(CONFIG.TEMPLATE_DB_ID);
    const newFile = templateFile.makeCopy("قاعدة بيانات: " + darName);
    sheet.appendRow([newFile.getId(), darName, curriculum, managerName, formatPhoneForStorage(managerPhone), newFile.getUrl(), location, "نشط"]);
    return { status: 'success', message: 'تم إنشاء قاعدة بيانات الدار بنجاح.' };
  } catch (e) { return { status: 'error', message: e.message }; }
}

function updateDarInfoFull(darId, name, curriculum, manager, phone, location, status) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID).getSheetByName('الدور');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === darId) {
        sheet.getRange(i + 1, 2, 1, 7).setValues([[name, curriculum, manager, formatPhoneForStorage(phone), data[i][5], location, status]]);
        return { status: 'success' };
      }
    }
    return { status: 'error', message: 'الدار غير موجودة' };
  } catch(e) { return { status: 'error', message: e.message }; }
}

function deleteDarFromDb(darId) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID).getSheetByName('الدور');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === darId) {
        sheet.getRange(i + 1, 8).setValue('محذوف');
        return { status: 'success' };
      }
    }
    return { status: 'error', message: 'الدار غير موجودة' }; 
  } catch (e) { return { status: 'error', message: e.message }; }
}

function getAdvancedDarStats(darId) {
  try {
    const darDb = SpreadsheetApp.openById(darId);
    const classSheet = darDb.getSheetByName('الفصول_والمعلمات');
    const studentSheet = darDb.getSheetByName('الطالبات');
    const trackingSheet = darDb.getSheetByName('الرصد_اليومي');
    
    let classesCount = classSheet ? Math.max(0, classSheet.getLastRow() - 1) : 0;
    let totalStudents = 0, activeStudents = 0;
    
    if (studentSheet) {
        const sData = studentSheet.getDataRange().getValues();
        totalStudents = Math.max(0, sData.length - 1);
        for(let i=1; i<sData.length; i++) {
          if(sData[i][4] === 'نشط') activeStudents++;
        }
    }

    let attendanceCount = 0, completionCount = 0, totalRecords = 0;
    if (trackingSheet) {
        const tData = trackingSheet.getDataRange().getValues();
        totalRecords = Math.max(0, tData.length - 1);
        for(let i=1; i<tData.length; i++) {
            if(tData[i][5] === 'حاضرة') attendanceCount++;
            if(tData[i][7] === 'أتقنت') completionCount++;
        }
    }

    let attendanceRate = totalRecords > 0 ? Math.round((attendanceCount / totalRecords) * 100) : 0;
    let completionRate = totalRecords > 0 ? Math.round((completionCount / totalRecords) * 100) : 0;
    let overallRate = Math.round((attendanceRate + completionRate) / 2);

    return { status: 'success', data: { totalStudents, activeStudents, classesCount, attendanceRate, completionRate, overallRate } };
  } catch(e) { return { status: 'error', message: "عذراً، لم تكتمل ملفات هذه الدار للقيام بالعملية." }; }
}

function saveExamToDb(darId, date, link) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID).getSheetByName('الاختبارات');
    sheet.appendRow(['EXM-' + Date.now(), "عام", darId, date, link]);
    return { status: 'success' };
  } catch (e) { return { status: 'error', message: e.message }; }
}

function saveAlertToDb(darId, title, content) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID).getSheetByName('التنبيهات');
    const date = new Date().toLocaleDateString('en-GB');
    sheet.appendRow(['MSG-' + Date.now(), darId, date, title, content]);
    return { status: 'success' };
  } catch (e) { return { status: 'error', message: e.message }; }
}

// ==========================================
// وظائف مديرة الدار (Manager)
function getClassesForManager(darId) {
  try {
    const darDb = SpreadsheetApp.openById(darId);
    const classes = darDb.getSheetByName('الفصول_والمعلمات').getDataRange().getValues();
    const studentSheet = darDb.getSheetByName('الطالبات');
    const students = studentSheet ? studentSheet.getDataRange().getValues() : [];
    const res = [];

    for (let i = 1; i < classes.length; i++) {
      let sCount = 0;
      for (let j = 1; j < students.length; j++) {
        if (students[j][2] === classes[i][0] && students[j][4] === 'نشط') sCount++; 
      }
      res.push({
        id:           classes[i][0],
        name:         classes[i][1],
        level:        classes[i][2],
        teacherName:  classes[i][3],
        teacherPhone: formatPhoneForReading(classes[i][4]),
        status:       classes[i][5],
        studentCount: sCount
      });
    }
    return { status: 'success', data: res };
  } catch (e) { return { status: 'error', message: e.message }; }
}

function saveClassToDb(darId, name, level, teacher, phone) {
  try {
    const sheet = SpreadsheetApp.openById(darId).getSheetByName('الفصول_والمعلمات');
    sheet.appendRow(['CLS-' + Date.now(), name, level, teacher, formatPhoneForStorage(phone), "نشط"]);
    return { status: 'success' };
  } catch (e) { return { status: 'error', message: e.message }; }
}

function updateClassInDb(darId, classId, name, level, teacher, phone) {
  try {
    const sheet = SpreadsheetApp.openById(darId).getSheetByName('الفصول_والمعلمات');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === classId) {
        sheet.getRange(i + 1, 2, 1, 4).setValues([[name, level, teacher, formatPhoneForStorage(phone)]]);
        return { status: 'success' };
      }
    }
    return { status: 'error', message: 'الفصل غير موجود' };
  } catch (e) { return { status: 'error', message: e.message }; }
}

function suspendClassInDb(darId, classId) {
  try {
    const sheet = SpreadsheetApp.openById(darId).getSheetByName('الفصول_والمعلمات');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === classId) {
        sheet.getRange(i + 1, 6).setValue('موقوف');
        return { status: 'success' };
      }
    }
    return { status: 'error', message: 'الفصل غير موجود' }; 
  } catch (e) { return { status: 'error', message: e.message }; }
}
function activateClassInDb(darId, classId) {
  try {
    const sheet = SpreadsheetApp.openById(darId).getSheetByName('الفصول_والمعلمات');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === classId) {
        sheet.getRange(i + 1, 6).setValue('نشط');
        return { status: 'success' };
      }
    }
    return { status: 'error', message: 'الفصل غير موجود' }; 
  } catch (e) { return { status: 'error', message: e.message }; }
}

function deleteClassFromDb(darId, classId) {
  try {
    const sheet = SpreadsheetApp.openById(darId).getSheetByName('الفصول_والمعلمات');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === classId) {
        sheet.deleteRow(i + 1);
        return { status: 'success' };
      }
    }
    return { status: 'error', message: 'الفصل غير موجود' }; 
  } catch (e) { return { status: 'error', message: e.message }; }
}
function saveDynamicStudentsToDb(darId, classId, studentsArray) {
  try {
    const sheet = SpreadsheetApp.openById(darId).getSheetByName('الطالبات');
    const rows = studentsArray.map((s, index) => {
      return [
        'STU-' + Date.now() + '-' + index,
        s.name.trim(),              
        classId,                    
        formatPhoneForStorage(s.phone),
        'نشط'
      ];
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
    return { status: 'success' };
  } catch (e) { return { status: 'error', message: e.message }; }
}
function getClassStatsFromDb(darId, classId) {
  try {
    const darDb = SpreadsheetApp.openById(darId);
    const stuData   = darDb.getSheetByName('الطالبات').getDataRange().getValues();
    const trackData = darDb.getSheetByName('الرصد_اليومي').getDataRange().getValues();

    const classStudentIds = [];
    let activeCount = 0;
    for (let i = 1; i < stuData.length; i++) {
      if (stuData[i][2] === classId) {               
        classStudentIds.push(stuData[i][0]);
        if (stuData[i][4] === 'نشط') activeCount++;  
      }
    }

    let att = 0, comp = 0, total = 0;
    for (let i = 1; i < trackData.length; i++) {
      if (classStudentIds.includes(trackData[i][3])) {
        total++;
        if (trackData[i][5] === 'حاضرة') att++;
        if (trackData[i][7] === 'أتقنت') comp++;
      }
    }

    let attRate  = total > 0 ? Math.round((att  / total) * 100) : 0;
    let compRate = total > 0 ? Math.round((comp / total) * 100) : 0;
    return { status: 'success', data: { studentCount: activeCount, attendanceRate: attRate, completionRate: compRate } };
  } catch (e) { return { status: 'error', message: e.message }; }
}
// 1. تحديث دالة جلب التنبيهات (لدمج سجل القراءة)
function getAdminAlertsForDar(darId) {
  try {
    const masterDb = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID);
    const darDb = SpreadsheetApp.openById(darId);
    let alerts = [];
    const cleanDarId = String(darId).trim();

    // جلب التنبيهات المقروءة مسبقاً
    let readIds = [];
    const readSheet = darDb.getSheetByName('سجل_القراءة');
    if (readSheet) {
      const readData = readSheet.getDataRange().getValues();
      for (let i = 1; i < readData.length; i++) readIds.push(String(readData[i][0]).trim());
    }

    const msgSheet = masterDb.getSheetByName('التنبيهات');
    if (msgSheet) {
       const msgData = msgSheet.getDataRange().getValues();
       for (let i = 1; i < msgData.length; i++) {
         let target = String(msgData[i][1]).trim();
         if (target === 'الكل' || target === cleanDarId) {
           let id = String(msgData[i][0] || '');
           let rawDate = msgData[i][2];
           let dateStr = (rawDate instanceof Date) ? rawDate.toLocaleDateString('en-GB') : String(rawDate || '');
           alerts.push({ id: id, type: 'msg', date: dateStr, title: String(msgData[i][3] || ''), content: String(msgData[i][4] || ''), isRead: readIds.includes(id) });
         }
       }
    }

    const examSheet = masterDb.getSheetByName('الاختبارات');
    if (examSheet) {
       const examData = examSheet.getDataRange().getValues();
       for (let i = 1; i < examData.length; i++) {
         let target = String(examData[i][2]).trim();
         if (target === 'الكل' || target === cleanDarId) {
           let id = String(examData[i][0] || '');
           let rawDate = examData[i][3];
           let dateStr = (rawDate instanceof Date) ? rawDate.toLocaleDateString('en-GB') : String(rawDate || '');
           alerts.push({ id: id, type: 'exam', date: dateStr, link: String(examData[i][4] || ''), title: (String(examData[i][1] || '').trim() === 'الكل' ? 'اختبار مركزي' : 'اختبار للدار'), isRead: readIds.includes(id) });
         }
       }
    }
    
    alerts.reverse();
    return { status: 'success', data: alerts };
  } catch (e) { return { status: 'error', message: 'خطأ في جلب التنبيهات: ' + e.message }; }
}
// ==========================================
// وظائف المعلمة (Teacher)
// ==========================================
function getDailyLessonPlan(level, week, day) {
  try {
    const masterDb = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID);
    const planSheet = masterDb.getSheetByName('المناهج');
    const data = planSheet.getDataRange().getValues();
    const cleanLevel = String(level).replace('أ','ا').trim();
    
    for (let i = 1; i < data.length; i++) {
      let rowLevel = String(data[i][0]).replace('أ','ا').trim();
      if (rowLevel === cleanLevel && String(data[i][1]) === String(week) && String(data[i][2]) === String(day)) {
        return { status: 'success', educational: data[i][3], homework: data[i][4], tarbawi: data[i][5] || "" };
      }
    }
    return { status: 'error', message: 'لم يتم العثور على خطة مسجلة لهذا اليوم.' };
  } catch (e) { return { status: 'error', message: e.message }; }
}

function saveDailyTrackingToDb(darId, classId, date, week, day, trackingData) {
  // قفل السيرفر لمنع التداخل (Concurrency)
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // الانتظار حتى 10 ثوانٍ إذا كان السيرفر مشغولاً

    const sheet = SpreadsheetApp.openById(darId).getSheetByName('الرصد_اليومي');
    const data = sheet.getDataRange().getValues();
    
    // تحويل مصفوفة الرصد إلى كائن (Object) لسرعة البحث
    let trackMap = {};
    trackingData.forEach(t => trackMap[t.studentId] = t);

    // 1. تحديث البيانات السابقة (إن وجدت)
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim() === String(week).trim() && String(data[i][2]).trim() === String(day).trim()) {
        let sId = String(data[i][3]).trim();
        if (trackMap[sId]) {
          // تحديث (الحضور، الواجب، التعليمي، التربوي، المرفق) في نفس الصف القديم
          sheet.getRange(i + 1, 6, 1, 5).setValues([[
            trackMap[sId].attendance,
            trackMap[sId].homework,
            trackMap[sId].educational,
            trackMap[sId].tarbawi,
            trackMap[sId].attachment
          ]]);
          delete trackMap[sId]; // حذف الطالبة من القائمة بعد التحديث
        }
      }
    }

    // 2. إضافة بيانات الطالبات الجديدات اللاتي لم يتم رصدهن مسبقاً في هذا اليوم
    let newRows = [];
    for (let sId in trackMap) {
      let t = trackMap[sId];
      newRows.push([date, week, day, t.studentId, t.studentName, t.attendance, t.homework, t.educational, t.tarbawi, t.attachment]);
    }
    
    if (newRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    }

    //توثيق إنجاز اليوم في الفهرس
    logClassDayAsTracked(darId, classId, week, day);
    return { status: 'success' };
    
  } catch(e) {
    return { status: 'error', message: e.message };
  } finally {
    // فتح القفل دائماً بعد الانتهاء
    lock.releaseLock();
  }
}
// 2. دالة حفظ قراءة التنبيه
function markAlertAsRead(darId, alertId) {
  try {
    const sheet = SpreadsheetApp.openById(darId).getSheetByName('سجل_القراءة');
    sheet.appendRow([alertId]);
    return { status: 'success' };
  } catch (e) { return { status: 'error', message: e.message }; }
}

// 3. دالة تمرير الإشعار للمعلمات
function forwardAlertToTeachers(darId, title, content, targetClassId) {
  try {
    const sheet = SpreadsheetApp.openById(darId).getSheetByName('إشعارات_المعلمات');
    const dateStr = new Date().toLocaleDateString('en-GB');
    const alertId = 'FWA-' + Date.now();
    // ترتيب الأعمدة: ID | التاريخ | العنوان | المحتوى أو الرابط | الفصل_المستهدف
    sheet.appendRow([alertId, dateStr, title, content, targetClassId]);
    return { status: 'success' };
  } catch (e) { return { status: 'error', message: e.message }; }
}
function getAllStudentsForManager(darId) {
  try {
    const darDb = SpreadsheetApp.openById(darId);
    const classes = darDb.getSheetByName('الفصول_والمعلمات').getDataRange().getValues();
    const students = darDb.getSheetByName('الطالبات').getDataRange().getValues();

    let classMap = {};
    for (let i = 1; i < classes.length; i++) {
      classMap[classes[i][0]] = classes[i][1] + ' (أ. ' + classes[i][3] + ')';
    }

    let res = [];
    for (let i = 1; i < students.length; i++) {
      let status = String(students[i][4]).trim();
      if (status !== 'محذوف') {
        res.push({
          id:        students[i][0],
          name:      students[i][1],              
          classId:   students[i][2],              
          className: classMap[students[i][2]] || 'فصل محذوف', 
          phone:     formatPhoneForReading(students[i][3]),
          status:    status
        });
      }
    }
    return { status: 'success', data: res };
  } catch (e) { return { status: 'error', message: e.message }; }
}
// 2. تعديل بيانات الطالبة
function updateStudentInDb(darId, studentId, classId, name, phone) {
  try {
    const sheet = SpreadsheetApp.openById(darId).getSheetByName('الطالبات');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === studentId) {
        sheet.getRange(i + 1, 2, 1, 3).setValues([[name, classId, formatPhoneForStorage(phone)]]);
        return { status: 'success' };
      }
    }
    return { status: 'error', message: 'الطالبة غير موجودة' }; 
  } catch (e) { return { status: 'error', message: e.message }; }
}

// 3. تعليق / تنشيط الطالبة
function toggleStudentStatusInDb(darId, studentId, status) {
  try {
    const sheet = SpreadsheetApp.openById(darId).getSheetByName('الطالبات');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === studentId) {
        sheet.getRange(i + 1, 5).setValue(status);
        return { status: 'success' };
      }
    }
    return { status: 'error', message: 'الطالبة غير موجودة' }; 
  } catch (e) { return { status: 'error', message: e.message }; }
}

// 4. حذف الطالبة نهائياً
function deleteStudentFromDb(darId, studentId) {
  try {
    const sheet = SpreadsheetApp.openById(darId).getSheetByName('الطالبات');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === studentId) {
        sheet.deleteRow(i + 1);
        return { status: 'success' };
      }
    }
    return { status: 'error', message: 'الطالبة غير موجودة' }; 
  } catch (e) { return { status: 'error', message: e.message }; }
}
// دالة خفيفة جداً: تجلب طالبات فصل محدد فقط بدلاً من جلب الجميع
function getStudentsByClassForManager(darId, classId) {
  try {
    const sheet = SpreadsheetApp.openById(darId).getSheetByName('الطالبات');
    const data = sheet.getDataRange().getValues();
    let res = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === classId && String(data[i][4]).trim() !== 'محذوف') { 
        res.push({
          id:      data[i][0],
          name:    data[i][1],                          
          classId: data[i][2],                          
          phone:   formatPhoneForReading(data[i][3]),
          status:  data[i][4]
        });
      }
    }
    return { status: 'success', data: res };
  } catch (e) { return { status: 'error', message: e.message }; }
}

// ==========================================
// وظائف إدارة الملفات والمجلدات
// ==========================================
function getOrCreateFolder(parentFolder, folderName) {
  let folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return parentFolder.createFolder(folderName);
  }
}

function uploadFileAndGetUrl(darId, className, lessonName, fileName, base64Data, mimeType) {
  try {
    // 1. استخراج اسم الدار من ملف الماستر
    const masterDb = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID);
    const darSheet = masterDb.getSheetByName('الدور');
    const darsData = darSheet.getDataRange().getValues();
    let darName = "دار غير محددة";
    for (let i = 1; i < darsData.length; i++) {
      if (darsData[i][0] === darId) {
        darName = String(darsData[i][1]).trim();
        break;
      }
    }

    // 2. بناء شجرة المجلدات في درايف
    const baseFolderId = "1K37grJSXo5s1hHFN-JIOY6hA3n4xWw1z";
    const baseFolder = DriveApp.getFolderById(baseFolderId);
    
    // إنشاء أو جلب المجلدات بالتسلسل
    const darFolder = getOrCreateFolder(baseFolder, darName);
    const classFolder = getOrCreateFolder(darFolder, className);
    
    // تطهير اسم الدرس من الرموز الممنوعة في تسمية المجلدات
    const safeLessonName = String(lessonName).replace(/[\\/:*?"<>|]/g, "_") || "مرفقات عامة";
    const lessonFolder = getOrCreateFolder(classFolder, safeLessonName);

    // 3. فك تشفير الملف وإنشائه (الدرايف يقبل تكرار الأسماء برمجياً ولن يستبدل القديم)
    let decoded = Utilities.base64Decode(base64Data);
    let blob = Utilities.newBlob(decoded, mimeType, fileName);
    let file = lessonFolder.createFile(blob);
    
    return { status: 'success', url: file.getUrl() };
  } catch (e) {
    return { status: 'error', message: 'فشل رفع الملف: ' + e.message };
  }
}
// 1. الدالة المحدثة السريعة جداً (تقرأ من الفهرس بدلاً من الرصد اليومي)
function getTrackedDaysForWeek(darId, classId, week) {
  try {
    const sheet = SpreadsheetApp.openById(darId).getSheetByName('حالة_الدروس');
    if (!sheet) return { status: 'success', data: [] }; // إذا لم تُنشأ الورقة بعد
    
    const data = sheet.getDataRange().getValues();
    let trackedDays = [];

    // نبدأ من 1 لتخطي العناوين
    for (let i = 1; i < data.length; i++) {
      // تطابق معرف الفصل والأسبوع
      if (String(data[i][0]).trim() === String(classId).trim() && 
          String(data[i][1]).trim() === String(week).trim()) {
        trackedDays.push(String(data[i][2]).trim()); // جلب اليوم
      }
    }
    return { status: 'success', data: trackedDays };
  } catch(e) {
    return { status: 'error', message: e.message };
  }
}

// 2. دالة مساعدة تكتب في الفهرس (تُستدعى عند حفظ الرصد)
function logClassDayAsTracked(darId, classId, week, day) {
  try {
    const sheet = SpreadsheetApp.openById(darId).getSheetByName('حالة_الدروس');
    if (!sheet) return;
    
    // نتحقق أولاً حتى لا نكرر كتابة نفس اليوم لنفس الفصل
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(classId).trim() && 
          String(data[i][1]).trim() === String(week).trim() && 
          String(data[i][2]).trim() === String(day).trim()) {
        return; // مسجل مسبقاً، نخرج
      }
    }
    
    // إذا لم يكن مسجلاً، نضيفه
    sheet.appendRow([classId, week, day]);
  } catch(e) {
    console.error("فشل تسجيل حالة الدرس: " + e.message);
  }
}
// ==========================================
// دالة التجميع السريعة لواجهة المعلمة (Batch Request) - Big O(1) Network
// ==========================================
function getTeacherDashboardData(darId, classId) {
  try {
    let data = { alerts: [], students: [] };
    const masterDb = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID);

    const alertSheet = masterDb.getSheetByName('الإشعارات');
    if (alertSheet) {
      const alertData = alertSheet.getDataRange().getValues();
      for (let i = 1; i < alertData.length; i++) {
        let target = String(alertData[i][2]).trim();
        let cleanDarId   = String(darId).trim();
        let cleanClassId = String(classId).trim();
        if (target === 'الكل' || target === cleanDarId || target === cleanClassId) {
          let rawDate = alertData[i][3];
          let dateStr = (rawDate instanceof Date) ? rawDate.toLocaleDateString('en-GB') : String(rawDate || '');
          data.alerts.push({
            title: String(alertData[i][0]).trim(),
            body:  String(alertData[i][1]).trim(),
            date:  dateStr
          });
        }
      }
    }

    const darDb = SpreadsheetApp.openById(darId);
    const stuSheet = darDb.getSheetByName('الطالبات');
    if (stuSheet) {
      const stuData = stuSheet.getDataRange().getValues();
      for (let i = 1; i < stuData.length; i++) {
        if (String(stuData[i][2]).trim() === String(classId).trim() &&
            String(stuData[i][4]).trim() !== 'محذوف') {
          data.students.push({
            id:          String(stuData[i][0]).trim(),
            name:        String(stuData[i][1]).trim(),              
            parentPhone: formatPhoneForReading(stuData[i][3])       
          });
        }
      }
    }
    return { status: 'success', data: data };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}
// ==========================================
// نظام الاختبارات المستقل (Lazy Loading)
// ==========================================

// 1. جلب الاختبارات المتاحة والتي لم يتم رصدها بعد
function getPendingExams(darId, classId) {
  try {
    let pendingExams = [];
    let gradedExams = new Set();
    const cleanDarId = String(darId).trim();
    const cleanClassId = String(classId).trim();

    // جلب الاختبارات المرصودة مسبقاً لهذا الفصل (لإخفائها)
    const darDb = SpreadsheetApp.openById(darId);
    const historySheet = darDb.getSheetByName('سجل_الاختبارات');
    if (historySheet) {
      const historyData = historySheet.getDataRange().getValues();
      for (let i = 1; i < historyData.length; i++) {
        if (String(historyData[i][0]).trim() === cleanClassId) {
          gradedExams.add(String(historyData[i][1]).trim()); // حفظ معرف الاختبار المرصود
        }
      }
    }

    // جلب الاختبارات من الإشراف العام
    const masterDb = SpreadsheetApp.openById(CONFIG.MASTER_DB_ID);
    const examSheet = masterDb.getSheetByName('الاختبارات');
    if (examSheet) {
      const examData = examSheet.getDataRange().getValues();
      for (let i = 1; i < examData.length; i++) {
        let examId = String(examData[i][0]).trim();
        let target = String(examData[i][2]).trim();
        
        // التحقق من الاستهداف (الكل، الدار، الفصل) + عدم وجوده في قائمة المرصود
        if ((target === 'الكل' || target === cleanDarId || target === cleanClassId) && !gradedExams.has(examId)) {
          let rawDate = examData[i][3];
          let dateStr = (rawDate instanceof Date) ? rawDate.toLocaleDateString('en-GB') : String(rawDate || '');
          pendingExams.push({
            id: examId,
            title: String(examData[i][1]).trim(),
            date: dateStr
          });
        }
      }
    }
    return { status: 'success', data: pendingExams };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

// 2. حفظ درجات الاختبار
function saveExamGrades(darId, classId, examId, examTitle, gradesData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = SpreadsheetApp.openById(darId).getSheetByName('سجل_الاختبارات');
    if (!sheet) throw new Error("ورقة 'سجل_الاختبارات' غير موجودة.");

    const today = new Date().toLocaleDateString('en-GB');
    let rowsToAppend = [];

    // تحضير مصفوفة البيانات (معرف الفصل، معرف الاختبار، اسم الاختبار، التاريخ، الطالبة، الدرجة)
    gradesData.forEach(student => {
      rowsToAppend.push([classId, examId, examTitle, today, student.name, student.score]);
    });

    if (rowsToAppend.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
    }
    
    return { status: 'success' };
  } catch (e) {
    return { status: 'error', message: e.message };
  } finally {
    lock.releaseLock();
  }
}
// ==========================================
// دالة حساب مؤشرات الطالبة للتقرير الشامل لولي الأمر
// ==========================================
function generateStudentReportData(darId, classId, studentName) {
  try {
    const darDb = SpreadsheetApp.openById(darId);
    
    // 1. حساب نسبة الحضور والإنجاز من (الرصد_اليومي)
    const trackingSheet = darDb.getSheetByName('الرصد_اليومي');
    let totalDays = 0, presentDays = 0;
    let totalTasks = 0, completedTasks = 0;
    
    if (trackingSheet) {
      const data = trackingSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][4]).trim() === String(studentName).trim()) {
          totalDays++;
          if (String(data[i][5]).trim() === 'حاضرة') presentDays++;
          
          // حساب الإنجاز (التعليمي والواجب) للطالبة الحاضرة فقط
          if (String(data[i][5]).trim() !== 'غائبة') {
            totalTasks += 2; 
            if (String(data[i][6]).trim() === 'أنجزت') completedTasks++;
            if (String(data[i][7]).trim() === 'أتقنت') completedTasks++;
          }
        }
      }
    }
    
    let attRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
    let compRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    // 2. حساب متوسط الاختبارات من (سجل_الاختبارات)
    const examsSheet = darDb.getSheetByName('سجل_الاختبارات');
    let totalExamScore = 0, examCount = 0;
    
    if (examsSheet) {
      const eData = examsSheet.getDataRange().getValues();
      for (let i = 1; i < eData.length; i++) {
        if (String(eData[i][0]).trim() === String(classId).trim() && String(eData[i][4]).trim() === String(studentName).trim()) {
          let score = parseFloat(eData[i][5]);
          if (!isNaN(score)) {
            totalExamScore += score;
            examCount++;
          }
        }
      }
    }
    
    let examRate = examCount > 0 ? Math.round(totalExamScore / examCount) : 0;
    
    return { 
      status: 'success', 
      data: { attRate: attRate, compRate: compRate, examRate: examRate }
    };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}