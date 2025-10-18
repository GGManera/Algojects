"use client";

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // NEW: Import useQuery, useMutation, useQueryClient
import { fetchProjectDetailsClient, updateProjectDetailsClient } from '@/lib/coda';
import { ProjectDetailsEntry } from '../../api/project-details';
import { useWallet } from '@txnlab/use-wallet-react';
import { ProjectMetadata } from '@/types/project';

// NEW: Define a chave de query para o React Query
const PROJECT_DETAILS_QUERY_KEY = ['projectDetails'];

export function useProjectDetails() {
  const queryClient = useQueryClient(); // NEW: Hook para acessar o cliente de query
  const { activeAddress, transactionSigner, algodClient } = useWallet();

  // NEW: Usar useQuery para buscar os detalhes do projeto
  const {
    data: projectDetails = [], // Default para array vazio
    isLoading,
    isFetching, // isFetching indica se está buscando (incluindo em background)
    isError,
    error,
    refetch,
  } = useQuery<ProjectDetailsEntry[], Error>({
    queryKey: PROJECT_DETAILS_QUERY_KEY,
    queryFn: fetchProjectDetailsClient,
    staleTime: 1 * 60 * 1000, // Dados considerados "fresh" por 1 minuto (não re-buscam em mounts)
    gcTime: 5 * 60 * 1000, // Dados permanecem no cache por 5 minutos (para re-uso rápido)
    refetchOnWindowFocus: false, // Desabilitar refetch automático no foco da janela para evitar chamadas excessivas
    refetchOnMount: true, // Re-busca no mount se estiver stale
  });

  // NEW: Usar useMutation para atualizar os detalhes do projeto
  const updateProjectDetailsMutation = useMutation<void, Error, { projectId: string; newProjectMetadata: ProjectMetadata }>({
    mutationFn: async ({ projectId, newProjectMetadata }) => {
      if (!activeAddress || !transactionSigner || !algodClient) {
        throw new Error("Wallet not connected. Cannot update project details.");
      }
      await updateProjectDetailsClient(
        projectId,
        newProjectMetadata,
        activeAddress,
        transactionSigner,
        algodClient
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECT_DETAILS_QUERY_KEY }); // Invalida o cache para re-buscar
    },
    onError: (err) => {
      console.error("Failed to update project details:", err);
      throw err; // Re-throw para que o componente possa lidar com o erro
    },
  });

  // NEW: Usar useMutation para aceitar edições de notas propostas
  const acceptProposedNoteEditMutation = useMutation<void, Error, { projectId: string; acceptedContent: string; acceptedByAddress: string }>({
    mutationFn: async ({ projectId, acceptedContent, acceptedByAddress }) => {
      if (!activeAddress || !transactionSigner || !algodClient) {
        throw new Error("Wallet not connected. Cannot accept proposed note edit.");
      }
      const currentDetails = projectDetails.find(pd => pd.projectId === projectId);
      if (!currentDetails) {
        throw new Error(`Project details for ${projectId} not found.`);
      }

      const updatedMetadata = currentDetails.projectMetadata.map(item => {
        if (item.type === 'project-description') {
          return { ...item, value: acceptedContent };
        }
        if (item.type === 'is-community-notes') {
          return { ...item, value: 'true' };
        }
        if (item.type === 'added-by-address') {
          return { ...item, value: acceptedByAddress };
        }
        if (item.type === 'is-creator-added') {
          return { ...item, value: 'false' };
        }
        return item;
      });

      if (!updatedMetadata.some(item => item.type === 'is-community-notes')) {
        updatedMetadata.push({ title: 'Is Community Notes', value: 'true', type: 'is-community-notes' });
      }
      if (!updatedMetadata.some(item => item.type === 'added-by-address')) {
        updatedMetadata.push({ title: 'Added By Address', value: acceptedByAddress, type: 'added-by-address' });
      }
      if (!updatedMetadata.some(item => item.type === 'is-creator-added')) {
        updatedMetadata.push({ title: 'Is Creator Added', value: 'false', type: 'is-creator-added' });
      }

      await updateProjectDetailsClient(
        projectId,
        updatedMetadata,
        activeAddress,
        transactionSigner,
        algodClient
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECT_DETAILS_QUERY_KEY }); // Invalida o cache para re-buscar
    },
    onError: (err) => {
      console.error("Failed to accept proposed note edit:", err);
      throw err;
    },
  });

  return {
    projectDetails,
    loading: isLoading,
    isRefreshing: isFetching, // isFetching é mais preciso para "refreshing"
    error: isError ? error.message : null,
    refetch,
    updateProjectDetails: updateProjectDetailsMutation.mutateAsync, // Retorna a função de mutação
    acceptProposedNoteEdit: acceptProposedNoteEditMutation.mutateAsync, // Retorna a função de mutação
  };
}