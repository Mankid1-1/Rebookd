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
            hasSuccess ? "text-success" :
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
            hasSuccess ? "border-success focus:border-success" :
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
              <CheckCircle className="h-4 w-4 text-success" />
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
        <Alert className="py-2 px-3 border-success/20 bg-success/5">
          <CheckCircle className="h-4 w-4 text-success" />
          <AlertDescription className="text-xs text-success">
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

// Comprehensive country dial codes — popular countries first, then alphabetical
const COUNTRY_CODES = [
  // Popular / English-speaking
  { code: "US", dial: "+1", flag: "\u{1F1FA}\u{1F1F8}", name: "United States" },
  { code: "GB", dial: "+44", flag: "\u{1F1EC}\u{1F1E7}", name: "United Kingdom" },
  { code: "CA", dial: "+1", flag: "\u{1F1E8}\u{1F1E6}", name: "Canada" },
  { code: "AU", dial: "+61", flag: "\u{1F1E6}\u{1F1FA}", name: "Australia" },
  { code: "NZ", dial: "+64", flag: "\u{1F1F3}\u{1F1FF}", name: "New Zealand" },
  { code: "IE", dial: "+353", flag: "\u{1F1EE}\u{1F1EA}", name: "Ireland" },
  { code: "ZA", dial: "+27", flag: "\u{1F1FF}\u{1F1E6}", name: "South Africa" },
  // Europe
  { code: "DE", dial: "+49", flag: "\u{1F1E9}\u{1F1EA}", name: "Germany" },
  { code: "FR", dial: "+33", flag: "\u{1F1EB}\u{1F1F7}", name: "France" },
  { code: "ES", dial: "+34", flag: "\u{1F1EA}\u{1F1F8}", name: "Spain" },
  { code: "IT", dial: "+39", flag: "\u{1F1EE}\u{1F1F9}", name: "Italy" },
  { code: "NL", dial: "+31", flag: "\u{1F1F3}\u{1F1F1}", name: "Netherlands" },
  { code: "PT", dial: "+351", flag: "\u{1F1F5}\u{1F1F9}", name: "Portugal" },
  { code: "PL", dial: "+48", flag: "\u{1F1F5}\u{1F1F1}", name: "Poland" },
  { code: "SE", dial: "+46", flag: "\u{1F1F8}\u{1F1EA}", name: "Sweden" },
  { code: "NO", dial: "+47", flag: "\u{1F1F3}\u{1F1F4}", name: "Norway" },
  { code: "DK", dial: "+45", flag: "\u{1F1E9}\u{1F1F0}", name: "Denmark" },
  { code: "FI", dial: "+358", flag: "\u{1F1EB}\u{1F1EE}", name: "Finland" },
  { code: "BE", dial: "+32", flag: "\u{1F1E7}\u{1F1EA}", name: "Belgium" },
  { code: "AT", dial: "+43", flag: "\u{1F1E6}\u{1F1F9}", name: "Austria" },
  { code: "CH", dial: "+41", flag: "\u{1F1E8}\u{1F1ED}", name: "Switzerland" },
  { code: "GR", dial: "+30", flag: "\u{1F1EC}\u{1F1F7}", name: "Greece" },
  { code: "CZ", dial: "+420", flag: "\u{1F1E8}\u{1F1FF}", name: "Czech Republic" },
  { code: "RO", dial: "+40", flag: "\u{1F1F7}\u{1F1F4}", name: "Romania" },
  { code: "HU", dial: "+36", flag: "\u{1F1ED}\u{1F1FA}", name: "Hungary" },
  { code: "HR", dial: "+385", flag: "\u{1F1ED}\u{1F1F7}", name: "Croatia" },
  { code: "BG", dial: "+359", flag: "\u{1F1E7}\u{1F1EC}", name: "Bulgaria" },
  { code: "SK", dial: "+421", flag: "\u{1F1F8}\u{1F1F0}", name: "Slovakia" },
  { code: "RS", dial: "+381", flag: "\u{1F1F7}\u{1F1F8}", name: "Serbia" },
  { code: "UA", dial: "+380", flag: "\u{1F1FA}\u{1F1E6}", name: "Ukraine" },
  { code: "RU", dial: "+7", flag: "\u{1F1F7}\u{1F1FA}", name: "Russia" },
  { code: "IS", dial: "+354", flag: "\u{1F1EE}\u{1F1F8}", name: "Iceland" },
  { code: "LU", dial: "+352", flag: "\u{1F1F1}\u{1F1FA}", name: "Luxembourg" },
  // Americas
  { code: "MX", dial: "+52", flag: "\u{1F1F2}\u{1F1FD}", name: "Mexico" },
  { code: "BR", dial: "+55", flag: "\u{1F1E7}\u{1F1F7}", name: "Brazil" },
  { code: "AR", dial: "+54", flag: "\u{1F1E6}\u{1F1F7}", name: "Argentina" },
  { code: "CO", dial: "+57", flag: "\u{1F1E8}\u{1F1F4}", name: "Colombia" },
  { code: "CL", dial: "+56", flag: "\u{1F1E8}\u{1F1F1}", name: "Chile" },
  { code: "PE", dial: "+51", flag: "\u{1F1F5}\u{1F1EA}", name: "Peru" },
  { code: "VE", dial: "+58", flag: "\u{1F1FB}\u{1F1EA}", name: "Venezuela" },
  { code: "EC", dial: "+593", flag: "\u{1F1EA}\u{1F1E8}", name: "Ecuador" },
  { code: "CR", dial: "+506", flag: "\u{1F1E8}\u{1F1F7}", name: "Costa Rica" },
  { code: "PA", dial: "+507", flag: "\u{1F1F5}\u{1F1E6}", name: "Panama" },
  { code: "DO", dial: "+1", flag: "\u{1F1E9}\u{1F1F4}", name: "Dominican Republic" },
  { code: "PR", dial: "+1", flag: "\u{1F1F5}\u{1F1F7}", name: "Puerto Rico" },
  { code: "JM", dial: "+1", flag: "\u{1F1EF}\u{1F1F2}", name: "Jamaica" },
  { code: "TT", dial: "+1", flag: "\u{1F1F9}\u{1F1F9}", name: "Trinidad & Tobago" },
  // Asia
  { code: "IN", dial: "+91", flag: "\u{1F1EE}\u{1F1F3}", name: "India" },
  { code: "JP", dial: "+81", flag: "\u{1F1EF}\u{1F1F5}", name: "Japan" },
  { code: "KR", dial: "+82", flag: "\u{1F1F0}\u{1F1F7}", name: "South Korea" },
  { code: "CN", dial: "+86", flag: "\u{1F1E8}\u{1F1F3}", name: "China" },
  { code: "SG", dial: "+65", flag: "\u{1F1F8}\u{1F1EC}", name: "Singapore" },
  { code: "PH", dial: "+63", flag: "\u{1F1F5}\u{1F1ED}", name: "Philippines" },
  { code: "MY", dial: "+60", flag: "\u{1F1F2}\u{1F1FE}", name: "Malaysia" },
  { code: "TH", dial: "+66", flag: "\u{1F1F9}\u{1F1ED}", name: "Thailand" },
  { code: "ID", dial: "+62", flag: "\u{1F1EE}\u{1F1E9}", name: "Indonesia" },
  { code: "VN", dial: "+84", flag: "\u{1F1FB}\u{1F1F3}", name: "Vietnam" },
  { code: "PK", dial: "+92", flag: "\u{1F1F5}\u{1F1F0}", name: "Pakistan" },
  { code: "BD", dial: "+880", flag: "\u{1F1E7}\u{1F1E9}", name: "Bangladesh" },
  { code: "LK", dial: "+94", flag: "\u{1F1F1}\u{1F1F0}", name: "Sri Lanka" },
  { code: "NP", dial: "+977", flag: "\u{1F1F3}\u{1F1F5}", name: "Nepal" },
  { code: "TW", dial: "+886", flag: "\u{1F1F9}\u{1F1FC}", name: "Taiwan" },
  { code: "HK", dial: "+852", flag: "\u{1F1ED}\u{1F1F0}", name: "Hong Kong" },
  // Middle East
  { code: "AE", dial: "+971", flag: "\u{1F1E6}\u{1F1EA}", name: "UAE" },
  { code: "SA", dial: "+966", flag: "\u{1F1F8}\u{1F1E6}", name: "Saudi Arabia" },
  { code: "IL", dial: "+972", flag: "\u{1F1EE}\u{1F1F1}", name: "Israel" },
  { code: "TR", dial: "+90", flag: "\u{1F1F9}\u{1F1F7}", name: "Turkey" },
  { code: "QA", dial: "+974", flag: "\u{1F1F6}\u{1F1E6}", name: "Qatar" },
  { code: "KW", dial: "+965", flag: "\u{1F1F0}\u{1F1FC}", name: "Kuwait" },
  { code: "BH", dial: "+973", flag: "\u{1F1E7}\u{1F1ED}", name: "Bahrain" },
  { code: "OM", dial: "+968", flag: "\u{1F1F4}\u{1F1F2}", name: "Oman" },
  { code: "JO", dial: "+962", flag: "\u{1F1EF}\u{1F1F4}", name: "Jordan" },
  { code: "LB", dial: "+961", flag: "\u{1F1F1}\u{1F1E7}", name: "Lebanon" },
  { code: "EG", dial: "+20", flag: "\u{1F1EA}\u{1F1EC}", name: "Egypt" },
  // Africa
  { code: "NG", dial: "+234", flag: "\u{1F1F3}\u{1F1EC}", name: "Nigeria" },
  { code: "KE", dial: "+254", flag: "\u{1F1F0}\u{1F1EA}", name: "Kenya" },
  { code: "GH", dial: "+233", flag: "\u{1F1EC}\u{1F1ED}", name: "Ghana" },
  { code: "TZ", dial: "+255", flag: "\u{1F1F9}\u{1F1FF}", name: "Tanzania" },
  { code: "UG", dial: "+256", flag: "\u{1F1FA}\u{1F1EC}", name: "Uganda" },
  { code: "ET", dial: "+251", flag: "\u{1F1EA}\u{1F1F9}", name: "Ethiopia" },
  { code: "MA", dial: "+212", flag: "\u{1F1F2}\u{1F1E6}", name: "Morocco" },
  { code: "TN", dial: "+216", flag: "\u{1F1F9}\u{1F1F3}", name: "Tunisia" },
  { code: "SN", dial: "+221", flag: "\u{1F1F8}\u{1F1F3}", name: "Senegal" },
  { code: "CI", dial: "+225", flag: "\u{1F1E8}\u{1F1EE}", name: "Ivory Coast" },
  { code: "CM", dial: "+237", flag: "\u{1F1E8}\u{1F1F2}", name: "Cameroon" },
  { code: "ZW", dial: "+263", flag: "\u{1F1FF}\u{1F1FC}", name: "Zimbabwe" },
  { code: "RW", dial: "+250", flag: "\u{1F1F7}\u{1F1FC}", name: "Rwanda" },
  { code: "MU", dial: "+230", flag: "\u{1F1F2}\u{1F1FA}", name: "Mauritius" },
];

