"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchFormStructure, fetchFormResponses, FormStructure, FeedbackResponseEntry } from '@/lib/feedback-api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, ChevronDown, ChevronUp, BarChart as BarChartIcon, PieChart as PieChartIcon, Info } from 'lucide-react';
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
import { StickyHeader } from '@/components/StickyHeader';
import { useNavigate } from 'react-router-dom';
import { StarRatingProgressBar } from '@/components/StarRatingProgressBar'; // NEW: Import StarRatingProgressBar

// Define colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57'];

interface QuestionStats {
  questionText: string;
  type: 'rating' | 'text' | 'single_choice';
  totalResponses: number;
  data: Array<{ name: string; value: number; id?: string }>; // Added id for single_choice
  average?: number;
}

interface ModuleStats {
  moduleId: string;
  moduleTitle: string;
  totalResponses: number;
  questions: Record<string, QuestionStats>;
}

interface VersionStats {
  version: string;
  totalResponses: number;
  modules: Record<string, ModuleStats>;
}

// Utility function to generate star labels
const getStarLabel = (rating: number) => '★'.repeat(rating);

// Custom Tick Component for XAxis to color the stars yellow
const CustomStarTick = (props: any) => {
  const { x, y, payload } = props;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="middle" fill="#FFBB28" className="font-numeric">
        {payload.value}
      </text>
    </g>
  );
};

