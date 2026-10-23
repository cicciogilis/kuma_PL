import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import WorkoutTools from './WorkoutTools';

const Harness = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('open')) return undefined;

    const timer = window.setTimeout(() => {
      document.querySelector('.wt-fab')?.click();
    }, 120);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <p className="harness-note">Workout tools harness</p>
      <WorkoutTools />
    </>
  );
};

createRoot(document.getElementById('root')).render(<Harness />);
