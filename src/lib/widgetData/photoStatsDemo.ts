import type { IntegrationInstance } from '@/lib/types';
import type { PhotoStatsProvider, PhotoStatsResponse } from './contracts';
/** All fields are fictional and local, including account names. */
export function demoPhotoStats(instance: IntegrationInstance): PhotoStatsResponse {
  return { provider: instance.type as PhotoStatsProvider, name: instance.name, photos: 12400, videos: 380, albums: 42, people: 68, places: 126, favorites: 840,
    libraryBytes: 184000000000, disk: { usedBytes: 640000000000, totalBytes: 2000000000000 },
    byYear: [{ year: 2022, count: 1860 }, { year: 2023, count: 2400 }, { year: 2024, count: 3360 }, { year: 2025, count: 4120 }, { year: 2026, count: 1040 }],
    added: Array.from({ length: 30 }, (_, i) => 4 + (i * 17) % 43),
    users: [{ name: 'Alex', photos: 7200, videos: 240, bytes: 112000000000 }, { name: 'Robin', photos: 5200, videos: 140, bytes: 72000000000 }],
    fetchedAt: Date.UTC(2026, 0, 15, 12) };
}
