import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronDown,
  Trash2,
  FileText,
  Zap,
  Users,
  HelpCircle,
  Clock,
  Target,
  CheckSquare,
  AlertTriangle,
  FolderOpen,
} from "lucide-react";
import { useState } from "react";
import { ExtractedRequirement, RequirementCategory } from "@/hooks/useRequirements";

interface RequirementsListProps {
  requirements: ExtractedRequirement[];
  onDelete: (id: string) => void;
}

const categoryConfig: Record<RequirementCategory, { label: string; icon: typeof FileText; color: string }> = {
  functional: { label: "Functional", icon: Zap, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  non_functional: { label: "Non-Functional", icon: Target, color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  stakeholder: { label: "Stakeholder", icon: Users, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  assumption: { label: "Assumption", icon: HelpCircle, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  constraint: { label: "Constraint", icon: AlertTriangle, color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  timeline: { label: "Timeline", icon: Clock, color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  metric: { label: "Success Metric", icon: Target, color: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400" },
  decision: { label: "Decision", icon: CheckSquare, color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400" },
};

export const RequirementsList = ({ requirements, onDelete }: RequirementsListProps) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Group requirements by category
  const groupedRequirements = requirements.reduce((acc, req) => {
    if (!acc[req.category]) {
      acc[req.category] = [];
    }
    acc[req.category].push(req);
    return acc;
  }, {} as Record<RequirementCategory, ExtractedRequirement[]>);

  if (requirements.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <FolderOpen className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg mb-1">No requirements yet</CardTitle>
          <CardDescription className="text-center max-w-sm">
            Add data sources and click "Extract Requirements" to analyze them with AI.
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Extracted Requirements ({requirements.length})</CardTitle>
          <CardDescription>
            AI-extracted requirements with source traceability
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(groupedRequirements).map(([category, reqs]) => {
            const config = categoryConfig[category as RequirementCategory];
            const Icon = config.icon;

            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{config.label}</span>
                  <Badge variant="secondary" className="text-xs">
                    {reqs.length}
                  </Badge>
                </div>

                {reqs.map((req) => (
                  <Collapsible
                    key={req.id}
                    open={expandedIds.has(req.id)}
                    onOpenChange={() => toggleExpand(req.id)}
                  >
                    <div className="rounded-lg border border-border overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <button className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left">
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform ${
                              expandedIds.has(req.id) ? "rotate-180" : ""
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{req.title}</p>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={req.confidence_score * 100}
                                  className="w-16 h-2"
                                />
                                <span className="text-xs text-muted-foreground w-8">
                                  {Math.round(req.confidence_score * 100)}%
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              Confidence Score: {Math.round(req.confidence_score * 100)}%
                            </TooltipContent>
                          </Tooltip>
                          <Badge variant="secondary" className={`text-xs ${config.color}`}>
                            {config.label}
                          </Badge>
                        </button>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-border">
                          <div className="pt-3">
                            <p className="text-sm text-foreground">{req.description}</p>
                          </div>

                          {req.source_excerpt && (
                            <div className="bg-muted/50 rounded-md p-3">
                              <p className="text-xs text-muted-foreground mb-1">
                                Source Excerpt:
                              </p>
                              <p className="text-sm italic text-foreground">
                                "{req.source_excerpt}"
                              </p>
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            {req.source && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <FileText className="h-3 w-3" />
                                <span>Source: {req.source.name}</span>
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(req.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};
