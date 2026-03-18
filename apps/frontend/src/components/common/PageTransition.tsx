import React from "react";

interface PageTransitionProps {
  children: React.ReactNode;
  mode?: "fade" | "slide" | "scale" | "slideUp";
  duration?: number;
}

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  mode = "fade",
  duration = 300,
}) => {
  const [displayChildren, setDisplayChildren] = React.useState(children);
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const [animationClass, setAnimationClass] = React.useState("page-enter");

  React.useEffect(() => {
    if (children !== displayChildren) {
      setIsTransitioning(true);
      setAnimationClass("page-exit");

      const timer = setTimeout(() => {
        setDisplayChildren(children);
        setAnimationClass("page-enter");

        const enterTimer = setTimeout(() => {
          setIsTransitioning(false);
        }, duration);

        return () => clearTimeout(enterTimer);
      }, duration / 2);

      return () => clearTimeout(timer);
    }
  }, [children, displayChildren, duration]);

  const getTransitionStyles = () => {
    const baseStyles: React.CSSProperties = {
      transition: `all ${duration}ms var(--ease-out)`,
    };

    switch (mode) {
      case "fade":
        return {
          ...baseStyles,
          opacity: animationClass === "page-enter" ? 1 : 0,
        };
      case "slide":
        return {
          ...baseStyles,
          opacity: animationClass === "page-enter" ? 1 : 0,
          transform:
            animationClass === "page-enter"
              ? "translateX(0)"
              : "translateX(-20px)",
        };
      case "scale":
        return {
          ...baseStyles,
          opacity: animationClass === "page-enter" ? 1 : 0,
          transform:
            animationClass === "page-enter" ? "scale(1)" : "scale(0.98)",
        };
      case "slideUp":
        return {
          ...baseStyles,
          opacity: animationClass === "page-enter" ? 1 : 0,
          transform:
            animationClass === "page-enter"
              ? "translateY(0)"
              : "translateY(20px)",
        };
      default:
        return baseStyles;
    }
  };

  return (
    <div
      style={{
        ...getTransitionStyles(),
        willChange: isTransitioning ? "opacity, transform" : "auto",
      }}
    >
      {displayChildren}
    </div>
  );
};

// Staggered children animation wrapper
interface StaggerContainerProps {
  children: React.ReactNode;
  staggerDelay?: number;
  initialDelay?: number;
}

export const StaggerContainer: React.FC<StaggerContainerProps> = ({
  children,
  staggerDelay = 0.05,
  initialDelay = 0,
}) => {
  return (
    <div className="stagger-container">
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return child;

        return (
          <div
            style={{
              opacity: 0,
              animation: `slideUp 0.4s var(--ease-out) ${initialDelay + index * staggerDelay}s forwards`,
            }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
};

// Animated list item
interface AnimatedListItemProps {
  children: React.ReactNode;
  index: number;
  delay?: number;
}

export const AnimatedListItem: React.FC<AnimatedListItemProps> = ({
  children,
  index,
  delay = 0.03,
}) => {
  return (
    <div
      style={{
        opacity: 0,
        animation: `slideUp 0.3s var(--ease-out) ${index * delay}s forwards`,
      }}
    >
      {children}
    </div>
  );
};

// Fade in wrapper
interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
}

export const FadeIn: React.FC<FadeInProps> = ({
  children,
  delay = 0,
  duration = 300,
  direction = "up",
  distance = 20,
}) => {
  const getTransform = () => {
    switch (direction) {
      case "up":
        return `translateY(${distance}px)`;
      case "down":
        return `translateY(-${distance}px)`;
      case "left":
        return `translateX(${distance}px)`;
      case "right":
        return `translateX(-${distance}px)`;
      case "none":
        return "none";
    }
  };

  return (
    <div
      style={{
        opacity: 0,
        transform: getTransform(),
        animation: `fadeIn ${duration}ms var(--ease-out) ${delay}s forwards,
                   ${direction !== "none" ? `slideUp` : "none"} ${duration}ms var(--ease-out) ${delay}s forwards`,
      }}
    >
      {children}
    </div>
  );
};

// Loading spinner with animation
interface LoadingSpinnerProps {
  size?: "small" | "medium" | "large";
  color?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "medium",
  color = "var(--color-primary)",
}) => {
  const sizeMap = {
    small: 16,
    medium: 24,
    large: 32,
  };

  const pixelSize = sizeMap[size];

  return (
    <div
      style={{
        width: pixelSize,
        height: pixelSize,
        border: `2px solid ${color}20`,
        borderTopColor: color,
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}
    />
  );
};

// Pulse animation wrapper for loading states
interface PulseProps {
  children: React.ReactNode;
}

export const Pulse: React.FC<PulseProps> = ({ children }) => {
  return (
    <div
      style={{
        animation: "pulse 2s ease-in-out infinite",
      }}
    >
      {children}
    </div>
  );
};

export default PageTransition;
