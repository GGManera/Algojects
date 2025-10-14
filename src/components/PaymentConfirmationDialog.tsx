"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useNfd } from '@/hooks/useNfd';
import { useSettings } from '@/hooks/useSettings';
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, DollarSign, Info, Repeat2, ArrowDown } from 'lucide-react';
import { PROTOCOL_ADDRESS } from '@/lib/social';

// Internal component to resolve and display recipient NFD with their role
const RecipientDisplayWithRole = ({ address, role }: { address: string; role: string }) => {
  // Special case for the protocol address
  if (address === PROTOCOL_ADDRESS) {
    return (
      <div className="flex flex-col text-right" title={address}>
        <span className="font-semibold overflow-wrap-anywhere">AlgoJects</span>
        <span className="text-xs text-muted-foreground">{role}</span>
      </div>
    );
  }

  const { nfd, loading } = useNfd(address);

  if (loading) {
    return <Skeleton className="h-4 w-32" />;
  }

  const displayName = nfd?.name || `${address.substring(0, 8)}...`;

  return (
    <div className="flex flex-col text-right" title={address}>
      <span className="font-semibold overflow-wrap-anywhere">{displayName}</span>
      <span className="text-xs text-muted-foreground">{role}</span>
    </div>
  );
};

interface TransactionDisplayItem {
  type: 'pay' | 'axfer';
  from: string;
  to?: string;
  amount?: number;
  assetId?: number;
  note?: string;
  isOptIn?: boolean;
  role?: 'Review Writer' | 'Comment Writer' | 'Reply Writer' | 'Protocol';
}

interface PaymentConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: TransactionDisplayItem[];
  onConfirm: () => void;
  isConfirming: boolean;
}

const microAlgosToAlgos = (microAlgos: number) => microAlgos / 1_000_000;

export function PaymentConfirmationDialog({
  isOpen,
  onOpenChange,
  transactions,
  onConfirm,
  isConfirming,
}: PaymentConfirmationDialogProps) {
  const { updateSetting } = useSettings();
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [detailedView, setDetailedView] = useState(false);

  const handleConfirm = () => {
    if (dontShowAgain) {
      updateSetting('showTransactionConfirmation', false);
    }
    onConfirm();
  };

  const totalPaymentAmount = transactions.reduce((sum, tx) => {
    if (tx.type === 'pay' && tx.amount !== undefined) {
      return sum + tx.amount;
    }
    return sum;
  }, 0);

  const transactionFee = transactions.length * 1000; // 0.001 ALGO per transaction in microAlgos
  const totalCostInMicroAlgos = totalPaymentAmount + transactionFee;

  const paymentRecipients = transactions.filter(tx => tx.type === 'pay' && tx.to && tx.amount !== undefined && tx.amount > 0);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="gradient-text">Confirm Transaction(s)</DialogTitle>
          <DialogDescription>
            Review the details before sending the request to your wallet.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-end space-x-2">
          <Label htmlFor="view-mode">{detailedView ? 'Detailed' : 'Simplified'}</Label>
          <Switch
            id="view-mode"
            checked={detailedView}
            onCheckedChange={setDetailedView}
            aria-label="Toggle detailed view"
          />
        </div>

        <ScrollArea className="h-[300px] pr-4">
          {detailedView ? (
            // DETAILED VIEW
            <div className="grid gap-4 py-4">
              {transactions.map((tx, index) => (
                <div key={index} className="border rounded-md p-3 bg-muted/30 relative">
                  <div className="absolute top-2 right-2 text-xs text-muted-foreground font-mono">Tx {index + 1}</div>
                  <div className="flex items-center gap-2 mb-2">
                    {tx.type === 'pay' ? <DollarSign className="h-4 w-4 text-green-400" /> : <Repeat2 className="h-4 w-4 text-hodl-blue" />}
                    <span className="font-semibold capitalize">{tx.type === 'pay' ? 'Payment' : 'Asset Transfer'}</span>
                  </div>
                  <div className="text-sm space-y-1">
                    {tx.to && (
                      <p className="flex items-center">
                        <span className="font-medium w-16 text-muted-foreground">To:</span>
                        <RecipientDisplayWithRole address={tx.to} role={tx.role || 'Recipient'} />
                      </p>
                    )}
                    {tx.amount !== undefined && tx.type === 'pay' && (
                      <p className="flex items-center">
                        <span className="font-medium w-16 text-muted-foreground">Amount:</span>
                        <span className="font-numeric text-green-400">{microAlgosToAlgos(tx.amount).toFixed(2)} ALGO</span>
                      </p>
                    )}
                    {tx.assetId !== undefined && (
                      <p className="flex items-center">
                        <span className="font-medium w-16 text-muted-foreground">Asset ID:</span>
                        <span className="font-numeric">{tx.assetId}</span>
                      </p>
                    )}
                    {tx.amount !== undefined && tx.type === 'axfer' && (
                      <p className="flex items-center">
                        <span className="font-medium w-16 text-muted-foreground">Amount:</span>
                        <span className="font-numeric">{tx.amount}</span>
                      </p>
                    )}
                    {tx.isOptIn && (
                      <p className="flex items-center text-hodl-blue"><Info className="h-4 w-4 mr-1" /> Asset Opt-In</p>
                    )}
                    {tx.note && (
                      <p className="flex items-start">
                        <span className="font-medium w-16 text-muted-foreground">Note:</span>
                        <span className="font-mono text-xs overflow-wrap-anywhere flex-1">{tx.note}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // SIMPLIFIED VIEW (NEW DESIGN)
            <div className="space-y-4 py-4">
              <div className="border rounded-md p-3 bg-muted/30 text-center">
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold font-numeric text-green-400">{microAlgosToAlgos(totalCostInMicroAlgos).toFixed(2)} ALGO</p>
              </div>
              {(paymentRecipients.length > 0 || transactionFee > 0) && (
                <div className="border rounded-md p-3 bg-muted/30 space-y-2">
                  {paymentRecipients.map((recipient, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-md bg-background/50">
                      <div className="flex items-center gap-2">
                        <span className="font-numeric text-green-400 font-semibold">{microAlgosToAlgos(recipient.amount!).toFixed(2)} A</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <RecipientDisplayWithRole address={recipient.to!} role={recipient.role!} />
                    </div>
                  ))}
                  {/* Network Fee Row */}
                  <div className="flex items-center justify-between p-2 rounded-md bg-background/50">
                    <div className="flex items-center gap-2">
                      <span className="font-numeric text-green-400 font-semibold">{microAlgosToAlgos(transactionFee).toFixed(3)} A</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="font-semibold">Algorand Blockchain</span>
                      <span className="text-xs text-muted-foreground">Network Fee</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="items-top flex space-x-2 pt-4">
          <Checkbox id="dont-show-again" checked={dontShowAgain} onCheckedChange={(checked) => setDontShowAgain(!!checked)} />
          <div className="grid gap-1.5 leading-none">
            <label htmlFor="dont-show-again" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Don't show this confirmation again
            </label>
            <p className="text-xs text-muted-foreground">
              This can be changed in the settings menu.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:space-x-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isConfirming} className="flex-1 sm:flex-none">
            {isConfirming ? "Sending..." : "Send Request"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}