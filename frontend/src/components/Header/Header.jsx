import { useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { IconSettings } from "../icons.jsx";
import { useIndexProgress } from "../../hooks/useIndexProgress";
import "./Header.css";

function Header({ onSettingsClick, settingsDisabled = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const progress = useIndexProgress();
  const isRunning = progress?.state === "running";

  const triggerSearchFocus = () => {
    if (location.pathname !== "/") {
      navigate("/?focus=true");
    } else {
      window.dispatchEvent(new CustomEvent("uriel:focus-search"));
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        triggerSearchFocus();
      } else if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        triggerSearchFocus();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  });

  const statusText = isRunning
    ? progress.total_files > 0
      ? `Indexing ${progress.processed_files}/${progress.total_files}...`
      : "Indexing..."
    : "Live Sync Active";

  return (
    <header className="header">
      <div className="header-left">
        <NavLink to="/" className="header-logo-link">
          <span className="header-logo-symbol">✦</span>
          <span className="header-brand-name">URIEL</span>
          <span className="header-pro-badge">PRO</span>
        </NavLink>

        <nav className="header-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `header-nav-item ${isActive ? "is-active" : ""}`
            }
          >
            Search & AI
          </NavLink>
          <NavLink
            to="/vault"
            className={({ isActive }) =>
              `header-nav-item ${isActive ? "is-active" : ""}`
            }
          >
            Document Vault
          </NavLink>
          <NavLink
            to="/analytics"
            className={({ isActive }) =>
              `header-nav-item ${isActive ? "is-active" : ""}`
            }
          >
            IR Analytics
          </NavLink>
        </nav>
      </div>

      <div className="header-right">
        <button
          type="button"
          className="header-kbd-hint"
          onClick={triggerSearchFocus}
          title="Click or press Ctrl+K anywhere to search"
        >
          <kbd>Ctrl</kbd> + <kbd>K</kbd>
        </button>

        <div className="header-status" title="Real-time directory watcher & FastEmbed active">
          <span className={`header-status-dot ${isRunning ? "is-busy" : ""}`} />
          <span>{statusText}</span>
        </div>

        <button
          className="settings-button"
          type="button"
          onClick={onSettingsClick}
          disabled={settingsDisabled}
          title={settingsDisabled ? "Complete setup first" : "Engine Settings"}
          aria-label="Settings"
        >
          <IconSettings size={18} />
        </button>
      </div>
    </header>
  );
}

export default Header;
