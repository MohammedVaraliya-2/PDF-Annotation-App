import type { User } from "../types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserSwitcherProps {
  currentUser: User;
  onUserChange: (user: User) => void;
}

const AVAILABLE_USERS: User[] = [
  { id: "A1", name: "Admin (A1)", role: "admin" },
  { id: "D1", name: "Default User (D1)", role: "default" },
  { id: "D2", name: "Default User (D2)", role: "default" },
  { id: "R1", name: "Read-Only (R1)", role: "readonly" },
];

export function UserSwitcher({ currentUser, onUserChange }: UserSwitcherProps) {
  const handleUserSelection = (selectedId: string) => {
    const selectedUser = AVAILABLE_USERS.find((user) => user.id === selectedId);
    if (selectedUser) onUserChange(selectedUser);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground font-medium">
        Current User:
      </span>

      <Select value={currentUser.id} onValueChange={handleUserSelection}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select user" />
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_USERS.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
