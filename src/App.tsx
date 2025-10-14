"use client";

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Index } from './pages/Index';
import { UserProfile } from './pages/UserProfile';
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <Router>
      <main className="min-h-screen bg-background text-foreground">
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/profile/:userAddress" element={<UserProfile />} />
        </Routes>
      </main>
      <Toaster />
    </Router>
  );
}

export default App;