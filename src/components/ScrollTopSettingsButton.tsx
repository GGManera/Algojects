"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SettingsDialog } from './SettingsDialog';
import { cn } from '@/lib/utils';
import { useSocialData } from '@/hooks/useSocialData';
import { useProjectDetails } from '@/hooks/useProjectDetails';
import { useAccountData } from '@/hooks/useAccountData';
import { useWallet } from '@txnlab/use-wallet-react';

export function ScrollTopSettingsButton() {
  // This component is no longer needed as SettingsDialog is moved to the Footer.
  // Keeping it as a placeholder for now, but it will render nothing.
  return null;
}