import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { Onboarding } from './screens/Onboarding';
import { Contract } from './screens/Contract';
import { Arranque } from './screens/Arranque';
import { Progress } from './screens/Progress';
import { Review } from './screens/Review';
import { MyData } from './screens/MyData';
import { StoreProvider, useStore } from './state/store';
import { pendingToday } from './state/stats';
import { updateAppBadge } from './pwa';
import type { Screen } from './types';

function Shell() {
  const { state, activeContract } = useStore();
  const needsOnboarding = !state.profile;
  const needsContract = !!state.profile && !activeContract;
  const [screen, setScreen] = useState<Screen>('arranque');

  // Número en el icono de la app instalada: compromisos pendientes hoy.
  useEffect(() => {
    updateAppBadge(pendingToday(state));
  }, [state]);

  // "Mis datos" es accesible siempre: también sin perfil (para restaurar una
  // copia tras perder los datos) y cuando toca firmar el contrato de la semana.
  if (screen === 'datos') {
    return (
      <Layout screen="datos" onNavigate={setScreen}>
        <MyData onNavigate={setScreen} />
      </Layout>
    );
  }

  if (needsOnboarding) {
    return <Onboarding onRestore={() => setScreen('datos')} />;
  }

  if (needsContract && screen !== 'contrato' && screen !== 'revision') {
    // Sin contrato esta semana no tiene sentido preparar la siguiente:
    // se firma primero la actual (con el formulario prellenado).
    return (
      <Layout screen="contrato" onNavigate={setScreen}>
        <Contract onSaved={() => setScreen('arranque')} />
      </Layout>
    );
  }

  return (
    <Layout screen={screen === 'contrato-proxima' ? 'contrato' : screen} onNavigate={setScreen}>
      {screen === 'arranque' && <Arranque onNavigate={setScreen} />}
      {screen === 'progreso' && <Progress onNavigate={setScreen} />}
      {screen === 'contrato' && <Contract onSaved={() => setScreen('arranque')} />}
      {screen === 'contrato-proxima' && (
        <Contract target="next" onSaved={() => setScreen('revision')} />
      )}
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
