import { useEffect } from 'preact/hooks';
import type { ComponentType } from 'preact';
import type { KeyboardSession } from '../core/types';
import { BusyBar } from './components/BusyBar';
import { ConnectScreen } from './components/ConnectScreen';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Nav } from './components/Nav';
import { Toasts } from './components/Toasts';
import { pagesFor } from './lib/pages';
import { AdvancedPage } from './pages/AdvancedPage';
import { KeymapPage } from './pages/KeymapPage';
import { LightingPage } from './pages/LightingPage';
import { MacrosPage } from './pages/MacrosPage';
import { PerformancePage } from './pages/PerformancePage';
import { SettingsPage } from './pages/SettingsPage';
import { initConnection } from './state/connection';
import { page, type PageId } from './state/route';
import { activeProfile, profileTarget, session } from './state/session';

export interface PageProps {
  session: KeyboardSession;
  profile: number;
}

const PAGES: Record<PageId, ComponentType<PageProps>> = {
  keymap: KeymapPage,
  performance: PerformancePage,
  advanced: AdvancedPage,
  lighting: LightingPage,
  macros: MacrosPage,
  settings: SettingsPage,
};

function Workspace({ s }: { s: KeyboardSession }) {
  const pages = pagesFor(s.model);
  const current = pages.some((p) => p.id === page.value)
    ? page.value
    : 'keymap';
  const Page = PAGES[current];
  const profile = activeProfile.value;
  return (
    <>
      <Header session={s} />
      <div class="workspace">
        <Nav pages={pages} current={current} />
        <main
          class="page"
          id="main"
          tabIndex={-1}
          inert={profileTarget.value !== null}
          aria-busy={profileTarget.value !== null}
        >
          {/* keyed so page-local state (selection, drafts) resets on profile change */}
          <Page key={`${current}/${profile}`} session={s} profile={profile} />
        </main>
      </div>
    </>
  );
}

export function App() {
  useEffect(() => initConnection(), []);
  const s = session.value;
  return (
    <div class="app">
      <a class="skip-link" href="#main">
        Skip to content
      </a>
      <section aria-label="Keyboard activity">
        <BusyBar />
      </section>
      {s ? (
        <Workspace key={`${s.model.pid}/${s.isDemo}`} s={s} />
      ) : (
        <ConnectScreen />
      )}
      <Footer />
      <Toasts />
    </div>
  );
}
