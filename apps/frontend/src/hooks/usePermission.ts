import { useAppStore } from "@/store/useAppStore";
import { useFeatures } from "./useFeatures";

export type UserRole = "ADMIN" | "EDITOR" | "REVIEWER" | "VIEWER";

export const usePermission = () => {
  const { user } = useAppStore();
  const { data: features, isLoading: featuresLoading } = useFeatures();

  return {
    user,
    features,
    isLoading: featuresLoading,
    canReview: user?.role === "REVIEWER" || user?.role === "ADMIN",
    canPublish: user?.role === "ADMIN",
    canManageMembers: user?.role === "ADMIN",
    canEdit: user?.role === "EDITOR" || user?.role === "ADMIN",
  };
};

export default usePermission;
