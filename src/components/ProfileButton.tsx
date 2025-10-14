"use client";

import { useWallet } from '@txnlab/use-wallet-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { User } from 'lucide-react';

export function ProfileButton() {
  const { activeAddress } = useWallet();
  const navigate = useNavigate();

  if (!activeAddress) {
    return null;
  }

  const handleProfileClick = () => {
    navigate(`/profile/${activeAddress}`);
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleProfileClick} className="text-muted-foreground hover:text-foreground">
      <User className="h-5 w-5" />
      <span className="sr-only">Go to profile</span>
    </Button>
  );
}