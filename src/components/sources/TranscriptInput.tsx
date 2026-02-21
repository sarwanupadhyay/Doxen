import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, Loader2 } from "lucide-react";

interface TranscriptInputProps {
  onSubmit: (name: string, content: string) => Promise<any>;
}

export const TranscriptInput = ({ onSubmit }: TranscriptInputProps) => {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;

    setLoading(true);
    await onSubmit(name.trim(), content.trim());
    setLoading(false);
    setName("");
    setContent("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Meeting Transcript
        </CardTitle>
        <CardDescription>
          Paste meeting notes from Fireflies, Otter.ai, or any other source
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="transcript-name">Transcript Name</Label>
            <Input
              id="transcript-name"
              placeholder="e.g., Kickoff Meeting - Jan 15"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transcript-content">Transcript Content</Label>
            <Textarea
              id="transcript-content"
              placeholder="Paste your meeting transcript here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={loading}
              rows={8}
              className="font-mono text-sm"
            />
          </div>
          <Button
            type="submit"
            disabled={!name.trim() || !content.trim() || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Transcript"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
