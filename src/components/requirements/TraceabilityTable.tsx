import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Mail, MessageSquare, Upload } from "lucide-react";
import { ExtractedRequirement } from "@/hooks/useRequirements";

interface TraceabilityTableProps {
  requirements: ExtractedRequirement[];
}

const sourceIcons: Record<string, typeof FileText> = {
  document: Upload,
  gmail: Mail,
  slack: MessageSquare,
  transcript: FileText,
};

export const TraceabilityTable = ({ requirements }: TraceabilityTableProps) => {
  if (requirements.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Traceability Matrix</CardTitle>
        <CardDescription>
          Every requirement traced back to its source with confidence scores
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requirement</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Confidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requirements.map((req) => {
              const sourceType = req.source?.source_type || "document";
              const Icon = sourceIcons[sourceType] || FileText;
              
              return (
                <TableRow key={req.id}>
                  <TableCell className="font-medium max-w-xs truncate">
                    {req.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {req.category.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {req.source ? (
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm truncate max-w-[150px]">
                          {req.source.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Unknown</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Progress
                        value={req.confidence_score * 100}
                        className="w-16 h-2"
                      />
                      <span className="text-sm text-muted-foreground w-10">
                        {Math.round(req.confidence_score * 100)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
