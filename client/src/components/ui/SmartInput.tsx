import * as React from "react";
import { Input } from "./input";
import { Label } from "./label";
import { HelpTooltip } from "./HelpTooltip";
import { Alert, AlertDescription } from "./alert";
import { CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";

interface SmartInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  success?: string;
  hint?: string;
  helpText?: string;
  showPasswordToggle?: boolean;
  validationIcon?: boolean;
  containerClassName?: string;
}

export function SmartInput({
  label,
  error,
  success,
  hint,
  helpText,
  showPasswordToggle = false,
  validationIcon = true,
  containerClassName = "",
  type = "text",
  id,
  className = "",
  ...props
}: SmartInputProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const inputId = id || `input-${React.useId()}`;

  const inputType = type === "password" && showPassword ? "text" : type;
  const hasError = !!error;
  const hasSuccess = !!success && !error;
  const showValidationIcon = validationIcon && (hasError || hasSuccess);

  const handleTogglePassword = () => {
    setShowPassword(prev => !prev);
  };

  return (
    <div className={`space-y-2 ${containerClassName}`}>
      <div className="flex items-center gap-2">
        <Label 
          htmlFor={inputId}
          className={`text-sm font-medium ${
            hasError ? "text-destructive" : 
            hasSuccess ? "text-green-600" : 
            ""
          }`}
        >
          {label}
        </Label>
        
        {helpText && (
          <HelpTooltip content={helpText} variant="help">
            <span />
          </HelpTooltip>
        )}
      </div>

      <div className="relative">
        <Input
          id={inputId}
          type={inputType}
          className={`pr-10 transition-colors ${
            hasError ? "border-destructive focus:border-destructive" :
            hasSuccess ? "border-green-500 focus:border-green-500" :
            isFocused ? "border-primary" : ""
          } ${className}`}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          aria-invalid={hasError}
          aria-describedby={
            hasError ? `${inputId}-error` : 
            success ? `${inputId}-success` : 
            hint ? `${inputId}-hint` : undefined
          }
          {...props}
        />

        {/* Validation Icon */}
        {showValidationIcon && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {hasError && (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
            {hasSuccess && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
          </div>
        )}

        {/* Password Toggle */}
        {showPasswordToggle && type === "password" && (
          <button
            type="button"
            onClick={handleTogglePassword}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Error Message */}
      {hasError && (
        <Alert variant="destructive" className="py-2 px-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Success Message */}
      {hasSuccess && (
        <Alert className="py-2 px-3 border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-xs text-green-800">
            {success}
          </AlertDescription>
        </Alert>
      )}

      {/* Hint */}
      {hint && !error && !success && (
        <p className="text-xs text-muted-foreground" id={`${inputId}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}

// Phone number input with formatting
export function PhoneInput(props: Omit<SmartInputProps, "type">) {
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
  };

  return (
    <SmartInput
      {...props}
      type="tel"
      placeholder="(555) 123-4567"
      onChange={(e) => {
        const formatted = formatPhoneNumber(e.target.value);
        e.target.value = formatted;
        props.onChange?.(e);
      }}
      maxLength={14}
    />
  );
}

// Email input with validation
export function EmailInput(props: Omit<SmartInputProps, "type">) {
  return (
    <SmartInput
      {...props}
      type="email"
      placeholder="you@example.com"
      autoComplete="email"
    />
  );
}
