import { useQuery } from "@tanstack/react-query";
import apiClient from "@/api/client";

export interface Features {
  review: boolean;
  import: boolean;
  invite: boolean;
  llm: boolean;
  tm: boolean;
}

export const useFeatures = () => {
  return useQuery<Features>({
    queryKey: ["config", "features"],
    queryFn: async () => {
      const response = await apiClient.get("/config/features");
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    placeholderData: {
      review: false,
      import: false,
      invite: false,
      llm: false,
      tm: false,
    },
  });
};

export default useFeatures;
