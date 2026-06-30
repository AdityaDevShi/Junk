import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api, type AppNotification } from "../lib/api";
import { BellIcon } from "./icons";

const STATUS_LABEL: Record<string, string> = {
  reported: "reported",
  acknowledged: "acknowledged",
  in_progress: "in progress",
  resolved: "resolved ✅",
  reopened: "reopened",
};

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    const unsub = api.subscribeNotifications(user.uid, setItems);
    return () => unsub();
  }, [user]);

  if (!user) return null;
  const unread = items.filter((n) => !n.read).length;

  function openItem(n: AppNotification) {
    void api.markNotificationRead(n.id);
    setOpen(false);
    navigate(`/issue/${n.issueId}`);
  }

  return (
    <div className="bell-wrap">
      <button
        className={`bell-btn${unread > 0 ? " has-unread" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
      >
        <BellIcon className="bell-ic" />
        {unread > 0 && <span className="bell-badge">{unread}</span>}
      </button>
      {open && (
        <div className="bell-menu">
          <div className="bell-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button
                className="link-btn"
                onClick={() =>
                  void api.markAllRead(items.filter((n) => !n.read).map((n) => n.id))
                }
              >
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 && <p className="muted small bell-empty">No notifications yet.</p>}
          {items.map((n) => (
            <button
              key={n.id}
              className={`bell-item${n.read ? "" : " unread"}`}
              onClick={() => openItem(n)}
            >
              <span className="bell-dot" />
              <span>
                Your report “{n.title}” is now <b>{STATUS_LABEL[n.status] || n.status}</b>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
