"use client";

import React, { useState, useMemo, useCallback } from 'react';
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

const MIN_REWARD_ALGO = 10; // Enforce minimum reward of 10 ALGO
const DEFAULT_REWARD_ALGO = 10;
const MICRO_ALGOS_PER_ALGO = 1_000_000;

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
  isConfirming,
}: ThankContributorDialogProps) {
  const { activeAddress } = useWallet();
  const { nfd: contributorNfd } = useNfd(contributorAddress);

  const initialWhitelistedEditors = useMemo(() => {
    return initialMetadata.find(item => item.type === 'whitelisted-editors')?.value || '';
  }, [initialMetadata]);

  const [totalRewardAlgos, setTotalRewardAlgos] = useState(DEFAULT_REWARD_ALGO);
  const [contributorShare, setContributorShare] = useState<number[]>([100]); // Percentage 0-100
  const [whitelistedEditors, setWhitelistedEditors] = useState(initialWhitelistedEditors);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setTotalRewardAlgos(DEFAULT_REWARD_ALGO);
      setContributorShare([100]);
      setWhitelistedEditors(initialWhitelistedEditors);
    }
  }, [isOpen, initialWhitelistedEditors]);

  const contributorAmount = useMemo(() => {
    return totalRewardAlgos * (contributorShare[0] / 100);
  }, [totalRewardAlgos, contributorShare]);

  const algojectsAmount = useMemo(() => {
    return totalRewardAlgos - contributorAmount;
  }, [totalRewardAlgos, contributorAmount]);

  const handleTotalRewardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    // Allow input if it's empty or if it's a valid number greater than or equal to MIN_REWARD_ALGO
    if (!isNaN(value) && value >= 0) {
      setTotalRewardAlgos(value);
    } else if (e.target.value === '') {
      setTotalRewardAlgos(0); // Temporarily set to 0 if empty, but validation will prevent submission
    }
  };

  const handleConfirmClick = async () => {
    if (totalRewardAlgos < MIN_REWARD_ALGO) {
        alert(`Total reward must be at least ${MIN_REWARD_ALGO} ALGO.`);
        return;
    }
    await onConfirm(totalRewardAlgos, contributorShare[0], whitelistedEditors);
  };

  const isCreator = activeAddress === projectCreatorAddress;
  const canConfirm = !isConfirming && totalRewardAlgos >= MIN_REWARD_ALGO;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="gradient-text">Thank Contributor</DialogTitle>
          <DialogDescription>
            Finalize details and reward the contributor for adding <strong>{projectName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-3">
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
              className="bg-muted/50 font-numeric"
            />
            <p className="text-xs text-muted-foreground">Minimum reward: {MIN_REWARD_ALGO} ALGO.</p>
          </div>

          <Separator className="my-2" />

          {/* Reward Split Slider */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Reward Split (Total: {totalRewardAlgos.toFixed(2)} ALGO)</Label>
            
            <div className="flex justify-between text-xs font-semibold">
                <span className="text-hodl-blue">Contributor ({contributorShare[0]}%)</span>
                <span className="text-hodl-purple">AlgoJects ({100 - contributorShare[0]}%)</span>
            </div>

            <Slider
              value={contributorShare}
              onValueChange={setContributorShare}
              max={100}
              step={1}
              className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
            />

            <div className="grid grid-cols-2 gap-2 text-center font-numeric">
              <div className="p-2 rounded-md bg-hodl-blue/20">
                <span className="font-bold text-hodl-blue">{contributorAmount.toFixed(2)} ALGO</span>
                <p className="text-xs text-muted-foreground">To Contributor</p>
              </div>
              <div className="p-2 rounded-md bg-hodl-purple/20">
                <span className="font-bold text-hodl-purple">{algojectsAmount.toFixed(2)} ALGO</span>
                <p className="text-xs text-muted-foreground">To AlgoJects</p>
              </div>
            </div>
          </div>

          <Separator className="my-2" />

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
              disabled={isConfirming}
              onSubmit={() => {}}
              isSubmitDisabled={true}
              className="bg-muted/50 min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isConfirming}>
            Cancel
          </Button>
          <Button onClick={handleConfirmClick} disabled={!canConfirm}>
            {isConfirming ? "Sending..." : "Send Reward & Claim"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}