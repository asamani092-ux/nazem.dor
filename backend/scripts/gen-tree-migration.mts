import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { flattenCurriculumTree } from '../src/lib/curriculum-tree.ts';

const rows = flattenCurriculumTree();
const id = (name: string) => `cl_${createHash('sha1').update(name).digest('hex').slice(0, 20)}`;
const esc = (s: string) => s.replace(/'/g, "''");

const lines: string[] = [
  '-- مشجّرة مستويات المنهج فارغة من الخطط',
  'DELETE FROM "CurriculumPlan";',
  'ALTER TABLE "CurriculumLevel" ADD COLUMN IF NOT EXISTS "label" TEXT NOT NULL DEFAULT \'\';',
  'ALTER TABLE "CurriculumLevel" ADD COLUMN IF NOT EXISTS "curriculum" "CurriculumType";',
  'ALTER TABLE "CurriculumLevel" ADD COLUMN IF NOT EXISTS "parentId" TEXT;',
  'ALTER TABLE "CurriculumLevel" ADD COLUMN IF NOT EXISTS "isLeaf" BOOLEAN NOT NULL DEFAULT true;',
  'DELETE FROM "CurriculumLevel";',
];

const ids = new Set<string>();
for (const r of rows) {
  const own = id(r.name);
  if (ids.has(own)) throw new Error(`id collision for ${r.name}`);
  ids.add(own);
  const pid = r.parentName ? `'${id(r.parentName)}'` : 'NULL';
  lines.push(
    `INSERT INTO "CurriculumLevel" ("id","name","label","curriculum","parentId","isLeaf","sortOrder") VALUES ('${own}','${esc(r.name)}','${esc(r.label)}','${r.curriculum}',${pid},${r.isLeaf},${r.sortOrder});`,
  );
}

lines.push('ALTER TABLE "CurriculumLevel" ALTER COLUMN "curriculum" SET NOT NULL;');
lines.push(
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CurriculumLevel_parentId_fkey') THEN ALTER TABLE "CurriculumLevel" ADD CONSTRAINT "CurriculumLevel_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CurriculumLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`,
);
lines.push(
  'CREATE INDEX IF NOT EXISTS "CurriculumLevel_curriculum_sortOrder_idx" ON "CurriculumLevel"("curriculum", "sortOrder");',
);
lines.push('CREATE INDEX IF NOT EXISTS "CurriculumLevel_parentId_idx" ON "CurriculumLevel"("parentId");');

writeFileSync(
  new URL('../prisma/migrations/20260902190000_curriculum_tree_empty/migration.sql', import.meta.url),
  `${lines.join('\n')}\n`,
);
console.log('ok', rows.length, 'unique ids', ids.size);
