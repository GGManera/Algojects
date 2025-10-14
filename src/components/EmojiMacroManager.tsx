"use client";

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Settings, Plus, Edit, Trash } from "lucide-react";
import { useEmojiMacros } from "@/hooks/useEmojiMacros";
import { showSuccess, showError } from "@/utils/toast";

interface EmojiMacroManagerProps {
  children?: React.ReactNode; // Para permitir que seja um trigger de Dialog
}

export function EmojiMacroManager({ children }: EmojiMacroManagerProps) {
  const { macros, addMacro, updateMacro, deleteMacro, loading } = useEmojiMacros();
  const [newShortcut, setNewShortcut] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const [editingMacro, setEditingMacro] = useState<{ shortcut: string; emoji: string } | null>(null);
  const [editShortcut, setEditShortcut] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAddMacro = useCallback(() => {
    if (!newShortcut.trim() || !newEmoji.trim()) {
      showError("Shortcut and Emoji cannot be empty.");
      return;
    }
    if (!newShortcut.startsWith(':') || !newShortcut.endsWith(':')) {
      showError("The shortcut must start and end with ':'.");
      return;
    }
    if (macros.some(m => m.shortcut === newShortcut)) {
      showError("This shortcut already exists.");
      return;
    }
    addMacro({ shortcut: newShortcut, emoji: newEmoji });
    showSuccess("Macro added successfully!");
    setNewShortcut("");
    setNewEmoji("");
  }, [newShortcut, newEmoji, macros, addMacro]);

  const handleEditClick = useCallback((macro: { shortcut: string; emoji: string }) => {
    setEditingMacro(macro);
    setEditShortcut(macro.shortcut);
    setEditEmoji(macro.emoji);
  }, []);

  const handleUpdateMacro = useCallback(() => {
    if (!editingMacro) return;
    if (!editShortcut.trim() || !editEmoji.trim()) {
      showError("Shortcut and Emoji cannot be empty.");
      return;
    }
    if (!editShortcut.startsWith(':') || !editShortcut.endsWith(':')) {
      showError("The shortcut must start and end with ':'.");
      return;
    }
    if (editShortcut !== editingMacro.shortcut && macros.some(m => m.shortcut === editShortcut)) {
      showError("This shortcut already exists.");
      return;
    }
    updateMacro(editingMacro.shortcut, { shortcut: editShortcut, emoji: editEmoji });
    showSuccess("Macro updated successfully!");
    setEditingMacro(null);
  }, [editingMacro, editShortcut, editEmoji, macros, updateMacro]);

  const handleDeleteMacro = useCallback((shortcut: string) => {
    deleteMacro(shortcut);
    showSuccess("Macro deleted successfully!");
  }, [deleteMacro]);

  if (loading) {
    return null; // Ou um skeleton loader
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Manage emoji macros">
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-[300px] bg-card text-foreground p-4"> {/* Reduzido padding do DialogContent */}
        <DialogHeader className="pb-2"> {/* Reduzido padding inferior do cabeçalho */}
          <DialogTitle>Manage Emoji Macros</DialogTitle>
          <DialogDescription>
            Create custom shortcuts for your favorite emojis.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2"> {/* Reduzido gap e removido py */}
          {/* Layout simplificado para os inputs de nova macro */}
          <div className="flex flex-col gap-1"> {/* Reduzido gap */}
            <Label htmlFor="newShortcut">Shortcut</Label>
            <Input
              id="newShortcut"
              placeholder=":shortcut:"
              value={newShortcut}
              onChange={(e) => setNewShortcut(e.target.value)}
            />
            <Label htmlFor="newEmoji">Emoji</Label>
            <Input
              id="newEmoji"
              placeholder="😊"
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
              maxLength={2} // Emojis geralmente têm 1 ou 2 caracteres
            />
          </div>
          <Button onClick={handleAddMacro} className="w-full">
            <Plus className="h-4 w-4 mr-2" /> Add Macro
          </Button>

          <h3 className="text-lg font-semibold mt-4">Existing Macros</h3>
          {macros.length === 0 ? (
            <p className="text-muted-foreground text-center">No macros added yet.</p>
          ) : (
            <div className="overflow-x-auto scrollbar-thin"> {/* Adicionado overflow-x-auto para rolagem horizontal */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[100px] py-2">Shortcut</TableHead> {/* Largura mínima para o atalho */}
                    <TableHead className="min-w-[60px] py-2">Emoji</TableHead> {/* Largura mínima para o emoji */}
                    <TableHead className="text-right min-w-[100px] py-2">Actions</TableHead> {/* Largura mínima para ações */}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {macros.map((macro) => (
                    <TableRow key={macro.shortcut}>
                      <TableCell className="font-mono py-2">{macro.shortcut}</TableCell>
                      <TableCell className="py-2">{macro.emoji}</TableCell>
                      <TableCell className="text-right flex justify-end space-x-2 py-2">
                        {editingMacro?.shortcut === macro.shortcut ? (
                          <>
                            <Button variant="outline" size="sm" onClick={handleUpdateMacro}>Save</Button>
                            <Button variant="ghost" size="sm" onClick={() => setEditingMacro(null)}>Cancel</Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleEditClick(macro)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive/90">
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-card text-foreground">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will delete the macro "{macro.shortcut}".
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteMacro(macro.shortcut)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {editingMacro && (
                    <TableRow>
                      <TableCell className="py-2">
                        <Input
                          value={editShortcut}
                          onChange={(e) => setEditShortcut(e.target.value)}
                          placeholder=":shortcut:"
                        />
                      </TableCell>
                      <TableCell className="py-2">
                        <Input
                          value={editEmoji}
                          onChange={(e) => setEditEmoji(e.target.value)}
                          maxLength={2}
                          placeholder="😊"
                        />
                      </TableCell>
                      <TableCell className="text-right flex justify-end space-x-2 py-2">
                        <Button variant="outline" size="sm" onClick={handleUpdateMacro}>Save</Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingMacro(null)}>Cancel</Button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <DialogFooter className="pt-2"> {/* Reduzido padding superior do rodapé */}
          <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}