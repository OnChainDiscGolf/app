import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { BottomNav } from './components/BottomNav';
import { Home } from './pages/Home';
import { Scorecard } from './pages/Scorecard';
import { Wallet } from './pages/Wallet';
import { Profile } from './pages/Profile';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-brand-dark text-white font-sans antialiased selection:bg-brand-primary selection:text-black pb-safe">
      <div className="max-w-md mx-auto min-h-screen relative bg-brand-dark shadow-2xl overflow-hidden flex flex-col">
        <div className="flex-1 flex flex-col relative">
          {children}
        </div>
        <BottomNav />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <MemoryRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/play" element={<Scorecard />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </Layout>
      </MemoryRouter>
    </AppProvider>
  );
};

export default App;