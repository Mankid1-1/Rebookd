import { useParams } from "wouter";
import { INDUSTRIES } from "@/data/industries";
import { IndustryLandingPage } from "@/components/landing/IndustryLandingPage";
import NotFound from "./NotFound";

export default function IndustryLanding() {
  const { industry } = useParams<{ industry: string }>();
  const config = industry ? INDUSTRIES[industry] : undefined;

  if (!config) return <NotFound />;

  return <IndustryLandingPage config={config} />;
}
