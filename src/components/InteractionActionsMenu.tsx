"use client";

import React, { useState } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { MoreVertical, Edit, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { BaseInteraction, Project, Review, Comment } from '@/types/social';
import { EditInteractionDialog } from './EditInteractionDialog';
import { DeleteInteractionDialog } from './DeleteInteractionDialog';

interface InteractionActionsMenuProps {
  item: BaseInteraction;
  project: Project;
  review?: Review;
  comment?: Comment;
  onInteractionSuccess: () => void;
}

export function InteractionActionsMenu({ item, project, review, comment, onInteractionSuccess }: InteractionActionsMenuProps) {
  const { activeAddress } = useWallet();
  const isCreator = activeAddress === item.sender;

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  if (!isCreator) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card text-foreground">
          <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)} className="cursor-pointer">
            <Edit className="mr-2 h-4 w-4" /> Edit Post
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="cursor-pointer text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Exclude Post
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditInteractionDialog
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        item={item}
        project={project}
        review={review}
        comment={comment}
        onInteractionSuccess={onInteractionSuccess}
      />

      <DeleteInteractionDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        item={item}
        project={project}
        review={review}
        comment={comment}
        onInteractionSuccess={onInteractionSuccess}
      />
    </>
  );
}