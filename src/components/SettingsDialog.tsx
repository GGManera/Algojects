"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";

export function SettingsDialog() {
  const { settings, updateSetting } = useSettings();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Open settings">
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your application settings here. Changes are saved locally to your device.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="show-confirmation" className="text-base">
                Show Transaction Confirmation
              </Label>
              <p className="text-sm text-muted-foreground">
                Display a summary of transactions for review before sending to your wallet.
              </p>
            </div>
            <Switch
              id="show-confirmation"
              checked={settings.showTransactionConfirmation}
              onCheckedChange={(checked) => updateSetting('showTransactionConfirmation', checked)}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}