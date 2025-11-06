"use client";

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Governance = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-foreground">
      <div className="text-center max-w-md mx-auto">
        <h1 className="text-4xl font-bold gradient-text mb-4">Governance</h1>
        <p className="text-lg text-muted-foreground mb-6">
          This page will contain information about AlgoJects governance, proposals, and community decision-making.
        </p>
        <Link to="/" className="inline-flex items-center text-primary hover:underline">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
        </Link>
      </div>
    </div>
  );
};

export default Governance;