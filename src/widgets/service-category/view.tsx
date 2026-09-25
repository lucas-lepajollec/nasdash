import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import CategoryCard from '@/components/tabs/home/CategoryCard';
import type { WidgetViewProps } from '../types';

/** One category of services; its services move between categories by drag and drop. */
export default function ServiceCategoryView({ instance, editMode, searchQuery, showSensitive, showSecretSections }: WidgetViewProps) {
  const { t } = useI18n();
  const { config, setCategoryModal, setServiceModal } = useConfig();
  const categoryId = typeof instance.settings.categoryId === 'string' ? instance.settings.categoryId : '';
  const category = config?.categories.find(candidate => candidate.id === categoryId);

  if (!category) {
    return editMode ? <div className="nd-page-widget-missing">{t('pages.widget.missingCategory')}</div> : null;
  }
  // Normally filtered out by the page until secret sections are revealed.
  if (category.isSecret && !showSecretSections) return null;

  // Deleting the category itself is done from its edit form; the page only removes views.
  return (
    <CategoryCard
      category={category}
      editMode={editMode}
      searchQuery={searchQuery}
      showSensitive={showSensitive}
      embedded
      dndScope={instance.id}
      onEditCategory={cat => setCategoryModal({ open: true, category: cat })}
      onDeleteCategory={() => undefined}
      onAddService={id => setServiceModal({ open: true, categoryId: id })}
    />
  );
}
