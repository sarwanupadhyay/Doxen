import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Mail, MessageSquare, Upload, Trash2, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { DataSource, SourceType } from "@/hooks/useDataSources";

interface SourcesListProps {
  sources: DataSource[];
  onDelete: (id: string) => void;
}

const sourceIcons: Record<SourceType, typeof FileText> = {
  document: Upload,
  gmail: Mail,
  slack: MessageSquare,
  transcript: FileText,
};

const sourceLabels: Record<SourceType, string> = {
  document: "Document",
  gmail: "Gmail",
  slack: "Slack",
  transcript: "Transcript",
};

export const SourcesList = ({ sources, onDelete }: SourcesListProps) => {
  if (sources.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <FolderOpen className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg mb-1">No data sources yet</CardTitle>
          <CardDescription className="text-center max-w-sm">
            Add documents, transcripts, or connect Gmail/Slack to start extracting requirements.
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Sources ({sources.length})</CardTitle>
        <CardDescription>
          All imported data that will be analyzed for requirements
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sources.map((source) => {
            const Icon = sourceIcons[source.source_type];
            return (
              <div
                key={source.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{source.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      {sourceLabels[source.source_type]}
                    </Badge>
                    <span>•</span>
                    <span>{format(new Date(source.created_at), "MMM d, yyyy")}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(source.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
