"use client";

import React from 'react';
import { Link } from 'react-router-dom';

export function Index() {
  return (
    <div className="p-4 md:p-8 text-center">
      <h1 className="text-4xl font-bold mb-4 gradient-text">Welcome to Algojects</h1>
      <p className="text-muted-foreground mb-8">
        A decentralized social platform for projects.
      </p>
      <p>
        This is the home page. You can now navigate to user profiles.
      </p>
      <p className="mt-4">
        Try visiting a profile by manually changing the URL to `/profile/YOUR_WALLET_ADDRESS`.
      </p>
    </div>
  );
}