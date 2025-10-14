"use client";

import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { Index } from './pages/Index';
import { UserProfile } from './pages/UserProfile';
import { ProjectPage } from './pages/ProjectPage';
import { StickyHeader } from './components/StickyHeader';
import { MobileBottomBar } from './components/MobileBottomBar';
import { useSocialData } from './hooks/useSocialData';
import { AppDisplayModeProvider, useAppContextDisplayMode } from './contexts/AppDisplayModeContext';
import { Toaster } from 'sonner';

const AppContent = () => {
  const { projects, refetch } = useSocialData();
  const { isMobile } = useAppContextDisplayMode();
  const navigate = useNavigate();

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/');
    window.scrollTo(0, 0);
  };

  return (
    <>
      <StickyHeader onLogoClick={handleLogoClick} />
      <main className="pt-16 container mx-auto px-4 pb-20 md:pb-4">
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/profile/:userAddress" element={<UserProfile />} />
          <Route path="/project/:projectId" element={<ProjectPage />} />
        </Routes>
      </main>
      {isMobile && <MobileBottomBar projects={projects} onInteractionSuccess={refetch} />}
      <Toaster richColors position="bottom-right" />
    </>
  );
};

function App() {
  return (
    <AppDisplayModeProvider>
      <Router>
        <AppContent />
      </Router>
    </AppDisplayModeProvider>
  );
}

export default App;