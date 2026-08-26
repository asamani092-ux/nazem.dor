import { prisma } from './prisma.js';
import { DEFAULT_RATE_WEIGHTS, normalizeWeights, type RateWeights } from './domain.js';

const WEIGHTS_KEY = 'rate_weights';

export async function getRateWeights(): Promise<RateWeights> {
  const row = await prisma.systemSetting.findUnique({ where: { key: WEIGHTS_KEY } });
  if (!row?.value) return { ...DEFAULT_RATE_WEIGHTS };
  try {
    return normalizeWeights(JSON.parse(row.value) as Partial<RateWeights>);
  } catch {
    return { ...DEFAULT_RATE_WEIGHTS };
  }
}

export async function setRateWeights(weights: RateWeights): Promise<RateWeights> {
  const next = normalizeWeights(weights);
  if (next.attendance + next.completion + next.homework !== 100) {
    throw new Error('مجموع الأوزان يجب أن يساوي 100');
  }
  await prisma.systemSetting.upsert({
    where: { key: WEIGHTS_KEY },
    create: { key: WEIGHTS_KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  return next;
}
