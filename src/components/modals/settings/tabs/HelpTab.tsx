'use client';

import React from 'react';
import { ArrowUpRight, BookOpen, Bug, LifeBuoy, Plug, Rocket, Shield, Wrench } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import type { UiLanguage } from '@/i18n/messages';
import { CalmeHeading } from '../shared/CalmeControls';

const DOCS = 'https://docs.nasdash.lucas-homelab.fr';
const DOCS_HOST = new URL(DOCS).host;
const REPOSITORY = 'https://github.com/lucas-lepajollec/nasdash';

/** A page of the documentation, in the interface language. */
export function docsUrl(language: UiLanguage, page = ''): string {
  return `${DOCS}/${language}/docs${page ? `/${page}` : ''}`;
}

const TOPICS = [
  { id: 'start', icon: Rocket, page: 'getting-started' },
  { id: 'guide', icon: BookOpen, page: 'guide' },
  { id: 'integrations', icon: Plug, page: 'integrations' },
  { id: 'operations', icon: Wrench, page: 'operations' },
  { id: 'security', icon: Shield, page: 'operations/security' },
  { id: 'troubleshooting', icon: LifeBuoy, page: 'operations/troubleshooting' },
] as const;

/** Help: the main topics of the documentation, and where to report a problem. */
export function HelpTab() {
  const { t, language } = useI18n();
  return (
    <div className="ndc-set-page">
      <section className="ndc-set-block">
        <CalmeHeading info={t('help.docsHint')}>{t('help.docs')}</CalmeHeading>
        <div className="ndc-help-grid">
          {TOPICS.map(topic => {
            const Icon = topic.icon;
            return (
              <a key={topic.id} className="ndc-help-card" href={docsUrl(language, topic.page)} target="_blank" rel="noopener noreferrer">
                <span className="ndc-help-icon"><Icon size={16} /></span>
                <span className="ndc-help-text">
                  <span className="ndc-help-title">{t(`help.${topic.id}`)}</span>
                  <span className="ndc-help-desc">{t(`help.${topic.id}Desc`)}</span>
                </span>
                <ArrowUpRight size={13} className="ndc-help-arrow" aria-hidden="true" />
              </a>
            );
          })}
        </div>
      </section>
      <section className="ndc-set-block">
        <CalmeHeading>{t('help.more')}</CalmeHeading>
        <div className="ndc-help-grid">
          <a className="ndc-help-card" href={`${REPOSITORY}/issues`} target="_blank" rel="noopener noreferrer">
            <span className="ndc-help-icon"><Bug size={16} /></span>
            <span className="ndc-help-text"><span className="ndc-help-title">{t('help.issue')}</span><span className="ndc-help-desc">{t('help.issueDesc')}</span></span>
            <ArrowUpRight size={13} className="ndc-help-arrow" aria-hidden="true" />
          </a>
          <a className="ndc-help-card" href={docsUrl(language)} target="_blank" rel="noopener noreferrer">
            <span className="ndc-help-icon"><BookOpen size={16} /></span>
            <span className="ndc-help-text"><span className="ndc-help-title">{t('help.allDocs')}</span><span className="ndc-help-desc">{DOCS_HOST}</span></span>
            <ArrowUpRight size={13} className="ndc-help-arrow" aria-hidden="true" />
          </a>
        </div>
      </section>
    </div>
  );
}
