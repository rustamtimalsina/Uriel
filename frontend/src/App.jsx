import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./components/Header/Header";
import SettingsModal from "./components/Settings/SettingsModal";
import DirectorySetupModal from "./components/DirectorySetup/DirectorySetupModal";
import OnboardingFlow from "./components/Onboarding/OnboardingFlow";
import SearchPage from "./pages/SearchPage";
import DocumentPage from "./pages/DocumentPage";
import VaultPage from "./pages/VaultPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import { getConfig } from "./services/api";
import "./App.css";

function App() {
  const [config, setConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDirectorySetupOpen, setIsDirectorySetupOpen] = useState(false);

  // Either "backend unreachable at startup" or "onboarding never completed"
  // route here — only the entry step differs.
  const [onboardingStartStep, setOnboardingStartStep] = useState(null);

  const loadConfig = () => {
    setConfigLoading(true);
    getConfig()
      .then((response) => {
        const data = {
          ...response.data,
          directories: response.data.directories ?? [],
        };
        setConfig(data);
        setConfigError(null);

        if (!data.onboarding?.completed) {
          setOnboardingStartStep(1);
        } else if (data.directories.length === 0) {
          setIsDirectorySetupOpen(true);
        }
      })
      .catch((err) => {
        setConfigError(err.message);
        setOnboardingStartStep(2); // jump straight to the fixable step
      })
      .finally(() => {
        setConfigLoading(false);
      });
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleConfigUpdate = (updatedConfig) => {
    setConfig(updatedConfig);
  };

  const handleDirectoryAdded = (newDirectory) => {
    setConfig((prev) => ({
      ...prev,
      directories: [...prev.directories, newDirectory],
    }));
  };

  const handleOnboardingComplete = () => {
    setOnboardingStartStep(null);
    loadConfig();
  };

  return (
    <BrowserRouter>
      <div className="app">
        <Header
          onSettingsClick={() => setIsSettingsOpen(true)}
          settingsDisabled={!!onboardingStartStep}
        />

        {configLoading && (
          <p className="status-message">Loading configuration...</p>
        )}
        {configError && !onboardingStartStep && (
          <p className="error-message">{configError}</p>
        )}

        {!configLoading && config && !onboardingStartStep && (
          <>
            <Routes>
              <Route path="/" element={<SearchPage config={config} />} />
              <Route path="/vault" element={<VaultPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/document/:docId" element={<DocumentPage />} />
            </Routes>

            <SettingsModal
              isOpen={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
              config={config}
              onConfigUpdate={handleConfigUpdate}
            />

            <DirectorySetupModal
              isOpen={isDirectorySetupOpen}
              onClose={() => setIsDirectorySetupOpen(false)}
              onDirectoryAdded={handleDirectoryAdded}
            />
          </>
        )}

        {!configLoading && onboardingStartStep && (
          <OnboardingFlow
            startStep={onboardingStartStep}
            onComplete={handleOnboardingComplete}
          />
        )}
      </div>
    </BrowserRouter>
  );
}

export default App;