const GovernancePage = () => {
  const [openVersions, setOpenVersions] = useState<Set<string>>(new Set());
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  // Fetch form schema
  const { data: schemaResponse, isLoading: schemaLoading, error: schemaError } = useQuery<any, Error>({ // Changed type to any to handle bilingual response
    queryKey: ['formStructure'],
    queryFn: fetchFormStructure,
    staleTime: 5 * 60 * 1000,
  });
  
  // Use the English schema as the canonical structure for stats
  const schema = useMemo(() => schemaResponse?.schema?.en, [schemaResponse]);

  // Fetch all responses
  const { data: responses, isLoading: responsesLoading, error: responsesError } = useQuery<FeedbackResponseEntry[], Error>({
    queryKey: ['formResponses'],
    queryFn: fetchFormResponses,
    staleTime: 1 * 60 * 1000,
  });

  const isLoading = schemaLoading || responsesLoading;
  const error = schemaError || responsesError;

  // Process responses into statistics
  const aggregatedStats = useMemo(() => {
    if (!schema || !responses || responses.length === 0) return {};

    const stats: Record<string, VersionStats> = {};

    // Create a map of all question definitions from the LATEST schema for quick lookup
    const questionDefinitionsMap = new Map<string, any>();
    (schema.modules || []).forEach(moduleDef => {
      (moduleDef.questions || []).forEach((q: any) => {
        questionDefinitionsMap.set(q.id, { ...q, moduleId: moduleDef.id, moduleTitle: moduleDef.title });
      });
    });

    responses.forEach(response => {
      const version = response.version || 'unknown';
      if (!stats[version]) {
        stats[version] = {
          version,
          totalResponses: 0,
          modules: {},
        };
      }
      stats[version].totalResponses++;

      const modulesWithResponsesInThisForm = new Set<string>();

      for (const questionId in response.responses) {
        const userAnswer = response.responses[questionId];

        if (userAnswer !== undefined && userAnswer !== null && userAnswer !== '') {
          const questionDef = questionDefinitionsMap.get(questionId);
          
          const moduleId = questionDef?.moduleId || 'unknown_module';
          const moduleTitle = questionDef?.moduleTitle || 'Unknown Module';
          const questionText = questionDef?.question || `Unknown Question ID: ${questionId}`;
          const questionType = questionDef?.type || 'text';

          if (!stats[version].modules[moduleId]) {
            stats[version].modules[moduleId] = {
              moduleId,
              moduleTitle,
              totalResponses: 0,
              questions: {},
            };
          }
          modulesWithResponsesInThisForm.add(moduleId);

          if (!stats[version].modules[moduleId].questions[questionId]) {
            stats[version].modules[moduleId].questions[questionId] = {
              questionText,
              type: questionType,
              totalResponses: 0,
              data: [],
            };
          }

          const qStats = stats[version].modules[moduleId].questions[questionId];
          
          // Only count responses for chartable types
          if (questionType !== 'text') {
            qStats.totalResponses++;
          }

          // For rating, the answer is a number. For single_choice, the answer is the option ID (string).
          const responseKey = String(userAnswer);

          if (questionType === 'rating' || questionType === 'single_choice') {
            const existingDataIndex = qStats.data.findIndex(d => d.name === responseKey);
            if (existingDataIndex !== -1) {
              qStats.data[existingDataIndex].value++;
            } else {
              // Store the response ID/Key as the 'name' initially
              qStats.data.push({ name: responseKey, value: 1 });
            }
          }
        }
      }
      modulesWithResponsesInThisForm.forEach(moduleId => {
        stats[version].modules[moduleId].totalResponses++;
      });
    });

    // --- Phase 2: Normalize and Calculate Averages, Apply Labels ---
    Object.values(stats).forEach(versionStat => {
      (schema.modules || []).forEach(moduleDef => {
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
          const questionType = questionDef.type;
          
          if (!versionStat.modules[moduleId].questions[questionId]) {
            versionStat.modules[moduleId].questions[questionId] = {
              questionText: questionDef.question,
              type: questionType,
              totalResponses: 0,
              data: [],
            };
          }

          const qStats = versionStat.modules[moduleId].questions[questionId];
          
          if (questionType === 'rating') {
            const scale = questionDef.scale || 5;
            // FIX: Keep dataMap keys as strings to match responseKey from Phase 1
            const dataMap = new Map(qStats.data.map(d => [d.name, d.value])); 
            const normalizedData: Array<{ name: string; value: number }> = [];
            let totalSum = 0;
            let totalCount = 0;

            for (let i = 1; i <= scale; i++) {
              const ratingKey = String(i); // Use string key for lookup
              const count = dataMap.get(ratingKey) || 0; 
              
              normalizedData.push({ name: getStarLabel(i), value: count });
              totalSum += i * count;
              totalCount += count;
            }
            
            qStats.data = normalizedData;
            qStats.totalResponses = totalCount;
            (qStats as QuestionStats).average = totalCount > 0 ? totalSum / totalCount : undefined;
          } else if (questionType === 'single_choice') {
            // Map response IDs (stored in 'name') back to their labels from the schema
            const optionLabelsMap = new Map((questionDef.options || []).map((opt: any) => [opt.id, opt.label]));
            
            qStats.data = qStats.data.map(d => ({
              ...d,
              name: optionLabelsMap.get(d.name) || d.name, // Replace ID with Label for display
            }));
            
            // Sort by label name
            qStats.data.sort((a, b) => a.name.localeCompare(b.name));
          }
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

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/');
  };

  // Helper function to format the average rating
  const formatAverageRating = (avg: number): string => {
    const rounded = Math.round(avg * 10) / 10;
    if (rounded % 1 === 0) {
      return rounded.toFixed(0);
    }
    return rounded.toFixed(1);
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center pt-12">
        <StickyHeader onLogoClick={handleLogoClick} />
        <div className="p-4 md:p-8 w-full flex flex-col items-center">
          <h1 className="text-4xl font-bold gradient-text mb-6">AlgoJects Governance & Feedback Statistics</h1>
          <div className="w-full max-w-3xl space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center pt-12">
        <StickyHeader onLogoClick={handleLogoClick} />
        <div className="p-4 md:p-8 w-full flex flex-col items-center">
          <h1 className="text-4xl font-bold gradient-text mb-6">AlgoJects Governance & Feedback Statistics</h1>
          <Alert variant="destructive" className="w-full max-w-3xl mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading Data</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!schema || !responses || responses.length === 0) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center pt-12">
        <StickyHeader onLogoClick={handleLogoClick} />
        <div className="p-4 md:p-8 w-full flex flex-col items-center">
          <h1 className="text-4xl font-bold gradient-text mb-6">AlgoJects Governance & Feedback Statistics</h1>
          <Alert className="w-full max-w-3xl">
            <Info className="h-4 w-4" />
            <AlertTitle>No Feedback Data</AlertTitle>
            <AlertDescription>No feedback responses have been recorded yet.</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex flex-col items-center pt-12">
      <StickyHeader onLogoClick={handleLogoClick} />
      <div className="p-4 md:p-8 w-full flex flex-col items-center">
        <h1 className="text-4xl font-bold gradient-text mb-6">AlgoJects Governance & Feedback Statistics</h1>
        <p className="text-lg text-muted-foreground mb-4 text-center max-w-2xl">
          This page provides insights into community feedback, which informs the ongoing governance and evolution of AlgoJects.
        </p>
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
                          {Object.entries(moduleStats.questions).map(([questionId, qStats], qIndex) => {
                            
                            // --- Filter out text questions ---
                            if (qStats.type === 'text') return null;
                            // -------------------------------------
                            
                            // Find the original question definition using the ID
                            const originalQuestionDef = schema.modules
                                .flatMap(m => m.questions || [])
                                .find((q: any) => q.id === questionId);
                            
                            // Fallback scale if not found
                            const scale = originalQuestionDef?.scale || 5;

                            // Calculate max value for YAxis domain
                            const maxResponses = qStats.data.length > 0 
                                ? Math.max(...qStats.data.map(d => d.value)) 
                                : 1; // Default to 1 if no responses

                            return (
                              <div key={questionId} className="border p-3 rounded-md bg-card space-y-3">
                                <h4 className="text-md font-semibold text-foreground">{qIndex + 1}. {qStats.questionText} ({qStats.totalResponses} responses)</h4>
                                
                                {/* Display Average for Rating Questions */}
                                {qStats.type === 'rating' && qStats.average !== undefined && (
                                    <div className="space-y-2">
                                        <p className="text-sm text-hodl-blue font-bold">Average Rating: {formatAverageRating(qStats.average)} / {scale}</p>
                                        <StarRatingProgressBar 
                                            average={qStats.average} 
                                            scale={scale} 
                                            totalResponses={qStats.totalResponses} 
                                        />
                                    </div>
                                )}

                                {qStats.totalResponses > 0 ? (
                                  <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                                    
                                    {/* RATING: Bar Chart only */}
                                    {qStats.type === 'rating' && (
                                        <ResponsiveContainer width="100%" height={200}>
                                            <BarChart data={qStats.data}>
                                                {/* Use CustomStarTick for yellow stars */}
                                                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={<CustomStarTick />} />
                                                <YAxis 
                                                    stroke="hsl(var(--muted-foreground))" 
                                                    allowDecimals={false} 
                                                    domain={[0, maxResponses]} // Set domain from 0 to maxResponses
                                                    tickCount={maxResponses + 1} // Ensure all integer ticks are shown
                                                />
                                                <Tooltip 
                                                    formatter={(value, name, props) => [`${value} responses`, 'Count']}
                                                    labelFormatter={(label) => `Rating: ${label}`}
                                                />
                                                {/* REMOVED: <Legend /> */}
                                                <Bar dataKey="value" fill="#8884d8">
                                                    {qStats.data.map((entry, index) => (
                                                        <Cell key={`bar-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                    
                                    {/* SINGLE CHOICE: Pie Chart only */}
                                    {qStats.type === 'single_choice' && (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <PieChart>
                                                <Pie
                                                    data={qStats.data}
                                                    cx="50%"
                                                    cy="60%" /* Adjusted cy to shift pie down */
                                                    labelLine={false}
                                                    outerRadius={100}
                                                    fill="#8884d8"
                                                    dataKey="value"
                                                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                                >
                                                    {qStats.data.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                                <Legend 
                                                    wrapperStyle={{ paddingTop: '20px' }} 
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-muted-foreground">No responses for this question yet.</p>
                                )}
                              </div>
                            );
                          })}
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
    </div>
  );
};

export default GovernancePage;