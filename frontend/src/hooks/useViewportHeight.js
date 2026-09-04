import { useEffect } from "react";

export default function useViewportHeight() {
  useEffect(() => {
    const setHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${height}px`);
    };

    setHeight();
    window.visualViewport?.addEventListener("resize", setHeight);
    window.addEventListener("resize", setHeight);

    return () => {
      window.visualViewport?.removeEventListener("resize", setHeight);
      window.removeEventListener("resize", setHeight);
    };
  }, []);
}