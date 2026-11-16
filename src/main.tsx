import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles.css';
import rawPlan from './data/plan.json';
import { parsePlan, type Plan } from './schema';
import { App } from './App';

const root = createRoot(document.getElementById('root')!);

let plan: Plan | null = null;
let error = '';
try {
  plan = parsePlan(rawPlan);
} catch (e) {
  error = e instanceof Error ? e.message : String(e);
}

root.render(
  <StrictMode>
    {plan ? (
      <App plan={plan} />
    ) : (
      <main className="app">
        <section className="plan-error">
          <h1>The training plan file has a problem</h1>
          <p>Fix src/data/plan.json and reload. Details:</p>
          <pre>{error}</pre>
        </section>
      </main>
    )}
  </StrictMode>,
);
