/** مشجّرة المنهج في الواجهة — الأوراق فقط تُختار كمستوى فصل/خطة. O(n) */

export type CurriculumKind = 'TIBYAN' | 'QARI';

export type CurriculumTreeNode = {
  name: string;
  label: string;
  curriculum: CurriculumKind;
  isLeaf: boolean;
  children: CurriculumTreeNode[];
};

/** تُحمَّل من /api/master/curriculum/tree — قيمة ابتدائية للأوراق */
export const DEFAULT_LEAF_LEVELS = [
  'روضة — الفصل الأول',
  'روضة — الفصل الثاني',
  'تمهيدي — الفصل الأول',
  'تمهيدي — الفصل الثاني',
  'ابتدائي سنة أولى — الفصل الأول',
  'ابتدائي سنة أولى — الفصل الثاني',
  'ابتدائي سنة ثانية — الفصل الأول',
  'ابتدائي سنة ثانية — الفصل الثاني',
  'تمهيدي صباحي — الفصل الأول',
  'تمهيدي صباحي — الفصل الثاني',
  'تمهيدي مسائي — الفصل الأول',
  'تمهيدي مسائي — الفصل الثاني',
  'ابتدائي أولية سنة أولى — الفصل الأول',
  'ابتدائي أولية سنة أولى — الفصل الثاني',
  'ابتدائي أولية سنة ثانية — الفصل الأول',
  'ابتدائي أولية سنة ثانية — الفصل الثاني',
  'روضة مسائي — الفصل الأول',
  'روضة مسائي — الفصل الثاني',
  'تمهيدي مسائي سنتين — الفصل الأول',
  'تمهيدي مسائي سنتين — الفصل الثاني',
] as const;

export const LEVELS_BY_CURRICULUM: Record<string, string[]> = {
  TIBYAN: DEFAULT_LEAF_LEVELS.filter((n) =>
    ['روضة —', 'تمهيدي —', 'ابتدائي سنة'].some((p) => n.startsWith(p)),
  ) as string[],
  QARI: DEFAULT_LEAF_LEVELS.filter((n) =>
    ['تمهيدي صباحي', 'تمهيدي مسائي', 'ابتدائي أولية', 'روضة مسائي', 'تمهيدي مسائي سنتين'].some((p) =>
      n.startsWith(p),
    ),
  ) as string[],
  BOTH: [...DEFAULT_LEAF_LEVELS],
  'منهج تبيان': [],
  'منهج قارئ': [],
  كلاهما: [...DEFAULT_LEAF_LEVELS],
  'تبيان/قارئ': [...DEFAULT_LEAF_LEVELS],
};

LEVELS_BY_CURRICULUM['منهج تبيان'] = LEVELS_BY_CURRICULUM.TIBYAN;
LEVELS_BY_CURRICULUM['منهج قارئ'] = LEVELS_BY_CURRICULUM.QARI;

/** جمع الأوراق من شجرة API. O(n) */
export function collectLeaves(nodes: CurriculumTreeNode[]): string[] {
  const out: string[] = [];
  const walk = (list: CurriculumTreeNode[]) => {
    for (const n of list) {
      if (n.isLeaf) out.push(n.name);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}
