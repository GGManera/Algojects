"use client";

import { useQuery } from '@tanstack/react-query';
import { retryFetch } from '@/utils/api';

const FEEDBACK_RESPONSES_QUERY_KEY = ['feedbackResponses'];

interface FeedbackResponse {
  form_id: string;
  version: string;
  feedback_version: string;
  wallet_address: string;
  responses: Record<string, any>;
}

export async function fetchFeedbackResponsesClient(): Promise<FeedbackResponse[]> {
  const response = await retryFetch('/api/feedback-stats', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  }, 5);

  const data = await response.json();
  return data.responses;
}

export function useFeedbackResponses() {
  const {
    data: responses = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<FeedbackResponse[], Error>({
    queryKey: FEEDBACK_RESPONSES_QUERY_KEY,
    queryFn: fetchFeedbackResponsesClient,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  return {
    responses,
    loading: isLoading,
    isRefreshing: isFetching,
    error: isError ? error.message : null,
    refetch,
  };
}