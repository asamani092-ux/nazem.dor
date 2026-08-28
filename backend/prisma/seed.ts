import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, Role } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureActiveTerm } from '../src/lib/terms.js';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  } else {
    console.log('No curriculum.json found, skipped');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
