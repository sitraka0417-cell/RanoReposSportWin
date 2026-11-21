// Calculs du sport (objectif hebdomadaire, répartition par jour, série)
import { startOfDay, addDays, mondayOf, weekdayIndex } from './util.js';

export function sportStats(sports, prefs, now = Date.now()) {
  const weekFrom = mondayOf(now);
  const weekTo = addDays(weekFrom, 7);
  const weekRecs = sports.filter((s) => s.ts >= weekFrom && s.ts < weekTo);
  const weekSec = weekRecs.reduce((a, r) => a + r.sec, 0);
  const dayStart = startOfDay(now);
  const todayRecs = sports.filter((s) => s.ts >= dayStart && s.ts < addDays(dayStart, 1));
  const todaySec = todayRecs.reduce((a, r) => a + r.sec, 0);
  const goalSec = prefs.sportGoalMin * 60;
  const leftSec = Math.max(0, goalSec - weekSec);
  const todayIdx = weekdayIndex(now);
  const daysLeft = 7 - todayIdx;

  const days = Math.max(1, prefs.sportSplitDays);
  const perDayMin = Math.ceil(prefs.sportGoalMin / days);
  const byDay = new Map();
  weekRecs.forEach((r) => {
    const k = startOfDay(r.ts);
    byDay.set(k, (byDay.get(k) || 0) + r.sec);
  });
  let completedDays = 0;
  byDay.forEach((v) => {
    if (v >= perDayMin * 60) completedDays++;
  });

  let targetSec = 0;
  if (prefs.sportSplit) {
    if (prefs.sportSplitCustom) targetSec = (prefs.sportDayMin[todayIdx] || 0) * 60;
    else if (completedDays >= days && todaySec < perDayMin * 60) targetSec = 0;
    else targetSec = perDayMin * 60;
  }

  const sportDays = new Set(sports.map((s) => startOfDay(s.ts)));
  let streak = 0;
  let cur = dayStart;
  if (!sportDays.has(cur)) cur = addDays(cur, -1);
  while (sportDays.has(cur)) {
    streak++;
    cur = addDays(cur, -1);
  }

  return { weekSec, weekRecs, todaySec, todayRecs, goalSec, leftSec, todayIdx, daysLeft, perDayMin, completedDays, targetSec, streak };
}
