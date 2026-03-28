export type AutomationCategory = "appointment" | "no_show" | "cancellation" | "follow_up" | "reactivation" | "welcome" | "loyalty";

export type AutomationKey = string;

export interface AutomationConfigField {
  key: string;
  label: string;
  type: "text" | "number" | "textarea" | "select";
  defaultValue: string | number;
  placeholder?: string;
  unit?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface AutomationTemplate {
  key: AutomationKey;
  name: string;
  description: string;
  category: AutomationCategory;
  icon: React.ElementType;
  recommended?: boolean;
  impact?: "high" | "medium" | "low";
  setupComplexity?: "low" | "medium" | "high";
  planRequired: string;
  defaultMessage: string;
  configFields: AutomationConfigField[];
}
