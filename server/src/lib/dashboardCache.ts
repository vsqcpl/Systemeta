interface CacheEntry {
  data: any;
  timestamp: number;
  role: string;
  userId: string;
}

const dashboardCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds TTL

export function getDashboardCacheKey(userId: string, role: string): string {
  return `${userId}:${role}`;
}

export function getCachedDashboard(userId: string, role: string): any | null {
  const key = getDashboardCacheKey(userId, role);
  const entry = dashboardCache.get(key);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    dashboardCache.delete(key);
    return null;
  }
  
  return entry.data;
}

export function setDashboardCache(userId: string, role: string, data: any): void {
  const key = getDashboardCacheKey(userId, role);
  dashboardCache.set(key, {
    data,
    timestamp: Date.now(),
    role,
    userId
  });
}

export function invalidateDashboardCache(): void {
  dashboardCache.clear();
}
