import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { AcademicTermStatus, PrismaClient } from '@prisma/client';

/**
 * تنظيف لمرة واحدة داخل الحاوية — لا يستورد من src/.
 * يبقي: User + CurriculumPlan + CurriculumLevel + SystemSetting
 * التشغيل:
 *   CONFIRM=تنظيف_البيانات npx tsx prisma/clean-except-accounts.ts
 */
const CONFIRM = 'تنظيف_البيانات';

async function main() {
  if (process.env.CONFIRM !== CONFIRM) {
    console.error(`ارفض التشغيل دون تأكيد. عيّن: CONFIRM=${CONFIRM}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const deleted: Record<string, number> = {};
    const count = async (key: string, fn: () => Promise<{ count: number }>) => {
      deleted[key] = (await fn()).count;
    };

    await prisma.$transaction(async (tx) => {
      await count('teacherNotificationRead', () => tx.teacherNotificationRead.deleteMany());
      await count('alertRead', () => tx.alertRead.deleteMany());
      await count('dailyTracking', () => tx.dailyTracking.deleteMany());
      await count('lessonTracked', () => tx.lessonTracked.deleteMany());
      await count('weekAttachment', () => tx.weekAttachment.deleteMany());
      await count('examGrade', () => tx.examGrade.deleteMany());
      await count('exam', () => tx.exam.deleteMany());
      await count('teacherNotification', () => tx.teacherNotification.deleteMany());
      await count('alert', () => tx.alert.deleteMany());
      await count('student', () => tx.student.deleteMany());

      deleted.usersUnlinked = (
        await tx.user.updateMany({ data: { darId: null, classId: null } })
      ).count;

      await tx.dar.updateMany({ data: { supervisorId: null } });
      await count('class', () => tx.class.deleteMany());
      await count('dar', () => tx.dar.deleteMany());
      await count('academicTerm', () => tx.academicTerm.deleteMany());

      await tx.academicTerm.create({
        data: {
          name: 'الفصل الحالي',
          status: AcademicTermStatus.ACTIVE,
          startsAt: new Date(),
        },
      });
    });

    const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
    let uploadsCleared = false;
    if (fs.existsSync(uploadDir)) {
      for (const entry of fs.readdirSync(uploadDir)) {
        fs.rmSync(path.join(uploadDir, entry), { recursive: true, force: true });
      }
      uploadsCleared = true;
    }

    console.log('تم التنظيف مع الإبقاء على الحسابات والمنهج والأوزان.');
    console.log(JSON.stringify({ deleted, uploadsCleared }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
