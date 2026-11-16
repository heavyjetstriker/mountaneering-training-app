import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/mona-sans';
// GitHub's Primer design tokens: colours, type, sizes. Styles use these only.
import '@primer/primitives/dist/css/base/typography/typography.css';
import '@primer/primitives/dist/css/functional/typography/typography.css';
import '@primer/primitives/dist/css/base/size/size.css';
import '@primer/primitives/dist/css/functional/size/size.css';
import '@primer/primitives/dist/css/functional/size/radius.css';
import '@primer/primitives/dist/css/functional/size/border.css';
import '@primer/primitives/dist/css/functional/themes/dark.css';
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
