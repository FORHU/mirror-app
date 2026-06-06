import { redirect } from "next/navigation";
import { ROUTES } from "@/navigation";

export default function CosmeticPage() {
  redirect(ROUTES.AI_RECOMMENDATION_COSMETIC_RECOMMENDATION);
}
