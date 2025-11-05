"use client";

import React, { useState, useMemo } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { useFeedbackResponses } from '@/hooks/useFeedbackResponses';
import { useFormStructure } from '@/lib/feedback-api'; // Import useFormStructure
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, BarChart, PieChart, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CollapsibleContent } from '@/components/CollapsibleContent'; // Import CollapsibleContent

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c', '#8dd1e1'];

interface QuestionDefinition {
  id: string;
  type: 'rating' | 'text' | 'single_choice';
  question: string;
  scale?: number;
  options?: string[];
  moduleId: string;
}

const FeedbackStats = () => {
  const { activeAddress } = useWallet();
  const { responses, loading: responsesLoading, error: responsesError } = useFeedbackResponses();
  const { schema, loading: schemaLoading, error: schemaError } = useFormStructure(); // Fetch schema
  const [selectedVersion, setSelectedVersion] = useState<string>('all');
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  const adminWallet = import.meta.env.VITE_FEEDBACK_ADMIN_WALLET;
  const isAuthorized = useMemo(() => activeAddress === adminWallet, [activeAddress, adminWallet]);

  const allVersions = useMemo(() => {
    const versions = new Set<string>();
    responses.forEach(res => versions.add(res.version));
    return Array.from(versions).sort((a, b) => parseFloat(b) - parseFloat(a));
  }, [responses]);

  const filteredResponses = useMemo(() => {
    if (selectedVersion === 'all') {
      return responses;
    }
    return responses.filter(res => res.version === selectedVersion);
  }, [responses, selectedVersion]);

  const allQuestions: QuestionDefinition[] = useMemo(() => {
    if (!schema?.modules) return [];
    return schema.modules.flatMap(module =>
      (module.questions || []).map((q: any) => ({ ...q, moduleId: module.id }))
    );
  }, [schema]);

  const stats = useMemo(() => {
    if (responsesLoading || schemaLoading || !schema) return null;

    const totalResponses = filteredResponses.length;
    const questionStats: Record<string, {
      questionDef: QuestionDefinition;
      totalAnswers: number;
      ratingCounts?: Record<number, number>;
      singleChoiceCounts?: Record<string, number>;
      textResponses?: string[];
      averageRating?: number;
    }> = {};

    allQuestions.forEach(qDef => {
      questionStats[qDef.id] = {
        questionDef: qDef,
        totalAnswers: 0,
      };
      if (qDef.type === 'rating') {
        questionStats[qDef.id].ratingCounts = {};
        for (let i = 1; i <= (qDef.scale || 5); i++) {
          questionStats[qDef.id].ratingCounts![i] = 0;
        }
      } else if (qDef.type === 'single_choice') {
        questionStats[qDef.id].singleChoiceCounts = {};
        (qDef.options || []).forEach(option => {
          questionStats[qDef.id].singleChoiceCounts![option] = 0;
        });
      } else if (qDef.type === 'text') {
        questionStats[qDef.id].textResponses = [];
      }
    });

    filteredResponses.forEach(res => {
      for (const qId in res.responses) {
        const qDef = allQuestions.find(q => q.id === qId);
        if (!qDef) continue; // Skip if question definition not found

        const answer = res.responses[qId];
        const currentStats = questionStats[qId];
        if (!currentStats) continue;

        currentStats.totalAnswers++;

        if (qDef.type === 'rating' && typeof answer === 'number') {
          currentStats.ratingCounts![answer] = (currentStats.ratingCounts![answer] || 0) + 1;
        } else if (qDef.type === 'single_choice' && typeof answer === 'string') {
          currentStats.singleChoiceCounts![answer] = (currentStats.singleChoiceCounts![answer] || 0) + 1;
        } else if (qDef.type === 'text' && typeof answer === 'string') {
          currentStats.textResponses!.push(answer);
        }
      }
    });

    // Calculate averages for ratings
    for (const qId in questionStats) {
      const qStats = questionStats[qId];
      if (qStats.questionDef.type === 'rating' && qStats.ratingCounts) {
        let sum = 0;
        let count = 0;
        for (const rating in qStats.ratingCounts) {
          sum += parseInt(rating) * qStats.ratingCounts[rating];
          count += qStats.ratingCounts[rating];
        }
        qStats.averageRating = count > 0 ? sum / count : 0;
      }
    }

    return { totalResponses, questionStats };
  }, [filteredResponses, allQuestions, responsesLoading, schemaLoading, schema]);

  const isLoading = responsesLoading || schemaLoading;
  const displayError = responsesError || schemaError;

  if (!isAuthorized) {
    return (
      <div className="w-full min-h-screen p-4 md:p-8 flex flex-col items-center">
        <h1 className="text-4xl font-bold gradient-text mb-6">Feedback Statistics</h1>
        <Alert variant="destructive" className="w-full max-w-3xl mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unauthorized</AlertTitle>
          <AlertDescription>You must connect the authorized wallet ({adminWallet}) to view feedback statistics.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full min-h-screen p-4 md:p-8 flex flex-col items-center">
        <h1 className="text-4xl font-bold gradient-text mb-6">Feedback Statistics</h1>
        <div className="w-full max-w-3xl space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (displayError) {
    return (
      <div className="w-full min-h-screen p-4 md:p-8 flex flex-col items-center">
        <h1 className="text-4xl font-bold gradient-text mb-6">Feedback Statistics</h1>
        <Alert variant="destructive" className="w-full max-w-3xl mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!stats || stats.totalResponses === 0) {
    return (
      <div className="w-full min-h-screen p-4 md:p-8 flex flex-col items-center">
        <h1 className="text-4xl font-bold gradient-text mb-6">Feedback Statistics</h1>
        <Alert className="w-full max-w-3xl bg-muted/50 border-hodl-blue text-muted-foreground">
          <Info className="h-4 w-4 text-hodl-blue" />
          <AlertTitle className="text-hodl-blue">No Responses Yet</AlertTitle>
          <AlertDescription>There are no feedback responses to display statistics for.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const toggleQuestionExpansion = (questionId: string) => {
    setExpandedQuestionId(prev => (prev === questionId ? null : questionId));
  };

  return (
    <div className="w-full min-h-screen p-4 md:p-8 flex flex-col items-center">
      <h1 className="text-4xl font-bold gradient-text mb-6">Feedback Statistics</h1>

      <Card className="w-full max-w-3xl mx-auto mb-6 bg-card">
        <CardHeader>
          <CardTitle className="gradient-text">Overall Statistics</CardTitle>
          <CardDescription>Summary of all feedback responses.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
            <span className="font-semibold">Total Responses:</span>
            <span className="font-numeric text-lg text-primary">{stats.totalResponses}</span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="version-select">Filter by Form Version:</Label>
            <Select value={selectedVersion} onValueChange={setSelectedVersion}>
              <SelectTrigger id="version-select" className="w-full bg-muted/50">
                <SelectValue placeholder="Select a version" />
              </SelectTrigger>
              <SelectContent className="bg-card">
                <SelectItem value="all">All Versions</SelectItem>
                {allVersions.map(version => (
                  <SelectItem key={version} value={version}>Version {version}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="w-full max-w-3xl mx-auto space-y-6">
        {allQuestions.map(qDef => {
          const qStats = stats.questionStats[qDef.id];
          if (!qStats || qStats.totalAnswers === 0) return null;

          const moduleTitle = schema?.modules?.find(m => m.id === qDef.moduleId)?.title || 'Unknown Module';

          return (
            <Card key={qDef.id} className="bg-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 cursor-pointer" onClick={() => toggleQuestionExpansion(qDef.id)}>
                <CardTitle className="text-lg text-primary flex items-center gap-2">
                  {qDef.type === 'rating' && <Star className="h-5 w-5" />}
                  {qDef.type === 'single_choice' && <PieChart className="h-5 w-5" />}
                  {qDef.type === 'text' && <Info className="h-5 w-5" />}
                  {qDef.question}
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">({qStats.totalAnswers} responses)</span>
                  {expandedQuestionId === qDef.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
              <CollapsibleContent isOpen={expandedQuestionId === qDef.id}>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground mb-4">Module: {moduleTitle}</p>
                  {qDef.type === 'rating' && qStats.ratingCounts && (
                    <div className="space-y-4">
                      <p className="text-md font-semibold">Average Rating: <span className="font-numeric text-primary">{qStats.averageRating?.toFixed(2)}</span></p>
                      <ResponsiveContainer width="100%" height={200}>
                        <RechartsBarChart data={Object.entries(qStats.ratingCounts).map(([rating, count]) => ({ rating: parseInt(rating), count }))}>
                          <XAxis dataKey="rating" label={{ value: "Rating", position: "insideBottom", offset: -5 }} />
                          <YAxis label={{ value: "Count", angle: -90, position: "insideLeft" }} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#8884d8" />
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {qDef.type === 'single_choice' && qStats.singleChoiceCounts && (
                    <div className="space-y-4">
                      <ResponsiveContainer width="100%" height={250}>
                        <RechartsPieChart>
                          <Pie
                            data={Object.entries(qStats.singleChoiceCounts).map(([option, count]) => ({ name: option, value: count }))}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          >
                            {Object.entries(qStats.singleChoiceCounts).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {qDef.type === 'text' && qStats.textResponses && (
                    <div className="space-y-2">
                      <h4 className="text-md font-semibold">Text Responses:</h4>
                      <ul className="list-disc list-inside space-y-1 max-h-60 overflow-y-auto scrollbar-thin p-2 border rounded-md bg-muted/30">
                        {qStats.textResponses.map((text, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground whitespace-pre-wrap">{text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default FeedbackStats;