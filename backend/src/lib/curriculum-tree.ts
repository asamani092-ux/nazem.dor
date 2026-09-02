/**
 * مشجّرة مستويات المنهج (فارغة من الخطط).
 * البناء: O(n) زمنًا ومكانًا حيث n = عدد العقد.
 */

export type CurriculumKind = 'TIBYAN' | 'QARI';

export type CurriculumTreeNode = {
  /** اسم فريد مستقر يُخزَّن في Class.level و CurriculumPlan.level عند الورقة */
  name: string;
  label: string;
  curriculum: CurriculumKind;
  children?: CurriculumTreeNode[];
};

/** جذور المشجرة حسب المنهج — الأوراق فقط تُستخدم كمستوى فصل/خطة */
export const CURRICULUM_TREE: CurriculumTreeNode[] = [
  {
    name: 'تبيان/روضة',
    label: 'روضة',
    curriculum: 'TIBYAN',
    children: [
      { name: 'روضة — الفصل الأول', label: 'الفصل الأول', curriculum: 'TIBYAN' },
      { name: 'روضة — الفصل الثاني', label: 'الفصل الثاني', curriculum: 'TIBYAN' },
    ],
  },
  {
    name: 'تبيان/تمهيدي',
    label: 'تمهيدي',
    curriculum: 'TIBYAN',
    children: [
      { name: 'تمهيدي — الفصل الأول', label: 'الفصل الأول', curriculum: 'TIBYAN' },
      { name: 'تمهيدي — الفصل الثاني', label: 'الفصل الثاني', curriculum: 'TIBYAN' },
    ],
  },
  {
    name: 'تبيان/ابتدائي',
    label: 'ابتدائي',
    curriculum: 'TIBYAN',
    children: [
      {
        name: 'تبيان/ابتدائي/السنة الأولى',
        label: 'السنة الأولى',
        curriculum: 'TIBYAN',
        children: [
          { name: 'ابتدائي سنة أولى — الفصل الأول', label: 'الفصل الأول', curriculum: 'TIBYAN' },
          { name: 'ابتدائي سنة أولى — الفصل الثاني', label: 'الفصل الثاني', curriculum: 'TIBYAN' },
        ],
      },
      {
        name: 'تبيان/ابتدائي/السنة الثانية',
        label: 'السنة الثانية',
        curriculum: 'TIBYAN',
        children: [
          { name: 'ابتدائي سنة ثانية — الفصل الأول', label: 'الفصل الأول', curriculum: 'TIBYAN' },
          { name: 'ابتدائي سنة ثانية — الفصل الثاني', label: 'الفصل الثاني', curriculum: 'TIBYAN' },
        ],
      },
    ],
  },
  {
    name: 'قارئ/تمهيدي صباحي',
    label: 'تمهيدي صباحي',
    curriculum: 'QARI',
    children: [
      { name: 'تمهيدي صباحي — الفصل الأول', label: 'الفصل الأول', curriculum: 'QARI' },
      { name: 'تمهيدي صباحي — الفصل الثاني', label: 'الفصل الثاني', curriculum: 'QARI' },
    ],
  },
  {
    name: 'قارئ/تمهيدي مسائي',
    label: 'تمهيدي مسائي',
    curriculum: 'QARI',
    children: [
      { name: 'تمهيدي مسائي — الفصل الأول', label: 'الفصل الأول', curriculum: 'QARI' },
      { name: 'تمهيدي مسائي — الفصل الثاني', label: 'الفصل الثاني', curriculum: 'QARI' },
    ],
  },
  {
    name: 'قارئ/ابتدائي صفوف أولية',
    label: 'ابتدائي صفوف أولية (سنة ونصف)',
    curriculum: 'QARI',
    children: [
      {
        name: 'قارئ/ابتدائي/السنة الأولى',
        label: 'السنة الأولى',
        curriculum: 'QARI',
        children: [
          { name: 'ابتدائي أولية سنة أولى — الفصل الأول', label: 'الفصل الأول', curriculum: 'QARI' },
          { name: 'ابتدائي أولية سنة أولى — الفصل الثاني', label: 'الفصل الثاني', curriculum: 'QARI' },
        ],
      },
      {
        name: 'قارئ/ابتدائي/السنة الثانية',
        label: 'السنة الثانية',
        curriculum: 'QARI',
        children: [
          { name: 'ابتدائي أولية سنة ثانية — الفصل الأول', label: 'الفصل الأول', curriculum: 'QARI' },
          { name: 'ابتدائي أولية سنة ثانية — الفصل الثاني', label: 'الفصل الثاني', curriculum: 'QARI' },
        ],
      },
    ],
  },
  {
    name: 'قارئ/روضة وتمهيدي سنتين',
    label: 'روضة + تمهيدي (سنتين)',
    curriculum: 'QARI',
    children: [
      {
        name: 'قارئ/روضة مسائي',
        label: 'روضة مسائي',
        curriculum: 'QARI',
        children: [
          { name: 'روضة مسائي — الفصل الأول', label: 'الفصل الأول', curriculum: 'QARI' },
          { name: 'روضة مسائي — الفصل الثاني', label: 'الفصل الثاني', curriculum: 'QARI' },
        ],
      },
      {
        name: 'قارئ/تمهيدي مسائي سنتين',
        label: 'تمهيدي مسائي (سنتين)',
        curriculum: 'QARI',
        children: [
          { name: 'تمهيدي مسائي سنتين — الفصل الأول', label: 'الفصل الأول', curriculum: 'QARI' },
          { name: 'تمهيدي مسائي سنتين — الفصل الثاني', label: 'الفصل الثاني', curriculum: 'QARI' },
        ],
      },
    ],
  },
];

