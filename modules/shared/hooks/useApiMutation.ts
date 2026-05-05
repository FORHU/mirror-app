import {
  useMutation,
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import { api } from "@/modules/shared/api/api-client";
import { ApiResponse } from "apisauce";

export interface ApiMutationArgs<TVariables> {
  endpoint: string;
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  data?: TVariables;
}

/**
 * A generic wrapper hook around React Query's `useMutation` to handle data
 * mutations (CREATE, UPDATE, DELETE) through our Apisauce client.
 */
export function useApiMutation<TData, TError = Error, TVariables = unknown>(
  options?: Omit<
    UseMutationOptions<TData, TError, ApiMutationArgs<TVariables>>,
    "mutationFn"
  >,
): UseMutationResult<TData, TError, ApiMutationArgs<TVariables>> {
  return useMutation<TData, TError, ApiMutationArgs<TVariables>>({
    mutationFn: async ({ endpoint, method = "POST", data }): Promise<TData> => {
      let response: ApiResponse<TData>;

      switch (method) {
        case "POST":
          response = await api.post<TData>(endpoint, data);
          break;
        case "PUT":
          response = await api.put<TData>(endpoint, data);
          break;
        case "PATCH":
          response = await api.patch<TData>(endpoint, data);
          break;
        case "DELETE":
          // The apisauce delete method signature expects data as the 3rd arg in some generic scenarios,
          // or just the endpoint and params. We cast to any here to satisfy the generic wrapper dynamically.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          response = await api.delete<TData>(endpoint, data as any);
          break;
        default:
          throw new Error(`Unsupported method: ${method}`);
      }

      if (!response.ok || !response.data) {
        throw new Error(
          response.problem || "An unexpected error occurred during mutation",
        );
      }

      return response.data;
    },
    ...options,
  });
}
