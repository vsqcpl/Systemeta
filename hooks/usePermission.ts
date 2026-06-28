import { useAuth } from "./useAuth";
import {
  canAccessScreen,
  canDo as checkCanDo,
  hasFullAccess,
  isReadOnly as checkIsReadOnly,
  isOwnOnly as checkIsOwnOnly,
  isLimitedAccess,
  getScreenAccess,
} from "@/lib/permissionHelpers";
import { UserRole } from "@/lib/roles";

export function usePermission() {
  const { user } = useAuth();
  const role = (user?.role as UserRole) ?? null;

  return {
    role,
    canAccess:    (screen: string) => role ? canAccessScreen(screen, role) : false,
    canDo:        (action: string) => role ? checkCanDo(action, role) : false,
    isFull:       (screen: string) => role ? hasFullAccess(screen, role) : false,
    isReadOnly:   (screen: string) => role ? checkIsReadOnly(screen, role) : true,
    isOwnOnly:    (screen: string) => role ? checkIsOwnOnly(screen, role) : false,
    isLimited:    (screen: string) => role ? isLimitedAccess(screen, role) : false,
    accessLevel:  (screen: string) => role ? getScreenAccess(screen, role) : null,
  };
}
