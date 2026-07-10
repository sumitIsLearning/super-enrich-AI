"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/lib/auth/client";
import { SignOutButton } from "@/components/sign-out-button";

//Enrich Specific Components
import { CSVUploader } from "@/components/super-enrich/csv-uploader";
import { UnifiedEnrichmentView } from "@/components/super-enrich/unified-enrichment-view";
import { EnrichmentTable } from "@/components/super-enrich/enrichment-table";
import { ProviderPicker } from "@/components/super-enrich/provider-picker";
import {
  PROVIDER_KEYS,
  providerIdsForSelection,
} from "@/lib/providers/client-keys";
import { CSVRow, EnrichmentField } from "@/lib/types";

// Import shared components
import HeroFlame from "@/components/shared/effects/flame/hero-flame";
import { HeaderProvider } from "@/components/shared/header/HeaderContext";

// Import hero section components
import HomeHeroBackground from "@/components/app/(home)/sections/hero/Background/Background";
import { BackgroundOuterPiece } from "@/components/app/(home)/sections/hero/Background/BackgroundOuterPiece";
import HomeHeroBadge from "@/components/app/(home)/sections/hero/Badge/Badge";
import HomeHeroPixi from "@/components/app/(home)/sections/hero/Pixi/Pixi";
import HomeHeroTitle from "@/components/app/(home)/sections/hero/Title/Title";
import HeroScraping from "@/components/app/(home)/sections/hero-scraping/HeroScraping";

// Import header components
import HeaderBrandKit from "@/components/shared/header/BrandKit/BrandKit";
import HeaderWrapper from "@/components/shared/header/Wrapper/Wrapper";
import HeaderDropdownWrapper from "@/components/shared/header/Dropdown/Wrapper/Wrapper";
import GithubIcon from "@/components/shared/header/Github/_svg/GithubIcon";
import ButtonUI from "@/components/shared/button/button";

// Ui Imports
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import Button from "@/components/shared/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Input from "@/components/ui/input";

