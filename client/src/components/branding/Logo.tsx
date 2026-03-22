import React from "react";

interface LogoProps {
  variant?: "primary" | "stacked" | "icon" | "wordmark";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const Logo = ({ variant = "primary", size = "md", className = "" }: LogoProps) => {
  const sizeMap = {
    sm: { width: variant === "icon" ? 24 : 120, height: variant === "icon" ? 24 : 24 },
    md: { width: variant === "icon" ? 32 : 160, height: variant === "icon" ? 32 : 32 },
    lg: { width: variant === "icon" ? 48 : 200, height: variant === "icon" ? 48 : 48 },
    xl: { width: variant === "icon" ? 64 : 240, height: variant === "icon" ? 64 : 64 },
  };

  const logoFiles = {
    primary: "/assets/branding/rebooked-logo-primary.svg",
    stacked: "/assets/branding/rebooked-logo-stacked.svg",
    icon: "/assets/branding/rebooked-icon.svg",
    wordmark: "/assets/branding/rebooked-wordmark.svg",
  };

  const { width, height } = sizeMap[size];

  return (
    <img
      src={logoFiles[variant]}
      alt="Rebooked - Revenue Recovery Automation"
      width={width}
      height={height}
      className={`logo-${variant} ${className}`}
      style={{ display: "block" }}
    />
  );
};

export default Logo;
