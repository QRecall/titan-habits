import { useState } from 'react';
import { Layout } from './components/Layout';
import { Onboarding } from './screens/Onboarding';
import { Contract } from './screens/Contract';
import { Arranque } from './screens/Arranque';
import { Progress } from './screens/Progress';
import { Review } from './screens/Review';
import { StoreProvider, useStore } from './state/store';
import { currentWeekKey } from './state/date';
import type { Screen } from './types';

function Shell() {
  const { state, activeContract } = useStore();
  const needsOnboarding = !state.profile;
  const needsContract = !!state.profile && activeContract?.weekKey !== currentWeekKey();
  const [screen, setScreen] = useState<Screen>('arranque');

  if (needsOnboarding) {
    return <Onboarding />;
  }

  if (needsContract && screen !== 'contrato' && screen !== 'revision') {
    return (
      <Layout screen="contrato" onNavigate={setScreen}>
        <Contract onSaved={() => setScreen('arranque')} />
      </Layout>
    );
  }

  return (
    <Layout screen={screen} onNavigate={setScreen}>
      {screen === 'arranque' && <Arranque onNavigate={setScreen} />}
      {screen === 'progreso' && <Progress onNavigate={setScreen} />}
      {screen === 'contrato' && <Contract onSaved={() => setScreen('arranque')} />}
      {screen === 'revision' && <Review onNavigate={setScreen} />}
    </Layout>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
