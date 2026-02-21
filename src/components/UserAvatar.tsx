import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  avatarUrl: string | null;
  initials: string;
  size?: "sm" | "md";
  className?: string;
}

const UserAvatar = ({ avatarUrl, initials, size = "sm", className }: UserAvatarProps) => {
  const sizeClass = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <Avatar className={cn(sizeClass, "border border-border/40 shrink-0", className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile" />}
      <AvatarFallback className="bg-primary/20 text-primary font-semibold">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};

export default UserAvatar;