export default function HomePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  useEffect(() => {
    if (!isPending && !session) router.push("/login");
  }, [isPending, session, router]);

  //enrich-states
  const [step, setStep] = useState<"upload" | "setup" | "enrichment">("upload");
  const [csvData, setCsvData] = useState<{
    rows: CSVRow[];
    columns: string[];
  } | null>(null);
  const [emailColumn, setEmailColumn] = useState<string>("");
  const [selectedFields, setSelectedFields] = useState<EnrichmentField[]>([]);
  const [isCheckingEnv, setIsCheckingEnv] = useState(true);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [scraperId, setScraperId] = useState("firecrawl");
  const [llmModelId, setLlmModelId] = useState("openai:gpt-4o");
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [missingProviders, setMissingProviders] = useState<string[]>([]);
  const [pendingEnrichment, setPendingEnrichment] = useState<{
    emailColumn: string;
    fields: EnrichmentField[];
  } | null>(null);
  const [chatEnabled, setChatEnabled] = useState(false);
  const [envStatus, setEnvStatus] = useState<Record<string, boolean>>({});
  // Bumped whenever a key is saved, so the picker's inline status re-computes.
  const [keysVersion, setKeysVersion] = useState(0);

  // Load which provider keys exist server-side, so the picker can show
  // per-provider key status inline.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/check-env");
        const data = await res.json();
        setEnvStatus(data.environmentStatus ?? {});
      } catch (error) {
        console.error("Error checking environment:", error);
      } finally {
        setIsCheckingEnv(false);
      }
    })();
  }, []);

  // Per-provider key status for the picker: server env key, browser-stored
  // key, or none. Recomputed when env loads or a key is saved.
  const keyStatus = useMemo(() => {
    void keysVersion; // recompute trigger: localStorage reads below aren't reactive
    const out: Record<string, "server" | "local" | "none"> = {};
    for (const id of Object.keys(PROVIDER_KEYS)) {
      const info = PROVIDER_KEYS[id];
      if (envStatus[info.envStatusKey]) out[id] = "server";
      else if (typeof window !== "undefined" && localStorage.getItem(info.localStorageKey))
        out[id] = "local";
      else out[id] = "none";
    }
    return out;
  }, [envStatus, keysVersion]);

  // Open the key modal for a single provider in edit mode (no pending
  // enrichment), so submitting just saves the key.
  const openKeyEditor = (id: string) => {
    setPendingEnrichment(null);
    setMissingProviders([id]);
    setKeyInputs((prev) => ({ ...prev, [id]: "" }));
    setShowApiKeyModal(true);
  };

  const handleCSVUpload = (rows: CSVRow[], columns: string[]) => {
    // Provider is not chosen yet at upload time, so no key gate here.
    setCsvData({ rows, columns });
    setStep("setup");
  };

  const handleStartEnrichment = async (
    email: string,
    fields: EnrichmentField[],
  ) => {
    const response = await fetch("/api/check-env");
    const data = await response.json();
    const has = (id: string) =>
      !!data.environmentStatus[PROVIDER_KEYS[id].envStatusKey] ||
      !!localStorage.getItem(PROVIDER_KEYS[id].localStorageKey);

    // Chat is hardcoded to Firecrawl + OpenAI; only show it when both keys exist.
    setChatEnabled(has("firecrawl") && has("openai"));

    const missing = providerIdsForSelection(scraperId, llmModelId).filter(
      (id) => !has(id),
    );
    if (missing.length > 0) {
      setPendingEnrichment({ emailColumn: email, fields });
      setMissingProviders(missing);
      setShowApiKeyModal(true);
      return;
    }

    setEmailColumn(email);
    setSelectedFields(fields);
    setStep("enrichment");
  };

  const handleBack = () => {
    if (step === "setup") {
      setStep("upload");
    } else if (step === "enrichment") {
      setStep("setup");
    }
  };

  const resetProcess = () => {
    setStep("upload");
    setCsvData(null);
    setEmailColumn("");
    setSelectedFields([]);
  };

  const handleApiKeySubmit = () => {
    for (const id of missingProviders) {
      if (!(keyInputs[id] ?? "").trim()) {
        toast.error(`Please enter a valid ${PROVIDER_KEYS[id].label} API key`);
        return;
      }
    }

    for (const id of missingProviders) {
      localStorage.setItem(PROVIDER_KEYS[id].localStorageKey, keyInputs[id].trim());
    }

    toast.success("API keys saved successfully!");
    setShowApiKeyModal(false);
    setKeysVersion((v) => v + 1);

    // Resume the enrichment the user was starting.
    if (pendingEnrichment) {
      setEmailColumn(pendingEnrichment.emailColumn);
      setSelectedFields(pendingEnrichment.fields);
      setStep("enrichment");
      setPendingEnrichment(null);
    }
  };

  return (
    <HeaderProvider>
      <div className="min-h-screen bg-background-base">
        {/* Header/Navigation Section */}
        <HeaderDropdownWrapper />
        <div className="sticky top-0 left-0 w-full z-[40] bg-background-base header">
          {step === "enrichment" ? (
            <div className="py-20 px-16 flex justify-between items-center">
              <div className="flex gap-24 items-center">
                <HeaderBrandKit />
              </div>
              <div className="flex gap-8 items-center">
                <a
                  className="contents"
                  href="https://github.com/sumitIsLearning/super-enrich-AI"
                  target="_blank"
                >
                  <ButtonUI variant="tertiary">
                    <GithubIcon />
                    View on GitHub
                  </ButtonUI>
                </a>
                <SignOutButton />
              </div>
            </div>
          ) : (
            <HeaderWrapper>
              <div className="max-w-[900px] mx-auto w-full flex justify-between items-center">
                <div className="flex gap-24 items-center">
                  <HeaderBrandKit />
                </div>
                <div className="flex gap-8 items-center">
                  <a
                    className="contents"
                    href="https://github.com/sumitIsLearning/super-enrich-AI"
                    target="_blank"
                  >
                    <ButtonUI variant="tertiary">
                      <GithubIcon />
                      View on GitHub
                    </ButtonUI>
                  </a>
                  <SignOutButton />
                </div>
              </div>
            </HeaderWrapper>
          )}
        </div>

        {/* Hero Section */}
        <section className="overflow-x-clip" id="home-hero">
          <div
            className={`pt-28 lg:pt-254 lg:-mt-100 ${step === "upload" ? "pb-115" : "pb-20"} relative `}
            id="hero-content"
          >
            <HomeHeroPixi />
            <HeroFlame />

            <HomeHeroBackground />

            <AnimatePresence mode="wait">
              {step == "upload" ? (
                <motion.div
                  key="hero"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5 }}
                  className="relative container px-16"
                >
                  <HomeHeroBadge />
                  <HomeHeroTitle />

                  <p className="text-center text-body-large">
                    Enrich you leads with clean & accurate data
                    <br className="lg-max:hidden" />
                    crawled from all over the internet.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="enrichment-process"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    ease: [0.22, 1, 0.36, 1]
                  }}
                  className="relative container px-8 lg:px-16"
                >
                  <div className="text-center mb-8 lg:mb-12">
                    <HomeHeroBadge />
                    <div className="mb-6">
                      <h1 className="text-title-h2 lg:text-title-h1 text-zinc-900 mb-4">
                        {step === "setup"
                          ? "Configure Enrichment"
                          : "Enrichment Results"}
                      </h1>
                      <p className="text-center text-body-large text-gray-600">
                        {step === "setup"
                          ? "Select the fields you want to enrich and configure your settings"
                          : "Your enriched data is ready. Click on any row to view detailed information"}
                      </p>
                    </div>
                  </div>

                  {step === "setup" && (
                    <div className="w-full max-w-7xl mx-auto relative z-[11] lg:z-[2]">
                      <div
                        className="bg-accent-white rounded-lg p-6 lg:p-10"
                        style={{
                          boxShadow:
                            "0px 0px 44px 0px rgba(0, 0, 0, 0.02), 0px 88px 56px -20px rgba(0, 0, 0, 0.03), 0px 56px 56px -20px rgba(0, 0, 0, 0.02), 0px 32px 32px -20px rgba(0, 0, 0, 0.03), 0px 16px 24px -12px rgba(0, 0, 0, 0.03), 0px 0px 0px 1px rgba(0, 0, 0, 0.05), 0px 0px 0px 10px #F9F9F9",
                        }}
                      >
                        {csvData && (
                          <div className="w-full space-y-6">
                            <ProviderPicker
                              scraperId={scraperId}
                              llmModelId={llmModelId}
                              onScraperChange={setScraperId}
                              onLlmChange={setLlmModelId}
                              keyStatus={keyStatus}
                              onManageKey={openKeyEditor}
                            />
                            <UnifiedEnrichmentView
                              rows={csvData.rows}
                              columns={csvData.columns}
                              onStartEnrichment={handleStartEnrichment}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {step === "enrichment" && csvData && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{
                        duration: 0.6,
                        ease: [0.22, 1, 0.36, 1] // Custom cubic-bezier for smooth easing
                      }}
                      className="fixed inset-0 top-[72px] z-50 bg-background-base"
                    >
                      <EnrichmentTable
                        rows={csvData.rows}
                        fields={selectedFields}
                        emailColumn={emailColumn}
                        scraperId={scraperId}
                        llmModelId={llmModelId}
                        chatEnabled={chatEnabled}
                      />
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {step == "upload" && (
            <motion.div
              className="container lg:contents !p-16 relative -mt-90"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="max-w-400 lg:min-w-700 mx-auto w-full relative z-[11] lg:z-[2] rounded-20 -mt-30 lg:-mt-98">
                <div
                  className="overlay bg-accent-white"
                  style={{
                    boxShadow:
                      "0px 0px 44px 0px rgba(0, 0, 0, 0.02), 0px 88px 56px -20px rgba(0, 0, 0, 0.03), 0px 56px 56px -20px rgba(0, 0, 0, 0.02), 0px 32px 32px -20px rgba(0, 0, 0, 0.03), 0px 16px 24px -12px rgba(0, 0, 0, 0.03), 0px 0px 0px 1px rgba(0, 0, 0, 0.05), 0px 0px 0px 10px #F9F9F9",
                  }}
                />

                <div className="p-16 flex flex-col justify-center relative lg:min-w-[700px]">
                  {isCheckingEnv ? (
                    <div className="text-center py-10">
                      <Loader2 style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }} className="animate-spin text-primary mx-auto mb-4" />
                      <p className="text-body-small text-muted-foreground">
                        Initializing...
                      </p>
                    </div>
                  ) : (
                    <div className="w-full">
                      <CSVUploader onUpload={handleCSVUpload} />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
          {step === "upload" && (
            <div className="flex items-center justify-center">
              <div className="hidden md:block">
                <BackgroundOuterPiece />
              </div>
              <HeroScraping />
            </div>
          )}
        </section>
      </div>
      {/*Dialog Input for BYOK*/}
      <Dialog open={showApiKeyModal} onOpenChange={setShowApiKeyModal}>
        <DialogContent
          className="sm:max-w-md rounded-md p-16"
          style={{ backgroundColor: "var(--accent-white)" }}
        >
          <DialogHeader>
            <DialogTitle>
              {pendingEnrichment ? "API Keys Required" : "Update API Key"}
            </DialogTitle>
            <DialogDescription>
              {pendingEnrichment
                ? "Enter an API key for each selected provider to enrich your CSV data."
                : "Enter a new key to replace the one stored in this browser."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            {missingProviders.map((id) => {
              const info = PROVIDER_KEYS[id];
              return (
                <div key={id} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor={`${id}-key`}
                      className="text-body-small font-medium"
                    >
                      {info.label} API Key
                    </label>
                    <a
                      href={info.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-body-small text-black-alpha-56"
                    >
                      <ExternalLink style={{ width: '16px', height: '16px', minWidth: '16px', minHeight: '16px' }} />
                      Get {info.label} key
                    </a>
                  </div>
                  <Input
                    id={`${id}-key`}
                    type="password"
                    placeholder={info.placeholder}
                    value={keyInputs[id] ?? ""}
                    onChange={(e) =>
                      setKeyInputs((prev) => ({ ...prev, [id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleApiKeySubmit();
                    }}
                  />
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setShowApiKeyModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApiKeySubmit}
              disabled={missingProviders.some(
                (id) => !(keyInputs[id] ?? "").trim(),
              )}
              variant="primary"
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HeaderProvider>
  );
}
