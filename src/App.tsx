import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import NotFound from "./pages/NotFound";
import {
  NetworkId,
  WalletManager,
  WalletProvider,
  WalletId,
} from '@txnlab/use-wallet-react';
import { WalletUIProvider } from '@txnlab/use-wallet-ui-react';
import algosdk from "algosdk";
import React from "react";
import Layout from "./components/Layout";
import { AppDisplayModeProvider } from "./contexts/AppDisplayModeContext";
import { HeroLogoVisibilityProvider } from "./contexts/HeroLogoVisibilityContext";
import { NavigationHistoryProvider } from "./contexts/NavigationHistoryContext";
import NewWebsite from "./pages/NewWebsite"; // Import the new page

const queryClient = new QueryClient();

// Explicitly create an algodClient instance using a public node
const algodClient = new algosdk.Algodv2(
  "", // No token needed for this public node
  "https://mainnet-api.algonode.cloud",
  "" // Port is included in the URL
);

// Configure the wallets you want to use
const walletManager = new WalletManager({
  wallets: [
    WalletId.PERA,
    WalletId.DEFLY,
    WalletId.LUTE,
  ],
  algodClient, // Provide the explicit client to the manager
  defaultNetwork: NetworkId.MAINNET,
});

const App = () => {
  // Enforce dark mode globally
  React.useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <WalletProvider manager={walletManager}>
          <WalletUIProvider>
            <AppDisplayModeProvider>
              <HeroLogoVisibilityProvider>
                <BrowserRouter>
                  <NavigationHistoryProvider>
                    <Routes>
                      {/* A rota raiz agora renderiza o Layout com NewWebsite como seu filho */}
                      <Route path="/*" element={<Layout><NewWebsite /></Layout>} />
                      {/* A rota NotFound ainda é mantida para URLs inválidas */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </NavigationHistoryProvider>
                </BrowserRouter>
              </HeroLogoVisibilityProvider>
            </AppDisplayModeProvider>
          </WalletUIProvider>
        </WalletProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;