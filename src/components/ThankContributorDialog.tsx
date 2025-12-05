"use client";

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { UserDisplay } from './UserDisplay';
import { ProjectMetadata } from '@/types/project';
import { cn } from '@/lib/utils';
import { useWallet } from '@txnlab/use-wallet-react';
import { useNfd } from '@/hooks/useNfd';
import { Check, DollarSign, ArrowRight } from 'lucide-react';
import { StyledTextarea } from './ui/StyledTextarea';
import { toast } from "sonner";

const MIN_REWARD_ALGO = 10; // Enforce minimum reward of 10 ALGO
const DEFAULT_REWARD_ALGO = 10;
const MICRO_ALGOS_PER_ALGO = 1_000_000;
const PROMPT_TIMEOUT_MS = 5000; // 5 seconds for wallet prompt

interface ThankContributorDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  contributorAddress: string;
  projectCreatorAddress: string;
  initialMetadata: ProjectMetadata;
  onConfirm: (
    totalRewardAlgos: number,
    contributorShare: number, // percentage 0-100
    newWhitelistedEditors: string
  ) => Promise<void>;
  isConfirming: boolean;
}

export function ThankContributorDialog({
  isOpen,
  onOpenChange,
  projectId,
  projectName,
  contributorAddress,
  projectCreatorAddress,
  initialMetadata,
  onConfirm,
  isConfirming: isExecuting, // Renamed to avoid conflict with local state
}: ThankContributorDialogProps) {
  const { activeAddress } = useWallet();
  const { nfd: contributorNfd } = useNfd(contributorAddress);
  const [isConfirming, setIsConfirming] = useState(false); // Local state for dialog confirmation
  const loadingToastIdRef = useRef<string | null>(null);

  const initialWhitelistedEditors = useMemo(() => {
    return initialMetadata.find(item => item.type === 'whitelisted-editors')?.value || '';
  }, [initialMetadata]);

  const [totalRewardAlgos, setTotalRewardAlgos] = useState(DEFAULT_REWARD_ALGO);
  const [contributorAmountAlgos, setContributorAmountAlgos] = useState(DEFAULT_REWARD_ALGO);
  const [whitelistedEditors, setWhitelistedEditors] = useState(initialWhitelistedEditors);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setTotalRewardAlgos(DEFAULT_REWARD_ALGO);
      setContributorAmountAlgos(DEFAULT_REWARD_ALGO);
      setWhitelistedEditors(initialWhitelistedEditors);
    }
  }, [isOpen, initialWhitelistedEditors]);

  // --- Derived values ---
  const algojectsAmountAlgos = useMemo(() => {
    const amount = totalRewardAlgos - contributorAmountAlgos;
    return parseFloat(Math.max(0, amount).toFixed(2));
  }, [totalRewardAlgos, contributorAmountAlgos]);

  const contributorSharePercentage = useMemo(() => {
    if (totalRewardAlgos === 0) return 0;
    return parseFloat(((contributorAmountAlgos / totalRewardAlgos) * 100).toFixed(1));
  }, [totalRewardAlgos, contributorAmountAlgos]);

  // --- Handlers ---

  const handleTotalRewardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const value = parseFloat(rawValue);

    let newTotal = 0;
    if (rawValue === '') {
      newTotal = 0;
    } else if (!isNaN(value)) {
      newTotal = value;
    }
    
    setTotalRewardAlgos(newTotal);
    // When total changes, constrain contributor amount to the new total
    setContributorAmountAlgos(Math.min(contributorAmountAlgos, newTotal));
  };

  const handleContributorAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const value = parseFloat(rawValue);

    if (rawValue === '') {
      setContributorAmountAlgos(0);
    } else if (!isNaN(value)) {
      // Constrain the input between 0 and totalRewardAlgos
      const constrainedValue = Math.max(0, Math.min(totalRewardAlgos, value));
      setContributorAmountAlgos(constrainedValue);
    }
  };

  const handleSliderChange = (value: number[]) => {
    const percentage = value[0];
    const newAmount = parseFloat(((totalRewardAlgos * percentage) / 100).toFixed(2));
    setContributorAmountAlgos(newAmount);
  };

  const handleConfirmClick = async () => {
    if (totalRewardAlgos < MIN_REWARD_ALGO) {
        alert(`Total reward must be at least ${MIN_REWARD_ALGO} ALGO.`);
        return;
    }
    
    setIsConfirming(true);
    loadingToastIdRef.current = toast.loading("Preparing claim transaction... Please check your wallet.");
    
    // NEW: Set short timer for wallet prompt
    const promptTimer = setTimeout(() => {
        toast.info("If the request didn't show up, reconnect your wallet and try again.", { duration: 10000 });
    }, PROMPT_TIMEOUT_MS);

    try {
        // The actual transaction execution happens inside onConfirm (which calls thankContributorAndClaimProject)
        await onConfirm(totalRewardAlgos, contributorSharePercentage, whitelistedEditors);
        
        clearTimeout(promptTimer); // Clear prompt timer on success
        // Success toast is handled inside the calling component (ProjectDetailCard)
        onOpenChange(false);
    } catch (error) {
        clearTimeout(promptTimer); // Clear prompt timer on failure
        console.error(error);
        toast.error(error instanceof Error ? error.message : "An unknown error occurred during execution.", { id: loadingToastIdRef.current });
    } finally {
        setIsConfirming(false);
        loadingToastIdRef.current = null;
    }
  };

  const canConfirm = !isExecuting && totalRewardAlgos >= MIN_REWARD_ALGO && !isConfirming;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] bg-card text-foreground p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="gradient-text">Thank Contributor</DialogTitle>
          <DialogDescription>
            Finalize details and reward the contributor for adding <strong>{projectName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Contributor Info */}
          <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
            <Label className="text-sm text-muted-foreground">Contributor:</Label>
            <UserDisplay address={contributorAddress} textSizeClass="text-sm" avatarSizeClass="h-6 w-6" linkTo={null} />
          </div>

          {/* Total Reward Input */}
          <div className="space-y-1">
            <Label htmlFor="totalReward" className="text-sm font-semibold flex items-center gap-1">
              <DollarSign className="h-4 w-4" /> Total Reward (ALGO)
            </Label>
            <Input
              id="totalReward"
              type="number"
              step="0.01"
              min={MIN_REWARD_ALGO}
              value={totalRewardAlgos}
              onChange={handleTotalRewardChange}
              disabled={isExecuting || isConfirming}
              className="bg-muted/50 font-numeric h-9"
            />
            <p className={cn("text-xs", totalRewardAlgos < MIN_REWARD_ALGO ? "text-red-500" : "text-muted-foreground")}>
              Minimum reward: {MIN_REWARD_ALGO} ALGO.
            </p>
          </div>

          <Separator className="my-1" />

          {/* Reward Split Input & Slider */}
          <div className="space-y-2">
            
            {/* Contributor Amount Input */}
            <div className="space-y-1">
                <Label htmlFor="contributorAmount" className="text-sm font-semibold text-hodl-blue">
                    Contributor Share (ALGO)
                </Label>
                <Input
                    id="contributorAmount"
                    type="number"
                    step="0.01"
                    min={0}
                    max={totalRewardAlgos}
                    value={contributorAmountAlgos}
                    onChange={handleContributorAmountChange}
                    disabled={isExecuting || isConfirming}
                    className="bg-muted/50 font-numeric text-hodl-blue h-9"
                />
                <p className="text-xs text-muted-foreground">
                    Max: {totalRewardAlgos.toFixed(2)} ALGO.
                </p>
            </div>

            {/* Percentage Display above Slider */}
            <div className="flex justify-between text-xs font-semibold pt-1">
                <span className="text-hodl-blue">Contributor ({contributorSharePercentage.toFixed(1)}%)</span>
                <span className="text-hodl-purple">AlgoJects ({(100 - contributorSharePercentage).toFixed(1)}%)</span>
            </div>

            {/* Slider (now controlled by amount) */}
            <Slider
              value={[contributorSharePercentage]}
              onValueChange={handleSliderChange}
              max={100}
              step={0.1}
              disabled={isExecuting || isConfirming}
              className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
            />

            {/* Calculated Amounts - Condensed Display */}
            <div className="flex justify-between text-sm font-numeric pt-1">
              <div className="flex flex-col items-start">
                <span className="font-bold text-hodl-blue">{contributorAmountAlgos.toFixed(2)} ALGO</span>
                <p className="text-xs text-muted-foreground">To Contributor</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-bold text-hodl-purple">{algojectsAmountAlgos.toFixed(2)} ALGO</span>
                <p className="text-xs text-muted-foreground">To AlgoJects</p>
              </div>
            </div>
          </div>

          <Separator className="my-1" />

          {/* Whitelist Editor */}
          <div className="space-y-2">
            <Label htmlFor="whitelistedEditors" className="text-sm font-semibold">
              Whitelisted Editors (Addresses/NFDs)
            </Label>
            <StyledTextarea
              id="whitelistedEditors"
              placeholder="e.g., ADDRESS1, my.nfd, another.nfd"
              value={whitelistedEditors}
              onChange={(e) => setWhitelistedEditors(e.target.value)}
              disabled={isExecuting || isConfirming}
              onSubmit={() => {}}
              isSubmitDisabled={true}
              className="bg-muted/50 min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExecuting || isConfirming}>
            Cancel
          </Button>
          <Button onClick={handleConfirmClick} disabled={!canConfirm}>
            {isConfirming || isExecuting ? "Sending..." : "Send Reward & Claim"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}