export type FlatLevelRow = {
  name: string;
  label: string;
  curriculum: CurriculumKind;
  parentName: string | null;
  isLeaf: boolean;
  sortOrder: number;
};

/** تسطيح المشجرة بترتيب عرض مسبق. O(n) */
export function flattenCurriculumTree(tree: CurriculumTreeNode[] = CURRICULUM_TREE): FlatLevelRow[] {
  const out: FlatLevelRow[] = [];
  let order = 0;
  const walk = (nodes: CurriculumTreeNode[], parentName: string | null) => {
    for (const node of nodes) {
      order += 1;
      const hasChildren = Boolean(node.children?.length);
      out.push({
        name: node.name,
        label: node.label,
        curriculum: node.curriculum,
        parentName,
        isLeaf: !hasChildren,
        sortOrder: order,
      });
      if (hasChildren) walk(node.children!, node.name);
    }
  };
  walk(tree, null);
  return out;
}

function isBothCurriculum(curriculum: string): boolean {
  return curriculum === 'BOTH' || curriculum === 'كلاهما' || curriculum === 'تبيان/قارئ';
}

function isTibyanCurriculum(curriculum: string): boolean {
  return curriculum === 'TIBYAN' || curriculum === 'منهج تبيان';
}

function isQariCurriculum(curriculum: string): boolean {
  return curriculum === 'QARI' || curriculum === 'منهج قارئ';
}

/** أوراق المنهج فقط — ما يُختار للفصل/الخطة. O(n) */
export function leafLevelsForCurriculum(curriculum: string): string[] {
  const leaves = flattenCurriculumTree().filter((r) => r.isLeaf);
  if (isBothCurriculum(curriculum)) return leaves.map((r) => r.name);
  if (isTibyanCurriculum(curriculum)) return leaves.filter((r) => r.curriculum === 'TIBYAN').map((r) => r.name);
  if (isQariCurriculum(curriculum)) return leaves.filter((r) => r.curriculum === 'QARI').map((r) => r.name);
  return leaves.map((r) => r.name);
}

export type CurriculumTreeDto = {
  name: string;
  label: string;
  curriculum: CurriculumKind;
  isLeaf: boolean;
  children: CurriculumTreeDto[];
};

/** تحويل التعريف إلى شجرة للواجهة. O(n) */
export function curriculumTreeDto(tree: CurriculumTreeNode[] = CURRICULUM_TREE): CurriculumTreeDto[] {
  return tree.map((node) => ({
    name: node.name,
    label: node.label,
    curriculum: node.curriculum,
    isLeaf: !node.children?.length,
    children: node.children ? curriculumTreeDto(node.children) : [],
  }));
}
