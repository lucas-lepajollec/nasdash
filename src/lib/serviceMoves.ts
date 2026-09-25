import type { Category } from './types';

/**
 * Moving services between categories, independent of where the categories are
 * displayed. Behaviour matches the historical Home grid:
 * - dropping on a service swaps the two services (also across categories),
 * - dropping on a gap inserts the service at that position,
 * - dropping on an empty category appends it.
 */

export type ServiceDropTarget =
  | { type: 'service-drop'; categoryId: string; serviceId: string }
  | { type: 'service-gap'; categoryId: string; index: number }
  | { type: 'category-empty-drop'; categoryId: string };

export function moveService(
  categories: Category[],
  serviceId: string,
  fromCategoryId: string,
  target: ServiceDropTarget,
): Category[] | null {
  const next = structuredClone(categories);
  const from = next.find(category => category.id === fromCategoryId);
  const to = next.find(category => category.id === target.categoryId);
  if (!from || !to) return null;
  const oldIndex = from.services.findIndex(service => service.id === serviceId);
  if (oldIndex === -1) return null;

  if (target.type === 'service-drop') {
    const newIndex = to.services.findIndex(service => service.id === target.serviceId);
    if (newIndex === -1 || target.serviceId === serviceId) return null;
    const moving = from.services[oldIndex];
    from.services[oldIndex] = to.services[newIndex];
    to.services[newIndex] = moving;
    return next;
  }

  if (target.type === 'service-gap') {
    const [moving] = from.services.splice(oldIndex, 1);
    let insertIndex = Math.max(0, Math.min(target.index, to.services.length + 1));
    if (from.id === to.id && oldIndex < target.index) insertIndex -= 1;
    to.services.splice(Math.min(insertIndex, to.services.length), 0, moving);
    return next;
  }

  if (from.id === to.id) return null;
  const [moving] = from.services.splice(oldIndex, 1);
  to.services.push(moving);
  return next;
}

export function readServiceDropTarget(data: Record<string, unknown> | undefined): ServiceDropTarget | null {
  if (!data || typeof data.categoryId !== 'string') return null;
  if (data.type === 'service-drop' && typeof data.serviceId === 'string') {
    return { type: 'service-drop', categoryId: data.categoryId, serviceId: data.serviceId };
  }
  if (data.type === 'service-gap' && typeof data.index === 'number') {
    return { type: 'service-gap', categoryId: data.categoryId, index: data.index };
  }
  if (data.type === 'category-empty-drop') return { type: 'category-empty-drop', categoryId: data.categoryId };
  return null;
}
