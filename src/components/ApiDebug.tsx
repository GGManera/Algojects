"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Terminal } from "lucide-react";
import { cn } from '@/lib/utils'; // Import cn
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext'; // Import useAppContextDisplayMode

interface ApiDebugProps {
  isInsideCarousel?: boolean; // Add isInsideCarousel prop
}

export function ApiDebug({ isInsideCarousel = false }: ApiDebugProps) {
  const [rawData, setRawData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isMobile } = useAppContextDisplayMode(); // Use useAppContextDisplayMode

  useEffect(() => {
    const fetchRawData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/getCreatedAssets");
        
        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(responseData.error || `HTTP error! status: ${response.status}`);
        }
        
        setRawData(responseData);
      } catch (err) {
        console.error("API Debug Fetch Error:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred.");
      } finally {
        setLoading(false);
      }
    };

    fetchRawData();
  }, []);

  return (
    <Card className="w-full max-w-md mt-8 bg-gray-900 border-yellow-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-yellow-400">
          <Terminal className="h-5 w-5" />
          API Debugger (Temporary)
        </CardTitle>
        <CardDescription>
          RAW response from <code>/api/getCreatedAssets</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && <Skeleton className="h-20 w-full" />}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>API Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {rawData && (
          <pre className="text-left text-xs bg-black p-4 rounded-md overflow-x-auto scrollbar-thin text-green-400">
            <code>
              {JSON.stringify(rawData, null, 2)}
            </code>
          </pre>
        )}
      </CardContent>
    </Card>
  );
}