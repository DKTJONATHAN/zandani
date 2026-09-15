import { Component, type ReactNode, type ErrorInfo, useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/errors";

import Index from "./pages/Index";
const ArticlePage = lazy(() => import("./pages/ArticlePage"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const Trending = lazy(() => import("./pages/Trending"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const AdvertisePage = lazy(() => import("./pages/AdvertisePage"));
const CareersPage = lazy(() => import("./pages/CareersPage"));
const EthicsPage = lazy(() => import("./pages/EthicsPage"));
const CorrectionsPage = lazy(() => import("./pages/CorrectionsPage"));
const FactCheckPage = lazy(() => import("./pages/FactCheckPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const TagPage = lazy(() => import("./pages/TagPage"));
const SportsPage = lazy(() => import("./pages/SportsPage"));
const NewsPage = lazy(() => import("./pages/NewsPage"));
const EntertainmentPage = lazy(() => import("./pages/EntertainmentPage"));
const BusinessPage = lazy(() => import("./pages/BusinessPage"));
const LifestylePage = lazy(() => import("./pages/LifestylePage"));
const LiveScoresPage = lazy(() => import("./pages/LiveScoresPage"));
const LiveWirePage = lazy(() => import("./pages/LiveWirePage"));
const SitemapHtmlPage = lazy(() => import("./pages/SitemapHtmlPage"));
const AuthorsPage = lazy(() => import("./pages/AuthorsPage"));
const PodcastPage = lazy(() => import("./pages/PodcastPage"));
const TvPage = lazy(() => import("./pages/TvPage"));
const AuthorProfilePage = lazy(() => import("./pages/AuthorProfilePage"));
const HubPage = lazy(() => import("./pages/HubPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const NewsletterPage = lazy(() => import("./pages/NewsletterPage"));
const AiDebateRoom = lazy(() => import("./pages/AiDebateRoom"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  </div>
);

const ErrorFallback = ({ onRetry }: { onRetry: () => void }) => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center max-w-md mx-auto px-4">
      <h1 className="text-2xl font-serif font-bold text-foreground mb-4">Something went wrong</h1>
      <p className="text-muted-foreground mb-6">We encountered an error loading this page. Please try again.</p>
      <Button onClick={onRetry} className="gradient-primary text-primary-foreground">Try Again</Button>
    </div>
  </div>
);

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Page error:", error, errorInfo);
    reportError(error, { source: "ErrorBoundary", componentStack: errorInfo.componentStack });
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <ErrorFallback onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

const GlobalErrorHandler = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);
      reportError(event.reason, { source: "unhandledrejection" });
      if (event.reason?.message?.includes("Failed to fetch dynamically imported module")) {
        window.location.reload();
      }
    };
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  }, []);
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <GlobalErrorHandler>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/article/:slug" element={<ArticlePage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/newsletter" element={<NewsletterPage />} />
                <Route path="/ai-room" element={<AiDebateRoom />} />
                <Route path="/category/:slug" element={<CategoryPage />} />
                <Route path="/trending" element={<Trending />} />
                <Route path="/live" element={<LiveWirePage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/privacy-policy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/advertise" element={<AdvertisePage />} />
                <Route path="/careers" element={<CareersPage />} />
                <Route path="/ethics" element={<EthicsPage />} />
                <Route path="/corrections" element={<CorrectionsPage />} />
                <Route path="/fact-check" element={<FactCheckPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/tag/:tag" element={<TagPage />} />
                <Route path="/news" element={<NewsPage />} />
                <Route path="/entertainment" element={<EntertainmentPage />} />
                <Route path="/sports" element={<SportsPage />} />
                <Route path="/business" element={<BusinessPage />} />
                <Route path="/lifestyle" element={<LifestylePage />} />
                <Route path="/sports/live" element={<LiveScoresPage />} />
                <Route path="/sitemap" element={<SitemapHtmlPage />} />
                <Route path="/authors" element={<AuthorsPage />} />
                <Route path="/podcast" element={<PodcastPage />} />
                <Route path="/tv" element={<TvPage />} />
                <Route path="/author/:authorName" element={<AuthorProfilePage />} />
                <Route path="/energy" element={<HubPage />} />
                <Route path="/education" element={<HubPage />} />
                <Route path="/finance" element={<HubPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </GlobalErrorHandler>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
