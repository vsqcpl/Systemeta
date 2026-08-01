"use client";

import React, { useState } from "react";
import ModalPortal from "@/components/ui/ModalPortal";
import { IconClose } from "@/components/ui/Icons";
import { Client } from "@/lib/data/types";
import { useTranslation } from "@/lib/store";

interface DeleteClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  onConfirm: (id: string) => Promise<boolean>;
}

export default function DeleteClientModal({
  isOpen,
  onClose,
  client,
  onConfirm,
}: DeleteClientModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onConfirm(client.id);
      onClose();
    } catch (err) {
      console.error("Failed to delete client:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "fadeIn 0.2s ease",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="card"
          style={{
            width: "100%",
            maxWidth: "460px",
            margin: "24px",
            animation: "cardEntrance 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="card-header" style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)" }}>
            <span className="card-title" style={{ color: "#ef4444" }}>
              {t("Delete Client")}
            </span>
            <button
              className="topbar-btn"
              onClick={onClose}
              style={{ width: "32px", height: "32px", minWidth: "32px", borderRadius: "8px" }}
            >
              <IconClose size={14} />
            </button>
          </div>

          <div className="card-body" style={{ padding: "20px 24px" }}>
            <p style={{ margin: 0, color: "var(--text-primary)", fontSize: "14px", lineHeight: "1.6" }}>
              {t("Are you sure you want to delete")} <strong>"{client.companyName}"</strong>?
            </p>
            
            <div
              style={{
                marginTop: "16px",
                padding: "12px",
                borderRadius: "8px",
                background: "#fef2f2",
                border: "1px solid #f87171",
                color: "#991b1b",
                fontSize: "13px",
                lineHeight: "1.5",
              }}
            >
              ℹ️ {t("This is a soft-delete operation. Historical invoices, milestones, and project relationships will be safely preserved.")}
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "24px" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onClose}
                disabled={loading}
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleDelete}
                disabled={loading}
                style={{ padding: "8px 20px" }}
              >
                {loading ? t("Deleting...") : t("Confirm Delete")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
