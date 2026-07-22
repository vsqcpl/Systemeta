"use client";

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { Edit2, Trash2, Plus, MapPin } from "lucide-react";

export default function OfficesManager() {
  const [offices, setOffices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffice, setEditingOffice] = useState<any>(null);
  
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  const showToast = useAppStore((state) => state.showToast);
  const setGlobalOffices = useAppStore((state) => state.setOffices);

  const fetchOffices = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/offices");
      if (res.ok) {
        const data = await res.json();
        setOffices(data);
        setGlobalOffices(data);
      }
    } catch (error) {
      showToast("Failed to fetch offices", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffices();
  }, []);

  const openModal = (office?: any) => {
    if (office) {
      setEditingOffice(office);
      setName(office.name);
      setAddress(office.address);
    } else {
      setEditingOffice(null);
      setName("");
      setAddress("");
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address) {
      return showToast("Name and address are required", "warning");
    }
    
    try {
      const method = editingOffice ? "PUT" : "POST";
      const url = editingOffice ? `/api/offices/${editingOffice.id}` : "/api/offices";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address })
      });
      
      if (res.ok) {
        showToast(`Office ${editingOffice ? 'updated' : 'added'} successfully`, "success");
        setIsModalOpen(false);
        fetchOffices();
      } else {
        showToast(`Failed to save office`, "danger");
      }
    } catch (err) {
      showToast("Error saving office", "danger");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this office?")) return;
    try {
      const res = await fetch(`/api/offices/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Office deleted", "success");
        fetchOffices();
      }
    } catch (err) {
      showToast("Failed to delete office", "danger");
    }
  };

  return (
    <div className="card">
      <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="card-title">Manage Offices</span>
        <button className="btn btn-primary btn-sm" onClick={() => openModal()}>
          <Plus size={16} /> Add Office
        </button>
      </div>
      <div className="card-body">
        {loading ? (
          <p>Loading offices...</p>
        ) : offices.length === 0 ? (
          <p className="text-secondary" style={{ textAlign: "center", padding: "20px" }}>No offices found. Add one above.</p>
        ) : (
          <div className="table-responsive">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Address</th>
                  <th style={{ width: "120px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {offices.map((office) => (
                  <tr key={office.id}>
                    <td><strong>{office.name}</strong></td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <MapPin size={14} className="text-secondary" /> {office.address}
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openModal(office)}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(office.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
        }}>
          <div className="card" style={{ width: "420px", maxWidth: "90%", padding: "24px", animation: "slideUp 0.3s ease-out" }}>
            <h3 style={{ marginTop: 0, marginBottom: "20px", color: "var(--text-primary)" }}>
              {editingOffice ? "Edit Office" : "Add Office"}
            </h3>
            
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "8px" }}>Office Name</label>
                <input
                  type="text"
                  className="input premium-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mumbai HQ"
                  style={{ width: "100%", height: "38px" }}
                  required
                />
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "8px" }}>Full Address</label>
                <textarea
                  className="input premium-input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Full street address..."
                  style={{ width: "100%", minHeight: "80px", resize: "vertical" }}
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingOffice ? "Update" : "Save"} Office</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
