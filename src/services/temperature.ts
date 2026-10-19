// 温度 → 档位映射
// 依据需求文档 Q17：单日推荐取"感受温度（tempFeels）"的最近档位；边界值同时返回两侧候选。

import { DEFAULT_TEMP_BANDS } from '@/utils/constants';

/**
 * 将连续温度映射到档位候选集合（可能 1 或 2 个）。
 * @param temp 感受温度（℃）
 * @param bands 可用档位（升序，默认 DEFAULT_TEMP_BANDS）
 * @returns 候选档位数组，永远非空
 */
export function mapTempToBands(
  temp: number,
  bands: number[] = DEFAULT_TEMP_BANDS,
): number[] {
  const sorted = [...bands].sort((a, b) => a - b);
  if (sorted.length === 0) return [0];
  if (sorted.length === 1) return [sorted[0]];

  // 找到最近的档位
  let nearestIdx = 0;
  let nearestDist = Infinity;
  for (let i = 0; i < sorted.length; i++) {
    const dist = Math.abs(sorted[i] - temp);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestIdx = i;
    }
  }

  const result = [sorted[nearestIdx]];
  // 边界值（正好在两个档位中点）：返回两侧
  if (nearestIdx > 0 && nearestIdx < sorted.length - 1) {
    const mid = (sorted[nearestIdx] + sorted[nearestIdx + 1]) / 2;
    if (Math.abs(temp - mid) < 0.5) {
      result.push(sorted[nearestIdx + 1]);
    }
  } else if (nearestIdx === 0 && sorted.length > 1) {
    const mid = (sorted[0] + sorted[1]) / 2;
    if (temp <= mid + 0.5) result.push(sorted[1]);
  } else if (nearestIdx === sorted.length - 1 && sorted.length > 1) {
    const mid = (sorted[sorted.length - 2] + sorted[sorted.length - 1]) / 2;
    if (temp >= mid - 0.5) result.push(sorted[sorted.length - 2]);
  }
  return result;
}

/**
 * 单档主档（用于过滤单品 tempBands）：最近的档位。
 */
export function primaryBand(
  temp: number,
  bands: number[] = DEFAULT_TEMP_BANDS,
): number {
  return mapTempToBands(temp, bands)[0];
}

/**
 * 判断某档是否匹配单品 tempBands（用于推荐过滤）。
 * 若单品的 bands 中包含主档或任一候选档即视为匹配。
 */
export function matchesTempBand(
  itemBands: number[],
  candidates: number[],
): boolean {
  if (itemBands.length === 0) return true; // 未标记温度 = 通用
  return candidates.some((c) => itemBands.includes(c));
}
