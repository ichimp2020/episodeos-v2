import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/i18n/LanguageProvider";

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-center">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-xl font-semibold">{t.notFound.title}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {t.notFound.description}
          </p>
          <Link href="/">
            <Button variant="secondary" className="mt-4" data-testid="button-go-home">
              {t.notFound.backToDashboard}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
