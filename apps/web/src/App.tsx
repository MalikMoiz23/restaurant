import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Launcher } from './screens/Launcher';
import { CustomerApp } from './screens/customer/CustomerApp';
import { KitchenApp } from './screens/kitchen/KitchenApp';
import { CounterApp } from './screens/counter/CounterApp';
import { useAuth } from './store';

export function App() {
  const restore = useAuth((s) => s.restore);

  useEffect(() => {
    void restore();
  }, [restore]);

  return (
    <Routes>
      <Route path="/" element={<Launcher />} />
      <Route path="/mesa/:tableNumber/*" element={<CustomerApp />} />
      <Route path="/cozinha" element={<KitchenApp />} />
      <Route path="/balcao/*" element={<CounterApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
