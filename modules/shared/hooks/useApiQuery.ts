import {
  useQuery,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { api } from "@/modules/shared/api/api-client";
import { ApiResponse } from "apisauce";

/**
 * A generic wrapper hook around React Query's `useQuery` specifically designed
 * to work with our Apisauce client. It automatically extracts the 'data'
 * from the Apisauce response and throws an error if the request fails,
 * enabling React Query's error boundaries and retries.
 */
export function useApiQuery<TData, TError = Error>(
  queryKey: unknown[],
  endpoint: string,
  options?: Omit<UseQueryOptions<TData, TError>, "queryKey" | "queryFn">,
): UseQueryResult<TData, TError> {
  return useQuery<TData, TError>({
    queryKey,
    queryFn: async (): Promise<TData> => {
      // Extract params from the second element of the queryKey, if it's an object
      const params =
        queryKey.length > 1 &&
        queryKey[1] &&
        typeof queryKey[1] === "object" &&
        !Array.isArray(queryKey[1])
          ? (queryKey[1] as Record<string, unknown>)
          : undefined;
      const response: ApiResponse<TData> = await api.get<TData>(
        endpoint,
        params,
      );

      if (!response.ok || !response.data) {
        // Throwing an error delegates handling to React Query's error states
        throw new Error(response.problem || "An unexpected error occurred");
      }

      return response.data;
    },
    ...options,
  });
}
