import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { AcademicTermStatus, PrismaClient, Role } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Inline — لا تستورد من src/ لأن صورة Docker لا تحتويها (Time O(1), Space O(1)). */
async function ensureActiveTerm() {
  const existing = await prisma.academicTerm.findFirst({
    where: { status: AcademicTermStatus.ACTIVE },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return existing;
  return prisma.academicTerm.create({
    data: {
      name: 'الفصل الحالي',
      status: AcademicTermStatus.ACTIVE,
      startsAt: new Date(),
    },
  });
}

async function main() {
  await ensureActiveTerm();

  const phone = process.env.SEED_SUPER_PHONE || '0555143246';
  const password = process.env.SEED_SUPER_PASSWORD || 'Nazem@123';
  const name = process.env.SEED_SUPER_NAME || 'مدير النظام';
  // دور GENERAL_DIRECTOR يُنشأ يدوياً من واجهة مدير النظام — لا بذرة افتراضية.

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (!existing) {
    await prisma.user.create({
      data: {
        phone,
        name,
        role: Role.SUPER_MASTER,
        passwordHash: await bcrypt.hash(password, 10),
        mustChangePassword: false,
      },
    });
    console.log(`Created SUPER_MASTER — login with phone only: ${phone}`);
  } else {
    await prisma.user.update({
      where: { phone },
      data: { mustChangePassword: false },
    });
    console.log(`SUPER_MASTER already exists — login with phone only: ${phone}`);
  }

  // مشجّرة المستويات فارغة من الخطط — من JSON داخل prisma (بدون استيراد src/)
  type FlatLevel = {
    name: string;
    label: string;
    curriculum: 'TIBYAN' | 'QARI';
    parentName: string | null;
    isLeaf: boolean;
    sortOrder: number;
  };
  const levelsPath = path.join(__dirname, 'curriculum-levels.json');
  if (fs.existsSync(levelsPath)) {
    const flat = JSON.parse(fs.readFileSync(levelsPath, 'utf8')) as FlatLevel[];
    const plansCleared = (await prisma.curriculumPlan.deleteMany({})).count;
    await prisma.curriculumLevel.deleteMany({});
    const idByName = new Map<string, string>();
    for (const row of flat) {
      const created = await prisma.curriculumLevel.create({
        data: {
          name: row.name,
          label: row.label,
          curriculum: row.curriculum,
          parentId: row.parentName ? idByName.get(row.parentName) ?? null : null,
          isLeaf: row.isLeaf,
          sortOrder: row.sortOrder,
        },
      });
      idByName.set(row.name, created.id);
    }
    console.log(`Curriculum tree synced: ${flat.length} levels, plans cleared: ${plansCleared}`);
  } else {
    console.log('No curriculum-levels.json — skipped tree sync');
  }

  const curriculumPath = path.join(__dirname, 'curriculum.json');
  if (fs.existsSync(curriculumPath)) {
    const rows = JSON.parse(fs.readFileSync(curriculumPath, 'utf8')) as Array<{
      level: string;
      week: number;
      day: string;
      educational: string;
      homework: string;
      tarbawi: string;
    }>;
    if (!rows.length) {
      console.log('curriculum.json empty — plans left empty');
    } else {
      let upserted = 0;
      const cleanHomework = (v: string) => {
        const t = String(v ?? '').trim();
        if (!/^-?\d+(\.\d+)?$/.test(t)) return t;
        const n = Number(t);
        if (!Number.isFinite(n)) return t;
        return Number.isInteger(n) ? String(n) : String(n);
      };
      for (const row of rows) {
        const homework = cleanHomework(String(row.homework));
        await prisma.curriculumPlan.upsert({
          where: {
            level_week_day: { level: row.level, week: row.week, day: row.day },
          },
          create: {
            level: row.level,
            week: row.week,
            day: row.day,
            educational: row.educational,
            homework,
            tarbawi: row.tarbawi || '',
          },
          update: {
            educational: row.educational,
            homework,
            tarbawi: row.tarbawi || '',
          },
        });
        upserted++;
      }
      console.log(`Curriculum plans upserted: ${upserted}`);
    }
  } else {
    console.log('No curriculum.json found, plans left empty');
  }


  // ترحيل مستويات الفصول القديمة → أوراق المشجّرة (بدون استيراد src/)
  const legacyMap: Record<string, string> = {
    'تمهيدي 1': 'تمهيدي — الفصل الأول',
    'تمهيدي 2': 'تمهيدي — الفصل الثاني',
    'صفوف أولية 1': 'ابتدائي أولية سنة أولى — الفصل الأول',
    'صفوف أولية 2': 'ابتدائي أولية سنة أولى — الفصل الثاني',
    'صفوف أولية 3': 'ابتدائي أولية سنة ثانية — الفصل الأول',
    'تمهيدي صباحي': 'تمهيدي صباحي — الفصل الأول',
    'تمهيدي مسائي': 'تمهيدي مسائي — الفصل الأول',
    روضة: 'روضة — الفصل الأول',
  };
  const classes = await prisma.class.findMany({ select: { id: true, level: true } });
  let classMigrated = 0;
  for (const cls of classes) {
    const next = legacyMap[cls.level];
    if (next && next !== cls.level) {
      await prisma.class.update({ where: { id: cls.id }, data: { level: next } });
      classMigrated++;
    }
  }
  console.log(`Class levels migrated: ${classMigrated}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