// Phone number input with compact country code square and searchable dropdown
export function PhoneInput(props: Omit<SmartInputProps, "type">) {
  const [selectedCountry, setSelectedCountry] = React.useState(COUNTRY_CODES[0]);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  // Focus search input when dropdown opens
  React.useEffect(() => {
    if (dropdownOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [dropdownOpen]);

  const filteredCountries = React.useMemo(() => {
    if (!search) return COUNTRY_CODES;
    const q = search.toLowerCase();
    return COUNTRY_CODES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [search]);

  // Sync the hidden form value with dial code + local number
  const updateFormValue = React.useCallback((localNumber: string, country: typeof COUNTRY_CODES[0]) => {
    const digits = localNumber.replace(/[^\d]/g, "");
    if (!digits) {
      if (props.onChange) {
        const syntheticEvent = { target: { value: "", name: props.name } } as React.ChangeEvent<HTMLInputElement>;
        props.onChange(syntheticEvent);
      }
      return;
    }
    const fullNumber = `${country.dial}${digits}`;
    if (props.onChange) {
      const syntheticEvent = { target: { value: fullNumber, name: props.name } } as React.ChangeEvent<HTMLInputElement>;
      props.onChange(syntheticEvent);
    }
  }, [props.onChange, props.name]);

  const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d\s\-()]/g, "");
    e.target.value = raw;
    updateFormValue(raw, selectedCountry);
  };

  const handleCountrySelect = (country: typeof COUNTRY_CODES[0]) => {
    setSelectedCountry(country);
    setDropdownOpen(false);
    setSearch("");
    const currentLocal = inputRef.current?.value || "";
    updateFormValue(currentLocal, country);
    inputRef.current?.focus();
  };

  const { onChange, value, label, error, success, hint, helpText, validationIcon, containerClassName, showPasswordToggle, ...inputProps } = props;

  return (
    <div className={`space-y-2 ${containerClassName || ""}`}>
      <div className="flex items-center gap-2">
        <Label className={`text-sm font-medium ${error ? "text-destructive" : success ? "text-success" : ""}`}>
          {label}
        </Label>
        {helpText && (
          <HelpTooltip content={helpText} variant="help">
            <span />
          </HelpTooltip>
        )}
      </div>

      <div className="flex gap-1.5">
        {/* Compact country code square */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="h-10 w-[72px] rounded-md border border-input bg-background px-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring flex items-center justify-center gap-1 hover:bg-accent/50 transition-colors"
            aria-label="Select country code"
            aria-expanded={dropdownOpen}
          >
            <span className="text-base leading-none">{selectedCountry.flag}</span>
            <span className="text-xs text-muted-foreground font-medium">{selectedCountry.dial}</span>
            <svg className="h-3 w-3 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 max-h-60 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
              {/* Search */}
              <div className="p-2 border-b border-border">
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search country..."
                  className="w-full h-8 px-2.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setDropdownOpen(false);
                      setSearch("");
                    }
                    if (e.key === "Enter" && filteredCountries.length > 0) {
                      handleCountrySelect(filteredCountries[0]);
                    }
                  }}
                />
              </div>
              {/* Country list */}
              <div className="overflow-y-auto max-h-48">
                {filteredCountries.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No countries found</div>
                ) : (
                  filteredCountries.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleCountrySelect(c)}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-accent/50 transition-colors text-left ${
                        c.code === selectedCountry.code ? "bg-accent/30 font-medium" : ""
                      }`}
                    >
                      <span className="text-base leading-none w-5 text-center">{c.flag}</span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{c.dial}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <Input
          ref={inputRef}
          type="tel"
          placeholder="Phone number"
          className={`flex-1 ${error ? "border-destructive focus:border-destructive" : success ? "border-success focus:border-success" : ""}`}
          onChange={handleLocalChange}
          maxLength={15}
          aria-invalid={!!error}
          {...inputProps}
        />
      </div>

      {error && (
        <Alert variant="destructive" className="py-2 px-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}
      {success && !error && (
        <Alert className="py-2 px-3 border-success/20 bg-success/5">
          <CheckCircle className="h-4 w-4 text-success" />
          <AlertDescription className="text-xs text-success">{success}</AlertDescription>
        </Alert>
      )}
      {hint && !error && !success && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
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
