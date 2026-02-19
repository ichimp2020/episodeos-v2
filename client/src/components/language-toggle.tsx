import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageProvider";

export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleLanguage}
      className="rounded-xl text-xs font-bold"
      data-testid="button-language-toggle"
    >
      {language === "en" ? "עב" : "EN"}
    </Button>
  );
}
