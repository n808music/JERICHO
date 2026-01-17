type Block = {
  id?: string;
  label?: string;
  start?: string;
  end?: string;
  status?: string;
  domain?: string;
  practice?: string;
};

type BlocksByDay = Map<string, Block[]>;

function isCompleted(block: Block) {
  return block?.status === 'completed' || block?.status === 'complete';
}

export function getBlocksForDay(dayKey: string, blocksByDay: BlocksByDay) {
  return blocksByDay?.get(dayKey) || [];
}

export function getDayStats(dayKey: string, blocksByDay: BlocksByDay) {
  const blocks = getBlocksForDay(dayKey, blocksByDay);
  const plannedCount = blocks.length;
  const completedCount = blocks.filter(isCompleted).length;
  const completionRate = plannedCount ? completedCount / plannedCount : 0;
  return {
    dayKey,
    plannedCount,
    completedCount,
    completionRate,
    blocks
  };
}

export function getMonthStats(dayKeys: string[], blocksByDay: BlocksByDay) {
  const stats = dayKeys.map((dayKey) => getDayStats(dayKey, blocksByDay));
  const plannedCount = stats.reduce((sum, d) => sum + d.plannedCount, 0);
  const completedCount = stats.reduce((sum, d) => sum + d.completedCount, 0);
  const completionRate = plannedCount ? completedCount / plannedCount : 0;
  return {
    plannedCount,
    completedCount,
    completionRate,
    dayStats: stats
  };
}

export function getQuarterStats(monthStats: Array<{ plannedCount: number; completedCount: number }>) {
  const plannedCount = monthStats.reduce((sum, m) => sum + (m.plannedCount || 0), 0);
  const completedCount = monthStats.reduce((sum, m) => sum + (m.completedCount || 0), 0);
  const completionRate = plannedCount ? completedCount / plannedCount : 0;
  return { plannedCount, completedCount, completionRate };
}

export function getYearStats(monthStats: Array<{ plannedCount: number; completedCount: number }>) {
  const plannedCount = monthStats.reduce((sum, m) => sum + (m.plannedCount || 0), 0);
  const completedCount = monthStats.reduce((sum, m) => sum + (m.completedCount || 0), 0);
  const completionRate = plannedCount ? completedCount / plannedCount : 0;
  return { plannedCount, completedCount, completionRate };
}
