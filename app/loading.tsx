import React from "react";
import { AppLoader } from "@/modules/shared/components/AppLoader";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center">
      <AppLoader />
    </div>
  );
}
