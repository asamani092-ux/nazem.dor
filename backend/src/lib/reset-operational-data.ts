import fs from 'node:fs';
import path from 'node:path';
import { AcademicTermStatus, type PrismaClient } from '@prisma/client';

const DEFAULT_TERM_NAME = 'الفصل الحالي';

export type ResetOperationalResult = {
  deleted: Record<string, number>;
  usersUnlinked: number;
  uploadsCleared: boolean;
  activeTermId: string;
};

/**
 * مسح البيانات التشغيلية مع الإبقاء على: User + Curriculum* + SystemSetting.
 * Time O(n) على الجداول التشغيلية؛ Space O(1).
 */
export async function resetOperationalData(
  prisma: PrismaClient,
  opts?: { uploadDir?: string },
): Promise<ResetOperationalResult> {
  const deleted: Record<string, number> = {};
  let usersUnlinked = 0;

  await prisma.$transaction(async (tx) => {
    deleted.teacherNotificationRead = (await tx.teacherNotificationRead.deleteMany()).count;
    deleted.alertRead = (await tx.alertRead.deleteMany()).count;
    deleted.dailyTracking = (await tx.dailyTracking.deleteMany()).count;
    deleted.lessonTracked = (await tx.lessonTracked.deleteMany()).count;
    deleted.weekAttachment = (await tx.weekAttachment.deleteMany()).count;
    deleted.examGrade = (await tx.examGrade.deleteMany()).count;
    deleted.exam = (await tx.exam.deleteMany()).count;
    deleted.teacherNotification = (await tx.teacherNotification.deleteMany()).count;
    deleted.alert = (await tx.alert.deleteMany()).count;
    deleted.student = (await tx.student.deleteMany()).count;

    usersUnlinked = (await tx.user.updateMany({ data: { darId: null, classId: null } })).count;

    await tx.dar.updateMany({ data: { supervisorId: null } });
    deleted.class = (await tx.class.deleteMany()).count;
    deleted.dar = (await tx.dar.deleteMany()).count;
    deleted.academicTerm = (await tx.academicTerm.deleteMany()).count;

    await tx.academicTerm.create({
      data: {
        name: DEFAULT_TERM_NAME,
        status: AcademicTermStatus.ACTIVE,
        startsAt: new Date(),
      },
    });
  });

  const active = await prisma.academicTerm.findFirst({
    where: { status: AcademicTermStatus.ACTIVE },
    orderBy: { createdAt: 'desc' },
  });
  if (!active) {
    throw new Error('FAILED_TO_CREATE_ACTIVE_TERM');
  }

  let uploadsCleared = false;
  const uploadDir = path.resolve(opts?.uploadDir || process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
  if (fs.existsSync(uploadDir)) {
    for (const entry of fs.readdirSync(uploadDir)) {
      fs.rmSync(path.join(uploadDir, entry), { recursive: true, force: true });
    }
    uploadsCleared = true;
  }

  return {
    deleted,
    usersUnlinked,
    uploadsCleared,
    activeTermId: active.id,
  };
}
