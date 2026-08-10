import { iles } from './data/iles';
import { missionsInitiales } from './data/missions';

function App() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Log Pose</h1>
      <p>{iles.length} îles chargées, {missionsInitiales.length} missions initiales.</p>
    </div>
  );
}

export default App;
