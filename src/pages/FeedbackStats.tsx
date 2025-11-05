"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchFormStructure, fetchFormResponses, FormStructure, FeedbackResponseEntry } from '@/lib/feedback-api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, ChevronDown, ChevronUp, BarChart as BarChartIcon, PieChart as PieChartIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CollapsibleContent } from '@/components/CollapsibleContent';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

// Define colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57'];

interface QuestionStats {
  questionText: string;
  type: 'rating' | 'text' | 'single_choice';
  totalResponses: number;
  data: Array<{ name: string; value: number }>;
}

interface ModuleStats {
  moduleId: string;
  moduleTitle: string;
  totalResponses: number; // Number of forms that had at least one answer in this module
  questions: Record<string, QuestionStats>;
}

interface VersionStats {
  version: string;
  totalResponses: number; // Number of forms submitted for this version
  modules: Record<string, ModuleStats>;
}

const FeedbackStatsPage = () => {
  const [openVersions, setOpenVersions] = useState<Set<string>>(new Set());
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());

  // Fetch form schema
  const { data: schema, isLoading: schemaLoading, error: schemaError } = useQuery<FormStructure, Error>({
    queryKey: ['formStructure'],
    queryFn: fetchFormStructure,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch all responses
  const { data: responses, isLoading: responsesLoading, error: responsesError } = useQuery<FeedbackResponseEntry[], Error>({
    queryKey: ['formResponses'],
    queryFn: fetchFormResponses,
    staleTime: 1 * 60 * 1000, // Cache for 1 minute
  });

  const isLoading = schemaLoading || responsesLoading;
  const error = schemaError || responsesError;

  // Process responses into statistics
  const aggregatedStats = useMemo(() => {
    if (!schema || !responses || responses.length === 0) return {};

    const stats: Record<string, VersionStats> = {};

    // Create a map of all question definitions from the LATEST schema for quick lookup
    const questionDefinitionsMap = new Map<string, any>();
    schema.modules.forEach(moduleDef => {
      (moduleDef.questions || []).forEach((q: any) => {
        questionDefinitionsMap.set(q.id, { ...q, moduleId: moduleDef.id, moduleTitle: moduleDef.title });
      });
    });

    responses.forEach(response => {
      const version = response.version || 'unknown';
      if (!stats[version]) {
        stats[version] = {
          version,
          totalResponses: 0, // This will count total submitted forms for this version
          modules: {},
        };
      }
      stats[version].totalResponses++; // Increment total forms submitted for this version

      const modulesWithResponsesInThisForm = new Set<string>(); // Track which modules in this form had answers

      // Iterate through the actual responses submitted by the user
      for (const questionId in response.responses) {
        const userAnswer = response.responses[questionId];

        // Only process if the answer is not empty (undefined, null, or empty string)
        if (userAnswer !== undefined && userAnswer !== null && userAnswer !== '') {
          const questionDef = questionDefinitionsMap.get(questionId);
          
          const moduleId = questionDef?.moduleId || 'unknown_module';
          const moduleTitle = questionDef?.moduleTitle || 'Unknown Module';
          const questionText = questionDef?.question || `Unknown Question ID: ${questionId}`;
          const questionType = questionDef?.type || 'text'; // Default to text if type is unknown

          if (!stats[version].modules[moduleId]) {
            stats[version].modules[moduleId] = {
              moduleId,
              moduleTitle,
              totalResponses: 0, // This will count forms that had answers in this module
              questions: {},
            };
          }
          modulesWithResponsesInThisForm.add(moduleId); // Mark that this module received an answer in this form

          if (!stats[version].modules[moduleId].questions[questionId]) {
            stats[version].modules[moduleId].questions[questionId] = {
              questionText,
              type: questionType,
              totalResponses: 0, // This will count actual answers for this specific question
              data: [],
            };
          }

          const qStats = stats[version].modules[moduleId].questions[questionId];
          qStats.totalResponses++; // Increment total answers for this specific question

          if (questionType === 'rating' || questionType === 'single_choice') {
            const existingDataIndex = qStats.data.findIndex(d => d.name === String(userAnswer));
            if (existingDataIndex !== -1) {
              qStats.data[existingDataIndex].value++;
            } else {
              qStats.data.push({ name: String(userAnswer), value: 1 });
            }
          }
          // For text questions, totalResponses is already incremented, no specific data points needed for charts.
        }
      }
      // After processing all questions in a response, update module totalResponses
      modulesWithResponsesInThisForm.forEach(moduleId => {
        stats[version].modules[moduleId].totalResponses++;
      });
    });

    // Post-processing: Ensure all modules and questions from the schema are present, even if no responses.
    // This ensures the structure is consistent with the schema for display, showing 0 responses if no data.
    Object.values(stats).forEach(versionStat => {
      schema.modules.forEach(moduleDef => {
        const moduleId = moduleDef.id;
        if (!versionStat.modules[moduleId]) {
          versionStat.modules[moduleId] = {
            moduleId,
            moduleTitle: moduleDef.title,
            totalResponses: 0,
            questions: {},
          };
        }
        (moduleDef.questions || []).forEach((questionDef: any) => {
          const questionId = questionDef.id;
          if (!versionStat.modules[moduleId].questions[questionId]) {
            versionStat.modules[moduleId].questions[questionId] = {
              questionText: questionDef.question,
              type: questionDef.type,
              totalResponses: 0,
              data: [],
            };
          }
        });
      });
    });

    // Sort data for consistent chart rendering
    Object.values(stats).forEach(versionStat => {
      Object.values(versionStat.modules).forEach(moduleStat => {
        Object.values(moduleStat.questions).forEach(qStat => {
          qStat.data.sort((a, b) => a.name.localeCompare(b.name));
        });
      });
    });

    return stats;
  }, [schema, responses]);

  const sortedVersions = useMemo(() => Object.keys(aggregatedStats).sort((a, b) => parseFloat(b) - parseFloat(a)), [aggregatedStats]);

  const toggleVersion = (version: string) => {
    setOpenVersions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(version)) {
        newSet.delete(version);
      } else {
        newSet.add(version);
      }
      return newSet;
    });
  };

  const toggleModule = (moduleId: string) => {
    setOpenModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-screen p-4 md:p-8 flex flex-col items-center">
        <h1 className="text-4xl font-bold gradient-text mb-6">Feedback Statistics</h1>
        <div className="w-full max-w-3xl space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full min-h-screen p-4 md:p-8 flex flex-col items-center">
        <h1 className="text-4xl font-bold gradient-text mb-6">Feedback Statistics</h1>
        <Alert variant="destructive" className="w-full max-w-3xl mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!schema || !responses || responses.length === 0) {
    return (
      <div className="w-full min-h-screen p-4 md:p-8 flex flex-col items-center">
        <h1 className="text-4xl font-bold gradient-text mb-6">Feedback Statistics</h1>
        <Alert className="w-full max-w-3xl">
          <Info className="h-4 w-4" />
          <AlertTitle>No Feedback Data</AlertTitle>
          <AlertDescription>No feedback responses have been recorded yet.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen p-4 md:p-8 flex flex-col items-center">
      <h1 className="text-4xl font-bold gradient-text mb-6">Feedback Statistics</h1>
      <p className="text-muted-foreground mb-8">Aggregated data from {responses.length} responses across {sortedVersions.length} form versions.</p>

      <div className="w-full max-w-4xl space-y-6">
        {sortedVersions.map(version => {
          const versionStats = aggregatedStats[version];
          const isVersionOpen = openVersions.has(version);
          return (
            <Card key={version} className="bg-card border-primary/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 cursor-pointer" onClick={() => toggleVersion(version)}>
                <CardTitle className="text-xl text-primary">Form Version {version} ({versionStats.totalResponses} responses)</CardTitle>
                {isVersionOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </CardHeader>
              <CollapsibleContent isOpen={isVersionOpen} className="p-4 pt-0 space-y-6">
                {Object.values(versionStats.modules).map(moduleStats => {
                  const isModuleOpen = openModules.has(moduleStats.moduleId);
                  return (
                    <Card key={moduleStats.moduleId} className="bg-muted/30 border-l-4 border-hodl-blue">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 cursor-pointer" onClick={() => toggleModule(moduleStats.moduleId)}>
                        <CardTitle className="text-lg text-hodl-blue">{moduleStats.moduleTitle}</CardTitle>
                        {isModuleOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </CardHeader>
                      <CollapsibleContent isOpen={isModuleOpen} className="p-4 pt-0 space-y-4">
                        {Object.values(moduleStats.questions).map((qStats, qIndex) => (
                          <div key={qStats.questionText} className="border p-3 rounded-md bg-card space-y-3">
                            <h4 className="text-md font-semibold text-foreground">{qIndex + 1}. {qStats.questionText} ({qStats.totalResponses} responses)</h4>
                            {qStats.totalResponses > 0 ? (
                              <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                                {qStats.type === 'rating' || qStats.type === 'single_choice' ? (
                                  <>
                                    <ResponsiveContainer width="100%" height={200} className="md:w-1/2">
                                      <PieChart>
                                        <Pie
                                          data={qStats.data}
                                          cx="50%"
                                          cy="50%"
                                          labelLine={false}
                                          outerRadius={80}
                                          fill="#8884d8"
                                          dataKey="value"
                                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                        >
                                          {qStats.data.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                          ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                      </PieChart>
                                    </ResponsiveContainer>
                                    <ResponsiveContainer width="100%" height={200} className="md:w-1/2">
                                      <BarChart data={qStats.data}>
                                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                                        <YAxis stroke="hsl(var(--muted-foreground))" />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="value" fill="#8884d8">
                                          {qStats.data.map((entry, index) => (
                                            <Cell key={`bar-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                          ))}
                                        </Bar>
                                      </BarChart>
                                    </ResponsiveContainer>
                                  </>
                                ) : (
                                  <p className="text-muted-foreground">Text responses are counted but not charted here.</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-muted-foreground">No responses for this question yet.</p>
                            )}
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Card>
                  );
                })}
              </CollapsibleContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default FeedbackStatsPage;