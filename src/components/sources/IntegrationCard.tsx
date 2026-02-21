import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";

interface IntegrationCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  connected?: boolean;
  comingSoon?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export const IntegrationCard = ({
  icon: Icon,
  title,
  description,
  connected = false,
  comingSoon = false,
  onConnect,
  onDisconnect,
}: IntegrationCardProps) => {
  return (
    <Card className={comingSoon ? "opacity-50" : "hover:border-primary/30 transition-all duration-300"}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            {title}
          </CardTitle>
          {connected && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              Connected
            </Badge>
          )}
          {comingSoon && (
            <Badge variant="outline" className="border-border/40 text-muted-foreground">Coming Soon</Badge>
          )}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {comingSoon ? (
          <Button variant="outline" disabled className="w-full">Connect</Button>
        ) : connected ? (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onConnect}>Import Data</Button>
            <Button variant="ghost" onClick={onDisconnect}>Disconnect</Button>
          </div>
        ) : (
          <Button variant="outline" className="w-full" onClick={onConnect}>Connect</Button>
        )}
      </CardContent>
    </Card>
  );
};
