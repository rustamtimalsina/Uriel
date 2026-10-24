//src/components/Setings/SettingsModal.jsx
import { useState, useEffect } from "react";
import {
  getIndexStats,
  getIndexStatus,
  rebuildIndex,
  updatePreprocessingConfig,
  updateRankingConfig,
  updateQueryExpansionConfig,
  addDirectory,
  removeDirectory,
} from "../../services/api";
import { IconTrash, IconPlus, IconRefresh } from "../icons.jsx";
import "./SettingsModal.css";

function SettingsModal({ isOpen, onClose, config, onConfigUpdate }) {
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [preprocessingForm, setPreprocessingForm] = useState(null);
  const [rankingForm, setRankingForm] = useState(null);
  const [queryExpansionForm, setQueryExpansionForm] = useState(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [reindexMessage, setReindexMessage] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildSuccess, setRebuildSuccess] = useState(null);

  const [newDirPath, setNewDirPath] = useState("");
  const [addingDir, setAddingDir] = useState(false);
  const [addDirError, setAddDirError] = useState(null);
  const [removingDirId, setRemovingDirId] = useState(null);
  const [removeDirError, setRemoveDirError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);
  useEffect(() => {
    if (!isOpen) return;
    // Seed local editable form state from the shared config each time the
    // modal opens, so Cancel always reverts to the current source of truth.
    setPreprocessingForm(structuredClone(config.preprocessing));
    setRankingForm(structuredClone(config.ranking));
    setQueryExpansionForm(structuredClone(config.query_expansion));
    setSaveError(null);
    setReindexMessage(null);
    setSaveSuccess(false);
    setRebuildSuccess(null);

    setStatsLoading(true);
    setStatsError(null);

    getIndexStats()
      .then((response) => {
        setStats(response.data);
      })
      .catch((err) => {
        setStatsError(err.message);
      })
      .finally(() => {
        setStatsLoading(false);
      });
  }, [isOpen, config]);

  if (!isOpen) {
    return null;
  }
  

  const handlePreprocessingChange = (field, value) => {
    setPreprocessingForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLemmaToggle = (value) => {
    setPreprocessingForm((prev) => ({
      ...prev,
      use_lemma: value,
      use_stemming: value ? false : prev.use_stemming,
    }));
  };

  const handleStemmingToggle = (value) => {
    setPreprocessingForm((prev) => ({
      ...prev,
      use_stemming: value,
      use_lemma: value ? false : prev.use_lemma,
    }));
  };

  const handleRankingChange = (field, value) => {
    setRankingForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBm25Change = (field, value) => {
    setRankingForm((prev) => ({
      ...prev,
      bm25: { ...prev.bm25, [field]: value },
    }));
  };

  const handleQueryExpansionChange = (field, value) => {
    setQueryExpansionForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleRocchioChange = (field, value) => {
    setQueryExpansionForm((prev) => ({
      ...prev,
      rocchio: { ...prev.rocchio, [field]: value },
    }));
  };

  const handleCancel = () => {
    onClose();
  };

  const handleAddDirectory = (e) => {
    e.preventDefault();

    if (!newDirPath.trim()) {
      return;
    }

    setAddingDir(true);
    setAddDirError(null);

    addDirectory(newDirPath.trim())
      .then((response) => {
        onConfigUpdate({
          ...config,
          directories: [...config.directories, response.data],
        });
        setNewDirPath("");
        setReindexMessage(
          "A new directory was added. Rebuild the index to make its documents searchable."
        );
      })
      .catch((err) => {
        const detail = err.response?.data?.detail;
        setAddDirError(typeof detail === "string" ? detail : err.message);
      })
      .finally(() => {
        setAddingDir(false);
      });
  };

  const handleRemoveDirectory = (dirId) => {
    setRemovingDirId(dirId);
    setRemoveDirError(null);

    removeDirectory(dirId)
      .then(() => {
        onConfigUpdate({
          ...config,
          directories: config.directories.filter((dir) => dir.id !== dirId),
        });
        setReindexMessage(
          "A directory was removed. Rebuild the index to remove its documents from search results."
        );
      })
      .catch((err) => {
        const detail = err.response?.data?.detail;
        setRemoveDirError(typeof detail === "string" ? detail : err.message);
      })
      .finally(() => {
        setRemovingDirId(null);
      });
  };

  const isEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const hasChanges =
    preprocessingForm &&
    rankingForm &&
    queryExpansionForm &&
    (!isEqual(preprocessingForm, config.preprocessing) ||
      !isEqual(rankingForm, config.ranking) ||
      !isEqual(queryExpansionForm, config.query_expansion));

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    setReindexMessage(null);

    try {
      const preprocessingChanged = !isEqual(
        preprocessingForm,
        config.preprocessing
      );

      const rankingChanged = !isEqual(rankingForm, config.ranking);

      const queryExpansionChanged = !isEqual(
        queryExpansionForm,
        config.query_expansion
      );

      if (!preprocessingChanged && !rankingChanged && !queryExpansionChanged) {
        onClose();
        return;
      }

      let updatedPreprocessing = config.preprocessing;
      let updatedRanking = config.ranking;
      let updatedQueryExpansion = config.query_expansion;

      if (preprocessingChanged) {
        const res = await updatePreprocessingConfig(preprocessingForm);
        updatedPreprocessing = res.data.config.preprocessing;
        if (res.data.reindex_required) {
          setReindexMessage(res.data.message);
        }
      }

      if (rankingChanged) {
        const res = await updateRankingConfig(rankingForm);
        updatedRanking = res.data.config.ranking;
      }

      if (queryExpansionChanged) {
        const res = await updateQueryExpansionConfig(queryExpansionForm);
        updatedQueryExpansion = res.data.config.query_expansion;
      }

      setPreprocessingForm(updatedPreprocessing);
      setRankingForm(updatedRanking);
      setQueryExpansionForm(updatedQueryExpansion);

      onConfigUpdate({
        ...config,
        preprocessing: updatedPreprocessing,
        ranking: updatedRanking,
        query_expansion: updatedQueryExpansion,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      if (preprocessingChanged) {
        // keep modal open so the user can rebuild
      } else {
        onClose();
      }
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const pollUntilDone = () => {
    return new Promise((resolve, reject) => {
      const check = () => {
        getIndexStatus()
          .then((res) => {
            if (res.data.state === "running") {
              setTimeout(check, 1000);
            } else if (res.data.state === "error") {
              reject(new Error(res.data.error || "Indexing failed"));
            } else {
              resolve(res.data);
            }
          })
          .catch(reject);
      };
      check();
    });
  };

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      const startResp = await rebuildIndex();
      if (startResp.data.status !== "started") {
        throw new Error("Failed to start rebuild.");
      }

      setReindexMessage(null);
      const finalStatus = await pollUntilDone();
      // NOTE: previously this message was set with the reindexed count, then
      // immediately overwritten by a second, generic setRebuildSuccess call
      // right below it — the count was computed and thrown away. Fixed to
      // keep the informative version.
      setRebuildSuccess(
        `Index rebuilt successfully. ${finalStatus.indexed_files} documents indexed` +
          (finalStatus.skipped.length ? `, ${finalStatus.skipped.length} skipped.` : ".")
      );

      const statsResponse = await getIndexStats();
      setStats(statsResponse.data);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" type="button" onClick={onClose}>
            ×
          </button>
        </div>

        {statsLoading && <p className="settings-status">Loading settings...</p>}
        {statsError && <p className="settings-error">{statsError}</p>}

        {!statsLoading &&
          !statsError &&
          config &&
          stats &&
          preprocessingForm &&
          rankingForm &&
          queryExpansionForm && (
            <>
              <div className="settings-content">
                <section className="settings-section">
                  <h3>Preprocessing</h3>

                  <div className="settings-row">
                    <label>Engine</label>
                    <select
                      className="settings-select"
                      value={preprocessingForm.engine}
                      onChange={(e) =>
                        handlePreprocessingChange("engine", e.target.value)
                      }
                    >
                      <option value="spacy">spacy</option>
                      <option value="traditional">traditional</option>
                    </select>
                  </div>

                  <div className="settings-row">
                    <label>Spacy Model</label>
                    <select
                      className="settings-select"
                      value={preprocessingForm.spacy_model}
                      onChange={(e) =>
                        handlePreprocessingChange("spacy_model", e.target.value)
                      }
                    >
                      <option value="en_core_web_sm">en_core_web_sm</option>
                    </select>
                  </div>

                  <div className="settings-row">
                    <label>Lowercase</label>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={preprocessingForm.lowercase}
                        onChange={(e) =>
                          handlePreprocessingChange("lowercase", e.target.checked)
                        }
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="settings-row">
                    <label>Remove Stopwords</label>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={preprocessingForm.remove_stopwords}
                        onChange={(e) =>
                          handlePreprocessingChange(
                            "remove_stopwords",
                            e.target.checked
                          )
                        }
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="settings-row">
                    <label>Use Lemma</label>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={preprocessingForm.use_lemma}
                        onChange={(e) => handleLemmaToggle(e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="settings-row">
                    <label>Use Stemming</label>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={preprocessingForm.use_stemming}
                        onChange={(e) => handleStemmingToggle(e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="settings-row">
                    <label>Keep POS Tags</label>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={preprocessingForm.keep_pos_tags}
                        onChange={(e) =>
                          handlePreprocessingChange(
                            "keep_pos_tags",
                            e.target.checked
                          )
                        }
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="settings-row">
                    <label>Keep Noun Chunks</label>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={preprocessingForm.keep_noun_chunks}
                        onChange={(e) =>
                          handlePreprocessingChange(
                            "keep_noun_chunks",
                            e.target.checked
                          )
                        }
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </section>

                <section className="settings-section">
                  <h3>Ranking</h3>

                  <div className="settings-row">
                    <label>Default Algorithm</label>
                    <select
                      className="settings-select"
                      value={rankingForm.default_algorithm}
                      onChange={(e) =>
                        handleRankingChange("default_algorithm", e.target.value)
                      }
                    >
                      <option value="bm25">bm25</option>
                      <option value="tfidf">tfidf</option>
                    </select>
                  </div>

                  <div className="settings-row">
                    <label>Default Top K</label>
                    <input
                      className="settings-input-number"
                      type="number"
                      value={rankingForm.default_top_k}
                      onChange={(e) =>
                        handleRankingChange(
                          "default_top_k",
                          Number(e.target.value)
                        )
                      }
                    />
                  </div>

                  <div className="settings-row">
                    <label>BM25 k1</label>
                    <input
                      className="settings-input-number"
                      type="number"
                      step="0.01"
                      value={rankingForm.bm25.k1}
                      onChange={(e) =>
                        handleBm25Change("k1", Number(e.target.value))
                      }
                    />
                  </div>

                  <div className="settings-row">
                    <label>BM25 b</label>
                    <input
                      className="settings-input-number"
                      type="number"
                      step="0.01"
                      value={rankingForm.bm25.b}
                      onChange={(e) =>
                        handleBm25Change("b", Number(e.target.value))
                      }
                    />
                  </div>
                </section>

                <section className="settings-section">
                  <h3>Query Expansion</h3>

                  <div className="settings-row">
                    <label>WordNet Enabled</label>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={queryExpansionForm.wordnet_enabled}
                        onChange={(e) =>
                          handleQueryExpansionChange(
                            "wordnet_enabled",
                            e.target.checked
                          )
                        }
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="settings-row">
                    <label>Max Synonyms Per Term</label>
                    <input
                      className="settings-input-number"
                      type="number"
                      value={queryExpansionForm.wordnet_max_synonyms_per_term}
                      onChange={(e) =>
                        handleQueryExpansionChange(
                          "wordnet_max_synonyms_per_term",
                          Number(e.target.value)
                        )
                      }
                    />
                  </div>

                  <div className="settings-row">
                    <label>Synonym Weight</label>
                    <input
                      className="settings-input-number"
                      type="number"
                      step="0.01"
                      value={queryExpansionForm.wordnet_synonym_weight}
                      onChange={(e) =>
                        handleQueryExpansionChange(
                          "wordnet_synonym_weight",
                          Number(e.target.value)
                        )
                      }
                    />
                  </div>

                  <div className="settings-row">
                    <label>Rocchio Alpha</label>
                    <input
                      className="settings-input-number"
                      type="number"
                      step="0.01"
                      value={queryExpansionForm.rocchio.alpha}
                      onChange={(e) =>
                        handleRocchioChange("alpha", Number(e.target.value))
                      }
                    />
                  </div>

                  <div className="settings-row">
                    <label>Rocchio Beta</label>
                    <input
                      className="settings-input-number"
                      type="number"
                      step="0.01"
                      value={queryExpansionForm.rocchio.beta}
                      onChange={(e) =>
                        handleRocchioChange("beta", Number(e.target.value))
                      }
                    />
                  </div>

                  <div className="settings-row">
                    <label>Rocchio Gamma</label>
                    <input
                      className="settings-input-number"
                      type="number"
                      step="0.01"
                      value={queryExpansionForm.rocchio.gamma}
                      onChange={(e) =>
                        handleRocchioChange("gamma", Number(e.target.value))
                      }
                    />
                  </div>
                </section>

                <section className="settings-section">
                  <h3>Index</h3>

                  <div className="settings-row">
                    <label>Indexed Documents</label>
                    <span className="settings-static-value">{stats.documents}</span>
                  </div>

                  <div className="settings-row">
                    <label>Vocabulary Size</label>
                    <span className="settings-static-value">
                      {stats.vocabulary_size}
                    </span>
                  </div>
                </section>

                <section className="settings-section">
                  <h3>Watched Directories</h3>
                  {config.directories.length === 0 ? (
                    <p className="settings-empty">No directories configured.</p>
                  ) : (
                    <ul className="settings-directory-list">
                      {config.directories.map((dir) => (
                        <li key={dir.id} className="settings-directory-item">
                          <span className="settings-directory-path">
                            {dir.path} {dir.is_default && "(default)"}
                          </span>
                          <button
                            type="button"
                            className="icon-button is-danger"
                            onClick={() => handleRemoveDirectory(dir.id)}
                            disabled={removingDirId === dir.id}
                            title="Remove directory"
                            aria-label="Remove directory"
                          >
                            <IconTrash size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {removeDirError && (
                    <p className="settings-error">{removeDirError}</p>
                  )}

                  <form
                    className="settings-add-directory-form"
                    onSubmit={handleAddDirectory}
                  >
                    <input
                      type="text"
                      className="settings-add-directory-input"
                      placeholder="Enter an absolute path to add"
                      value={newDirPath}
                      onChange={(e) => setNewDirPath(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="icon-button"
                      disabled={addingDir || !newDirPath.trim()}
                      title="Add directory"
                      aria-label="Add directory"
                    >
                      {addingDir ? (
                        <IconRefresh size={14} className="spin" />
                      ) : (
                        <IconPlus size={14} />
                      )}
                    </button>
                  </form>
                  {addDirError && <p className="settings-error">{addDirError}</p>}
                </section>
              </div>

              {reindexMessage && (
                <div className="settings-reindex">
                  <span className="settings-reindex-icon">
                    <IconRefresh size={14} />
                  </span>
                  <p className="settings-reindex-message">{reindexMessage}</p>
                  <button
                    className="settings-rebuild-button"
                    onClick={handleRebuild}
                    disabled={rebuilding}
                  >
                    {rebuilding ? "Rebuilding..." : "Rebuild Index"}
                  </button>
                </div>
              )}
              {rebuildSuccess && <p className="settings-success">{rebuildSuccess}</p>}
              {saveSuccess && <p className="settings-success">Settings saved.</p>}
              {saveError && <p className="settings-error">{saveError}</p>}

              <div className="settings-footer">
                <button
                  className="settings-cancel-button"
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="settings-save-button"
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                >
                  {saving ? "Saving..." : hasChanges ? "Save Changes" : "No Changes"}
                </button>
              </div>
            </>
          )}
      </div>
    </div>
  );
}

export default SettingsModal;